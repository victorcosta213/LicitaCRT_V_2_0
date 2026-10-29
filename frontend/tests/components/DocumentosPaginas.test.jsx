// Lista de documentos, escolha de modelo e conferência de autenticidade.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const h = vi.hoisted(() => ({
  auth: {}, doc: {}, processos: [], criar: vi.fn(), verificar: vi.fn(), erro: vi.fn(),
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/components/useDocumentos', () => ({ useDocumentos: () => h.doc }))
vi.mock('../../src/components/useTramitacao', () => ({ useTramitacao: () => ({ processos: h.processos }) }))
vi.mock('../../src/components/documentos/useContextoDocumento', () => ({ useContextoDocumento: () => ({ pronto: true, ctx: { numero: '' } }) }))
vi.mock('../../src/utils/alerts', () => ({ showError: h.erro, showSuccess: vi.fn(), showConfirm: vi.fn() }))
vi.mock('../../src/services/documentos', async (importOriginal) => ({
  ...(await importOriginal()),
  criarDocumento: h.criar,
  verificarDocumento: h.verificar,
}))

import Documentos from '../../src/pages/Documentos'
import DocumentoNovo from '../../src/pages/DocumentoNovo'
import Verificar from '../../src/pages/Verificar'

const Local = () => { const l = useLocation(); return <output data-testid="local">{l.pathname + l.search}</output> }
const doc = (extra) => ({
  id: 'd1', numero: 'OF-2026/000001', titulo: 'Ofício de teste', modelo: 'oficio', status: 'rascunho', versao: 1,
  criado_por: 'eu', criado_por_nome: 'Ana', unidade_id: 'u1', processo_id: null, atualizado_em: '2026-10-29T12:00:00Z', ...extra,
})

beforeEach(() => {
  localStorage.clear()
  h.auth = { role: 'compras', user: { id: 'eu' }, profile: { id: 'eu', unidade_id: 'u1' } }
  h.doc = { carregando: false, erro: null, ausente: false, documentos: [], assinaturas: [] }
  h.processos = []
  h.criar.mockReset().mockResolvedValue('novo-id')
  h.verificar.mockReset()
  h.erro.mockReset()
})

function lista(rota = '/documentos') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/documentos" element={<><Documentos /><Local /></>} />
        <Route path="/documentos/novo" element={<div>tela de novo</div>} />
        <Route path="/documentos/:id" element={<div>detalhe aberto</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('lista de documentos', () => {
  it('sem documentos, convida a criar o primeiro', () => {
    lista()
    expect(screen.getByText(/Ainda não há documentos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Criar o primeiro documento/ })).toHaveAttribute('href', '/documentos/novo')
  })

  it('quem não cria documentos não vê o botão de novo', () => {
    h.auth.role = 'perfil_inexistente'
    lista()
    expect(screen.queryByRole('link', { name: /Novo documento/ })).toBeNull()
  })

  it('mostra os documentos, avisa "Assine" e põe aguardando assinatura primeiro', () => {
    h.doc.documentos = [
      doc({ id: 'a', numero: 'OF-2026/000002', status: 'assinado' }),
      doc({ id: 'b', numero: 'OF-2026/000003', status: 'aguardando_assinatura', criado_por: 'outro' }),
    ]
    h.doc.assinaturas = [{ id: 's', documento_id: 'b', usuario_id: 'eu', status: 'pendente', versao: 1, papel: 'Presidente' }]
    lista()
    const linhas = screen.getAllByRole('row').slice(1)
    expect(linhas[0]).toHaveTextContent('OF-2026/000003')
    expect(within(linhas[0]).getByText('Assine')).toBeInTheDocument()
    expect(within(linhas[1]).queryByText('Assine')).toBeNull()
    expect(screen.getByText('2 de 2 documento(s)')).toBeInTheDocument()
  })

  it('as vistas filtram, a busca acha por texto e a vista fica no endereço', async () => {
    const ui = userEvent.setup()
    h.doc.documentos = [doc({ id: 'a', titulo: 'Compra de cadeiras' }), doc({ id: 'b', titulo: 'Reunião', status: 'assinado', numero: 'OF-2026/000009' })]
    lista()
    await ui.click(screen.getByRole('tab', { name: /Assinados/ }))
    expect(screen.getByTestId('local')).toHaveTextContent('?vista=assinados')
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1)
    await ui.click(screen.getByRole('tab', { name: /Todos/ }))
    expect(screen.getByTestId('local')).toHaveTextContent(/^\/documentos$/)
    await ui.type(screen.getByLabelText('Buscar documentos'), 'cadeiras')
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1)
    await ui.clear(screen.getByLabelText('Buscar documentos'))
    await ui.type(screen.getByLabelText('Buscar documentos'), 'zzz')
    expect(screen.getByText(/Nenhum documento nesta vista/)).toBeInTheDocument()
  })

  it('clicar na linha abre o documento', async () => {
    const ui = userEvent.setup()
    h.doc.documentos = [doc()]
    lista()
    await ui.click(screen.getByText('Ofício de teste'))
    expect(await screen.findByText('detalhe aberto')).toBeInTheDocument()
  })

  it('banco sem as tabelas explica o que aplicar; erro comum mostra o motivo', () => {
    h.doc = { ...h.doc, ausente: true, erro: 'x' }
    const { unmount } = lista()
    expect(screen.getByText('Os documentos ainda não foram ativados')).toBeInTheDocument()
    unmount()
    h.doc = { ...h.doc, ausente: false, erro: 'falha de rede' }
    lista()
    expect(screen.getByText(/Não foi possível carregar os documentos: falha de rede/)).toBeInTheDocument()
  })
})

describe('novo documento', () => {
  function novo(rota = '/documentos/novo', role = 'compras') {
    h.auth.role = role
    return render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/documentos/novo" element={<DocumentoNovo />} />
          <Route path="/documentos/:id" element={<div>editor aberto</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('cada perfil vê só os modelos que lhe cabem', () => {
    const { unmount } = novo('/documentos/novo', 'compras')
    expect(screen.getByRole('button', { name: /Estudo Técnico Preliminar/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Parecer jurídico/ })).toBeNull()
    unmount()
    novo('/documentos/novo', 'juridico')
    expect(screen.getByRole('button', { name: /Parecer jurídico/ })).toBeInTheDocument()
  })

  it('a busca filtra os modelos', async () => {
    const ui = userEvent.setup()
    novo()
    await ui.type(screen.getByLabelText('Procurar modelo'), 'zzzz')
    expect(screen.getByText(/Nenhum modelo encontrado/)).toBeInTheDocument()
    await ui.clear(screen.getByLabelText('Procurar modelo'))
    await ui.type(screen.getByLabelText('Procurar modelo'), 'ETP')
    expect(screen.getByRole('button', { name: /Estudo Técnico Preliminar/ })).toBeInTheDocument()
  })

  it('escolher o modelo cria o rascunho ligado ao processo e abre o editor', async () => {
    const ui = userEvent.setup()
    novo('/documentos/novo?processo=p9')
    await ui.click(screen.getByRole('button', { name: /Ofício/ }))
    await waitFor(() => expect(h.criar).toHaveBeenCalledOnce())
    expect(h.criar.mock.calls[0][0]).toMatchObject({ titulo: 'Ofício', processoId: 'p9', corpo: [] })
    expect(h.criar.mock.calls[0][0].modelo.codigo).toBe('oficio')
    expect(await screen.findByText('editor aberto')).toBeInTheDocument()
  })

  it('?modelo= cria sozinho, uma única vez', async () => {
    novo('/documentos/novo?modelo=despacho')
    expect(await screen.findByText('editor aberto')).toBeInTheDocument()
    expect(h.criar).toHaveBeenCalledOnce()
  })

  it('?modelo= que o perfil não pode usar cai na escolha normal', () => {
    novo('/documentos/novo?modelo=parecer-juridico', 'compras')
    expect(h.criar).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Novo documento' })).toBeInTheDocument()
  })

  it('falha ao criar mostra o motivo e libera nova tentativa', async () => {
    const ui = userEvent.setup()
    h.criar.mockRejectedValueOnce(new Error('Sem permissão para criar documentos.'))
    novo()
    await ui.click(screen.getByRole('button', { name: /Ofício/ }))
    await waitFor(() => expect(h.erro).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Ofício/ })).toBeEnabled()
  })
})

describe('verificar autenticidade', () => {
  const ok = {
    encontrado: true, numero: 'OF-2026/000001', situacao: 'assinado', integro: true, hash: 'ab'.repeat(32), assinado_em: '2026-10-29T15:00:00Z',
    assinaturas: [{ nome: 'Ana Ribeiro', papel: 'Presidente', situacao: 'assinada', assinada_em: '2026-10-29T15:00:00Z' }],
  }

  function verif(rota, publico = false) {
    return render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/verificar/:codigo?" element={<><Verificar publico={publico} /><Local /></>} />
          <Route path="/documentos/verificar/:codigo?" element={<><Verificar /><Local /></>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('código válido mostra autêntico, íntegro e as assinaturas', async () => {
    h.verificar.mockResolvedValue(ok)
    verif('/verificar/ABCD1234EFGH', true)
    expect(await screen.findByText('Documento autêntico e assinado')).toBeInTheDocument()
    expect(h.verificar).toHaveBeenCalledWith('ABCD1234EFGH')
    expect(screen.getByText('Íntegro')).toBeInTheDocument()
    expect(screen.getByText('Ana Ribeiro')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de verificação')).toHaveValue('ABCD-1234-EFGH')
  })

  it('conteúdo alterado depois de assinado dá alerta forte', async () => {
    h.verificar.mockResolvedValue({ ...ok, integro: false })
    verif('/verificar/ABCD1234EFGH', true)
    expect(await screen.findByText(/o conteúdo não confere/)).toBeInTheDocument()
    expect(screen.getByText('Alterado')).toBeInTheDocument()
  })

  it('código desconhecido, aguardando e cancelado', async () => {
    h.verificar.mockResolvedValue({ encontrado: false })
    const a = verif('/verificar/ZZZZ', true)
    expect(await screen.findByText('Código não encontrado.')).toBeInTheDocument()
    a.unmount()
    h.verificar.mockResolvedValue({ ...ok, situacao: 'aguardando_assinatura', assinado_em: null })
    const b = verif('/verificar/ABCD', true)
    expect(await screen.findByText(/aguardando assinatura \(ainda não vale\)/)).toBeInTheDocument()
    b.unmount()
    h.verificar.mockResolvedValue({ ...ok, situacao: 'cancelado', cancelado_em: '2026-10-30T10:00:00Z' })
    verif('/verificar/ABCD', true)
    expect(await screen.findByText('Documento cancelado')).toBeInTheDocument()
  })

  it('digitar o código leva ao endereço certo, sem hífens e em maiúsculas', async () => {
    const ui = userEvent.setup()
    h.verificar.mockResolvedValue(ok)
    verif('/documentos/verificar')
    await ui.type(screen.getByLabelText('Código de verificação'), 'abcd-1234 efgh')
    await ui.click(screen.getByRole('button', { name: 'Conferir' }))
    expect(screen.getByTestId('local')).toHaveTextContent('/documentos/verificar/ABCD1234EFGH')
    await waitFor(() => expect(h.verificar).toHaveBeenCalledWith('ABCD1234EFGH'))
  })

  it('falha na consulta mostra mensagem', async () => {
    h.verificar.mockRejectedValue(new Error('Failed to fetch'))
    verif('/verificar/ABCD', true)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

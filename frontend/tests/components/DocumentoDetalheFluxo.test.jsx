// Tela do documento no fluxo das secretarias: DFD → Compras, encaminhar ofício e arquivo enviado.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const h = vi.hoisted(() => ({
  auth: {}, sols: [], obter: vi.fn(), assinar: vi.fn(), encaminhar: vi.fn(), salvar: vi.fn(), enviarCompras: vi.fn(), unidades: vi.fn(), ok: vi.fn(), erro: vi.fn(),
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/components/useAtualizacao', () => ({ useAtualizacaoAutomatica: () => {} }))
vi.mock('../../src/components/useSolicitacoes', () => ({ useSolicitacoes: () => ({ solicitacoes: h.sols }) }))
vi.mock('../../src/components/documentos/useContextoDocumento', () => ({
  useContextoDocumento: () => ({ pronto: true, ctx: { orgao: 'Prefeitura', cidade: 'Aracaju', numero: 'X', data: new Date('2026-10-29T12:00:00'), autor: { nome: 'Laura' }, unidade: null, processo: null } }),
}))
vi.mock('../../src/utils/alerts', () => ({ showError: h.erro, showSuccess: h.ok, showConfirm: vi.fn() }))
vi.mock('../../src/services/documentos', async (importOriginal) => ({
  ...(await importOriginal()), obterDocumento: h.obter, assinarDocumento: h.assinar, encaminharDocumento: h.encaminhar, salvarDocumento: h.salvar,
  conferirArquivo: vi.fn().mockResolvedValue(true),
}))
vi.mock('../../src/services/solicitacoes', async (importOriginal) => ({ ...(await importOriginal()), enviarDfdAoCompras: h.enviarCompras }))
vi.mock('../../src/services/tramitacao', async (importOriginal) => ({ ...(await importOriginal()), listarUnidades: h.unidades }))

import DocumentoDetalhe from '../../src/pages/DocumentoDetalhe'

const Local = () => { const l = useLocation(); return <output data-testid="local">{l.pathname}</output> }
const ITENS = [{ item_id: 'i1', nome: 'Computador desktop', especificacao: 'i5', unidade: 'unidade', quantidade: '30', valor_unitario: '4500' }]
const dfd = (extra) => ({
  id: 'd1', numero: 'DFD-2026/000001', titulo: 'DFD', modelo: 'dfd', status: 'assinado', versao: 1, processo_id: null, unidade_id: 'u-sms', criado_por: 'u-sec',
  conteudo: { objeto: 'Computadores', itens: ITENS, prioridade: 'alta' }, corpo: [{ t: 'p', x: 'DFD' }], codigo_verificacao: 'A1B2C3D4E5F6', hash: 'ab'.repeat(32), ...extra,
})

function abrir(role = 'secretario') {
  h.auth = { role, user: { id: role === 'presidente' ? 'u-pres' : 'u-sec', email: 'x@x' }, profile: { unidade_id: role === 'presidente' ? 'u-pres' : 'u-sms' } }
  return render(
    <MemoryRouter initialEntries={['/documentos/d1']}>
      <Routes>
        <Route path="/documentos/:id" element={<DocumentoDetalhe />} />
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  h.sols = []
  for (const k of ['obter', 'assinar', 'encaminhar', 'salvar', 'enviarCompras', 'unidades', 'ok', 'erro']) h[k].mockReset()
  h.enviarCompras.mockResolvedValue('sol-1')
  h.encaminhar.mockResolvedValue('proc-1')
  h.unidades.mockResolvedValue([{ id: 'u-sms', sigla: 'SMS', nome: 'Secretaria de Saúde', ativa: true }, { id: 'u-x', sigla: 'X', nome: 'Inativa', ativa: false }])
})

describe('DFD assinada', () => {
  it('o secretário envia ao Compras em um clique', async () => {
    const ui = userEvent.setup()
    h.obter.mockResolvedValue({ documento: dfd(), assinaturas: [] })
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Enviar ao Compras/ }))
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('R$ 135.000,00')).toBeInTheDocument()
    await ui.click(within(modal).getByRole('button', { name: 'Enviar ao Compras' }))
    await waitFor(() => expect(h.enviarCompras).toHaveBeenCalledWith(expect.objectContaining({ documento_id: 'd1', valor_estimado: 135000 }), null, ''))
    expect(await screen.findByText('/solicitacoes/sol-1')).toBeInTheDocument()
  })

  it('DFD já enviada, já em processo, ou de quem não é secretário: sem o botão; e a DFD não é encaminhada pela tramitação', async () => {
    h.sols = [{ id: 's', documento_id: 'd1', status: 'enviada' }]
    h.obter.mockResolvedValue({ documento: dfd(), assinaturas: [] })
    const a = abrir()
    await screen.findByRole('heading', { name: 'DFD-2026/000001' })
    expect(screen.queryByRole('button', { name: /Enviar ao Compras/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Encaminhar/ })).toBeNull()
    a.unmount()
    h.sols = []
    h.obter.mockResolvedValue({ documento: dfd({ processo_id: 'p1' }), assinaturas: [] })
    const b = abrir()
    await screen.findByRole('heading', { name: 'DFD-2026/000001' })
    expect(screen.queryByRole('button', { name: /Enviar ao Compras/ })).toBeNull()
    b.unmount()
    h.obter.mockResolvedValue({ documento: dfd(), assinaturas: [] })
    abrir('compras')
    await screen.findByRole('heading', { name: 'DFD-2026/000001' })
    expect(screen.queryByRole('button', { name: /Enviar ao Compras/ })).toBeNull()
  })

  it('ao concluir as assinaturas da DFD, o envio ao Compras já se abre', async () => {
    const ui = userEvent.setup()
    const aguardando = dfd({ status: 'aguardando_assinatura' })
    h.obter.mockResolvedValueOnce({ documento: aguardando, assinaturas: [{ id: 1, usuario_id: 'u-sec', status: 'pendente', versao: 1, papel: 'Secretária', nome: 'Laura' }] })
      .mockResolvedValue({ documento: dfd(), assinaturas: [{ id: 1, usuario_id: 'u-sec', status: 'assinada', versao: 1, papel: 'Secretária', nome: 'Laura', assinada_em: '2026-10-29T12:00:00Z' }] })
    h.assinar.mockResolvedValue()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /^Assinar/ }))
    const modal = screen.getByRole('dialog')
    await ui.type(within(modal).getByLabelText('Sua senha'), 'segredo')
    await ui.click(within(modal).getByLabelText(/Li o documento/))
    await ui.click(within(modal).getByRole('button', { name: 'Assinar' }))
    expect(await screen.findByRole('heading', { name: /Enviar a DFD ao Compras/ })).toBeInTheDocument()
  })
})

describe('encaminhar documento assinado (ofício do Prefeito)', () => {
  it('escolhe a unidade (só as ativas), escreve o despacho e vai para o processo', async () => {
    const ui = userEvent.setup()
    h.obter.mockResolvedValue({ documento: dfd({ modelo: 'oficio', numero: 'OF-2026/000001', conteudo: {} }), assinaturas: [] })
    abrir('presidente')
    await ui.click(await screen.findByRole('button', { name: /Encaminhar/ }))
    const modal = await screen.findByRole('dialog')
    const unidade = within(modal).getByLabelText(/Para qual unidade/)
    expect(within(unidade).queryByText(/Inativa/)).toBeNull()
    await ui.selectOptions(unidade, 'u-sms')
    await ui.type(within(modal).getByLabelText(/Despacho/), 'Providenciar a DFD dos computadores.')
    await ui.click(within(modal).getByRole('button', { name: 'Encaminhar' }))
    await waitFor(() => expect(h.encaminhar).toHaveBeenCalledWith('d1', { unidade: 'u-sms', despacho: 'Providenciar a DFD dos computadores.' }))
    expect(await screen.findByText('/processos/proc-1')).toBeInTheDocument()
  })

  it('rascunho não é encaminhado', async () => {
    h.obter.mockResolvedValue({ documento: dfd({ modelo: 'oficio', status: 'rascunho', conteudo: {} }), assinaturas: [] })
    abrir('presidente')
    await screen.findByRole('heading', { name: 'DFD-2026/000001' })
    expect(screen.queryByRole('button', { name: /Encaminhar/ })).toBeNull()
  })
})

describe('arquivo enviado', () => {
  const arquivo = (extra) => dfd({
    modelo: 'arquivo', numero: 'ANX-2026/000001', titulo: 'Proposta', status: 'rascunho', criado_por: 'u-sec', arquivo_path: 'u-sec/x.pdf',
    conteudo: { descricao: 'Recebida por e-mail' }, corpo: [{ t: 'titulo', x: 'Proposta' }, { t: 'arquivo', nome: 'x.pdf', tipo: 'application/pdf', tamanho: 10, sha256: 'ab'.repeat(32) }],
    ...extra,
  })

  it('no rascunho, edita título e descrição e pode ir para assinatura', async () => {
    h.obter.mockResolvedValue({ documento: arquivo(), assinaturas: [] })
    abrir()
    await waitFor(async () => expect(await screen.findByLabelText('Descrição')).toHaveValue('Recebida por e-mail'))
    expect(screen.getByRole('button', { name: /Enviar para assinatura/ })).toBeEnabled()
    expect(screen.getByText('x.pdf')).toBeInTheDocument()
  })
})

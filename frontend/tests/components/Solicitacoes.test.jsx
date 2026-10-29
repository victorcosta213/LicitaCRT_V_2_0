// Pedidos ao Compras: o secretário envia a DFD assinada; o Compras analisa (devolve, recusa ou aceita e abre o processo).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const h = vi.hoisted(() => ({
  auth: {}, sols: [], docs: [], unidades: [], processos: [], obter: vi.fn(), erro: vi.fn(), ok: vi.fn(),
  enviar: vi.fn(), reenviar: vi.fn(), cancelar: vi.fn(), devolver: vi.fn(), recusar: vi.fn(), aceitar: vi.fn(), registrar: vi.fn(),
  obterDoc: vi.fn(), criarDoc: vi.fn(),
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/components/useAtualizacao', () => ({ useAtualizacaoAutomatica: () => {} }))
vi.mock('../../src/components/useSolicitacoes', () => ({ useSolicitacoes: () => ({ carregando: false, erro: null, ausente: false, solicitacoes: h.sols }) }))
vi.mock('../../src/components/useDocumentos', () => ({ useDocumentos: () => ({ carregando: false, documentos: h.docs }) }))
vi.mock('../../src/components/useTramitacao', () => ({
  useTramitacao: () => ({ unidades: h.unidades, unidadesPorId: new Map(h.unidades.map((u) => [u.id, u])), processos: h.processos }),
}))
vi.mock('../../src/utils/alerts', () => ({ showError: h.erro, showSuccess: h.ok, showConfirm: vi.fn() }))
vi.mock('../../src/services/solicitacoes', async (importOriginal) => ({
  ...(await importOriginal()),
  obterSolicitacao: h.obter, enviarSolicitacao: h.enviar, reenviarSolicitacao: h.reenviar, cancelarSolicitacao: h.cancelar,
  devolverSolicitacao: h.devolver, recusarSolicitacao: h.recusar, aceitarSolicitacao: h.aceitar, registrarProcessoContratacao: h.registrar,
  enviarDfdAoCompras: async (d, dev, r) => (dev ? (await h.reenviar(dev, d, r), dev) : h.enviar(d)),
}))
vi.mock('../../src/services/documentos', async (importOriginal) => ({ ...(await importOriginal()), obterDocumento: h.obterDoc, criarDocumento: h.criarDoc }))

import Solicitacoes from '../../src/pages/Solicitacoes'
import SolicitacaoNova from '../../src/pages/SolicitacaoNova'
import SolicitacaoDetalhe from '../../src/pages/SolicitacaoDetalhe'

const Local = () => { const l = useLocation(); return <output data-testid="local">{l.pathname + l.search}</output> }
const sol = (extra) => ({
  id: 's1', numero: 'SOL-2026/000001', tipo: 'dfd', objeto: 'Aquisição de computadores', quantidade: '30 unidade — Computador', justificativa: 'Equipamentos obsoletos.',
  status: 'enviada', prioridade: 'alta', solicitante: 'u-sec', solicitante_nome: 'Laura', unidade_id: 'u-sms', enviada_em: '2026-10-20T10:00:00Z',
  documento_id: 'd1', processo_id: null, motivo: null, objeto_tipo: 'bens-permanentes', valor_estimado: 135000, data_pretendida: null, previsto_pca: null, ...extra,
})
const ITENS = [{ item_id: 'i1', nome: 'Computador desktop', especificacao: 'i5', unidade: 'unidade', quantidade: '30', valor_unitario: '4500' }]
const DFD = {
  id: 'd1', numero: 'DFD-2026/000001', titulo: 'DFD', modelo: 'dfd', status: 'assinado', processo_id: null, atualizado_em: '2026-10-20T10:00:00Z',
  conteudo: { objeto: 'Computadores para as UBS', objeto_tipo: 'bens-permanentes', itens: ITENS, necessidade: 'Obsoletos', prioridade: 'alta' },
}

function abrir(rota, role = 'secretario') {
  h.auth = { role, user: { id: role === 'compras' ? 'u-comp' : 'u-sec' }, profile: { unidade_id: role === 'compras' ? 'u-comp' : 'u-sms' } }
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/solicitacoes" element={<><Solicitacoes /><Local /></>} />
        <Route path="/solicitacoes/nova" element={<><SolicitacaoNova /><Local /></>} />
        <Route path="/solicitacoes/:id" element={<><SolicitacaoDetalhe /><Local /></>} />
        <Route path="/processos/:id" element={<Local />} />
        <Route path="/documentos/:id" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  h.sols = []
  h.docs = []
  h.processos = []
  h.unidades = [{ id: 'u-sms', sigla: 'SMS', nome: 'Secretaria de Saúde', ativa: true }, { id: 'u-comp', sigla: 'COMP', nome: 'Compras', ativa: true }]
  for (const k of ['obter', 'erro', 'ok', 'enviar', 'reenviar', 'cancelar', 'devolver', 'recusar', 'aceitar', 'registrar', 'obterDoc', 'criarDoc']) h[k].mockReset()
  h.enviar.mockResolvedValue('nova-id')
  h.aceitar.mockResolvedValue('proc-1')
  h.registrar.mockResolvedValue('proc-2')
  h.obterDoc.mockResolvedValue({ documento: DFD, assinaturas: [] })
  h.criarDoc.mockResolvedValue('dfd-nova')
})

describe('lista', () => {
  it('o secretário vê os pedidos da secretaria e o convite para a primeira DFD', () => {
    abrir('/solicitacoes')
    expect(screen.getByRole('heading', { name: 'Pedidos ao Compras' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Fazer a primeira DFD/ })).toHaveAttribute('href', '/solicitacoes/nova')
    expect(screen.queryByRole('button', { name: /Lançar processo antigo/ })).toBeNull()
  })

  it('o Compras começa pelo que espera análise e não lança processo sem DFD', () => {
    h.sols = [sol(), sol({ id: 's2', numero: 'SOL-2026/000002', status: 'aceita', objeto: 'Papel A4' })]
    abrir('/solicitacoes', 'compras')
    expect(screen.getByRole('heading', { name: 'DFDs recebidas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Aguardando análise/ })).toHaveAttribute('aria-selected', 'true')
    const linhas = screen.getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(1)
    expect(within(linhas[0]).getByText('SMS')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Lançar processo antigo/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Nova DFD/ })).toBeNull()
  })

  it('a administração lança processo antigo, vendo o roteiro da forma escolhida', async () => {
    const ui = userEvent.setup()
    abrir('/solicitacoes', 'admin')
    await ui.click(screen.getByRole('button', { name: /Lançar processo antigo/ }))
    const modal = screen.getByRole('dialog')
    await ui.type(within(modal).getByLabelText(/^Objeto/), 'Suporte de rede')
    await ui.selectOptions(within(modal).getByLabelText(/Unidade demandante/), 'u-sms')
    await ui.selectOptions(within(modal).getByLabelText(/Forma de contratação/), 'dispensa')
    expect(within(modal).getByText(/Comprovação de que o contratado preenche os requisitos/)).toBeInTheDocument()
    await ui.click(within(modal).getByRole('button', { name: 'Abrir processo' }))
    await waitFor(() => expect(h.registrar).toHaveBeenCalledWith(expect.objectContaining({ objeto: 'Suporte de rede', unidade_demandante: 'u-sms', modalidade: 'dispensa' })))
    expect(await screen.findByText('/processos/proc-2')).toBeInTheDocument()
  })
})

describe('nova DFD (secretário)', () => {
  it('sem DFD pronta, aponta para fazer a DFD', () => {
    abrir('/solicitacoes/nova')
    expect(screen.getByText('Nenhuma DFD assinada aguardando envio.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Fazer nova DFD/ })).toHaveAttribute('href', '/documentos/novo?modelo=dfd')
  })

  it('separa as DFDs prontas das que ainda estão em elaboração', () => {
    h.docs = [DFD, { ...DFD, id: 'd2', numero: 'DFD-2026/000002', status: 'aguardando_assinatura' }]
    abrir('/solicitacoes/nova')
    expect(screen.getByRole('button', { name: /Enviar ao Compras/ })).toBeInTheDocument()
    expect(screen.getByText('DFD-2026/000002')).toBeInTheDocument()
    expect(screen.getByText('Aguardando assinatura')).toBeInTheDocument()
  })

  it('envia em um clique: os dados do pedido saem da DFD (itens e total)', async () => {
    const ui = userEvent.setup()
    h.docs = [DFD]
    abrir('/solicitacoes/nova')
    await ui.click(screen.getByRole('button', { name: /Enviar ao Compras/ }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText('Computadores para as UBS')).toBeInTheDocument()
    expect(within(modal).getByText('30 unidade — Computador desktop')).toBeInTheDocument()
    expect(within(modal).getByText('R$ 135.000,00')).toBeInTheDocument()
    await ui.click(within(modal).getByRole('button', { name: 'Enviar ao Compras' }))
    await waitFor(() => expect(h.enviar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'dfd', documento_id: 'd1', objeto: 'Computadores para as UBS', valor_estimado: 135000, prioridade: 'alta', objeto_tipo: 'bens-permanentes',
    })))
    expect(await screen.findByText('/solicitacoes/nova-id')).toBeInTheDocument()
  })

  it('a DFD nova pode responder a um pedido devolvido', async () => {
    const ui = userEvent.setup()
    h.docs = [DFD]
    h.sols = [sol({ id: 'dev', status: 'devolvida', motivo: 'Detalhe por UBS', documento_id: 'velha' })]
    abrir('/solicitacoes/nova')
    expect(screen.getByText(/O Compras devolveu um pedido para ajuste/)).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: /Enviar ao Compras/ }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByLabelText(/Sim, responde a/)).toBeChecked() // só uma devolvida: já vem escolhida
    await ui.type(within(modal).getByLabelText('O que foi corrigido'), 'Quantidade por UBS')
    await ui.click(within(modal).getByRole('button', { name: 'Reenviar ao Compras' }))
    await waitFor(() => expect(h.reenviar).toHaveBeenCalledWith('dev', expect.objectContaining({ documento_id: 'd1' }), 'Quantidade por UBS'))
    expect(h.enviar).not.toHaveBeenCalled()
  })
})

describe('detalhe', () => {
  const servir = (s, eventos = [{ id: 1, tipo: 'envio', criada_por_nome: 'Laura', criada_em: '2026-10-20T10:00:00Z' }]) => h.obter.mockResolvedValue({ solicitacao: s, eventos })

  it('o Compras aceita escolhendo a forma de contratação e vai para o processo', async () => {
    const ui = userEvent.setup()
    servir(sol())
    abrir('/solicitacoes/s1', 'compras')
    await ui.click(await screen.findByRole('button', { name: /Aceitar e abrir processo/ }))
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByLabelText(/Tipo de objeto/)).toHaveValue('bens-permanentes') // vem da DFD
    await ui.selectOptions(within(modal).getByLabelText(/Forma de contratação/), 'pregao')
    await ui.selectOptions(within(modal).getByLabelText(/Tipo de objeto/), 'obras-engenharia')
    expect(within(modal).getByText(/O pregão não se aplica a obras/)).toBeInTheDocument()
    await ui.click(within(modal).getByRole('button', { name: 'Abrir processo' }))
    await waitFor(() => expect(h.aceitar).toHaveBeenCalledWith('s1', expect.objectContaining({ modalidade: 'pregao', objeto_tipo: 'obras-engenharia', prioridade: 'alta' })))
    expect(await screen.findByText('/processos/proc-1')).toBeInTheDocument()
  })

  it('o Compras devolve com o motivo', async () => {
    const ui = userEvent.setup()
    servir(sol())
    abrir('/solicitacoes/s1', 'compras')
    await ui.click(await screen.findByRole('button', { name: 'Devolver para ajuste' }))
    const modal = screen.getByRole('dialog')
    await ui.type(within(modal).getByLabelText(/O que precisa ser ajustado/), 'Detalhe por UBS')
    await ui.click(within(modal).getByRole('button', { name: 'Devolver' }))
    await waitFor(() => expect(h.devolver).toHaveBeenCalledWith('s1', 'Detalhe por UBS'))
  })

  it('devolvido: o secretário refaz a DFD (cópia da anterior) e vai corrigi-la', async () => {
    const ui = userEvent.setup()
    servir(sol({ status: 'devolvida', motivo: 'Detalhe por UBS' }))
    abrir('/solicitacoes/s1')
    expect(await screen.findByText(/O Compras devolveu esta solicitação/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aceitar/ })).toBeNull()
    await ui.click(screen.getByRole('button', { name: /Refazer a DFD/ }))
    await waitFor(() => expect(h.criarDoc).toHaveBeenCalledOnce())
    expect(h.obterDoc).toHaveBeenCalledWith('d1')
    expect(h.criarDoc.mock.calls[0][0]).toMatchObject({ conteudo: DFD.conteudo, corpo: [] })
    expect(h.criarDoc.mock.calls[0][0].modelo.codigo).toBe('dfd')
    expect(await screen.findByText('/documentos/dfd-nova')).toBeInTheDocument()
  })

  it('aceito: mostra o link para acompanhar o processo e não deixa cancelar', async () => {
    servir(sol({ status: 'aceita', processo_id: 'proc-9' }))
    h.processos = [{ id: 'proc-9', numero: '2026/000009' }]
    abrir('/solicitacoes/s1')
    expect(await screen.findByRole('link', { name: 'Acompanhar o processo' })).toHaveAttribute('href', '/processos/proc-9')
    expect(screen.getByText('2026/000009')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelar solicitação/ })).toBeNull()
  })

  it('outra secretaria não refaz nem cancela; inexistente mostra aviso', async () => {
    servir(sol({ status: 'devolvida', motivo: 'x', solicitante: 'outra', unidade_id: 'u-semed' }))
    const { unmount } = abrir('/solicitacoes/s1')
    await screen.findByText(/O Compras devolveu/)
    expect(screen.queryByRole('button', { name: /Refazer/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Cancelar solicitação/ })).toBeNull()
    unmount()
    servir(null, [])
    abrir('/solicitacoes/s1')
    expect(await screen.findByText('Solicitação não encontrada')).toBeInTheDocument()
  })
})

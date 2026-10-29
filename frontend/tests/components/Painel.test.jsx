// Visão geral do presidente: processos por setor, o que está travado e quem mexeu por último.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const h = vi.hoisted(() => ({ gc: {}, listarProcessos: vi.fn(), listarUnidades: vi.fn(), movimentos: vi.fn() }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'presidente', user: { id: 'u-pres' }, profile: { nome: 'Marcos Tavares' } }) }))
vi.mock('../../src/context/GcContext', () => ({ useGc: () => h.gc }))
vi.mock('../../src/services/tramitacao', async (importOriginal) => ({
  ...(await importOriginal()),
  listarProcessosAdm: h.listarProcessos, listarUnidades: h.listarUnidades, listarMovimentacoesRecentes: h.movimentos,
}))

import Painel from '../../src/pages/Painel'

const ha = (dias, horas = 0) => new Date(Date.now() - dias * 86400000 - horas * 3600000).toISOString()
const UNIDADES = [
  { id: 'u-comp', sigla: 'COMP', nome: 'Compras e Licitações', ativa: true },
  { id: 'u-gcon', sigla: 'GCON', nome: 'Gestão de Contratos', ativa: true },
  { id: 'u-fin', sigla: 'FIN', nome: 'Financeiro', ativa: true },
]
const proc = (extra) => ({
  situacao: 'em_andamento', tipo: 'Requerimento', prazo: null, recebido_em: ha(1), desde: ha(1), concluido_em: null, unidade_atual: 'u-gcon', ...extra,
})
const PROCESSOS = [
  proc({ id: 'p1', numero: '2026/000001', assunto: 'Compra de cadeiras', unidade_atual: 'u-gcon' }),
  proc({ id: 'p2', numero: '2026/000002', assunto: 'Pagamento de diárias', unidade_atual: 'u-fin', desde: ha(9) }),
  proc({ id: 'p3', numero: '2026/000003', assunto: 'Contrato de limpeza', unidade_atual: 'u-gcon', recebido_em: null, desde: ha(0) }),
  proc({ id: 'p4', numero: '2026/000004', assunto: 'Prazo estourado', unidade_atual: 'u-comp', prazo: '2020-01-01', desde: ha(2) }),
  proc({ id: 'p5', numero: '2026/000005', assunto: 'Resolvido', situacao: 'concluido', concluido_em: new Date().toISOString(), unidade_atual: 'u-fin' }),
]
const MOVIMENTOS = [
  { id: 30, processo_id: 'p2', tipo: 'envio', de_unidade: 'u-gcon', para_unidade: 'u-fin', para_usuario_nome: 'Elisa', despacho: 'Verificar a dotação', criada_em: ha(0, 2), criada_por_nome: 'Ana Gestora' },
  { id: 29, processo_id: 'p1', tipo: 'abertura', de_unidade: 'u-comp', para_unidade: 'u-gcon', despacho: null, criada_em: ha(2), criada_por_nome: 'Diego Compras' },
  { id: 28, processo_id: 'p5', tipo: 'conclusao', de_unidade: null, para_unidade: 'u-fin', despacho: 'Pago e arquivado', criada_em: ha(0, 0), criada_por_nome: 'Elisa Financeira' },
]

const Destino = () => { const l = useLocation(); return <div>{`destino ${l.pathname}${l.search}`}</div> }
function abrir() {
  return render(
    <MemoryRouter initialEntries={['/painel']}>
      <Routes>
        <Route path="/painel" element={<Painel />} />
        <Route path="/processos" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  )
}
const indicador = (rotulo) => screen.getAllByText(rotulo).map((el) => el.closest('a')).find(Boolean)

beforeEach(() => {
  localStorage.clear()
  h.gc = { params: { tr_dias_parado: 5 }, consolidados: [], alertas: [] }
  h.listarProcessos.mockReset().mockResolvedValue(PROCESSOS)
  h.listarUnidades.mockReset().mockResolvedValue(UNIDADES)
  h.movimentos.mockReset().mockResolvedValue(MOVIMENTOS)
})

describe('visão geral do presidente', () => {
  it('cumprimenta pelo primeiro nome e resume o que pede atenção', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: /, Marcos\.$/ })).toBeInTheDocument()
    const resumo = document.querySelector('.cabecalho__sub')
    expect(resumo).toHaveTextContent('Há 1 parado e 1 atrasado entre os processos em andamento.')
  })

  it('a frase do topo concorda com os números e some o que é zero', async () => {
    h.listarProcessos.mockResolvedValue([
      proc({ id: 'a', numero: '1', assunto: 'A', desde: ha(9) }), proc({ id: 'b', numero: '2', assunto: 'B', desde: ha(8) }),
    ])
    abrir()
    await waitFor(() => expect(document.querySelector('.cabecalho__sub')).toHaveTextContent('Há 2 parados entre os processos em andamento.'))
  })

  it('os indicadores de processos levam à lista certa', async () => {
    abrir()
    await screen.findByText('Compra de cadeiras').catch(() => {})
    await waitFor(() => expect(within(indicador('Em andamento')).getByText('4')).toBeInTheDocument())
    expect(indicador('Em andamento')).toHaveAttribute('href', '/processos')
    expect(within(indicador('Parados')).getByText('1')).toBeInTheDocument()
    expect(indicador('Atrasados')).toHaveAttribute('href', '/processos?vista=atencao')
    expect(within(indicador('Aguardando recebimento')).getByText('1')).toBeInTheDocument()
    expect(indicador('Concluídos no mês')).toHaveAttribute('href', '/processos?vista=concluidos')
  })

  it('mostra cada setor com o total, os parados e atrasados, e leva à lista daquele setor', async () => {
    abrir()
    const fin = await screen.findByRole('link', { name: /Financeiro: 1 em andamento, 1 parados, 0 atrasados/ })
    expect(fin).toHaveAttribute('href', '/processos?unidade=u-fin')
    expect(within(fin).getByText('1 parado')).toBeInTheDocument()
    const comp = screen.getByRole('link', { name: /Compras e Licitações: 1 em andamento, 0 parados, 1 atrasados/ })
    expect(within(comp).getByText('1 atrasado')).toBeInTheDocument()
    const gcon = screen.getByRole('link', { name: /Gestão de Contratos: 2 em andamento, 0 parados, 0 atrasados/ })
    expect(within(gcon).getByText('em dia')).toBeInTheDocument()
  })

  it('lista o que precisa de atenção, do mais antigo para o mais novo', async () => {
    abrir()
    const card = (await screen.findByText('Precisam de atenção')).closest('section')
    await within(card).findByText('Pagamento de diárias')
    const itens = within(card).getAllByRole('link')
    expect(itens[0]).toHaveTextContent('Pagamento de diárias')
    expect(itens[0]).toHaveAttribute('href', '/processos/p2')
    expect(itens[1]).toHaveTextContent('Prazo estourado')
  })

  it('"Últimas movimentações" mostra quem mexeu, o que fez, entre quais setores, o despacho e há quanto tempo', async () => {
    abrir()
    const card = (await screen.findByText('Últimas movimentações')).closest('section')
    const itens = await within(card).findAllByRole('listitem')
    expect(itens).toHaveLength(3)
    expect(itens[0]).toHaveTextContent('Ana Gestora enviou 2026/000002 · Pagamento de diárias de GCON para FIN (Elisa)')
    expect(itens[0]).toHaveTextContent('“Verificar a dotação”')
    expect(itens[0]).toHaveTextContent('há 2 h')
    expect(within(itens[0]).getByRole('link', { name: '2026/000002' })).toHaveAttribute('href', '/processos/p2')
    expect(itens[1]).toHaveTextContent('Diego Compras abriu 2026/000001 · Compra de cadeiras para GCON')
    expect(itens[1]).toHaveTextContent('há 2 dias')
    expect(itens[2]).toHaveTextContent('Elisa Financeira concluiu 2026/000005')
    expect(itens[2]).toHaveTextContent('agora')
  })

  it('a busca leva à lista de processos já filtrada', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.type(await screen.findByLabelText('Achar um processo'), 'cadeiras{enter}')
    expect(await screen.findByText('destino /processos?busca=cadeiras')).toBeInTheDocument()
  })

  it('busca vazia abre todos os processos', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: 'Procurar' }))
    expect(await screen.findByText('destino /processos')).toBeInTheDocument()
  })

  it('as contratações aparecem num resumo à parte, com zeros quando ainda não há nenhuma', async () => {
    abrir()
    await screen.findByText('Contratações')
    expect(within(indicador('Em execução')).getByText('0')).toBeInTheDocument()
    expect(indicador('Vencem em até 120 dias')).toHaveAttribute('href', '/contratos')
    expect(indicador('Na fila do Financeiro')).toHaveAttribute('href', '/financeiro')
    expect(indicador('Alertas urgentes')).toHaveAttribute('href', '/alertas')
  })

  it('alertas urgentes das contratações entram na contagem', async () => {
    h.gc = { ...h.gc, alertas: [{ severidade: 'danger' }, { severidade: 'danger' }, { severidade: 'warning' }] }
    abrir()
    await waitFor(() => expect(within(indicador('Alertas urgentes')).getByText('2')).toBeInTheDocument())
  })

  it('sem processos, explica o que vai aparecer em vez de mostrar tabelas vazias', async () => {
    h.listarProcessos.mockResolvedValue([])
    h.movimentos.mockResolvedValue([])
    abrir()
    expect(await screen.findByText(/Nenhum processo em andamento/)).toBeInTheDocument()
    expect(screen.getByText('Nada travado agora.')).toBeInTheDocument()
    expect(screen.getByText('Ainda não há movimentações.')).toBeInTheDocument()
    expect(screen.getByText('Nenhum processo parado ou atrasado agora.')).toBeInTheDocument()
  })

  it('sem a migration, avisa o que falta mas mostra o resumo das contratações', async () => {
    h.listarProcessos.mockRejectedValue({ code: '42P01', message: 'relation does not exist' })
    abrir()
    expect(await screen.findByText(/ainda não foi ativada/)).toBeInTheDocument()
    expect(screen.getByText('Contratações')).toBeInTheDocument()
  })

  it('o guia "Como tramitar um processo" do presidente existe e começa recolhido', async () => {
    abrir()
    const guia = await screen.findByRole('region', { name: 'Como tramitar um processo' })
    expect(within(guia).getByRole('button', { name: 'Mostrar guia' })).toBeInTheDocument()
  })
})

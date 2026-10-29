// Lista de processos: onde cada um está, vistas, busca, estados vazios e abertura de processo.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const h = vi.hoisted(() => ({ auth: {}, listarProcessos: vi.fn(), listarUnidades: vi.fn(), abrir: vi.fn() }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/context/GcContext', () => ({ useGc: () => ({ params: { tr_dias_parado: 5 } }) }))
vi.mock('../../src/services/tramitacao', async (importOriginal) => ({
  ...(await importOriginal()),
  listarProcessosAdm: h.listarProcessos,
  listarUnidades: h.listarUnidades,
  abrirProcessoAdm: h.abrir,
}))

import Processos from '../../src/pages/Processos'

const ha = (dias) => new Date(Date.now() - dias * 86400000).toISOString()
const UNIDADES = [
  { id: 'u-comp', sigla: 'COMP', nome: 'Compras e Licitações', ativa: true },
  { id: 'u-gcon', sigla: 'GCON', nome: 'Gestão de Contratos', ativa: true },
  { id: 'u-fin', sigla: 'FIN', nome: 'Financeiro', ativa: true },
  { id: 'u-rh', sigla: 'RH', nome: 'Recursos Humanos', ativa: false },
]
const proc = (extra) => ({
  situacao: 'em_andamento', tipo: 'Requerimento', prioridade: 'normal', interessado: null, prazo: null, responsavel_nome: null,
  recebido_em: ha(1), desde: ha(1), aberto_por: 'outro', aberto_em: ha(10), concluido_em: null, unidade_atual: 'u-gcon', ...extra,
})
const PROCESSOS = [
  proc({ id: 'p1', numero: '2026/000001', assunto: 'Compra de cadeiras', unidade_atual: 'u-gcon', desde: ha(1) }),
  proc({ id: 'p2', numero: '2026/000002', assunto: 'Pagamento de diárias', unidade_atual: 'u-fin', desde: ha(9), responsavel_nome: 'Elisa' }),
  proc({ id: 'p3', numero: '2026/000003', assunto: 'Contrato de limpeza', unidade_atual: 'u-gcon', recebido_em: null, desde: ha(0), aberto_por: 'eu' }),
  proc({ id: 'p4', numero: '2026/000004', assunto: 'Reembolso antigo', situacao: 'concluido', concluido_em: ha(3), desde: ha(8), unidade_atual: 'u-fin' }),
  proc({ id: 'p5', numero: '2026/000005', assunto: 'Prazo estourado', unidade_atual: 'u-comp', prazo: '2020-01-01', prioridade: 'urgente', desde: ha(2) }),
]

function abrir(rota = '/processos', { role = 'compras', unidade = 'u-gcon' } = {}) {
  h.auth = { role, user: { id: 'eu' }, profile: { id: 'eu', unidade_id: unidade } }
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/processos" element={<Processos />} />
        <Route path="/processos/:id" element={<div>detalhe aberto</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
const linhas = () => screen.getAllByRole('row').slice(1)
const protocolos = () => linhas().map((r) => within(r).queryByText(/^2026\/\d+$/)?.textContent).filter(Boolean)

beforeEach(() => {
  localStorage.clear()
  h.listarProcessos.mockReset().mockResolvedValue(PROCESSOS)
  h.listarUnidades.mockReset().mockResolvedValue(UNIDADES)
  h.abrir.mockReset().mockResolvedValue('novo-id')
})

describe('lista de processos', () => {
  it('mostra protocolo, assunto, onde está e o estado de cada processo', async () => {
    abrir()
    await screen.findByText('Compra de cadeiras')
    const p2 = linhas().find((r) => within(r).queryByText('Pagamento de diárias'))
    expect(within(p2).getByText('FIN')).toBeInTheDocument()
    expect(within(p2).getByText('Elisa')).toBeInTheDocument()
    expect(within(p2).getByText('Parado')).toBeInTheDocument()
    expect(within(p2).getByText('9')).toBeInTheDocument()
    const p3 = linhas().find((r) => within(r).queryByText('Contrato de limpeza'))
    expect(within(p3).getByText('Aguardando recebimento')).toBeInTheDocument()
    const p5 = linhas().find((r) => within(r).queryByText('Prazo estourado'))
    expect(within(p5).getByText('Atrasado')).toBeInTheDocument()
    expect(within(p5).getByText('Urgente')).toBeInTheDocument()
  })

  it('mostra primeiro o que está há mais tempo na unidade e deixa os concluídos por último', async () => {
    abrir()
    await screen.findByText('Compra de cadeiras')
    expect(protocolos()).toEqual(['2026/000002', '2026/000005', '2026/000001', '2026/000003', '2026/000004'])
  })

  it('cada vista mostra a sua contagem e filtra a lista', async () => {
    const ui = userEvent.setup()
    abrir()
    await screen.findByText('Compra de cadeiras')
    const aba = (nome) => screen.getByRole('tab', { name: new RegExp(nome) })
    expect(aba('Na minha unidade')).toHaveTextContent('2')       // p1 e p3, em GCON
    expect(aba('Abertos por mim')).toHaveTextContent('1')
    expect(aba('Aguardando recebimento')).toHaveTextContent('1')
    expect(aba('Precisam de atenção')).toHaveTextContent('2')    // parado + atrasado
    expect(aba('Concluídos')).toHaveTextContent('1')

    await ui.click(aba('Na minha unidade'))
    expect(protocolos()).toEqual(['2026/000001', '2026/000003'])
    await ui.click(aba('Precisam de atenção'))
    expect(protocolos()).toEqual(['2026/000002', '2026/000005'])
    await ui.click(aba('Concluídos'))
    expect(protocolos()).toEqual(['2026/000004'])
  })

  it('a vista e a unidade podem vir no endereço (links do painel de acompanhamento)', async () => {
    abrir('/processos?vista=atencao&unidade=u-fin')
    await screen.findByText('Pagamento de diárias')
    expect(protocolos()).toEqual(['2026/000002'])
    expect(screen.getByText(/Mostrando só a unidade/)).toHaveTextContent('FIN')
  })

  it('a busca acha por protocolo, assunto ou unidade', async () => {
    const ui = userEvent.setup()
    abrir()
    await screen.findByText('Compra de cadeiras')
    await ui.type(screen.getByLabelText('Buscar processos'), 'diárias')
    expect(protocolos()).toEqual(['2026/000002'])
    await ui.clear(screen.getByLabelText('Buscar processos'))
    await ui.type(screen.getByLabelText('Buscar processos'), '000005')
    expect(protocolos()).toEqual(['2026/000005'])
  })

  it('a busca pode vir no endereço (vem da Visão geral)', async () => {
    abrir('/processos?busca=diárias')
    await screen.findByText('Pagamento de diárias')
    expect(protocolos()).toEqual(['2026/000002'])
    expect(screen.getByLabelText('Buscar processos')).toHaveValue('diárias')
  })

  it('clicar numa linha abre o processo', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByText('Compra de cadeiras'))
    expect(await screen.findByText('detalhe aberto')).toBeInTheDocument()
  })
})

describe('estados vazios e permissões', () => {
  it('sem processos, quem pode abrir recebe o botão do primeiro', async () => {
    h.listarProcessos.mockResolvedValue([])
    abrir()
    expect(await screen.findByRole('button', { name: /Abrir o primeiro processo/ })).toBeInTheDocument()
  })

  it('a consulta vê a lista, sem poder abrir processos', async () => {
    h.listarProcessos.mockResolvedValue([])
    abrir('/processos', { role: 'viewer', unidade: null })
    await screen.findByText(/Ainda não há processos/)
    expect(screen.queryByRole('button', { name: /Novo processo/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Abrir o primeiro processo/ })).not.toBeInTheDocument()
  })

  it('sem a migration, explica o que falta em vez de mostrar erro técnico', async () => {
    h.listarProcessos.mockRejectedValue({ code: '42P01', message: 'relation "tr_processos" does not exist' })
    abrir()
    expect(await screen.findByText(/ainda não foi ativada/)).toBeInTheDocument()
    expect(screen.getByText(/20261021_tramitacao\.sql/)).toBeInTheDocument()
  })

  it('o guia "Como tramitar um processo" vem recolhido quando já há processos, para a lista aparecer logo', async () => {
    abrir()
    const guia = await screen.findByRole('region', { name: 'Como tramitar um processo' })
    expect(within(guia).getByRole('button', { name: 'Mostrar guia' })).toBeInTheDocument()
    expect(within(guia).queryByText('Abra um processo')).not.toBeInTheDocument()
  })

  it('e vem aberto para quem ainda não tem nenhum processo', async () => {
    h.listarProcessos.mockResolvedValue([])
    abrir()
    const guia = await screen.findByRole('region', { name: 'Como tramitar um processo' })
    expect(within(guia).getByText('Abra um processo')).toBeInTheDocument()
  })
})

describe('abrir um processo', () => {
  it('envia os dados ao banco e vai para o processo criado', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Novo processo/ }))
    const modal = screen.getByRole('dialog')
    await ui.selectOptions(within(modal).getByLabelText(/Tipo do processo/), 'Solicitação de compra')
    await ui.type(within(modal).getByLabelText(/Assunto/), 'Compra de projetor')
    await ui.selectOptions(within(modal).getByLabelText(/Prioridade/), 'alta')
    await ui.selectOptions(within(modal).getByLabelText(/Enviar para/), 'u-fin')
    await ui.type(within(modal).getByLabelText(/Despacho/), 'Verificar a dotação')
    await ui.click(within(modal).getByRole('button', { name: 'Abrir processo' }))

    await waitFor(() => expect(h.abrir).toHaveBeenCalledOnce())
    expect(h.abrir.mock.calls[0][0]).toMatchObject({
      tipo: 'Solicitação de compra', assunto: 'Compra de projetor', prioridade: 'alta', unidade_destino: 'u-fin', despacho: 'Verificar a dotação',
    })
    expect(await screen.findByText('detalhe aberto')).toBeInTheDocument()
  })

  it('a unidade da própria pessoa já vem escolhida, e unidade inativa não é oferecida', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Novo processo/ }))
    const destino = within(screen.getByRole('dialog')).getByLabelText(/Enviar para/)
    expect(destino).toHaveValue('u-gcon')
    expect(within(destino).queryByText(/RH/)).not.toBeInTheDocument()
  })

  it('se o banco recusar, mostra o motivo e não sai da tela', async () => {
    h.abrir.mockRejectedValue(new Error('Peça ao administrador para definir a sua unidade antes de abrir processos.'))
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Novo processo/ }))
    const modal = screen.getByRole('dialog')
    await ui.selectOptions(within(modal).getByLabelText(/Tipo do processo/), 'Outro')
    await ui.type(within(modal).getByLabelText(/Assunto/), 'Qualquer coisa')
    await ui.click(within(modal).getByRole('button', { name: 'Abrir processo' }))
    await waitFor(() => expect(h.abrir).toHaveBeenCalled())
    expect(screen.queryByText('detalhe aberto')).not.toBeInTheDocument()
  })
})

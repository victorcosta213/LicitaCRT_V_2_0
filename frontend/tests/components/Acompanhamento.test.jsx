// Painel de acompanhamento: onde estão os processos e o que está travando.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ params: { tr_dias_parado: 5 }, listarProcessos: vi.fn(), listarUnidades: vi.fn() }))
vi.mock('../../src/context/GcContext', () => ({ useGc: () => ({ params: h.params }) }))
vi.mock('../../src/services/tramitacao', async (importOriginal) => ({
  ...(await importOriginal()),
  listarProcessosAdm: h.listarProcessos,
  listarUnidades: h.listarUnidades,
}))

import Acompanhamento from '../../src/pages/Acompanhamento'

const ha = (dias) => new Date(Date.now() - dias * 86400000).toISOString()
const UNIDADES = [
  { id: 'u-gcon', sigla: 'GCON', nome: 'Gestão de Contratos', ativa: true },
  { id: 'u-fin', sigla: 'FIN', nome: 'Financeiro', ativa: true },
  { id: 'u-jur', sigla: 'JUR', nome: 'Jurídico', ativa: true },
]
const proc = (extra) => ({
  situacao: 'em_andamento', prazo: null, recebido_em: ha(1), desde: ha(1), unidade_atual: 'u-gcon', concluido_em: null, ...extra,
})
const PROCESSOS = [
  proc({ id: 'a', numero: '2026/000001', assunto: 'Em dia', unidade_atual: 'u-gcon' }),
  proc({ id: 'b', numero: '2026/000002', assunto: 'Parado há muito', unidade_atual: 'u-fin', desde: ha(12) }),
  proc({ id: 'c', numero: '2026/000003', assunto: 'Esperando recebimento', unidade_atual: 'u-fin', recebido_em: null, desde: ha(0) }),
  proc({ id: 'd', numero: '2026/000004', assunto: 'Prazo vencido', unidade_atual: 'u-gcon', prazo: '2020-01-01', desde: ha(2) }),
  proc({ id: 'e', numero: '2026/000005', assunto: 'Já resolvido', situacao: 'concluido', concluido_em: new Date().toISOString(), desde: ha(4) }),
]

const abrir = () => render(<MemoryRouter><Acompanhamento /></MemoryRouter>)
// o rótulo também aparece no cabeçalho da tabela: o indicador é o que está dentro de um link
const indicador = (rotulo) => screen.getAllByText(rotulo).map((el) => el.closest('a')).find(Boolean)

beforeEach(() => {
  h.params = { tr_dias_parado: 5 }
  h.listarProcessos.mockReset().mockResolvedValue(PROCESSOS)
  h.listarUnidades.mockReset().mockResolvedValue(UNIDADES)
})

describe('painel de acompanhamento', () => {
  it('os indicadores contam o que está andando, parado, atrasado e aguardando, cada um com o seu link', async () => {
    abrir()
    await screen.findByText('Parado há muito')
    expect(within(indicador('Em andamento')).getByText('4')).toBeInTheDocument()
    expect(within(indicador('Parados')).getByText('1')).toBeInTheDocument()
    expect(within(indicador('Atrasados')).getByText('1')).toBeInTheDocument()
    expect(within(indicador('Aguardando recebimento')).getByText('1')).toBeInTheDocument()
    expect(within(indicador('Concluídos no mês')).getByText('1')).toBeInTheDocument()
    expect(indicador('Parados')).toHaveAttribute('href', '/processos?vista=atencao')
    expect(indicador('Aguardando recebimento')).toHaveAttribute('href', '/processos?vista=receber')
  })

  it('mostra por unidade quantos há, quantos parados e a média de espera, com os parados primeiro', async () => {
    abrir()
    await screen.findByText('Parado há muito')
    const tabela = screen.getByRole('table', { name: 'Processos por unidade' })
    const linhas = within(tabela).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(2)
    expect(within(linhas[0]).getByRole('link', { name: 'FIN' })).toHaveAttribute('href', '/processos?unidade=u-fin')
    expect(within(linhas[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['FIN', '', '2', '1', '0', '6 d'])
    expect(within(linhas[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['GCON', '', '2', '0', '1', '1.5 d'])
  })

  it('lista o que está travado, do mais antigo para o mais novo', async () => {
    abrir()
    const card = (await screen.findByText('O que está travado')).closest('section')
    const itens = within(card).getAllByRole('link')
    expect(itens).toHaveLength(2)
    expect(itens[0]).toHaveTextContent('Parado há muito')
    expect(itens[0]).toHaveAttribute('href', '/processos/b')
    expect(itens[0]).toHaveTextContent('12 d')
    expect(itens[1]).toHaveTextContent('Prazo vencido')
  })

  it('o limite de dias parado vem dos parâmetros', async () => {
    h.params = { tr_dias_parado: 1 }
    abrir()
    await screen.findByText('Parado há muito')
    expect(within(indicador('Parados')).getByText('3')).toBeInTheDocument() // com limite de 1 dia: a (1), b (12) e d (2); c chegou hoje
    expect(screen.getByText(/depois de 1 dias sem movimentação/)).toBeInTheDocument()
  })

  it('sem processos em andamento, explica em vez de mostrar tabela vazia', async () => {
    h.listarProcessos.mockResolvedValue([])
    abrir()
    expect(await screen.findByText(/Nenhum processo em andamento/)).toBeInTheDocument()
    expect(screen.getByText(/Nada travado agora/)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Processos por unidade' })).not.toBeInTheDocument()
  })

  it('mais de dez travados: mostra dez e oferece a lista completa', async () => {
    h.listarProcessos.mockResolvedValue(Array.from({ length: 13 }, (_, i) => proc({
      id: `x${i}`, numero: `2026/0001${i}`, assunto: `Travado ${i}`, desde: ha(10 + i),
    })))
    abrir()
    const card = (await screen.findByText('O que está travado')).closest('section')
    expect(within(card).getAllByRole('link').filter((l) => l.getAttribute('href').startsWith('/processos/'))).toHaveLength(10)
    expect(within(card).getByRole('link', { name: /Ver os 13 que precisam de atenção/ })).toHaveAttribute('href', '/processos?vista=atencao')
  })

  it('sem a migration, explica o que falta', async () => {
    h.listarProcessos.mockRejectedValue({ code: '42P01', message: 'relation does not exist' })
    abrir()
    expect(await screen.findByText(/ainda não foi ativada/)).toBeInTheDocument()
  })
})

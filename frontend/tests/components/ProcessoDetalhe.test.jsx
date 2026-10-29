// Tela do processo: onde está, por onde passou, histórico e as ações de cada perfil.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const h = vi.hoisted(() => ({
  auth: {}, obter: vi.fn(), unidades: vi.fn(), pessoas: vi.fn(), tramitar: vi.fn(), receber: vi.fn(),
  concluir: vi.fn(), reabrir: vi.fn(), dados: vi.fn(), erro: vi.fn(),
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/context/GcContext', () => ({ useGc: () => ({ params: { tr_dias_parado: 5 } }) }))
vi.mock('../../src/utils/alerts', () => ({ showError: h.erro, showSuccess: vi.fn(), showConfirm: vi.fn() }))
vi.mock('../../src/services/tramitacao', async (importOriginal) => ({
  ...(await importOriginal()),
  obterProcessoAdm: h.obter, listarUnidades: h.unidades, listarPessoasDaUnidade: h.pessoas,
  tramitarProcessoAdm: h.tramitar, receberProcessoAdm: h.receber, concluirProcessoAdm: h.concluir,
  reabrirProcessoAdm: h.reabrir, atualizarDadosProcessoAdm: h.dados,
}))

import ProcessoDetalhe from '../../src/pages/ProcessoDetalhe'

const ha = (dias) => new Date(Date.now() - dias * 86400000).toISOString()
const UNIDADES = [
  { id: 'u-comp', sigla: 'COMP', nome: 'Compras e Licitações', ativa: true },
  { id: 'u-gcon', sigla: 'GCON', nome: 'Gestão de Contratos', ativa: true },
  { id: 'u-fin', sigla: 'FIN', nome: 'Financeiro', ativa: true },
]
const PROCESSO = {
  id: 'p1', numero: '2026/000007', tipo: 'Solicitação de compra', assunto: 'Compra de cadeiras', interessado: 'Maria',
  descricao: 'Dez cadeiras ergonômicas', prioridade: 'alta', prazo: '2099-12-31', situacao: 'em_andamento',
  unidade_atual: 'u-gcon', responsavel_atual: null, responsavel_nome: null, desde: ha(3), recebido_em: null,
  aberto_por: 'u-ana', aberto_por_nome: 'Ana Compras', aberto_em: ha(6), concluido_em: null, motivo_conclusao: null,
}
const HIST = [
  { id: 1, tipo: 'abertura', de_unidade: 'u-comp', para_unidade: 'u-comp', despacho: 'Pedido inicial', criada_em: ha(6), criada_por_nome: 'Ana Compras' },
  { id: 2, tipo: 'envio', de_unidade: 'u-comp', para_unidade: 'u-gcon', despacho: 'Conferir o contrato vigente', criada_em: ha(3), criada_por_nome: 'Ana Compras', para_usuario_nome: 'Gil Gestor' },
]

function abrir({ role = 'gestor', unidade = 'u-gcon', userId = 'u-gil', processo = PROCESSO, hist = HIST, falha = null } = {}) {
  h.auth = { role, user: { id: userId }, profile: { id: userId, unidade_id: unidade } }
  if (falha) h.obter.mockRejectedValue(falha)
  else h.obter.mockResolvedValue({ processo, tramitacoes: hist })
  return render(
    <MemoryRouter initialEntries={['/processos/p1']}>
      <Routes><Route path="/processos/:id" element={<ProcessoDetalhe />} /></Routes>
    </MemoryRouter>,
  )
}
const botao = (nome) => screen.queryByRole('button', { name: new RegExp(nome) })

beforeEach(() => {
  h.obter.mockReset()
  h.unidades.mockReset().mockResolvedValue(UNIDADES)
  h.pessoas.mockReset().mockResolvedValue([{ id: 'u-fe', nome: 'Fabio Financeiro' }])
  for (const f of [h.tramitar, h.receber, h.concluir, h.reabrir, h.dados, h.erro]) f.mockReset().mockResolvedValue()
})

describe('o que a tela mostra', () => {
  it('onde o processo está agora, com unidade, estado e tempo', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Processo 2026/000007' })).toBeInTheDocument()
    const card = screen.getByText('Onde está agora').closest('section')
    expect(within(card).getByText('GCON')).toBeInTheDocument()
    expect(within(card).getByText('Gestão de Contratos')).toBeInTheDocument()
    expect(within(card).getByText('Aguardando recebimento')).toBeInTheDocument()
    expect(within(card).getByText(/ainda não recebido pela unidade/)).toBeInTheDocument()
    expect(within(card).getByText(/\(3 dias\)/)).toBeInTheDocument()
  })

  it('o histórico traz quem fez, o despacho e para quem foi', async () => {
    abrir()
    const historico = (await screen.findByText('Histórico')).closest('section')
    expect(within(historico).getByText('Pedido inicial')).toBeInTheDocument()
    expect(within(historico).getByText('Conferir o contrato vigente')).toBeInTheDocument()
    expect(within(historico).getByText((_, el) => el.classList.contains('linha-tempo__titulo') && /Enviado · COMP\s+GCON/.test(el.textContent))).toBeInTheDocument()
    expect(within(historico).getByText('(Gil Gestor)')).toBeInTheDocument()
    expect(within(historico).getAllByText(/Ana Compras/)).toHaveLength(2)
  })

  it('"Por onde passou" mede o tempo em cada unidade e marca a atual', async () => {
    abrir()
    const card = (await screen.findByText('Por onde passou')).closest('section')
    const itens = within(card).getAllByRole('listitem')
    expect(itens).toHaveLength(2)
    expect(within(itens[0]).getByText('COMP')).toBeInTheDocument()
    expect(within(itens[0]).getByText('3 dias')).toBeInTheDocument()
    expect(itens[1]).toHaveClass('permanencias__item--atual')
    expect(within(itens[1]).getByText(/→ hoje/)).toBeInTheDocument()
  })

  it('mostra os dados do processo', async () => {
    abrir()
    const card = (await screen.findByText('Dados do processo')).closest('section')
    for (const t of ['Solicitação de compra', 'Maria', 'Alta', '31/12/2099', 'Ana Compras', 'Dez cadeiras ergonômicas']) {
      expect(within(card).getByText(t)).toBeInTheDocument()
    }
  })

  it('processo inexistente ou sem acesso mostra a explicação', async () => {
    abrir({ processo: null })
    expect(await screen.findByText(/não existe ou a sua unidade ainda não teve acesso/)).toBeInTheDocument()
  })

  it('sem a migration, explica o que falta', async () => {
    abrir({ falha: { code: '42P01', message: 'relation "tr_processos" does not exist' } })
    expect(await screen.findByText(/ainda não foi ativada/)).toBeInTheDocument()
  })
})

describe('quem pode agir', () => {
  it('a unidade onde o processo está recebe, envia, altera e conclui', async () => {
    abrir()
    await screen.findByText('Onde está agora')
    for (const nome of ['Receber processo', 'Enviar para outra unidade', 'Alterar dados', 'Concluir']) expect(botao(nome), nome).toBeInTheDocument()
    expect(botao('Reabrir')).not.toBeInTheDocument()
  })

  it('depois de recebido, some o botão de receber', async () => {
    abrir({ processo: { ...PROCESSO, recebido_em: ha(1), responsavel_nome: 'Gil Gestor' } })
    await screen.findByText('Onde está agora')
    expect(botao('Receber processo')).not.toBeInTheDocument()
    expect(botao('Enviar para outra unidade')).toBeInTheDocument()
  })

  it('quem está em outra unidade só acompanha', async () => {
    abrir({ role: 'compras', unidade: 'u-comp', userId: 'u-ana' })
    await screen.findByText('Onde está agora')
    for (const nome of ['Receber', 'Enviar', 'Alterar', 'Concluir', 'Reabrir']) expect(botao(nome), nome).not.toBeInTheDocument()
  })

  it('a consulta só acompanha, mesmo na unidade do processo', async () => {
    abrir({ role: 'viewer' })
    await screen.findByText('Onde está agora')
    for (const nome of ['Receber', 'Enviar', 'Alterar', 'Concluir']) expect(botao(nome), nome).not.toBeInTheDocument()
  })

  it('o responsável atual age mesmo que a sua unidade tenha mudado', async () => {
    abrir({ role: 'fiscal', unidade: 'u-comp', userId: 'u-fe', processo: { ...PROCESSO, responsavel_atual: 'u-fe', recebido_em: ha(1) } })
    await screen.findByText('Onde está agora')
    expect(botao('Enviar para outra unidade')).toBeInTheDocument()
  })

  it('o administrador age em qualquer processo', async () => {
    abrir({ role: 'admin', unidade: null, userId: 'u-adm' })
    await screen.findByText('Onde está agora')
    expect(botao('Enviar para outra unidade')).toBeInTheDocument()
  })

  it('concluído: a gestão reabre mesmo fora da unidade; compras fora da unidade não', async () => {
    const concluido = { ...PROCESSO, situacao: 'concluido', concluido_em: ha(1), motivo_conclusao: 'Cadeiras entregues' }
    const { unmount } = abrir({ role: 'gestor', unidade: 'u-comp', processo: concluido })
    expect(await screen.findByText('Cadeiras entregues')).toBeInTheDocument()
    expect(botao('Reabrir')).toBeInTheDocument()
    expect(botao('Enviar')).not.toBeInTheDocument()
    unmount()
    abrir({ role: 'compras', unidade: 'u-comp', userId: 'u-ana', processo: concluido })
    await screen.findByText('Cadeiras entregues')
    expect(botao('Reabrir')).not.toBeInTheDocument()
  })
})

describe('ações', () => {
  it('receber chama o banco com o processo e recarrega', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Receber processo/ }))
    await waitFor(() => expect(h.receber).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(h.obter.mock.calls.length).toBeGreaterThan(1))
  })

  it('enviar exige unidade e despacho, e oferece as pessoas da unidade escolhida', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Enviar para outra unidade/ }))
    const modal = screen.getByRole('dialog')
    const pessoa = within(modal).getByLabelText(/Pessoa/)
    expect(pessoa).toBeDisabled()
    await ui.selectOptions(within(modal).getByLabelText(/Enviar para/), 'u-fin')
    await waitFor(() => expect(h.pessoas).toHaveBeenCalledWith('u-fin'))
    await ui.selectOptions(await within(modal).findByLabelText(/Pessoa/, {}, { timeout: 2000 }).then((el) => { expect(el).toBeEnabled(); return el }), 'u-fe')
    await ui.type(within(modal).getByLabelText(/Despacho/), 'Verificar a dotação')
    await ui.click(within(modal).getByRole('button', { name: /Enviar processo/ }))
    await waitFor(() => expect(h.tramitar).toHaveBeenCalledWith('p1', {
      unidade_destino: 'u-fin', usuario_destino: 'u-fe', despacho: 'Verificar a dotação', prazo: '',
    }))
  })

  it('a unidade desativada não é oferecida como destino', async () => {
    h.unidades.mockResolvedValue([...UNIDADES, { id: 'u-rh', sigla: 'RH', nome: 'Recursos Humanos', ativa: false }])
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Enviar para outra unidade/ }))
    const destino = within(screen.getByRole('dialog')).getByLabelText(/Enviar para/)
    expect(within(destino).queryByText(/RH/)).not.toBeInTheDocument()
    expect(within(destino).getByText(/GCON — Gestão de Contratos \(atual\)/)).toBeInTheDocument()
  })

  it('concluir pede como foi resolvido', async () => {
    const ui = userEvent.setup()
    abrir({ processo: { ...PROCESSO, recebido_em: ha(1) } })
    await ui.click(await screen.findByRole('button', { name: /Concluir/ }))
    const modal = screen.getByRole('dialog')
    await ui.type(within(modal).getByLabelText(/Como o processo foi resolvido/), 'Cadeiras entregues')
    await ui.click(within(modal).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(h.concluir).toHaveBeenCalledWith('p1', 'Cadeiras entregues'))
  })

  it('reabrir pede o motivo', async () => {
    const ui = userEvent.setup()
    abrir({ processo: { ...PROCESSO, situacao: 'concluido', concluido_em: ha(1), motivo_conclusao: 'ok' } })
    await ui.click(await screen.findByRole('button', { name: /Reabrir/ }))
    const modal = screen.getByRole('dialog')
    await ui.type(within(modal).getByLabelText(/Motivo da reabertura/), 'Faltou uma peça')
    await ui.click(within(modal).getByRole('button', { name: 'Reabrir' }))
    await waitFor(() => expect(h.reabrir).toHaveBeenCalledWith('p1', 'Faltou uma peça'))
  })

  it('alterar dados envia os campos editados', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Alterar dados/ }))
    const modal = screen.getByRole('dialog')
    const assunto = within(modal).getByLabelText(/Assunto/)
    await ui.clear(assunto)
    await ui.type(assunto, 'Cadeiras ergonômicas')
    await ui.click(within(modal).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(h.dados).toHaveBeenCalled())
    expect(h.dados.mock.calls[0][0]).toBe('p1')
    expect(h.dados.mock.calls[0][1]).toMatchObject({ assunto: 'Cadeiras ergonômicas', prioridade: 'alta', prazo: '2099-12-31' })
  })

  it('se o banco recusar o recebimento, mostra o motivo', async () => {
    h.receber.mockRejectedValue(new Error('Somente a unidade onde o processo está pode recebê-lo.'))
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Receber processo/ }))
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Somente a unidade onde o processo está pode recebê-lo.'))
  })
})

// Tarefas da Minha mesa vindas da tramitação.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ listar: vi.fn() }))
vi.mock('../../src/services/tramitacao', async (importOriginal) => ({ ...(await importOriginal()), listarProcessosAdm: h.listar }))

import { useTarefasTramitacao } from '../../src/components/useTarefasTramitacao'

const ha = (dias) => new Date(Date.now() - dias * 86400000).toISOString()
const proc = (extra) => ({
  situacao: 'em_andamento', assunto: 'Assunto', tipo: 'Requerimento', prazo: null, unidade_atual: 'u-minha',
  responsavel_atual: null, recebido_em: ha(1), desde: ha(1), ...extra,
})

function Sonda(props) {
  const tarefas = useTarefasTramitacao(props)
  return <ul>{tarefas.map((t) => <li key={t.id}>{`${t.ref}|${t.titulo}|${t.severidade}`}</li>)}<li>total {tarefas.length}</li></ul>
}
const itens = () => screen.getAllByRole('listitem').map((li) => li.textContent)

// O cache de leitura é do módulo e vale 1 minuto: cada teste avança o relógio para não reaproveitar o anterior
let rodada = 0
const novaRodada = () => {
  rodada += 1
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + rodada * 120000)
}
const montar = async (processos, props) => {
  novaRodada()
  h.listar.mockResolvedValue(processos)
  render(<Sonda {...props} />)
  await waitFor(() => expect(h.listar).toHaveBeenCalled())
}

beforeEach(() => { vi.restoreAllMocks(); h.listar.mockReset() })

describe('tarefas da tramitação', () => {
  it('traz o que chegou à minha unidade e ainda não foi recebido', async () => {
    await montar([proc({ id: '1', numero: 'A', recebido_em: null })], { ativo: true, unidadeId: 'u-minha', usuarioId: 'eu' })
    await waitFor(() => expect(itens()).toContain('A|Processo aguardando o seu recebimento|info'))
  })

  it('traz o que está parado ou atrasado com a minha unidade, e ignora o que anda bem', async () => {
    await montar([
      proc({ id: '1', numero: 'OK' }),
      proc({ id: '2', numero: 'PARADO', desde: ha(9) }),
      proc({ id: '3', numero: 'ATRASADO', prazo: '2020-01-01' }),
    ], { ativo: true, unidadeId: 'u-minha', usuarioId: 'eu' })
    await waitFor(() => expect(itens()).toEqual(expect.arrayContaining(['PARADO|Processo parado há 9 dias|warning', 'ATRASADO|Processo com prazo vencido|danger'])))
    expect(itens().join()).not.toContain('OK|')
  })

  it('só os da minha unidade ou comigo; concluídos e de outras unidades ficam de fora', async () => {
    await montar([
      proc({ id: '1', numero: 'OUTRA', unidade_atual: 'u-outra', recebido_em: null }),
      proc({ id: '2', numero: 'COMIGO', unidade_atual: 'u-outra', responsavel_atual: 'eu', recebido_em: null }),
      proc({ id: '3', numero: 'FIM', situacao: 'concluido', recebido_em: null }),
    ], { ativo: true, unidadeId: 'u-minha', usuarioId: 'eu' })
    await waitFor(() => expect(itens()).toContain('COMIGO|Processo aguardando o seu recebimento|info'))
    expect(itens()).toContain('total 1')
  })

  it('o limite de dias parado é configurável', async () => {
    await montar([proc({ id: '1', numero: 'P', desde: ha(3) })], { ativo: true, unidadeId: 'u-minha', usuarioId: 'eu', diasParado: 2 })
    await waitFor(() => expect(itens()).toContain('P|Processo parado há 3 dias|warning'))
  })

  it('desativado (consulta): não traz nada nem consulta o banco', async () => {
    novaRodada()
    h.listar.mockResolvedValue([proc({ id: '1', numero: 'A', recebido_em: null })])
    render(<Sonda ativo={false} unidadeId="u-minha" usuarioId="eu" />)
    expect(itens()).toEqual(['total 0'])
    expect(h.listar).not.toHaveBeenCalled()
  })

  it('sem unidade nem usuário, não há de quem ser a tarefa', async () => {
    await montar([proc({ id: '1', numero: 'A', recebido_em: null })], { ativo: true })
    expect(itens()).toEqual(['total 0'])
  })

  it('ao trocar de conta no mesmo navegador, relê e não mostra a lista da conta anterior', async () => {
    novaRodada()
    h.listar.mockResolvedValue([proc({ id: '1', numero: 'DA-ANA', recebido_em: null })])
    const { rerender } = render(<Sonda ativo unidadeId="u-minha" usuarioId="ana" />)
    await waitFor(() => expect(itens()).toContain('DA-ANA|Processo aguardando o seu recebimento|info'))

    // outra pessoa entra em seguida (dentro do prazo do cache); o banco devolve só o que ela vê
    h.listar.mockResolvedValue([proc({ id: '2', numero: 'DO-BRUNO', recebido_em: null })])
    rerender(<Sonda ativo unidadeId="u-minha" usuarioId="bruno" />)
    await waitFor(() => expect(itens()).toContain('DO-BRUNO|Processo aguardando o seu recebimento|info'))
    expect(itens().join()).not.toContain('DA-ANA')
    expect(h.listar).toHaveBeenCalledTimes(2)
  })

  it('resposta atrasada da conta anterior não aparece para a conta nova', async () => {
    novaRodada()
    let responderAna
    h.listar.mockReturnValueOnce(new Promise((ok) => { responderAna = ok }))
    const { rerender } = render(<Sonda ativo unidadeId="u-minha" usuarioId="ana" />)
    await waitFor(() => expect(h.listar).toHaveBeenCalledTimes(1))
    h.listar.mockResolvedValueOnce([])
    rerender(<Sonda ativo unidadeId="u-minha" usuarioId="bruno" />)
    await waitFor(() => expect(h.listar).toHaveBeenCalledTimes(2))
    responderAna([proc({ id: '1', numero: 'SO-DA-ANA', recebido_em: null })])
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(itens()).toEqual(['total 0'])
  })

  it('sem a migration (a leitura falha), a mesa segue sem erro', async () => {
    novaRodada()
    h.listar.mockRejectedValue({ code: '42P01' })
    render(<Sonda ativo unidadeId="u-minha" usuarioId="eu" />)
    await waitFor(() => expect(h.listar).toHaveBeenCalled())
    expect(itens()).toEqual(['total 0'])
  })
})

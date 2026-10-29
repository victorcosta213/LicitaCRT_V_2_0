import { describe, expect, it } from 'vitest'
import {
  STATUS_SOL, combinaBuscaSol, dadosDoDfd, devolvidasDaUnidade, dfdJaEnviada, dfdsDisponiveis, naVistaSol, ordenarSolicitacoes, podeEditarSol, tarefasDeSolicitacoes, vistasSol,
} from '../../src/utils/solicitacoes'

const sol = (extra) => ({
  id: 's1', numero: 'SOL-2026/000001', objeto: 'Cadeiras', justificativa: 'Quebradas', status: 'enviada', prioridade: 'normal',
  solicitante: 'ana', solicitante_nome: 'Ana', unidade_id: 'u-rh', enviada_em: '2026-10-20T10:00:00Z', ...extra,
})

describe('situações e vistas', () => {
  it('cada situação tem rótulo e cor', () => {
    expect(Object.keys(STATUS_SOL)).toEqual(['enviada', 'devolvida', 'aceita', 'recusada', 'cancelada'])
    for (const s of Object.values(STATUS_SOL)) expect(s.label && s.kind).toBeTruthy()
  })

  it('o Compras começa pelo que espera análise; os setores, por todas', () => {
    expect(vistasSol(true)[0][0]).toBe('analise')
    expect(vistasSol(false)[0][0]).toBe('todas')
    expect(vistasSol(true).map(([k]) => k).sort()).toEqual(vistasSol(false).map(([k]) => k).sort())
  })

  it('as vistas filtram pela situação', () => {
    expect(naVistaSol(sol(), 'analise')).toBe(true)
    expect(naVistaSol(sol({ status: 'devolvida' }), 'devolvidas')).toBe(true)
    expect(naVistaSol(sol({ status: 'aceita' }), 'aceitas')).toBe(true)
    expect(naVistaSol(sol({ status: 'recusada' }), 'encerradas')).toBe(true)
    expect(naVistaSol(sol({ status: 'cancelada' }), 'encerradas')).toBe(true)
    expect(naVistaSol(sol({ status: 'aceita' }), 'analise')).toBe(false)
    expect(naVistaSol(sol({ status: 'cancelada' }), 'todas')).toBe(true)
  })

  it('a busca acha por número, objeto, quem pediu e setor', () => {
    const unidades = new Map([['u-rh', { sigla: 'RH', nome: 'Recursos Humanos' }]])
    for (const t of ['000001', 'cadeiras', 'ANA', 'rh', 'humanos', '']) expect(combinaBuscaSol(sol(), t, unidades), t).toBe(true)
    expect(combinaBuscaSol(sol(), 'zzz', unidades)).toBe(false)
  })

  it('ordena: devolvidas, depois aguardando (urgentes e mais antigas primeiro), depois o resto', () => {
    const r = ordenarSolicitacoes([
      sol({ id: 'aceita', status: 'aceita' }),
      sol({ id: 'nova', enviada_em: '2026-10-25T00:00:00Z' }),
      sol({ id: 'velha', enviada_em: '2026-10-01T00:00:00Z' }),
      sol({ id: 'urgente', prioridade: 'urgente', enviada_em: '2026-10-28T00:00:00Z' }),
      sol({ id: 'dev', status: 'devolvida' }),
      sol({ id: 'canc', status: 'cancelada' }),
    ])
    expect(r.map((s) => s.id)).toEqual(['dev', 'urgente', 'velha', 'nova', 'aceita', 'canc'])
  })
})

describe('quem corrige e as tarefas da mesa', () => {
  it('corrige quem pediu, a unidade solicitante ou a administração', () => {
    expect(podeEditarSol(sol(), { usuarioId: 'ana' })).toBe(true)
    expect(podeEditarSol(sol(), { usuarioId: 'bia', unidadeId: 'u-rh' })).toBe(true)
    expect(podeEditarSol(sol(), { usuarioId: 'bia', unidadeId: 'u-ti' })).toBe(false)
    expect(podeEditarSol(sol(), { usuarioId: 'bia', master: true })).toBe(true)
    expect(podeEditarSol(null, { usuarioId: 'ana' })).toBe(false)
  })

  it('o Compras recebe tarefa do que espera análise; fica urgente com prioridade urgente ou mais de 5 dias', () => {
    const agora = new Date('2026-10-29T12:00:00Z').getTime()
    const t = tarefasDeSolicitacoes([
      sol({ id: 'a', enviada_em: '2026-10-28T12:00:00Z' }),
      sol({ id: 'b', enviada_em: '2026-10-10T12:00:00Z' }),
      sol({ id: 'c', prioridade: 'urgente', enviada_em: '2026-10-29T10:00:00Z' }),
      sol({ id: 'd', status: 'aceita' }),
    ], { ehCompras: true, usuarioId: 'compras', unidadeId: 'u-comp', agora })
    expect(t.map((x) => [x.id, x.severidade])).toEqual([['sol:a', 'warning'], ['sol:b', 'danger'], ['sol:c', 'danger']])
    expect(t[0]).toMatchObject({ to: '/solicitacoes/a', ref: 'SOL-2026/000001', categoria: 'Solicitação' })
    expect(t[1].sub).toContain('há 19 dia(s)')
  })

  it('a unidade recebe tarefa da devolvida, com o motivo; outros setores e o Compras, não', () => {
    const lista = [sol({ status: 'devolvida', motivo: 'Detalhe a quantidade' })]
    const minha = tarefasDeSolicitacoes(lista, { ehCompras: false, usuarioId: 'bia', unidadeId: 'u-rh' })
    expect(minha).toHaveLength(1)
    expect(minha[0]).toMatchObject({ severidade: 'danger', sub: 'Detalhe a quantidade' })
    expect(tarefasDeSolicitacoes(lista, { ehCompras: false, usuarioId: 'bia', unidadeId: 'u-ti' })).toEqual([])
    expect(tarefasDeSolicitacoes(lista, { ehCompras: true, usuarioId: 'compras', unidadeId: 'u-comp' })).toEqual([])
  })
})

describe('DFD na solicitação', () => {
  it('o pedido sai da DFD: itens, total, tipo de objeto, prazo e prioridade convertida', () => {
    const d = { titulo: 'DFD', conteudo: {
      objeto: 'Computadores', objeto_tipo: 'bens-permanentes', necessidade: 'Equipamentos obsoletos', resultados: 'Atendimento mais rápido',
      data_pretendida: '2026-12-01', prioridade: 'media', previsto_pca: 'sim',
      itens: [
        { nome: 'Computador', unidade: 'unidade', quantidade: '1500', valor_unitario: '4500' },
        { nome: 'Monitor', unidade: 'unidade', quantidade: '10', valor_unitario: '' },
        { nome: 'Sem quantidade', unidade: 'unidade', quantidade: '', valor_unitario: '10' },
      ],
    } }
    expect(dadosDoDfd(d)).toEqual({
      objeto: 'Computadores', quantidade: '1.500 unidade — Computador\n10 unidade — Monitor',
      justificativa: 'Equipamentos obsoletos\n\nResultados pretendidos: Atendimento mais rápido',
      objeto_tipo: 'bens-permanentes', valor_estimado: 6750000, data_pretendida: '2026-12-01', prioridade: 'normal', previsto_pca: 'sim',
    })
    expect(dadosDoDfd({ titulo: 'Só título', conteudo: {} })).toMatchObject({ objeto: 'Só título', prioridade: 'normal', justificativa: '', valor_estimado: '' })
  })

  it('pedidos devolvidos da secretaria e DFD já enviada', () => {
    const lista = [sol({ id: 'a', status: 'devolvida' }), sol({ id: 'b', status: 'devolvida', unidade_id: 'u-ti', solicitante: 'x' }), sol({ id: 'c', documento_id: 'd1' })]
    expect(devolvidasDaUnidade(lista, { usuarioId: 'bia', unidadeId: 'u-rh' }).map((s) => s.id)).toEqual(['a'])
    expect(dfdJaEnviada(lista, 'd1')).toBe(true)
    expect(dfdJaEnviada([sol({ documento_id: 'd1', status: 'recusada' })], 'd1')).toBe(false)
  })

  it('só oferece DFD assinado, fora de processo e ainda não enviado (salvo na própria solicitação)', () => {
    const docs = [
      { id: 'ok', modelo: 'dfd', status: 'assinado' },
      { id: 'rasc', modelo: 'dfd', status: 'rascunho' },
      { id: 'proc', modelo: 'dfd', status: 'assinado', processo_id: 'p1' },
      { id: 'enviado', modelo: 'dfd', status: 'assinado' },
      { id: 'recusado', modelo: 'dfd', status: 'assinado' },
      { id: 'oficio', modelo: 'oficio', status: 'assinado' },
    ]
    const sols = [sol({ id: 'x', documento_id: 'enviado' }), sol({ id: 'y', documento_id: 'recusado', status: 'recusada' })]
    expect(dfdsDisponiveis(docs, sols).map((d) => d.id)).toEqual(['ok', 'recusado'])
    expect(dfdsDisponiveis(docs, sols, { atual: 'x' }).map((d) => d.id)).toEqual(['ok', 'enviado', 'recusado'])
  })
})

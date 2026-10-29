import { describe, expect, it } from 'vitest'
import {
  DIAS_PARADO_PADRAO, VERBOS_MOVIMENTO, combinaBusca, estadoDoProcesso, haQuanto, indicadores, naVista, ordenarParaLista,
  permanencias, processosTravados, resumoPorUnidade, tarefaDeProcesso,
} from '../../src/utils/tramitacao'

// "hoje" fixo: 29/10/2026, meio-dia no fuso local
const AGORA = new Date(2026, 9, 29, 12)
const em = (dia, hora = 12) => new Date(2026, 9, dia, hora).toISOString()
const op = { agora: AGORA }

const U = { gcon: { id: 'u-gcon', sigla: 'GCON', nome: 'Gestão de Contratos' }, fin: { id: 'u-fin', sigla: 'FIN', nome: 'Financeiro' }, jur: { id: 'u-jur', sigla: 'JUR', nome: 'Jurídico' } }
const unidades = Object.values(U)
const porId = new Map(unidades.map((u) => [u.id, u]))

const proc = (extra = {}) => ({
  id: 'p1', numero: '2026/000001', assunto: 'Compra de cadeiras', tipo: 'Requerimento', interessado: 'Maria', situacao: 'em_andamento',
  unidade_atual: 'u-gcon', responsavel_atual: null, responsavel_nome: null, desde: em(28), recebido_em: em(28), prazo: null,
  aberto_por: 'u1', aberto_em: em(20), concluido_em: null, ...extra,
})

describe('estado do processo', () => {
  it('concluído vale sozinho', () => {
    expect(estadoDoProcesso(proc({ situacao: 'concluido', prazo: '2026-01-01' }), op)).toMatchObject({ chave: 'concluido', label: 'Concluído' })
  })

  it('chegou e ninguém abriu: aguardando recebimento', () => {
    expect(estadoDoProcesso(proc({ recebido_em: null }), op)).toMatchObject({ chave: 'aguardando_recebimento', diasNaUnidade: 1 })
  })

  it('recebido e dentro do prazo: em análise', () => {
    expect(estadoDoProcesso(proc(), op)).toMatchObject({ chave: 'em_analise', diasNaUnidade: 1, parado: false, atrasado: false })
  })

  it(`parado a partir de ${DIAS_PARADO_PADRAO} dias na mesma unidade`, () => {
    expect(estadoDoProcesso(proc({ desde: em(25) }), op)).toMatchObject({ chave: 'em_analise', diasNaUnidade: 4 })
    expect(estadoDoProcesso(proc({ desde: em(24) }), op)).toMatchObject({ chave: 'parado', diasNaUnidade: 5, parado: true })
  })

  it('o limite de dias é configurável', () => {
    expect(estadoDoProcesso(proc({ desde: em(27) }), { ...op, diasParado: 2 })).toMatchObject({ chave: 'parado' })
    expect(estadoDoProcesso(proc({ desde: em(20) }), { ...op, diasParado: 30 })).toMatchObject({ chave: 'em_analise' })
  })

  it('prazo vencido é atrasado, e vale mais que parado', () => {
    expect(estadoDoProcesso(proc({ prazo: '2026-10-28' }), op)).toMatchObject({ chave: 'atrasado', diasPrazo: -1, atrasado: true })
    expect(estadoDoProcesso(proc({ prazo: '2026-10-28', desde: em(10) }), op)).toMatchObject({ chave: 'atrasado', parado: true })
  })

  it('o prazo que vence hoje ainda não é atraso', () => {
    expect(estadoDoProcesso(proc({ prazo: '2026-10-29' }), op)).toMatchObject({ chave: 'em_analise', diasPrazo: 0, atrasado: false })
  })

  it('o relógio não anda para trás (chegou "no futuro" conta 0 dias)', () => {
    expect(estadoDoProcesso(proc({ desde: em(30) }), op).diasNaUnidade).toBe(0)
  })
})

describe('indicadores e resumo por unidade', () => {
  const lista = [
    proc({ id: 'a' }),                                                          // em análise
    proc({ id: 'b', recebido_em: null }),                                        // aguardando recebimento
    proc({ id: 'c', desde: em(20), unidade_atual: 'u-fin' }),                    // parado (9 dias)
    proc({ id: 'd', prazo: '2026-10-20', unidade_atual: 'u-fin', desde: em(27) }), // atrasado
    proc({ id: 'e', situacao: 'concluido', concluido_em: em(10) }),              // concluído neste mês
    proc({ id: 'f', situacao: 'concluido', concluido_em: new Date(2026, 8, 10).toISOString() }), // concluído em setembro
  ]

  it('conta o que está andando, parado, atrasado e aguardando', () => {
    expect(indicadores(lista, op)).toEqual({ emAndamento: 4, parados: 1, atrasados: 1, aguardandoRecebimento: 1, concluidosNoMes: 1 })
  })

  it('resume por unidade, com os parados primeiro e a média de espera', () => {
    const r = resumoPorUnidade(lista, unidades, op)
    expect(r.map((l) => l.unidade.sigla)).toEqual(['FIN', 'GCON'])
    expect(r[0]).toMatchObject({ total: 2, parados: 1, atrasados: 1, maisAntigo: 9 })
    expect(r[0].mediaDias).toBe(5.5)
    expect(r[1]).toMatchObject({ total: 2, parados: 0, mediaDias: 1 })
  })

  it('não lista unidade sem processo nem conta concluídos', () => {
    expect(resumoPorUnidade([proc({ situacao: 'concluido' })], unidades, op)).toEqual([])
  })

  it('os travados vêm do mais antigo na unidade para o mais novo', () => {
    expect(processosTravados(lista, op).map(({ p }) => p.id)).toEqual(['c', 'd'])
    expect(processosTravados([proc()], op)).toEqual([])
  })
})

describe('por onde o processo passou', () => {
  const t = (id, tipo, para, dia) => ({ id, tipo, para_unidade: para, criada_em: em(dia) })

  it('mede cada permanência e marca a atual', () => {
    const hist = [t(1, 'abertura', 'u-gcon', 20), t(2, 'recebimento', 'u-gcon', 21), t(3, 'envio', 'u-jur', 24), t(4, 'alteracao', 'u-jur', 25), t(5, 'envio', 'u-fin', 28)]
    const r = permanencias(proc({ unidade_atual: 'u-fin' }), hist, porId, AGORA)
    expect(r.map((x) => [x.unidade.sigla, x.dias, x.atual])).toEqual([['GCON', 4, false], ['JUR', 4, false], ['FIN', 1, true]])
  })

  it('processo concluído fecha a última permanência na data da conclusão', () => {
    const hist = [t(1, 'abertura', 'u-gcon', 20), t(2, 'conclusao', 'u-gcon', 22)]
    const r = permanencias(proc({ situacao: 'concluido', concluido_em: em(22) }), hist, porId, AGORA)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ dias: 2, atual: false, ate: em(22) })
  })

  it('reabrir começa uma nova permanência', () => {
    const hist = [t(1, 'abertura', 'u-gcon', 20), t(2, 'conclusao', 'u-gcon', 22), t(3, 'reabertura', 'u-gcon', 26)]
    expect(permanencias(proc(), hist, porId, AGORA).map((x) => x.dias)).toEqual([6, 3])
  })

  it('unidade desconhecida não quebra', () => {
    expect(permanencias(proc(), [t(1, 'abertura', 'u-x', 28)], porId, AGORA)[0].unidade).toBeNull()
  })
})

describe('vistas, busca e ordem da lista', () => {
  const eu = { usuarioId: 'u1', unidadeId: 'u-gcon', ...op }
  it('minha unidade inclui os que estão comigo e exclui os concluídos', () => {
    expect(naVista(proc(), 'minha', eu)).toBe(true)
    expect(naVista(proc({ unidade_atual: 'u-fin' }), 'minha', eu)).toBe(false)
    expect(naVista(proc({ unidade_atual: 'u-fin', responsavel_atual: 'u1' }), 'minha', eu)).toBe(true)
    expect(naVista(proc({ situacao: 'concluido' }), 'minha', eu)).toBe(false)
  })

  it('sem unidade nem usuário, "minha unidade" não traz nada', () => {
    expect(naVista(proc({ unidade_atual: null }), 'minha', { op })).toBe(false)
  })

  it('abertos por mim, aguardando recebimento, atenção e concluídos', () => {
    expect(naVista(proc({ aberto_por: 'u1' }), 'meus', eu)).toBe(true)
    expect(naVista(proc({ aberto_por: 'u2' }), 'meus', eu)).toBe(false)
    expect(naVista(proc({ recebido_em: null }), 'receber', eu)).toBe(true)
    expect(naVista(proc(), 'receber', eu)).toBe(false)
    expect(naVista(proc({ desde: em(10) }), 'atencao', eu)).toBe(true)
    expect(naVista(proc(), 'atencao', eu)).toBe(false)
    expect(naVista(proc({ situacao: 'concluido', desde: em(1) }), 'atencao', eu)).toBe(false)
    expect(naVista(proc({ situacao: 'concluido' }), 'concluidos', eu)).toBe(true)
    expect(naVista(proc(), 'todos', eu)).toBe(true)
  })

  it('a busca acha por protocolo, assunto, interessado, tipo, responsável e unidade, sem ligar para maiúsculas', () => {
    const p = proc({ responsavel_nome: 'Carlos Souza' })
    for (const termo of ['000001', 'CADEIRAS', 'maria', 'requerimento', 'carlos', 'gcon', 'gestão de contratos', '']) {
      expect(combinaBusca(p, termo, porId), termo).toBe(true)
    }
    expect(combinaBusca(p, 'zzz', porId)).toBe(false)
  })

  it('ordena em andamento antes de concluído, o mais antigo na unidade primeiro', () => {
    const r = ordenarParaLista([
      proc({ id: 'novo', desde: em(28) }), proc({ id: 'fim', situacao: 'concluido', concluido_em: em(27) }),
      proc({ id: 'velho', desde: em(20) }), proc({ id: 'fim2', situacao: 'concluido', concluido_em: em(28) }),
    ])
    expect(r.map((x) => x.id)).toEqual(['velho', 'novo', 'fim2', 'fim'])
  })
})

describe('há quanto tempo', () => {
  const depois = (ms) => new Date(AGORA.getTime() - ms).toISOString()
  it.each([
    [0, 'agora'], [30 * 1000, 'agora'], [60 * 1000, 'há 1 min'], [59 * 60 * 1000, 'há 59 min'], [60 * 60 * 1000, 'há 1 h'],
    [23 * 3600 * 1000, 'há 23 h'], [24 * 3600 * 1000, 'há 1 dia'], [47 * 3600 * 1000, 'há 1 dia'], [48 * 3600 * 1000, 'há 2 dias'],
    [-5 * 60 * 1000, 'agora'],
  ])('%i ms atrás → %s', (ms, esperado) => expect(haQuanto(depois(ms), AGORA)).toBe(esperado))

  it('sem data não escreve nada', () => {
    expect(haQuanto(null)).toBe('')
    expect(haQuanto(undefined)).toBe('')
  })

  it('há um verbo para cada tipo de movimentação', () => {
    for (const t of ['abertura', 'envio', 'recebimento', 'alteracao', 'conclusao', 'reabertura']) expect(VERBOS_MOVIMENTO[t], t).toBeTruthy()
  })
})

describe('tarefa da Minha mesa', () => {
  it('chegou e não foi recebido', () => {
    const p = proc({ recebido_em: null })
    expect(tarefaDeProcesso(p, estadoDoProcesso(p, op))).toMatchObject({
      id: 'tr:p1', categoria: 'Tramitação', severidade: 'info', titulo: 'Processo aguardando o seu recebimento', ref: '2026/000001', to: '/processos/p1',
    })
  })

  it('parado e atrasado sobem de severidade', () => {
    const parado = proc({ desde: em(20) })
    expect(tarefaDeProcesso(parado, estadoDoProcesso(parado, op))).toMatchObject({ severidade: 'warning', titulo: 'Processo parado há 9 dias', dias: -9 })
    const atrasado = proc({ prazo: '2026-10-27' })
    expect(tarefaDeProcesso(atrasado, estadoDoProcesso(atrasado, op))).toMatchObject({ severidade: 'danger', titulo: 'Processo com prazo vencido', dias: -2 })
  })
})

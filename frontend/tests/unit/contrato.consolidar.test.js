import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consolidar, competenciasFaltantes, documentosReferenciados, indexar, fiscalPodeOperar,
} from '../../src/utils/contrato'

const contrato = (extra = {}) => ({
  id: 'c1', numero: '001/2026', contratada: 'ACME Ltda', objeto: 'Limpeza',
  valor_inicial: 120000, vigencia_inicio: '2026-01-01', vigencia_fim: '2026-12-31',
  situacao: 'ativo', prorrogavel: true, ...extra,
})

const bucket = (extra = {}) => ({
  responsaveis: [], os: [], competencias: [], empenhos: [], movs: [],
  execucoes: [], eventos: [], ocorrencias: [], documentos: [], pendencias: [], ...extra,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 16, 12))
})
afterEach(() => vi.useRealTimers())

describe('indexar', () => {
  it('agrupa os lançamentos por contrato e renomeia ordens → os', () => {
    const idx = indexar({
      ordens: [{ id: 'o1', contrato_id: 'c1' }],
      competencias: [{ id: 'k1', contrato_id: 'c1' }, { id: 'k2', contrato_id: 'c2' }],
    })
    expect(idx.get('c1').os).toHaveLength(1)
    expect(idx.get('c1').competencias).toHaveLength(1)
    expect(idx.get('c2').competencias[0].id).toBe('k2')
    expect(idx.get('c2').empenhos).toEqual([])
  })
})

describe('consolidar — valor e vigência vigentes', () => {
  it('sem lançamentos, valores = cadastro', () => {
    const k = consolidar(contrato())
    expect(k.valorAtualizado).toBe(120000)
    expect(k.acrescimos).toBe(0)
    expect(k.saldoExecucao).toBe(120000)
    expect(k.empenhado).toBe(0)
    expect(k.competencias).toEqual([])
    expect(k.vigenciaFim).toBe('2026-12-31')
  })

  it('aplica somente eventos concluídos e não cancelados, em ordem cronológica', () => {
    const k = consolidar(contrato(), bucket({
      eventos: [
        { id: 'e2', tipo: 'supressao', situacao: 'concluido', data_evento: '2026-06-01', valor_anterior: null, valor_posterior: 140000 },
        { id: 'e1', tipo: 'acrescimo', situacao: 'concluido', data_evento: '2026-03-01', valor_anterior: 120000, valor_posterior: 150000 },
        { id: 'e3', tipo: 'acrescimo', situacao: 'solicitado', data_evento: '2026-07-01', valor_anterior: 140000, valor_posterior: 999999 },
        { id: 'e4', tipo: 'acrescimo', situacao: 'concluido', cancelado: true, data_evento: '2026-08-01', valor_anterior: 140000, valor_posterior: 999999 },
        { id: 'e5', tipo: 'prorrogacao', situacao: 'concluido', data_evento: '2026-09-01', vigencia_posterior: '2027-12-31' },
      ],
    }))
    // 120.000 → +30.000 (e1) → 150.000 → valor_anterior nulo usa o corrente: 140.000 (e2)
    expect(k.valorAtualizado).toBe(140000)
    expect(k.acrescimos).toBe(20000)
    expect(k.vigenciaFim).toBe('2027-12-31')
    expect(k.eventosConcluidos.map((e) => e.id)).toEqual(['e1', 'e2', 'e5'])
  })

  it('início da prorrogação = fim da vigência − maior alerta de vigência', () => {
    const k = consolidar(contrato(), bucket(), { alerta_vigencia_dias: [120, 90, 60, 30] })
    expect(k.inicioProrrogacao).toBe('2026-09-02')
    expect(consolidar(contrato({ prorrogavel: false })).inicioProrrogacao).toBeNull()
  })
})

describe('consolidar — saldos distintos (escopo §8)', () => {
  const b = (extra = {}) => bucket({
    competencias: [
      { id: 'k1', competencia: '2026-08-01', atestado: true, valor_liquido: 10000, relatorio_recebido: true, nf_recebida: true, doc_completa: true, liberado_financeiro: true },
      { id: 'k2', competencia: '2026-09-01', atestado: false, valor_liquido: 10000, relatorio_recebido: true },
      { id: 'k3', competencia: '2026-07-01', atestado: true, suspensa: true, valor_liquido: 10000 },
      { id: 'k4', competencia: '2026-06-01', atestado: true, cancelado: true, valor_liquido: 10000 },
    ],
    empenhos: [
      { id: 'emp1', numero: '2026NE001', exercicio: 2026, valor_inicial: 50000 },
      { id: 'emp0', numero: '2025NE009', exercicio: 2025, valor_inicial: 1000, cancelado: true },
    ],
    movs: [
      { id: 'm1', empenho_id: 'emp1', tipo: 'reforco', valor: 10000 },
      { id: 'm2', empenho_id: 'emp1', tipo: 'anulacao', valor: 5000 },
      { id: 'm3', empenho_id: 'emp1', tipo: 'reforco', valor: 99999, cancelado: true },
    ],
    execucoes: [
      { id: 'x1', competencia_id: 'k1', empenho_id: 'emp1', valor_competencia: 10000, valor_liquidado: 10000, retencao: 1000, valor_pago: 5000 },
      { id: 'x2', competencia_id: 'k2', empenho_id: 'emp1', valor_competencia: 8000, valor_liquidado: null },
    ],    ...extra,
  })

  it('execução reconhecida = líquido das competências atestadas, não suspensas nem canceladas', () => {
    const k = consolidar(contrato(), b())
    expect(k.execucaoReconhecida).toBe(10000)
  })

  it('saldo do contrato sem OS com valor: valor atualizado − liquidado (não o atestado)', () => {
    const k = consolidar(contrato(), b())
    expect(k.liquidado).toBe(10000)
    expect(k.saldoBase).toBe('liquidacao')
    expect(k.saldoExecucao).toBe(110000)
    // atestado e ainda não liquidado não abate o saldo
    const semLiquidar = consolidar(contrato(), b({ execucoes: [] }))
    expect(semLiquidar.execucaoReconhecida).toBe(10000)
    expect(semLiquidar.saldoExecucao).toBe(120000)
  })

  it('saldo do contrato com OS/OC dada: abate o valor das ordens, sem contar a liquidação de novo', () => {
    const ordens = [
      { id: 'o1', status: 'vigente', valor: 30000 },
      { id: 'o2', status: 'emitida', valor: 5000 },
      { id: 'o3', status: 'aguardando_ciencia', valor: 2000 },
    ]
    const k = consolidar(contrato(), b({ os: ordens }))
    expect(k.saldoBase).toBe('os')
    expect(k.valorOrdens).toBe(37000)
    expect(k.saldoExecucao).toBe(83000)
    expect(k.liquidado).toBe(10000)
  })

  it('só abatem a OS dada: solicitada, rascunho, aguardando assinatura, cancelada e sem valor ficam de fora', () => {
    const ordens = ['solicitada', 'em_conferencia', 'aguardando_assinatura', 'cancelada']
      .map((status, i) => ({ id: `o${i}`, status, valor: 9999 }))
      .concat([{ id: 'oc', status: 'vigente', valor: 7000, cancelado: true }, { id: 'ov', status: 'vigente', valor: null }])
    const k = consolidar(contrato(), b({ os: ordens, execucoes: [] }))
    expect(k.valorOrdens).toBe(0)
    expect(k.saldoBase).toBe('liquidacao')
    expect(k.saldoExecucao).toBe(120000)
  })

  it('o saldo reflete eventos de valor e pode ficar negativo', () => {
    const k = consolidar(contrato(), b({ os: [{ id: 'o1', status: 'vigente', valor: 130000 }] }))
    expect(k.saldoExecucao).toBe(-10000)
  })

  it('empenho: atual = inicial + reforços − anulações; saldo = atual − liquidado; reservado não liquidado', () => {
    const k = consolidar(contrato(), b())
    expect(k.empenhos).toHaveLength(1)
    const e = k.empenhos[0]
    expect(e.reforcos).toBe(10000)
    expect(e.anulacoes).toBe(5000)
    expect(e.valorAtual).toBe(55000)
    expect(e.liquidado).toBe(10000)
    expect(e.saldo).toBe(45000)
    expect(e.reservado).toBe(8000)
    expect(e.saldoDisponivel).toBe(37000)
    expect(k.empenhado).toBe(55000)
    expect(k.saldoEmpenhos).toBe(45000)
  })

  it('pendente de pagamento = liquidado − retenções − pago', () => {
    const k = consolidar(contrato(), b())
    expect(k.liquidado).toBe(10000)
    expect(k.pago).toBe(5000)
    expect(k.retido).toBe(1000)
    expect(k.pendentePagamento).toBe(4000)
  })

  it('competências ordenadas da mais recente e com status calculado', () => {
    const k = consolidar(contrato(), b())
    expect(k.competencias.map((c) => c.id)).toEqual(['k2', 'k1', 'k3'])
    expect(k.ultimaCompetencia.id).toBe('k2')
    expect(k.competencias.find((c) => c.id === 'k1').status.key).toBe('aguardando_pagamento')
    expect(k.competenciasEmAberto.map((c) => c.id)).toEqual(['k2', 'k1', 'k3'])
  })

  it('ocorrência aberta vinculada marca a competência', () => {
    const k = consolidar(contrato(), bucket({
      competencias: [{ id: 'k1', competencia: '2026-09-01' }],
      ocorrencias: [
        { id: 'o1', competencia_id: 'k1', status: 'aberta' },
        { id: 'o2', competencia_id: 'k1', status: 'regularizada' },
      ],
    }))
    expect(k.competencias[0].status.flags.map((f) => f.label)).toContain('Com ocorrência')
    expect(k.ocorrenciasAbertas).toHaveLength(1)
  })
})

describe('consolidar — responsáveis', () => {
  it('usa apenas responsáveis ativos; sem fiscal técnico ativo, cai no primeiro fiscal', () => {
    const k = consolidar(contrato({ responsavel_contratacao: 'Fulano de Compras' }), bucket({
      responsaveis: [
        { id: 'r1', papel: 'gestor_titular', nome: 'Gestora Ana', ativo: true },
        { id: 'r2', papel: 'fiscal_tecnico', nome: 'Fiscal Antigo', ativo: false },
        { id: 'r3', papel: 'fiscal_administrativo', nome: 'Fiscal Bia', ativo: true },
      ],
      os: [{ id: 'os1', status: 'vigente' }, { id: 'os2', status: 'vigente', cancelado: true }],
    }))
    expect(k.nomeGestor).toBe('Gestora Ana')
    expect(k.nomeFiscal).toBe('Fiscal Bia')
    expect(k.fiscais).toHaveLength(1)
    expect(k.osVigente.id).toBe('os1')
  })

  it('sem gestor designado, usa o responsável pela contratação', () => {
    const k = consolidar(contrato({ responsavel_contratacao: 'Fulano de Compras' }))
    expect(k.nomeGestor).toBe('Fulano de Compras')
    expect(k.gestorTitular).toBeNull()
  })
})

describe('etapas da contratação até a execução (§4–§9)', () => {
  const TIT = { id: 't', papel: 'fiscal_tecnico', nome: 'Bia', ativo: true, usuario_id: 'u-bia', ciente_em: '2026-01-05' }
  const SUB = { id: 's', papel: 'fiscal_substituto', nome: 'Caio', ativo: true, usuario_id: 'u-caio', ciente_em: '2026-01-05' }
  const GES = { id: 'g', papel: 'gestor_titular', nome: 'Ana', ativo: true, ciente_em: '2026-01-05' }
  const etapa = (c, b = {}) => consolidar(contrato(c), bucket(b)).etapa

  it.each([
    ['em_cadastro', { situacao: 'em_cadastro' }, {}],
    ['aguardando_gestao', { situacao: 'em_cadastro', encaminhado_em: '2026-10-01' }, {}],
    ['designacao', { validado_gestao: true }, { responsaveis: [TIT] }],
    ['portaria', { validado_gestao: true }, { responsaveis: [TIT, SUB] }],
    ['publicacao', { validado_gestao: true, portaria_status: 'aguardando_publicacao' }, { responsaveis: [TIT, SUB] }],
    ['termo', { validado_gestao: true, portaria_status: 'publicada' }, { responsaveis: [TIT, { ...SUB, ciente_em: null }] }],
    ['termo', { validado_gestao: true, portaria_status: 'publicada' }, { responsaveis: [TIT, SUB, { ...GES, ciente_em: null }] }],
    ['ordem', { validado_gestao: true, portaria_status: 'publicada' }, { responsaveis: [TIT, SUB, GES] }],
    ['em_execucao', { validado_gestao: true }, { os: [{ id: 'o', status: 'vigente' }] }],
    ['em_execucao', { situacao: 'suspenso' }, {}],
    ['em_execucao', { execucao_anterior: true }, {}],
  ])('%s', (esperado, c, b) => {
    expect(etapa(c, b)).toBe(esperado)
  })

  it('formalizada só com portaria publicada e ciência de todos', () => {
    const k = consolidar(contrato({ validado_gestao: true, portaria_status: 'publicada' }), bucket({ responsaveis: [TIT, SUB, GES] }))
    expect(k.formalizada).toBe(true)
    expect(k.fiscalTitular.nome).toBe('Bia')
    expect(k.fiscalSubstituto.nome).toBe('Caio')
  })

  it('fiscal em atuação: titular, ou o substituto quando acionado', () => {
    expect(consolidar(contrato(), bucket({ responsaveis: [TIT, SUB] })).fiscalEmAtuacao.nome).toBe('Bia')
    expect(consolidar(contrato({ substituto_em_atuacao: true }), bucket({ responsaveis: [TIT, SUB] })).fiscalEmAtuacao.nome).toBe('Caio')
    expect(consolidar(contrato({ substituto_em_atuacao: true }), bucket({ responsaveis: [TIT] })).fiscalEmAtuacao.nome).toBe('Bia')
  })

  it('quem pode registrar os atos do fiscal (mesma regra do banco)', () => {
    const k = consolidar(contrato(), bucket({ responsaveis: [TIT, SUB] }))
    expect(fiscalPodeOperar(k, 'u-bia')).toBe(true)
    expect(fiscalPodeOperar(k, 'u-caio')).toBe(false)
    expect(fiscalPodeOperar(k, 'u-outro')).toBe(false)
    const emAtuacao = consolidar(contrato({ substituto_em_atuacao: true }), bucket({ responsaveis: [TIT, SUB] }))
    expect(fiscalPodeOperar(emAtuacao, 'u-caio')).toBe(true)
    expect(fiscalPodeOperar(emAtuacao, 'u-bia')).toBe(true)
  })
})

describe('competenciasFaltantes', () => {
  it('lista meses desde o início efetivo da OS ainda sem competência', () => {
    const k = consolidar(contrato(), bucket({
      os: [{ id: 'os1', status: 'vigente', data_efetiva_inicio: '2026-06-10' }],
      competencias: [{ id: 'k1', competencia: '2026-06-01' }, { id: 'k2', competencia: '2026-08-01' }],
    }))
    expect(competenciasFaltantes(k)).toEqual(['2026-07-01', '2026-09-01', '2026-10-01'])
  })

  it('para no fim da vigência quando já venceu', () => {
    const k = consolidar(contrato({ vigencia_inicio: '2026-01-01', vigencia_fim: '2026-03-15' }))
    expect(competenciasFaltantes(k)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
  })

  it('competência cancelada pode ser reaberta', () => {
    const k = consolidar(contrato({ vigencia_inicio: '2026-10-01' }), bucket({
      competencias: [{ id: 'k1', competencia: '2026-10-01', cancelado: true }],
    }))
    expect(competenciasFaltantes(k)).toEqual(['2026-10-01'])
  })
})

describe('documentosReferenciados (índice SEI)', () => {
  it('reúne os SEI citados nos lançamentos e ignora vazios e cancelados', () => {
    const k = consolidar(contrato({ sei_processo: '0001.000001/2026-11', portaria_sei: '123456' }), bucket({
      responsaveis: [{ id: 'r1', papel: 'gestor_titular', nome: 'Ana', ativo: true, sei_documento: '111' }],
      empenhos: [
        { id: 'e1', numero: 'NE1', exercicio: 2026, sei_documento: '222' },
        { id: 'e2', numero: 'NE2', exercicio: 2026, sei_documento: '333', cancelado: true },
      ],
      competencias: [{ id: 'k1', competencia: '2026-09-01', sei_relatorio: '444', sei_atesto: null }],
    }))
    const docs = documentosReferenciados(k)
    expect(docs.map((d) => d.sei)).toEqual(['0001.000001/2026-11', '123456', '111', '222', '444'])
    expect(docs.find((d) => d.sei === '444')).toMatchObject({ tipo: 'Relatório fiscal', origem: 'Competência setembro/2026' })
  })
})

import { describe, expect, it } from 'vitest'
import {
  situacaoExecucao, statusCompetencia, donoDaEtapa, situacaoAposEvento,
} from '../../src/utils/contrato'

describe('situacaoExecucao (financeiro da competência)', () => {
  it('sem lançamento', () => {
    expect(situacaoExecucao(null)).toMatchObject({ key: 'sem_lancamento', pendente: 0 })
  })

  it('aguardando liquidação quando nada foi liquidado', () => {
    expect(situacaoExecucao({ valor_liquidado: null }).key).toBe('aguardando_liquidacao')
  })

  it('aguardando pagamento: pendente = liquidado', () => {
    expect(situacaoExecucao({ valor_liquidado: 1000 })).toMatchObject({ key: 'aguardando_pagamento', pendente: 1000 })
  })

  it('pagamento parcial', () => {
    expect(situacaoExecucao({ valor_liquidado: 1000, valor_pago: 400 }))
      .toMatchObject({ key: 'pagamento_parcial', pendente: 600 })
  })

  it('pago quando liquidado − retenção − pago = 0 (valores vindos do banco como texto)', () => {
    expect(situacaoExecucao({ valor_liquidado: '1000.00', retencao: '100.00', valor_pago: '900.00' }))
      .toMatchObject({ key: 'pago', pendente: 0 })
  })

  it('suspenso tem precedência', () => {
    expect(situacaoExecucao({ valor_liquidado: 1000, suspenso: true })).toMatchObject({ key: 'suspenso', pendente: 1000 })
  })

  it('pendente nunca fica negativo', () => {
    expect(situacaoExecucao({ valor_liquidado: 100, valor_pago: 150 }).pendente).toBe(0)
  })
})

describe('statusCompetencia — NF → fiscalização → atesto (fiscal) → Gestão → Financeiro', () => {
  const liberada = { nf_recebida: true, relatorio_recebido: true, doc_completa: true, atestado: true, liberado_financeiro: true }
  const etapas = [
    [{}, null, 'aguardando_nf', 'fiscal'],
    [{ nf_recebida: true }, null, 'aguardando_fiscalizacao', 'fiscal'],
    [{ nf_recebida: true, relatorio_recebido: true }, null, 'aguardando_atesto', 'fiscal'],
    [{ nf_recebida: true, relatorio_recebido: true, doc_completa: true, atestado: true }, null, 'conferencia_gestao', 'gestor'],
    [liberada, null, 'em_liquidacao', 'financeiro'],
    [liberada, { valor_liquidado: null }, 'em_liquidacao', 'financeiro'],
    [liberada, { valor_liquidado: 500 }, 'aguardando_pagamento', 'financeiro'],
    [liberada, { valor_liquidado: 500, valor_pago: 200 }, 'aguardando_pagamento', 'financeiro'],
    [liberada, { valor_liquidado: 500, valor_pago: 500 }, 'concluida', null],
  ]

  it.each(etapas)('%j + execução %j → %s (vez: %s)', (comp, ex, key, dono) => {
    const s = statusCompetencia(comp, ex)
    expect(s.key).toBe(key)
    expect(s.dono).toBe(dono)
  })

  it('cancelada e suspensa interrompem o fluxo', () => {
    expect(statusCompetencia({ cancelado: true, nf_recebida: true }).key).toBe('cancelada')
    expect(statusCompetencia({ suspensa: true }).key).toBe('suspensa')
  })

  it('pagamento suspenso pelo financeiro', () => {
    const comp = { relatorio_recebido: true, nf_recebida: true, doc_completa: true, atestado: true, liberado_financeiro: true }
    expect(statusCompetencia(comp, { suspenso: true })).toMatchObject({ key: 'suspensa', label: 'Pagamento suspenso', dono: 'financeiro' })
  })

  it('sinaliza ocorrência, glosa e devolução pela Gestão', () => {
    const labels = (s) => s.flags.map((f) => f.label)
    expect(labels(statusCompetencia({ houve_ocorrencia: true }))).toEqual(['Com ocorrência'])
    expect(labels(statusCompetencia({}, null, 2))).toEqual(['Com ocorrência'])
    expect(labels(statusCompetencia({ houve_glosa: true }))).toEqual(['Com glosa'])
    expect(labels(statusCompetencia({ nf_recebida: true, relatorio_recebido: true, devolvido_em: '2026-10-17' })))
      .toEqual(['Devolvida pela Gestão'])
    expect(labels(statusCompetencia({ atestado: true, devolvido_em: '2026-10-17' }))).toEqual([])
    expect(labels(statusCompetencia({}))).toEqual([])
  })

  it('devolvida pela Gestão volta para o fiscal atestar', () => {
    expect(statusCompetencia({ nf_recebida: true, relatorio_recebido: true, doc_completa: true, devolvido_em: 'x' }))
      .toMatchObject({ key: 'aguardando_atesto', dono: 'fiscal' })
  })
})

describe('donoDaEtapa', () => {
  it('o atesto é sempre do fiscal: o dono da etapa é o próprio', () => {
    expect(donoDaEtapa('fiscal')).toBe('fiscal')
    expect(donoDaEtapa('financeiro')).toBe('financeiro')
    expect(donoDaEtapa(null)).toBeNull()
  })
})

describe('situacaoAposEvento — efeito do evento na situação do contrato', () => {
  it.each([
    ['prorrogacao', 'solicitado', 'ativo', 'em_prorrogacao'],
    ['prorrogacao', 'em_analise', 'ativo', 'em_prorrogacao'],
    ['prorrogacao', 'concluido', 'em_prorrogacao', 'ativo'],
    ['prorrogacao', 'cancelado', 'em_prorrogacao', 'ativo'],
    ['prorrogacao', 'concluido', 'ativo', null],
    ['prorrogacao', 'solicitado', 'suspenso', null],
    ['suspensao', 'concluido', 'ativo', 'suspenso'],
    ['suspensao', 'solicitado', 'ativo', null],
    ['encerramento', 'solicitado', 'ativo', 'em_encerramento'],
    ['encerramento', 'em_analise', 'em_prorrogacao', 'em_encerramento'],
    ['encerramento', 'concluido', 'em_encerramento', 'encerrado'],
    ['encerramento', 'cancelado', 'em_encerramento', 'ativo'],
    ['reajuste', 'concluido', 'ativo', null],
    ['termo_aditivo', 'cancelado', 'ativo', null],
  ])('%s %s com contrato %s → %s', (tipo, situacaoEvento, atual, esperado) => {
    expect(situacaoAposEvento(tipo, situacaoEvento, atual)).toBe(esperado)
  })
})

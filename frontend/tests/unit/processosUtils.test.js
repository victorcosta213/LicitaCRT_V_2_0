// Utilitários do módulo de processos licitatórios (Home, Dashboard, Controle, Arquivados).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PHASES, computePhaseState, monthFromNumero, getDocDegree, phaseNameByKey } from '../../src/utils/phases'
import { normalizePriority, priorityRank } from '../../src/utils/priority'
import { computeStatus } from '../../src/utils/status'
import { toInputDate, fromInputDate } from '../../src/utils/dates'

describe('fases do processo', () => {
  it('estado da fase pelo último passo do fluxo', () => {
    const s = computePhaseState({ fluxo: [{ nome: 'Cotação de Preços' }, { nome: 'Homologação' }] })
    expect(s).toMatchObject({ key: 'homologacao', name: 'Homologação', index: 12, total: PHASES.length })
  })

  it('usa a etapa quando não há fluxo e ignora acentos/caixa', () => {
    expect(computePhaseState({ etapa: 'cotação de preços' }).key).toBe('cotacao')
  })

  it('primeira fase vale 0% e a última 100%', () => {
    expect(computePhaseState({}).pct).toBe(0)
    expect(computePhaseState({ etapa: PHASES.at(-1).name }).pct).toBe(100)
  })

  it('etapa fora da lista cai na primeira fase sem quebrar', () => {
    expect(computePhaseState({ etapa: 'Concluido' })).toMatchObject({ index: 0, key: 'oficio_tr' })
  })

  it('nome da fase pela chave', () => {
    expect(phaseNameByKey('adjudicacao')).toBe('Adjudicação')
    expect(phaseNameByKey('x')).toBe('')
  })

  it('mês de abertura extraído do número do processo', () => {
    expect(monthFromNumero('2026/03-001')).toEqual(new Date(2026, 2, 1))
    expect(monthFromNumero('PROC 2025.11.004')).toEqual(new Date(2025, 10, 1))
    expect(monthFromNumero('2026/13')).toBeNull()
    expect(monthFromNumero('123')).toBeNull()
    expect(monthFromNumero(null)).toBeNull()
  })

  it('grau de documentação', () => {
    expect(getDocDegree('DFD')).toBe(1)
    expect(getDocDegree('Pesquisa de preço')).toBe(4)
    expect(getDocDegree('x')).toBe(0)
    expect(getDocDegree('')).toBe(0)
  })
})

describe('prioridade', () => {
  it.each([
    ['Critico', 'Crítico', 0], ['Estrategico', 'Estratégico', 1], ['Alavancavel', 'Alavancável', 2],
    ['Nao Critico', 'Não Crítico', 3], ['', '—', 4], ['Outra', 'Outra', 4],
  ])('%j → %j (ordem %i)', (entrada, rotulo, ordem) => {
    expect(normalizePriority(entrada)).toBe(rotulo)
    expect(priorityRank(entrada)).toBe(ordem)
  })
})

describe('status de prazo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 16, 12))
  })
  afterEach(() => vi.useRealTimers())

  it.each([
    ['2026-10-10', 'Atrasado', -6],
    ['2026-10-15', 'Atrasado', -1], // venceu ontem (antes ficava "Quase vencendo")
    ['2026-10-16', 'Quase vencendo', 0],
    ['2026-10-19', 'Quase vencendo', 3],
    ['2026-10-20', 'Em dia', 4],
    ['2026-10-30', 'Em dia', 14],
  ])('prazo %s → %s (%i dias)', (prazo, label, days) => {
    expect(computeStatus(prazo)).toMatchObject({ label, days })
  })

  it('texto do banco, Date local e timestamptz dão o mesmo resultado (sem erro de fuso)', () => {
    const textoDate = computeStatus('2026-10-20')
    expect(computeStatus(new Date(2026, 9, 20))).toEqual(textoDate)
    expect(computeStatus('2026-10-20T03:00:00+00:00')).toEqual(textoDate)
  })

  it('sem prazo ou prazo inválido', () => {
    expect(computeStatus(null).label).toBe('—')
    expect(computeStatus('').label).toBe('—')
    expect(computeStatus('não é data').label).toBe('—')
  })

  it('não altera o objeto Date recebido', () => {
    const d = new Date(2026, 9, 20, 9, 30)
    computeStatus(d)
    expect(d.getHours()).toBe(9)
  })
})

describe('datas de formulário (Controle)', () => {
  it('converte Date para o valor do <input type="date">', () => {
    expect(toInputDate(new Date(2026, 9, 5))).toBe('2026-10-05')
    expect(toInputDate(null)).toBe('')
  })

  it('lê o valor do input como meia-noite local', () => {
    expect(fromInputDate('2026-10-05')).toEqual(new Date(2026, 9, 5))
    expect(fromInputDate('')).toBeNull()
  })

  // Antes só entendia Date/Timestamp (objetos com toDate): ao editar, o prazo vinha vazio e era apagado.
  it('aceita a data em texto devolvida pelo Supabase', () => {
    expect(toInputDate('2026-10-20')).toBe('2026-10-20')
    expect(toInputDate('2026-10-20T03:00:00+00:00')).toBe('2026-10-20')
    expect(toInputDate({ toDate: () => new Date(2026, 9, 20) })).toBe('2026-10-20')
    expect(toInputDate('lixo')).toBe('')
  })
})

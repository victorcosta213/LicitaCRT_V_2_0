import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  num, brl, fmtDate, toISO, parseISO, diasAte, addDias, competenciaISO, mesAtualISO,
  fmtCompetencia, fmtCompetenciaCurta, fimDaCompetencia, listaCompetencias, exercicioDe,
  soDigitos, fmtCnpj, codigoInterno, cnpjValido,
} from '../../src/utils/format'

describe('num', () => {
  it.each([
    [null, 0], [undefined, 0], ['', 0], ['12.5', 12.5], [7, 7], ['abc', 0], ['1000.00', 1000],
  ])('num(%j) = %j', (entrada, esperado) => {
    expect(num(entrada)).toBe(esperado)
  })
})

describe('brl', () => {
  it('formata em reais', () => {
    expect(brl(1234.5)).toMatch(/^R\$\s1\.234,50$/)
    expect(brl(0)).toMatch(/^R\$\s0,00$/)
    expect(brl(-10)).toMatch(/-R\$\s10,00/)
  })
  it('mostra travessão para vazio', () => {
    expect(brl(null)).toBe('—')
    expect(brl(undefined)).toBe('—')
    expect(brl('')).toBe('—')
  })
})

describe('datas', () => {
  it('fmtDate não sofre deslocamento de fuso', () => {
    expect(fmtDate('2026-03-05')).toBe('05/03/2026')
    expect(fmtDate('2026-03-05T23:30:00Z')).toBe('05/03/2026')
    expect(fmtDate(null)).toBe('—')
  })

  it('parseISO/toISO fazem ida e volta no horário local', () => {
    const d = parseISO('2026-02-28')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(28)
    expect(toISO(d)).toBe('2026-02-28')
    expect(parseISO(null)).toBeNull()
  })

  it('diasAte conta dias corridos em relação à referência', () => {
    const ref = new Date(2026, 9, 16, 15, 30)
    expect(diasAte('2026-10-20', ref)).toBe(4)
    expect(diasAte('2026-10-16', ref)).toBe(0)
    expect(diasAte('2026-10-01', ref)).toBe(-15)
    expect(diasAte(null, ref)).toBeNull()
  })

  it('addDias atravessa virada de ano', () => {
    expect(addDias('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDias(null, 1)).toBeNull()
  })
})

describe('competências', () => {
  afterEach(() => vi.useRealTimers())

  it('competência é sempre o dia 1 do mês', () => {
    expect(competenciaISO(2026, 3)).toBe('2026-03-01')
    expect(competenciaISO(2026, 12)).toBe('2026-12-01')
  })

  it('mesAtualISO usa o relógio do sistema', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 16, 10))
    expect(mesAtualISO()).toBe('2026-10-01')
  })

  it('formata competência por extenso e curta', () => {
    expect(fmtCompetencia('2026-03-01')).toBe('março/2026')
    expect(fmtCompetencia('2026-12-01')).toBe('dezembro/2026')
    expect(fmtCompetenciaCurta('2026-03-01')).toBe('03/2026')
    expect(fmtCompetencia(null)).toBe('—')
  })

  it('fim da competência considera ano bissexto', () => {
    expect(fimDaCompetencia('2024-02-01')).toBe('2024-02-29')
    expect(fimDaCompetencia('2026-02-01')).toBe('2026-02-28')
    expect(fimDaCompetencia('2026-12-01')).toBe('2026-12-31')
  })

  it('lista competências entre duas datas, atravessando o ano', () => {
    expect(listaCompetencias('2025-11-15', '2026-02-03'))
      .toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'])
    expect(listaCompetencias('2026-05-10', '2026-05-20')).toEqual(['2026-05-01'])
    expect(listaCompetencias('2026-05-01', '2026-01-01')).toEqual([])
    expect(listaCompetencias(null, '2026-01-01')).toEqual([])
  })

  it('exercicioDe extrai o ano', () => {
    expect(exercicioDe('2026-05-01')).toBe(2026)
    expect(exercicioDe(null)).toBeNull()
  })
})

describe('CNPJ e código interno', () => {
  it.each(['11.222.333/0001-81', '11222333000181', '00.000.000/0001-91'])('aceita CNPJ válido %s', (c) => {
    expect(cnpjValido(c)).toBe(true)
  })

  it.each(['11.222.333/0001-82', '11111111111111', '123', '', null])('rejeita CNPJ inválido %j', (c) => {
    expect(cnpjValido(c)).toBe(false)
  })

  it('formata CNPJ', () => {
    expect(fmtCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(fmtCnpj('123')).toBe('123')
    expect(fmtCnpj(null)).toBe('—')
    expect(soDigitos('11.222.333/0001-81')).toBe('11222333000181')
  })

  it('código interno GC-0000', () => {
    expect(codigoInterno({ id_interno: 7 })).toBe('GC-0007')
    expect(codigoInterno({ id_interno: 12345 })).toBe('GC-12345')
    expect(codigoInterno(null)).toBe('—')
  })
})

import { describe, expect, it } from 'vitest'
import { contratoFields, validarContrato } from '../../src/pages/contrato/contratoForm'

const base = () => ({
  numero: '014/2026', contratada: 'ACME', objeto: 'X', vigencia_inicio: '2026-01-01', vigencia_fim: '2026-12-31',
})

describe('validarContrato', () => {
  it('formata CNPJ válido', () => {
    expect(validarContrato({ ...base(), cnpj: '11222333000181' }).cnpj).toBe('11.222.333/0001-81')
  })

  it('rejeita CNPJ inválido', () => {
    expect(() => validarContrato({ ...base(), cnpj: '11.222.333/0001-00' })).toThrow('CNPJ inválido.')
  })

  it('rejeita fim de vigência antes do início', () => {
    expect(() => validarContrato({ ...base(), vigencia_fim: '2025-12-31' })).toThrow(/anterior ao início/)
  })

  it('exige o fim da vigência ou o prazo de execução (ex.: nota de empenho)', () => {
    expect(() => validarContrato({ ...base(), vigencia_fim: null })).toThrow('Informe o fim da vigência ou o prazo de execução.')
    expect(validarContrato({ ...base(), vigencia_fim: null, prazo_execucao_dias: 30 }).prazo_execucao_dias).toBe(30)
  })

  it('exige vencimento quando há garantia', () => {
    expect(() => validarContrato({ ...base(), exige_garantia: true })).toThrow('Informe o vencimento da garantia.')
  })

  it('limpa limite de prorrogação e dados de garantia quando não se aplicam', () => {
    const v = validarContrato({
      ...base(), prorrogavel: false, limite_prorrogacao: '2030-01-01',
      exige_garantia: false, garantia_valor: 100, garantia_vencimento: '2027-01-01',
    })
    expect(v.limite_prorrogacao).toBeNull()
    expect(v.garantia_valor).toBeNull()
    expect(v.garantia_vencimento).toBeNull()
  })
})

describe('contratoFields', () => {
  const nomes = (fs) => fs.filter((f) => f.name).map((f) => f.name)

  it('situação do contrato só aparece para a gestão', () => {
    expect(nomes(contratoFields({}))).not.toContain('situacao')
    expect(nomes(contratoFields({}, { gestao: true }))).toContain('situacao')
  })

  it('campos obrigatórios da contratação (§4)', () => {
    const obrig = contratoFields({}).filter((f) => f.required).map((f) => f.name)
    expect(obrig).toEqual(['instrumento', 'numero', 'sei_processo', 'objeto', 'contratada', 'vigencia_inicio', 'valor_inicial'])
  })

  it('instrumento: contrato, nota de empenho ou outro', () => {
    const f = contratoFields({}).find((x) => x.name === 'instrumento')
    expect(f.options.map((o) => o.value)).toEqual(['contrato', 'nota_empenho', 'outro'])
  })

  it('opções vêm dos parâmetros', () => {
    const f = contratoFields({ modalidades: ['Pregão eletrônico'] }).find((x) => x.name === 'modalidade')
    expect(f.options).toEqual(['Pregão eletrônico'])
  })
})

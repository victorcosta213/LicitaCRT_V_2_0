import { describe, expect, it } from 'vitest'
import { lerPlanilhaContratos, parseData, parseInstrumento } from '../../src/utils/importContratos'

const CAB = ['Instrumento', 'Nº', 'Processo SEI', 'Contratada', 'CNPJ', 'Objeto', 'Modalidade', 'Unidade demandante', 'Valor (R$)', 'Início', 'Fim da vigência', 'Prazo de execução (dias)', 'Prorrogável']
const OK = ['Contrato', '014/2026', '0001.000214/2026-11', 'Acme Ltda', '11.222.333/0001-81', 'Limpeza', 'Pregão', 'Administrativa', '312.000,00', '01/03/2026', '28/02/2027', '', 'Sim']

describe('parseData', () => {
  it.each([
    ['31/12/2026', '2026-12-31'], ['1/3/2026', '2026-03-01'], ['2026-12-31', '2026-12-31'],
    [46022, '2025-12-31'], [new Date(2026, 5, 15), '2026-06-15'],
    ['31/02/2026', null], ['abc', null], ['', null], [5, null],
  ])('%s', (entrada, saida) => expect(parseData(entrada)).toBe(saida))
})

describe('parseInstrumento', () => {
  it.each([['', 'contrato'], ['Contrato', 'contrato'], ['Nota de Empenho', 'nota_empenho'], ['NE', 'nota_empenho'], ['Termo', 'outro']])('%s', (e, s) => {
    expect(parseInstrumento(e)).toBe(s)
  })
})

describe('lerPlanilhaContratos', () => {
  it('lê uma linha completa', () => {
    const r = lerPlanilhaContratos([CAB, OK])
    expect(r.erro).toBeUndefined()
    expect(r.registros).toHaveLength(1)
    expect(r.registros[0].pendencias).toEqual([])
    expect(r.registros[0].dados).toMatchObject({
      instrumento: 'contrato', numero: '014/2026', contratada: 'Acme Ltda', cnpj: '11.222.333/0001-81', valor_inicial: 312000,
      vigencia_inicio: '2026-03-01', vigencia_fim: '2027-02-28', prazo_execucao_dias: null, prorrogavel: true,
    })
  })

  it('acha o cabeçalho abaixo de um título e ignora linhas em branco', () => {
    const r = lerPlanilhaContratos([['Contratos 2026'], [], CAB, [], OK])
    expect(r.registros).toHaveLength(1)
    expect(r.linhaCabecalho).toBe(3)
  })

  it('sem as colunas obrigatórias devolve erro', () => {
    expect(lerPlanilhaContratos([['Nome', 'Valor'], ['a', '1']]).erro).toMatch(/Cabeçalho não encontrado/)
  })

  it('ignora sem número, contratada ou objeto, e duplicadas (existentes ou repetidas)', () => {
    const r = lerPlanilhaContratos([
      CAB,
      ['Contrato', '', '', 'X', '', 'obj'],
      ['Contrato', '1', '', '', '', 'obj'],
      ['Contrato', '2', '', 'X', '', ''],
      OK,
      OK,
      ['Contrato', '9/2025', '', 'Y', '', 'obj'],
    ], { existentes: [{ instrumento: 'contrato', numero: '9/2025' }] })
    expect(r.registros).toHaveLength(1)
    expect(r.ignorados.map((i) => i.motivo)).toEqual([
      'sem número do instrumento', 'sem contratada', 'sem objeto',
      'já cadastrada ou repetida na planilha', 'já cadastrada ou repetida na planilha',
    ])
  })

  it('o mesmo número em instrumentos diferentes não é duplicidade', () => {
    const r = lerPlanilhaContratos([CAB, OK, ['Nota de Empenho', '014/2026', '', 'Acme', '', 'obj']])
    expect(r.registros).toHaveLength(2)
  })

  it('marca o que falta completar e avisa de dados ilegíveis', () => {
    const r = lerPlanilhaContratos([CAB, ['Contrato', '1', '', 'X', '123', 'obj', '', '', 'abc', '99/99/2026', '', '', '']])
    const [reg] = r.registros
    expect(reg.pendencias).toEqual(['processo SEI', 'valor', 'vigência ou prazo'])
    expect(reg.avisos).toEqual(expect.arrayContaining(['CNPJ inválido (ficou em branco)', 'valor ilegível (ficou zero)']))
    expect(reg.dados.cnpj).toBeNull()
  })

  it('prazo de execução dispensa o fim da vigência; fim anterior ao início é descartado', () => {
    const prazo = lerPlanilhaContratos([CAB, ['Nota de Empenho', '5', '0001', 'X', '', 'obj', '', '', '100', '', '', '30', '']])
    expect(prazo.registros[0].pendencias).toEqual([])
    expect(prazo.registros[0].dados.prazo_execucao_dias).toBe(30)
    const invertida = lerPlanilhaContratos([CAB, ['Contrato', '6', '0001', 'X', '', 'obj', '', '', '100', '01/03/2026', '01/01/2026', '', '']])
    expect(invertida.registros[0].dados.vigencia_fim).toBeNull()
    expect(invertida.registros[0].pendencias).toContain('vigência ou prazo')
  })

  it('aceita datas como número serial do Excel e relata colunas ausentes', () => {
    const r = lerPlanilhaContratos([['Nº', 'Contratada', 'Objeto', 'Fim'], ['1', 'X', 'obj', 46022]])
    expect(r.registros[0].dados.vigencia_fim).toBe('2025-12-31')
    expect(r.faltantes).toEqual(expect.arrayContaining(['sei_processo', 'valor_inicial']))
  })
})

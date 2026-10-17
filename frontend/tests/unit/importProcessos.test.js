import { describe, expect, it } from 'vitest'
import {
  norm, parseValor, normalizarPrioridade, tipoPorModalidade, fasePorTexto, lerPlanilhaProcessos,
} from '../../src/utils/importProcessos'
import { colunasInexistentes } from '../fixtures/schemaProcessos'

const CABECALHO = [
  'numero do Processo', 'Situação no SEI', 'nome do Processo', 'Unidade Demandante',
  'Modalidade', 'Valor Estimado (R$)', 'Prioridade', 'Fase Atual',
]

describe('normalização de texto e valores', () => {
  it('norm ignora acentos, caixa e espaços extras', () => {
    expect(norm('  Situação   no SEI ')).toBe('situacao no sei')
    expect(norm(null)).toBe('')
  })

  it.each([
    ['R$ 1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['R$ 12.345.678,90', 12345678.9],
    ['1.234.567', 1234567],
    ['1.500', 1500],
    ['2 500,00', 2500],
    [1234.56, 1234.56],
    ['', null],
    [null, null],
    ['a combinar', null],
    [Number.NaN, null],
  ])('parseValor(%j) = %j', (entrada, esperado) => {
    expect(parseValor(entrada)).toBe(esperado)
  })

  it.each([
    ['Crítico', 'Critico'], ['NÃO CRÍTICO', 'Nao Critico'], ['nao critico', 'Nao Critico'],
    ['estratégico', 'Estrategico'], ['Alavancável', 'Alavancavel'], ['Urgente', 'Urgente'], ['', ''],
  ])('prioridade %j → %j', (entrada, esperado) => {
    expect(normalizarPrioridade(entrada)).toBe(esperado)
  })

  it.each([
    ['Pregão Eletrônico', 'Pregao'], ['Dispensa Eletrônica', 'Dispensa Eletronica'],
    ['Dispensa de licitação', 'Dispensa'], ['Inexigibilidade', 'Inexigibilidade'],
    ['Concorrência', 'Concorrencia'], ['Adesão a Ata de Registro de Preços', 'ARP'],
    ['ARP', 'ARP'], ['Pronto pagamento', 'Pronto Pagamento'], ['Credenciamento', 'Credenciamento'],
  ])('modalidade %j → tipo %j', (entrada, esperado) => {
    expect(tipoPorModalidade(entrada)).toBe(esperado)
  })
})

describe('fasePorTexto', () => {
  it('reconhece o nome oficial ignorando acentos e caixa', () => {
    expect(fasePorTexto('cotacao de precos')).toEqual({ nome: 'Cotação de Preços', conhecida: true, key: 'cotacao' })
    expect(fasePorTexto('Homologação')).toMatchObject({ key: 'homologacao', conhecida: true })
  })

  it('aceita correspondência parcial a partir de 4 letras', () => {
    expect(fasePorTexto('Parecer Jurídico')).toMatchObject({ key: 'parecer_juridico_ini', conhecida: true })
    expect(fasePorTexto('Aguardando homologação')).toMatchObject({ key: 'homologacao' })
  })

  it('fase desconhecida é mantida como texto', () => {
    expect(fasePorTexto('Fase inventada')).toEqual({ nome: 'Fase inventada', conhecida: false })
    expect(fasePorTexto('abc')).toEqual({ nome: 'abc', conhecida: false })
    expect(fasePorTexto('')).toEqual({ nome: '', conhecida: false })
  })
})

describe('lerPlanilhaProcessos', () => {
  const planilha = (...linhas) => [['Relatório de processos — CRT-08'], [], CABECALHO, ...linhas]

  it('localiza o cabeçalho abaixo de um título e converte cada linha', () => {
    const r = lerPlanilhaProcessos(planilha(
      ['2026/001', 'Em andamento', 'Aquisição de papel', 'Almoxarifado', 'Pregão Eletrônico', 'R$ 15.000,00', 'Crítico', 'Cotação de Preços'],
    ))
    expect(r.erro).toBeUndefined()
    expect(r.linhaCabecalho).toBe(3)
    expect(r.faltantes).toEqual([])
    expect(r.registros).toHaveLength(1)
    expect(r.registros[0]).toMatchObject({
      numero: '2026/001', objeto: 'Aquisição de papel', situacao_sei: 'Em andamento',
      unidade_demandante: 'Almoxarifado', modalidade: 'Pregão Eletrônico', tipo: 'Pregao',
      valor_estimado: 15000, prioridade: 'Critico', etapa: 'Cotação de Preços', local_documentacao: 'DFD',
      _faseDesconhecida: false, _valorInvalido: false,
    })
    expect(r.registros[0].fluxo).toEqual([{ nome: 'Cotação de Preços', data: expect.any(String) }])
  })

  it('número numérico vindo do Excel vira texto; sem fase o processo fica "Aberto"', () => {
    const r = lerPlanilhaProcessos(planilha([2026001, '', 'Serviço X', '', '', '', '', '']))
    expect(r.registros[0]).toMatchObject({ numero: '2026001', etapa: 'Aberto', fluxo: [], valor_estimado: null, tipo: null })
  })

  it('ignora linhas sem número, sem nome e números repetidos (na planilha e no banco)', () => {
    const r = lerPlanilhaProcessos(planilha(
      ['', '', 'Sem número', '', '', '', '', ''],
      ['2026/002', '', '', '', '', '', '', ''],
      ['2026/003', '', 'Primeiro', '', '', '', '', ''],
      [' 2026/003 ', '', 'Repetido na planilha', '', '', '', '', ''],
      ['2026/EXISTE', '', 'Já no banco', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
    ), { numerosExistentes: ['2026/existe'] })
    expect(r.registros.map((x) => x.numero)).toEqual(['2026/003'])
    expect(r.ignorados).toEqual([
      { linha: 4, motivo: 'sem número do processo' },
      { linha: 5, numero: '2026/002', motivo: 'sem nome do processo' },
      { linha: 7, numero: '2026/003', motivo: 'número já cadastrado ou repetido na planilha' },
      { linha: 8, numero: '2026/EXISTE', motivo: 'número já cadastrado ou repetido na planilha' },
    ])
  })

  it('sinaliza valor ilegível e fase fora da lista oficial', () => {
    const r = lerPlanilhaProcessos(planilha(['2026/004', '', 'Obra', '', '', 'a combinar', '', 'Fase local']))
    expect(r.registros[0]).toMatchObject({ valor_estimado: null, _valorInvalido: true, etapa: 'Fase local', _faseDesconhecida: true })
  })

  it('informa colunas opcionais ausentes', () => {
    const r = lerPlanilhaProcessos([['Nº do Processo', 'Objeto'], ['1', 'X']])
    expect(r.registros).toHaveLength(1)
    expect(r.faltantes).toEqual(['situacao_sei', 'unidade_demandante', 'modalidade', 'valor_estimado', 'prioridade', 'fase'])
  })

  it('sem cabeçalho reconhecível devolve erro', () => {
    const r = lerPlanilhaProcessos([['a', 'b'], ['1', '2']])
    expect(r.erro).toMatch(/Cabeçalho não encontrado/)
    expect(r.registros).toEqual([])
  })

  it('registros gerados usam apenas colunas existentes na tabela processos', () => {
    const r = lerPlanilhaProcessos(planilha(['2026/005', 'x', 'Y', 'Z', 'Pregão', '10', 'Crítico', 'Homologação']))
    const { _faseDesconhecida, _valorInvalido, ...payload } = r.registros[0]
    expect(colunasInexistentes(payload)).toEqual([])
  })
})

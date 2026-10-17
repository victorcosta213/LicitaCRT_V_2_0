import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const h = vi.hoisted(() => ({
  salvar: vi.fn(),
  role: 'fiscal',
  usuario: 'u-bia',
  showError: vi.fn(),
  showSuccess: vi.fn(),
  pedirTexto: vi.fn(),
}))
vi.mock('../../src/utils/alerts', () => ({ showError: h.showError, showSuccess: h.showSuccess, pedirTexto: h.pedirTexto }))
vi.mock('../../src/components/gc/useGcActions', async () => {
  const { can } = await import('../../src/utils/permissions')
  return {
    useGcActions: () => ({
      salvar: h.salvar, role: h.role, nome: 'Usuário Logado', user: { id: h.usuario }, params: {},
      can: (acao) => can(h.role, acao),
    }),
  }
})

import CompetenciaModal from '../../src/components/gc/CompetenciaModal'

// Campos da Gestão que o fiscal nunca envia (o banco recusaria)
const DA_GESTAO = ['liberado_financeiro', 'liberado_data', 'liberado_por', 'sei_despacho', 'suspensa', 'observacoes', 'cancelado']
// Campos do fiscal que a Gestão nunca envia
const DO_FISCAL = ['nf_recebida', 'nf_numero', 'nf_valor_bruto', 'relatorio_recebido', 'houve_glosa', 'glosa_valor',
  'doc_completa', 'atestado', 'atesto_data', 'sei_atesto', 'execucao_realizada']

const RESP = [
  { id: 'r1', papel: 'fiscal_tecnico', nome: 'Bia', ativo: true, usuario_id: 'u-bia' },
  { id: 'r2', papel: 'fiscal_substituto', nome: 'Caio', ativo: true, usuario_id: 'u-caio' },
]
const contratacao = ({ substitutoEmAtuacao = false, ocorrencias = [] } = {}) => ({
  id: 'c1', c: { numero: '001/2026', contratada: 'ACME', substituto_em_atuacao: substitutoEmAtuacao },
  b: { responsaveis: RESP, ocorrencias },
  fiscalEmAtuacao: substitutoEmAtuacao ? RESP[1] : RESP[0],
})
const competencia = (extra = {}) => ({
  id: 'comp1', competencia: '2026-09-01', status: { label: 'Aguardando nota fiscal' }, ...extra,
})
const pronta = { nf_recebida: true, nf_numero: '458', nf_valor_bruto: 1000, relatorio_recebido: true, doc_completa: true }

function abrir(comp, k = contratacao()) {
  render(<CompetenciaModal k={k} comp={comp} onClose={() => {}} />)
  return userEvent.setup()
}
const salvarBtn = () => screen.getByRole('button', { name: 'Salvar' })
const enviado = () => h.salvar.mock.calls[0][1]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 16, 12))
  h.salvar.mockReset().mockResolvedValue({})
  h.showError.mockReset()
  h.pedirTexto.mockReset()
  h.role = 'fiscal'
  h.usuario = 'u-bia'
})
afterEach(() => vi.useRealTimers())

describe('fiscal em atuação: NF, fiscalização, glosa, documentação e atesto', () => {
  it('registra a NF e conclui a fiscalização; nunca envia campos da Gestão', async () => {
    const user = abrir(competencia())
    await user.click(screen.getByLabelText('NF recebida'))
    await user.type(screen.getByLabelText('Nº da NF'), '458')
    await user.selectOptions(screen.getByLabelText('Execução realizada?'), 'sim')
    await user.selectOptions(screen.getByLabelText('Quantidade adequada?'), 'na')
    await user.click(screen.getByLabelText('Fiscalização concluída'))
    await user.click(salvarBtn())
    const [tabela, valores, id] = h.salvar.mock.calls[0]
    expect([tabela, id]).toEqual(['competencias', 'comp1'])
    expect(valores).toMatchObject({
      nf_recebida: true, nf_numero: '458', nf_recebimento_data: '2026-10-16',
      execucao_realizada: true, quantidade_adequada: 'na', relatorio_recebido: true, relatorio_data: '2026-10-16',
    })
    expect(Object.keys(valores).filter((c) => DA_GESTAO.includes(c))).toEqual([])
  })

  it('não conclui a fiscalização sem a NF', async () => {
    const user = abrir(competencia())
    await user.click(screen.getByLabelText('Fiscalização concluída'))
    await user.click(salvarBtn())
    expect(h.showError).toHaveBeenCalledWith('Registre o recebimento da NF antes de concluir a fiscalização.')
  })

  it.each([
    [{ doc_completa: true }, 'Não é possível atestar sem a nota fiscal registrada.'],
    [{ nf_recebida: true, doc_completa: true }, 'Não é possível atestar sem concluir a fiscalização.'],
    [{ nf_recebida: true, relatorio_recebido: true }, 'Não é possível atestar sem conferir os documentos necessários.'],
  ])('atesto exige os pré-requisitos (%j)', async (estado, mensagem) => {
    const user = abrir(competencia(estado))
    await user.click(screen.getByLabelText('Atestado'))
    await user.click(salvarBtn())
    expect(h.showError).toHaveBeenCalledWith(mensagem)
    expect(h.salvar).not.toHaveBeenCalled()
  })

  it('atesta e carimba a data e o responsável', async () => {
    const user = abrir(competencia(pronta))
    await user.click(screen.getByLabelText('Atestado'))
    await user.click(salvarBtn())
    expect(enviado()).toMatchObject({ atestado: true, atesto_data: '2026-10-16', atesto_responsavel: 'Usuário Logado' })
  })

  it('glosa exige valor e fundamento', async () => {
    const user = abrir(competencia({ nf_valor_bruto: 1000 }))
    await user.click(screen.getByLabelText('Houve glosa'))
    await user.click(salvarBtn())
    expect(h.showError).toHaveBeenCalledWith('Informe o valor e o fundamento da glosa.')
  })

  it('glosa não supera o valor da competência', async () => {
    const user = abrir(competencia({ nf_valor_bruto: 1000 }))
    await user.click(screen.getByLabelText('Houve glosa'))
    await user.type(screen.getByLabelText('Valor da glosa (R$)'), '1500')
    await user.type(screen.getByLabelText('Fundamento da glosa'), 'Falta de postos')
    await user.click(salvarBtn())
    expect(h.showError).toHaveBeenCalledWith('A glosa não pode ser maior que o valor da competência.')
  })

  it('a ocorrência pode ser registrada no próprio formulário', async () => {
    const user = abrir(competencia(pronta))
    await user.click(screen.getByLabelText('Houve ocorrência'))
    await user.selectOptions(screen.getByLabelText('Tipo'), 'atraso')
    await user.type(screen.getByLabelText('Descrição da ocorrência'), 'Entrega atrasada')
    await user.click(salvarBtn())
    expect(h.salvar).toHaveBeenNthCalledWith(2, 'ocorrencias', expect.objectContaining({
      contrato_id: 'c1', competencia_id: 'comp1', tipo: 'atraso', descricao: 'Entrega atrasada', status: 'aberta',
    }))
  })

  it('a Gestão não é editável pelo fiscal', () => {
    abrir(competencia(pronta))
    expect(screen.getByLabelText('Encaminhar ao Financeiro')).toBeDisabled()
    expect(screen.getByLabelText('NF recebida')).toBeEnabled()
  })
})

describe('fiscal substituto', () => {
  it('fora de atuação, só consulta', () => {
    h.usuario = 'u-caio'
    abrir(competencia())
    expect(screen.getByText(/Somente consulta/)).toBeInTheDocument()
    expect(screen.getByLabelText('NF recebida')).toBeDisabled()
    expect(screen.getByLabelText('Atestado')).toBeDisabled()
  })

  it('em atuação, registra normalmente', () => {
    h.usuario = 'u-caio'
    abrir(competencia(), contratacao({ substitutoEmAtuacao: true }))
    expect(screen.getByLabelText('NF recebida')).toBeEnabled()
  })
})

describe('Gestão: confere, devolve ou libera ao Financeiro', () => {
  beforeEach(() => { h.role = 'gestor'; h.usuario = 'u-gestor' })

  it('não registra NF nem atesta; envia só os campos da Gestão', async () => {
    const user = abrir(competencia({ ...pronta, atestado: true }))
    expect(screen.getByLabelText('NF recebida')).toBeDisabled()
    expect(screen.getByLabelText('Atestado')).toBeDisabled()
    await user.click(screen.getByLabelText('Encaminhar ao Financeiro'))
    await user.click(salvarBtn())
    expect(Object.keys(enviado()).filter((c) => DO_FISCAL.includes(c))).toEqual([])
    expect(enviado()).toMatchObject({ liberado_financeiro: true, liberado_data: '2026-10-16', liberado_por: 'Usuário Logado' })
  })

  it('não libera sem atesto', async () => {
    const user = abrir(competencia(pronta))
    await user.click(screen.getByLabelText('Encaminhar ao Financeiro'))
    await user.click(salvarBtn())
    expect(h.showError).toHaveBeenCalledWith('A competência precisa estar atestada antes de ser liberada ao financeiro.')
  })

  it('ocorrência em aberto impede a liberação', async () => {
    const k = contratacao({ ocorrencias: [{ id: 'o1', competencia_id: 'comp1', status: 'aberta' }] })
    const user = abrir(competencia({ ...pronta, atestado: true }), k)
    expect(screen.getByText('Ocorrências tratadas')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Encaminhar ao Financeiro'))
    await user.click(salvarBtn())
    expect(h.showError).toHaveBeenCalledWith('Há ocorrência em aberto nesta competência: trate-a antes de liberar ao financeiro.')
  })

  it('devolve ao fiscal com motivo', async () => {
    h.pedirTexto.mockResolvedValue('NF sem retenção')
    const user = abrir(competencia({ ...pronta, atestado: true }))
    await user.click(screen.getByRole('button', { name: /Devolver ao fiscal/ }))
    expect(h.salvar).toHaveBeenCalledWith('competencias', expect.objectContaining({
      atestado: false, devolucao_motivo: 'NF sem retenção', devolvido_em: expect.any(String),
    }), 'comp1')
  })

  it('sem motivo, não devolve', async () => {
    h.pedirTexto.mockResolvedValue(null)
    const user = abrir(competencia({ ...pronta, atestado: true }))
    await user.click(screen.getByRole('button', { name: /Devolver ao fiscal/ }))
    expect(h.salvar).not.toHaveBeenCalled()
  })
})

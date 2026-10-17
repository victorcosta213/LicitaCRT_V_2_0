import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  alertasDoPerfil, consolidar, gerarAlertas, linkDoAlerta, ordenarAlertas, painelGestao, painelFinanceiro, tarefaDoAlerta,
} from '../../src/utils/contrato'

// "Hoje" fixo: 16/10/2026, meio-dia (horário de Brasília)
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 16, 12))
})
afterEach(() => vi.useRealTimers())

const PARAMS = {
  alerta_vigencia_dias: [120, 90, 60, 30],
  alerta_garantia_dias: [60, 30],
  alerta_reajuste_dias: [60, 30],
  prazo_competencia_dias: 10,
  prazo_ocorrencia_aviso_dias: 5,
}

// Contratação "saudável": recebida pela Gestão, fiscalização formalizada, empenho do exercício.
const contrato = (extra = {}) => ({
  id: 'c1', numero: '001/2026', contratada: 'ACME', objeto: 'Limpeza', valor_inicial: 120000,
  vigencia_inicio: '2026-01-01', vigencia_fim: '2027-12-31', situacao: 'ativo', prorrogavel: true,
  encaminhado_em: '2026-01-02T10:00:00Z', validado_gestao: true, portaria_status: 'publicada', ...extra,
})
const RESP = [
  { id: 'r1', papel: 'gestor_titular', nome: 'Ana', ativo: true, ciente_em: '2026-01-05' },
  { id: 'r2', papel: 'fiscal_tecnico', nome: 'Bia', ativo: true, ciente_em: '2026-01-05', usuario_id: 'u-bia', created_at: '2026-01-03T10:00:00Z' },
  { id: 'r3', papel: 'fiscal_substituto', nome: 'Caio', ativo: true, ciente_em: '2026-01-05', usuario_id: 'u-caio', created_at: '2026-01-03T10:00:00Z' },
]
const bucket = (extra = {}) => ({
  responsaveis: RESP, os: [], competencias: [],
  empenhos: [{ id: 'emp', numero: 'NE1', exercicio: 2026, valor_inicial: 100000 }],
  movs: [], execucoes: [], eventos: [], ocorrencias: [], documentos: [], pendencias: [], ...extra,
})
const emExecucao = (extra = {}) => bucket({ os: [{ id: 'os1', status: 'vigente', data_efetiva_inicio: '2026-10-01' }], ...extra })

const alertasDe = (c, b, params = PARAMS) => gerarAlertas([consolidar(c, b, params)], params)
const tipos = (as) => as.map((a) => a.tipo)
const daCompetencia = (as) => as.filter((a) => a.tipo === 'competencia')

describe('gerarAlertas — contratação', () => {
  it('contratação formalizada e em dia não gera alertas', () => {
    expect(alertasDe(contrato(), bucket())).toEqual([])
  })

  it('em cadastro por Compras: lembrete só para Compras encaminhar', () => {
    const as = alertasDe(contrato({ situacao: 'em_cadastro', encaminhado_em: null, validado_gestao: false, vigencia_fim: '2026-10-20' }), bucket({ responsaveis: [] }))
    expect(as).toEqual([expect.objectContaining({ tipo: 'cadastro', perfis: ['compras'], titulo: 'Contratação em cadastro — encaminhar à Gestão' })])
  })

  it('encaminhada: a Gestão recebe "Nova contratação recebida de Compras"', () => {
    const as = alertasDe(contrato({ situacao: 'em_cadastro', validado_gestao: false, vigencia_fim: '2026-10-20' }), bucket({ responsaveis: [] }))
    expect(as).toEqual([expect.objectContaining({ tipo: 'cadastro', perfis: ['gestor'], titulo: 'Nova contratação recebida de Compras', severidade: 'warning' })])
  })

  it('encerrada ou cancelada não gera alertas', () => {
    expect(alertasDe(contrato({ situacao: 'encerrado', vigencia_fim: '2026-01-01' }), bucket({ responsaveis: [] }))).toEqual([])
    expect(alertasDe(contrato({ cancelado: true, vigencia_fim: '2026-01-01' }), bucket())).toEqual([])
  })
})

describe('gerarAlertas — formalização da fiscalização', () => {
  it.each([
    ['designacao', { responsaveis: [RESP[0], RESP[1]] }, {}, 'Designar fiscal titular e fiscal substituto', ['gestor']],
    ['portaria', {}, { portaria_status: null }, 'Portaria de designação pendente', ['gestor']],
    ['publicacao', {}, { portaria_status: 'aguardando_publicacao' }, 'Portaria aguardando assinatura/publicação', ['gabinete', 'gestor']],
    ['termo', { responsaveis: [RESP[0], RESP[1], { ...RESP[2], ciente_em: null }] }, {}, 'Termo de ciência e aceite pendente', ['gestor']],
  ])('etapa %s', (etapa, b, c, titulo, perfis) => {
    const as = alertasDe(contrato(c), bucket(b)).filter((a) => a.tipo === 'formalizacao')
    expect(as).toEqual([expect.objectContaining({ chave: etapa, titulo, perfis })])
  })

  it('contratação já em execução não é cobrada pela formalização', () => {
    const as = alertasDe(contrato({ portaria_status: null }), emExecucao({ competencias: [{ id: 'k', competencia: '2026-10-01' }] }))
    expect(tipos(as)).not.toContain('formalizacao')
  })

  it('fiscal recém-designado recebe "Nova contratação atribuída a você"', () => {
    const novo = { ...RESP[1], id: 'r9', created_at: '2026-10-14T09:00:00Z' }
    const as = alertasDe(contrato(), bucket({ responsaveis: [RESP[0], novo, RESP[2]] }))
    expect(as.filter((a) => a.tipo === 'atribuicao')).toEqual([
      expect.objectContaining({ perfis: ['fiscal'], usuarioId: 'u-bia', titulo: 'Nova contratação atribuída a você' }),
    ])
  })
})

describe('gerarAlertas — vigência, garantia e reajuste', () => {
  it.each([
    ['2026-10-01', 'danger', 'Vigência vencida'],
    ['2026-11-10', 'danger', 'Vigência termina em 25 dia(s)'],
    ['2026-11-30', 'warning', 'Vigência termina em 45 dia(s)'],
    ['2026-12-30', 'info', 'Vigência termina em 75 dia(s)'],
    ['2027-01-24', 'info', 'Vigência termina em 100 dia(s)'],
  ])('fim em %s → %s', (fim, severidade, titulo) => {
    const [a] = alertasDe(contrato({ vigencia_fim: fim }), bucket()).filter((x) => x.tipo === 'vigencia')
    expect(a).toMatchObject({ severidade, titulo })
  })

  it('orienta prorrogação ou nova contratação', () => {
    const [p] = alertasDe(contrato({ vigencia_fim: '2026-11-10', limite_prorrogacao: '2031-01-01' }), bucket())
    expect(p.detalhe).toMatch(/Prorrogável até 2031-01-01/)
    const [n] = alertasDe(contrato({ vigencia_fim: '2026-11-10', prorrogavel: false }), bucket())
    expect(n.detalhe).toMatch(/não prorrogável/)
  })

  it.each([
    ['2026-10-10', 'danger', 'Garantia vencida'],
    ['2026-11-05', 'danger', 'Garantia vence em 20 dia(s)'],
    ['2026-12-05', 'warning', 'Garantia vence em 50 dia(s)'],
  ])('garantia vencendo em %s → %s', (venc, severidade, titulo) => {
    const as = alertasDe(contrato({ exige_garantia: true, garantia_vencimento: venc }), bucket())
    expect(as.find((a) => a.tipo === 'garantia')).toMatchObject({ severidade, titulo })
  })

  it('data-base passada sem pedido de reajuste → reajuste pendente', () => {
    const [a] = alertasDe(contrato({ data_base_reajuste: '2025-09-01' }), bucket())
    expect(a).toMatchObject({ tipo: 'reajuste', titulo: 'Reajuste pendente', chave: '2026-09-01', severidade: 'warning' })
  })

  it('pedido de reajuste até 60 dias antes do aniversário cobre a data-base', () => {
    const b = bucket({ eventos: [{ id: 'ev', tipo: 'reajuste', situacao: 'solicitado', data_solicitacao: '2026-08-15' }] })
    expect(alertasDe(contrato({ data_base_reajuste: '2025-09-01' }), b)).toEqual([])
  })

  it('aniversário próximo (primeiro ano) → aviso antecipado', () => {
    const [a] = alertasDe(contrato({ data_base_reajuste: '2025-11-20', indice_reajuste: 'IPCA' }), bucket())
    expect(a).toMatchObject({ tipo: 'reajuste', titulo: 'Data-base de reajuste em 35 dia(s)', severidade: 'info', detalhe: 'Índice: IPCA.' })
  })
})

describe('gerarAlertas — competência (cada etapa alerta quem tem de agir)', () => {
  const nf = { nf_recebida: true, nf_recebimento_data: '2026-10-14' }

  it('NF ainda não recebida só é cobrada depois do fim do mês', () => {
    const as = daCompetencia(alertasDe(contrato(), emExecucao({
      competencias: [{ id: 'k9', competencia: '2026-09-01' }, { id: 'k10', competencia: '2026-10-01' }],
    })))
    expect(as).toEqual([expect.objectContaining({
      competenciaId: 'k9', titulo: 'Nota fiscal não recebida — setembro/2026', perfis: ['fiscal', 'gestor'], usuarioId: 'u-bia',
      severidade: 'danger', dias: -16,
    })])
  })

  it('NF recebida cobra a fiscalização na hora, mesmo no mês corrente', () => {
    const [a] = daCompetencia(alertasDe(contrato(), emExecucao({ competencias: [{ id: 'k', competencia: '2026-10-01', ...nf }] })))
    expect(a).toMatchObject({ titulo: 'NF recebida — aguardando fiscalização — outubro/2026', severidade: 'warning', dias: -2, usuarioId: 'u-bia' })
  })

  it('com o substituto em atuação, a tarefa vai para ele', () => {
    const [a] = daCompetencia(alertasDe(contrato({ substituto_em_atuacao: true }), emExecucao({ competencias: [{ id: 'k', competencia: '2026-10-01', ...nf }] })))
    expect(a.usuarioId).toBe('u-caio')
  })

  it('fiscalizada → atesto pendente; devolvida → mostra o motivo', () => {
    const fisc = { ...nf, relatorio_recebido: true, relatorio_data: '2026-10-15' }
    const [a] = daCompetencia(alertasDe(contrato(), emExecucao({ competencias: [{ id: 'k', competencia: '2026-10-01', ...fisc }] })))
    expect(a.titulo).toBe('Atesto pendente — outubro/2026')
    const [d] = daCompetencia(alertasDe(contrato(), emExecucao({
      competencias: [{ id: 'k', competencia: '2026-10-01', ...fisc, devolvido_em: '2026-10-16', devolucao_motivo: 'NF sem retenção' }],
    })))
    expect(d.titulo).toBe('Devolvida pela Gestão: NF sem retenção — outubro/2026')
  })

  it('atestada → Gestão; liberada → Financeiro; liquidada → pagamento', () => {
    const ok = { ...nf, relatorio_recebido: true, doc_completa: true, atestado: true, atesto_data: '2026-10-01' }
    const titulos = daCompetencia(alertasDe(contrato(), emExecucao({
      competencias: [
        { id: 'k7', competencia: '2026-07-01', ...ok },
        { id: 'k8', competencia: '2026-08-01', ...ok, liberado_financeiro: true, liberado_data: '2026-10-16' },
        { id: 'k9', competencia: '2026-09-01', ...ok, liberado_financeiro: true },
      ],
      execucoes: [{ id: 'x', competencia_id: 'k9', empenho_id: 'emp', valor_liquidado: 100, data_liquidacao: '2026-10-10' }],
    }))).map((a) => [a.titulo, a.perfis, a.severidade])
    expect(titulos).toEqual(expect.arrayContaining([
      ['Competência atestada — aguardando conferência da Gestão — julho/2026', ['gestor'], 'danger'],
      ['Nova competência liberada — liquidação pendente — agosto/2026', ['financeiro'], 'warning'],
      ['Pagamento pendente — setembro/2026', ['financeiro'], 'warning'],
    ]))
  })

  it('competências não abertas de contratação em execução', () => {
    const as = alertasDe(contrato(), bucket({
      os: [{ id: 'os1', status: 'vigente', data_efetiva_inicio: '2026-07-01' }],
      competencias: [{ id: 'k7', competencia: '2026-07-01', cancelado: true }, { id: 'k8', competencia: '2026-08-01' }],
    }))
    const a = as.find((x) => x.tipo === 'competencia_nao_aberta')
    expect(a.titulo).toBe('3 competência(s) não aberta(s)')
    expect(a.detalhe).toBe('julho/2026, setembro/2026, outubro/2026')
  })

  it('contratação sem fim de vigência também é cobrada', () => {
    const as = alertasDe(contrato({ vigencia_fim: null }), bucket({
      os: [{ id: 'os1', status: 'vigente', data_efetiva_inicio: '2026-09-01' }],
    }))
    expect(tipos(as)).toContain('competencia_nao_aberta')
  })
})

describe('gerarAlertas — pendências, ocorrências, OS/OC, responsáveis e financeiro', () => {
  it('pendência com prazo em até 7 dias ou vencida, para o perfil responsável', () => {
    const as = alertasDe(contrato(), bucket({
      pendencias: [
        { id: 'p1', descricao: 'Enviar certidão', status: 'aberta', prazo: '2026-10-19', perfil_responsavel: 'financeiro' },
        { id: 'p2', descricao: 'Vencida', status: 'aberta', prazo: '2026-10-10' },
        { id: 'p3', descricao: 'Distante', status: 'aberta', prazo: '2026-11-30' },
        { id: 'p4', descricao: 'Concluída', status: 'concluida', prazo: '2026-10-10' },
      ],
    }))
    const p = as.filter((a) => a.tipo === 'pendencia')
    expect(p.map((x) => x.chave).sort()).toEqual(['p1', 'p2'])
    expect(p.find((x) => x.chave === 'p1')).toMatchObject({ severidade: 'warning', perfis: ['financeiro'] })
  })

  it('ocorrência: vencida, vencendo ou em acompanhamento', () => {
    const as = alertasDe(contrato(), bucket({
      ocorrencias: [
        { id: 'o1', tipo: 'atraso', descricao: 'Atrasou', status: 'aguardando_contratada', prazo_concedido: '2026-10-01' },
        { id: 'o2', tipo: 'atraso', descricao: 'Vence logo', status: 'aberta', prazo_concedido: '2026-10-19' },
        { id: 'o3', tipo: 'outros', descricao: 'Sem prazo', status: 'em_analise' },
        { id: 'o4', tipo: 'atraso', descricao: 'Resolvida', status: 'regularizada', prazo_concedido: '2026-10-01' },
      ],
    }))
    const o = Object.fromEntries(as.filter((a) => a.tipo === 'ocorrencia').map((a) => [a.chave, [a.severidade, a.titulo]]))
    expect(o).toEqual({
      o1: ['danger', 'Prazo concedido à contratada vencido'],
      o2: ['warning', 'Prazo de regularização vence em 3 dia(s)'],
      o3: ['info', 'Ocorrência em aberto'],
    })
  })

  it('OS/OC em cada etapa', () => {
    const as = alertasDe(contrato(), bucket({
      os: [
        { id: 'os1', status: 'solicitada', tipo: 'oc', data_solicitacao: '2026-10-01' },
        { id: 'os2', status: 'aguardando_assinatura' },
        { id: 'os3', status: 'emitida' },
        { id: 'os4', status: 'aguardando_ciencia' },
        { id: 'os5', status: 'solicitada', cancelado: true },
      ],
    })).filter((a) => a.tipo === 'os')
    expect(as.map((a) => [a.titulo, a.perfis])).toEqual(expect.arrayContaining([
      ['OC solicitada — preparar o rascunho', ['gestor']],
      ['OS aguardando assinatura', ['gabinete', 'gestor']],
      ['OS assinada — encaminhar à contratada', ['gestor']],
      ['OS enviada — registrar o recebimento pela contratada', ['gestor']],
    ]))
    expect(as).toHaveLength(4)
  })

  it('em execução sem gestor(a) e sem fiscal', () => {
    const as = alertasDe(contrato(), emExecucao({ responsaveis: [], competencias: [{ id: 'k', competencia: '2026-10-01' }] }))
    expect(as.filter((a) => a.tipo === 'responsaveis').map((a) => a.chave).sort()).toEqual(['fiscal', 'gestor'])
  })

  it('execução reconhecida acima do valor e empenho negativo', () => {
    const as = alertasDe(contrato({ valor_inicial: 5000 }), bucket({
      empenhos: [{ id: 'emp', numero: 'NE1', exercicio: 2026, valor_inicial: 1000 }],
      competencias: [{ id: 'k1', competencia: '2026-09-01', atestado: true, valor_liquido: 6000 }],
      execucoes: [{ id: 'x1', competencia_id: 'k1', empenho_id: 'emp', valor_liquidado: 6000 }],
    }))
    expect(as.filter((a) => a.tipo === 'financeiro').map((a) => a.titulo)).toEqual(expect.arrayContaining([
      'Execução reconhecida acima do valor contratual',
      'Empenho NE1/2026 com saldo negativo',
    ]))
  })

  it('contratação em execução sem empenho no exercício corrente', () => {
    const as = alertasDe(contrato(), emExecucao({
      empenhos: [{ id: 'emp', numero: 'NE9', exercicio: 2025, valor_inicial: 1000 }],
      competencias: [{ id: 'k', competencia: '2026-10-01' }],
    }))
    expect(as.find((a) => a.chave === 'emp-2026')).toMatchObject({ perfis: ['financeiro'], severidade: 'warning' })
  })

  it('ids de alerta são únicos (usados como chave na interface)', () => {
    const as = alertasDe(contrato({ vigencia_fim: '2026-11-10', exige_garantia: true, garantia_vencimento: '2026-10-01', data_base_reajuste: '2025-09-01' }), bucket({
      responsaveis: [],
      os: [{ id: 'os1', status: 'vigente', data_efetiva_inicio: '2026-07-01' }, { id: 'os2', status: 'solicitada' }],
      competencias: [{ id: 'k7', competencia: '2026-07-01' }, { id: 'k8', competencia: '2026-08-01', nf_recebida: true }],
      pendencias: [{ id: 'p1', descricao: 'x', status: 'aberta', prazo: '2026-10-10' }, { id: 'p2', descricao: 'y', status: 'aberta', prazo: '2026-10-11' }],
      ocorrencias: [{ id: 'o1', tipo: 'atraso', descricao: 'a', status: 'aberta' }, { id: 'o2', tipo: 'atraso', descricao: 'b', status: 'aberta' }],
    }))
    expect(as.length).toBeGreaterThan(10)
    expect(new Set(as.map((a) => a.id)).size).toBe(as.length)
  })
})

describe('ordenarAlertas', () => {
  it('críticos primeiro; na mesma severidade, o mais urgente', () => {
    const r = ordenarAlertas([
      { id: 'i', severidade: 'info' },
      { id: 'w2', severidade: 'warning', dias: 20 },
      { id: 'd', severidade: 'danger' },
      { id: 'w1', severidade: 'warning', dias: -3 },
    ])
    expect(r.map((a) => a.id)).toEqual(['d', 'w1', 'w2', 'i'])
  })
})

describe('painéis', () => {
  const carteira = () => {
    const ativo = consolidar(contrato({ id: 'a', vigencia_fim: '2026-11-30' }), emExecucao({
      competencias: [
        { id: 'k1', competencia: '2026-10-01' },
        { id: 'k2', competencia: '2026-09-01', relatorio_recebido: true, nf_recebida: true, doc_completa: true, atestado: true, liberado_financeiro: true, valor_liquido: 1000 },
      ],
      execucoes: [{ id: 'x', competencia_id: 'k2', empenho_id: 'emp', valor_liquidado: 1000, valor_pago: 400 }],
    }), PARAMS)
    const recebida = consolidar(contrato({ id: 'b', situacao: 'em_cadastro', validado_gestao: false }), bucket({ empenhos: [], responsaveis: [] }), PARAMS)
    const termo = consolidar(contrato({ id: 't' }), bucket({ empenhos: [], responsaveis: [RESP[1], { ...RESP[2], ciente_em: null }] }), PARAMS)
    const encerrado = consolidar(contrato({ id: 'c', situacao: 'encerrado', valor_inicial: 999 }), bucket({ empenhos: [] }), PARAMS)
    return [ativo, recebida, termo, encerrado]
  }

  it('painel da gestão: contratações a caminho da execução e competências por etapa', () => {
    const ks = carteira()
    const p = painelGestao(ks, gerarAlertas(ks, PARAMS))
    expect(p.ativos).toBe(2)
    expect(p.emCadastro).toBe(1)
    expect(p.recebidas.map((k) => k.id)).toEqual(['b'])
    expect(p.termo.map((k) => k.id)).toEqual(['t'])
    expect(p.proximosVencimento.map((k) => k.id)).toEqual(['a'])
    expect(p.competenciasMes).toHaveLength(1)
    expect(p.aguardandoNF).toHaveLength(1)
    expect(p.aguardandoFinanceiro).toHaveLength(1)
  })

  it('painel financeiro totaliza só contratações em execução no valor contratual ativo', () => {
    const p = painelFinanceiro(carteira())
    expect(p.valorContratualAtivo).toBe(240000)
    expect(p.empenhado).toBe(100000)
    expect(p.liquidado).toBe(1000)
    expect(p.pago).toBe(400)
    expect(p.pendente).toBe(600)
    expect(p.reconhecido).toBe(1000)
  })
})

describe('mesa de cada perfil (alertasDoPerfil, tarefaDoAlerta)', () => {
  const A = [
    { id: '1', tipo: 'competencia', perfis: ['fiscal', 'gestor'], usuarioId: 'u-bia', contratoId: 'c1', severidade: 'warning' },
    { id: '2', tipo: 'competencia', perfis: ['fiscal', 'gestor'], usuarioId: 'u-caio', contratoId: 'c1', severidade: 'warning' },
    { id: '3', tipo: 'os', perfis: ['gabinete', 'gestor'], contratoId: 'c1', severidade: 'warning' },
    { id: '4', tipo: 'financeiro', perfis: ['financeiro'], contratoId: 'c2', severidade: 'danger' },
    { id: '5', tipo: 'cadastro', contratoId: 'c3', severidade: 'info' },
  ]
  const ids = (as) => as.map((a) => a.id)

  it('cada perfil vê só o que lhe compete; sem perfil definido, todos veem', () => {
    expect(ids(alertasDoPerfil(A, 'gestor'))).toEqual(['1', '2', '3', '5'])
    expect(ids(alertasDoPerfil(A, 'financeiro'))).toEqual(['4', '5'])
    expect(ids(alertasDoPerfil(A, 'gabinete'))).toEqual(['3', '5'])
  })

  it('tarefa do fiscal vai só para quem está em atuação', () => {
    expect(ids(alertasDoPerfil(A, 'fiscal', 'u-bia'))).toEqual(['1', '5'])
    expect(ids(alertasDoPerfil(A, 'fiscal', 'u-caio'))).toEqual(['2', '5'])
  })

  it('admin vê tudo; editor (legado) segue Compras', () => {
    expect(alertasDoPerfil(A, 'admin')).toHaveLength(A.length)
    expect(ids(alertasDoPerfil(A, 'editor'))).toEqual(['5'])
  })

  it('o alerta leva à aba da ficha onde é tratado', () => {
    expect(linkDoAlerta({ contratoId: 'c1', tipo: 'competencia' })).toBe('/contratos/c1?aba=competencias')
    expect(linkDoAlerta({ contratoId: 'c1', tipo: 'vigencia' })).toBe('/contratos/c1?aba=eventos')
    expect(linkDoAlerta({ contratoId: 'c1', tipo: 'desconhecido' })).toBe('/contratos/c1?aba=resumo')
  })

  it('vira item de tarefa sem repetir a idade já mostrada no prazo', () => {
    const base = { contratoId: 'c1', contratoNumero: '001/2026', contratada: 'ACME', tipo: 'competencia' }
    expect(tarefaDoAlerta({ ...base, detalhe: 'Há 3 dia(s).' })).toMatchObject({ ref: '001/2026', sub: 'ACME', to: '/contratos/c1?aba=competencias' })
    expect(tarefaDoAlerta({ ...base, detalhe: 'Prazo em 5 dia(s).' }).sub).toBe('ACME — Prazo em 5 dia(s).')
    // dentro da ficha a contratação já está identificada
    expect(tarefaDoAlerta({ ...base, detalhe: 'Prazo em 5 dia(s).' }, { semContrato: true })).toMatchObject({ ref: null, sub: 'Prazo em 5 dia(s).' })
  })

  it('funciona como callback de map (o índice não é tratado como opção)', () => {
    const [t] = [{ contratoId: 'c1', contratoNumero: '1', contratada: 'X', tipo: 'os', detalhe: 'Y' }].map(tarefaDoAlerta)
    expect(t).toMatchObject({ ref: '1', sub: 'X — Y' })
  })
})

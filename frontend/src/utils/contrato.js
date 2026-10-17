// Regras de negócio da gestão contratual — funções puras.
// Nada é gravado de forma derivada: valor atualizado, saldos, status das
// competências e alertas são sempre recalculados a partir dos lançamentos.

import {
  num, diasAte, hojeISO, fimDaCompetencia, parseISO, toISO, competenciaISO,
  fmtCompetencia, listaCompetencias, exercicioDe, brl,
} from './format'
import { normalizeRole } from './permissions'

/* ------------------------------------------------------------------ */
/* Dicionários                                                          */
/* ------------------------------------------------------------------ */

// A entidade principal é a CONTRATAÇÃO (tabela gc_contratos): contrato,
// nota de empenho ou outro instrumento.
export const SITUACAO_CONTRATO = {
  em_cadastro:     { label: 'Em cadastro',     kind: 'secondary' },
  ativo:           { label: 'Ativa',           kind: 'success' },
  suspenso:        { label: 'Suspensa',        kind: 'warning' },
  em_prorrogacao:  { label: 'Em prorrogação',  kind: 'info' },
  em_encerramento: { label: 'Em encerramento', kind: 'warning' },
  encerrado:       { label: 'Encerrada',       kind: 'dark' },
}
export const SITUACOES_OPERACIONAIS = ['ativo', 'em_prorrogacao', 'em_encerramento']

export const INSTRUMENTO = {
  contrato:     'Contrato',
  nota_empenho: 'Nota de Empenho',
  outro:        'Outro instrumento',
}

export const TIPO_ORDEM = { os: 'Ordem de Serviço', oc: 'Ordem de Compra' }
export const SIGLA_ORDEM = { os: 'OS', oc: 'OC' }

// Fluxo da OS/OC: rascunho → assinatura (Presidente + Diretor Financeiro) →
// envio à contratada → recebimento registrado → em execução
export const STATUS_OS = {
  solicitada:            { label: 'Solicitada',               kind: 'secondary', dono: 'gestor' },
  em_conferencia:        { label: 'Rascunho',                 kind: 'info',      dono: 'gestor' },
  aguardando_assinatura: { label: 'Aguardando assinatura',    kind: 'warning',   dono: 'gabinete' },
  emitida:               { label: 'Assinada',                 kind: 'primary',   dono: 'gestor' },
  aguardando_ciencia:    { label: 'Encaminhada à contratada', kind: 'warning',   dono: 'gestor' },
  vigente:               { label: 'Em execução',              kind: 'success',   dono: null },
  concluida:             { label: 'Concluída',                kind: 'dark',      dono: null },
  cancelada:             { label: 'Cancelada',                kind: 'danger',    dono: null },
}
export const OS_EM_TRATAMENTO = ['solicitada', 'em_conferencia', 'aguardando_assinatura', 'emitida', 'aguardando_ciencia']

// fiscal_tecnico é o fiscal titular (nome mantido no banco)
export const PAPEL_RESPONSAVEL = {
  gestor_titular:        'Gestor(a) do contrato',
  gestor_substituto:     'Gestor(a) substituto(a)',
  fiscal_tecnico:        'Fiscal titular',
  fiscal_substituto:     'Fiscal substituto',
  fiscal_administrativo: 'Fiscal administrativo',
}

// Etapas da contratação até o início da execução (§4–§9 do fluxo funcional)
export const ETAPA_CONTRATACAO = {
  em_cadastro:       { label: 'Em cadastro (Compras)',                     curto: 'Em cadastro',          kind: 'secondary', dono: 'compras' },
  aguardando_gestao: { label: 'Aguardando gestão contratual',              curto: 'Com a Gestão',         kind: 'warning',   dono: 'gestor' },
  designacao:        { label: 'Aguardando designação dos fiscais',         curto: 'Designar fiscais',     kind: 'warning',   dono: 'gestor' },
  portaria:          { label: 'Portaria de designação a elaborar',         curto: 'Portaria a elaborar',  kind: 'warning',   dono: 'gestor' },
  publicacao:        { label: 'Portaria aguardando assinatura/publicação', curto: 'Portaria no Gabinete', kind: 'info',      dono: 'gabinete' },
  termo:             { label: 'Fiscalização designada — termo de ciência pendente', curto: 'Termo de ciência', kind: 'info', dono: 'gestor' },
  ordem:             { label: 'Fiscalização formalizada — OS/OC pendente', curto: 'OS/OC pendente',       kind: 'primary',   dono: 'gestor' },
  em_execucao:       { label: 'Em execução',                               curto: 'Em execução',          kind: 'success',   dono: null },
}

export const TIPO_EVENTO = {
  termo_aditivo:         'Termo aditivo',
  apostilamento:         'Apostilamento',
  reajuste:              'Reajuste',
  repactuacao:           'Repactuação',
  reequilibrio:          'Reequilíbrio econômico-financeiro',
  prorrogacao:           'Prorrogação',
  acrescimo:             'Acréscimo',
  supressao:             'Supressão',
  suspensao:             'Suspensão',
  alteracao_responsavel: 'Alteração de gestor/fiscal',
  alteracao_garantia:    'Alteração de garantia',
  encerramento:          'Encerramento',
  outros:                'Outros',
}
export const SITUACAO_EVENTO = {
  solicitado: { label: 'Solicitado', kind: 'secondary' },
  em_analise: { label: 'Em análise', kind: 'info' },
  concluido:  { label: 'Concluído',  kind: 'success' },
  cancelado:  { label: 'Cancelado',  kind: 'danger' },
}

export const TIPO_OCORRENCIA = {
  atraso:               'Atraso',
  execucao_irregular:   'Execução irregular',
  descumprimento:       'Descumprimento contratual',
  ausencia_empregado:   'Ausência de empregado',
  entrega_desconforme:  'Entrega em desconformidade',
  notificacao:          'Notificação',
  glosa:                'Glosa',
  advertencia:          'Advertência',
  solicitacao_correcao: 'Solicitação de correção',
  outros:               'Outros',
}
export const STATUS_OCORRENCIA = {
  aberta:                { label: 'Aberta',                 kind: 'danger' },
  aguardando_contratada: { label: 'Aguardando contratada',  kind: 'warning' },
  em_analise:            { label: 'Em análise',             kind: 'info' },
  regularizada:          { label: 'Regularizada',           kind: 'success' },
  encaminhada_apuracao:  { label: 'Encaminhada p/ apuração', kind: 'dark' },
  encerrada:             { label: 'Encerrada',              kind: 'secondary' },
}
export const OCORRENCIA_ABERTA = ['aberta', 'aguardando_contratada', 'em_analise']

export const TIPOS_DOCUMENTO = [
  'Contrato', 'Termo de referência', 'Edital', 'Proposta', 'Empenho', 'Portaria',
  'Ordem de serviço', 'Garantia', 'Relatório fiscal', 'Atesto', 'Nota fiscal',
  'Notificação', 'Aditivo', 'Apostila', 'Parecer', 'Documento financeiro',
  'Termo de encerramento', 'Outros',
]

// Efeito de um evento contratual sobre a situação do contrato (null = sem efeito)
export function situacaoAposEvento(tipo, situacaoEvento, situacaoAtual) {
  const aberto = ['solicitado', 'em_analise'].includes(situacaoEvento)
  if (situacaoEvento === 'cancelado') {
    if (situacaoAtual === 'em_prorrogacao' && tipo === 'prorrogacao') return 'ativo'
    if (situacaoAtual === 'em_encerramento' && tipo === 'encerramento') return 'ativo'
    return null
  }
  if (tipo === 'prorrogacao') {
    if (aberto && situacaoAtual === 'ativo') return 'em_prorrogacao'
    if (situacaoEvento === 'concluido' && situacaoAtual === 'em_prorrogacao') return 'ativo'
  }
  if (tipo === 'suspensao' && situacaoEvento === 'concluido') return 'suspenso'
  if (tipo === 'encerramento') {
    if (aberto && ['ativo', 'em_prorrogacao'].includes(situacaoAtual)) return 'em_encerramento'
    if (situacaoEvento === 'concluido') return 'encerrado'
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Indexação por contrato                                               */
/* ------------------------------------------------------------------ */

const vazio = () => ({
  responsaveis: [], os: [], competencias: [], empenhos: [], movs: [],
  execucoes: [], eventos: [], ocorrencias: [], documentos: [], pendencias: [],
})

const CHAVES = {
  responsaveis: 'responsaveis', ordens: 'os', competencias: 'competencias',
  empenhos: 'empenhos', movs: 'movs', execucoes: 'execucoes', eventos: 'eventos',
  ocorrencias: 'ocorrencias', documentos: 'documentos', pendencias: 'pendencias',
}

export function indexar(raw) {
  const map = new Map()
  for (const [chaveRaw, chaveBucket] of Object.entries(CHAVES)) {
    for (const row of raw[chaveRaw] || []) {
      if (!map.has(row.contrato_id)) map.set(row.contrato_id, vazio())
      map.get(row.contrato_id)[chaveBucket].push(row)
    }
  }
  return map
}

const validos = (rows) => rows.filter((r) => !r.cancelado)
const soma = (rows, f) => rows.reduce((s, r) => s + num(f(r)), 0)
const EPS = 0.005

/* ------------------------------------------------------------------ */
/* Execução financeira e status da competência                         */
/* ------------------------------------------------------------------ */

export function situacaoExecucao(ex) {
  if (!ex) return { key: 'sem_lancamento', label: 'Sem lançamento', kind: 'secondary', pendente: 0 }
  const liquidado = num(ex.valor_liquidado)
  const pago = num(ex.valor_pago)
  const retido = num(ex.retencao)
  const pendente = Math.max(0, liquidado - retido - pago)
  if (ex.suspenso) return { key: 'suspenso', label: 'Suspenso', kind: 'warning', pendente }
  if (liquidado > EPS && pendente <= EPS) return { key: 'pago', label: 'Pago', kind: 'success', pendente }
  if (pago > EPS && pendente > EPS) return { key: 'pagamento_parcial', label: 'Pagamento parcial', kind: 'warning', pendente }
  if (liquidado > EPS) return { key: 'aguardando_pagamento', label: 'Aguardando pagamento', kind: 'primary', pendente }
  return { key: 'aguardando_liquidacao', label: 'Aguardando liquidação', kind: 'info', pendente }
}

// Status automático da competência (§12–§16). `dono` = de quem é a vez.
// Fiscal: NF → fiscalização → atesto. Gestão: conferência e liberação. Financeiro: pagamento.
export function statusCompetencia(comp, ex, ocorrenciasAbertas = 0) {
  const flags = []
  if (comp.houve_ocorrencia || ocorrenciasAbertas > 0) flags.push({ label: 'Com ocorrência', kind: 'danger' })
  if (comp.houve_glosa) flags.push({ label: 'Com glosa', kind: 'warning' })
  if (comp.devolvido_em && !comp.atestado) flags.push({ label: 'Devolvida pela Gestão', kind: 'danger' })

  const base = (key, label, kind, dono) => ({ key, label, kind, dono, flags })

  if (comp.cancelado) return base('cancelada', 'Cancelada', 'secondary', null)
  if (comp.suspensa) return base('suspensa', 'Suspensa', 'warning', 'gestor')
  if (!comp.nf_recebida) return base('aguardando_nf', 'Aguardando nota fiscal', 'secondary', 'fiscal')
  if (!comp.relatorio_recebido) return base('aguardando_fiscalizacao', 'NF recebida — aguardando fiscalização', 'info', 'fiscal')
  if (!comp.atestado) return base('aguardando_atesto', 'Fiscalizada — aguardando atesto', 'info', 'fiscal')
  if (!comp.liberado_financeiro) return base('conferencia_gestao', 'Atestada — aguardando Gestão', 'primary', 'gestor')

  const s = situacaoExecucao(ex)
  switch (s.key) {
    case 'sem_lancamento':
    case 'aguardando_liquidacao':
      return base('em_liquidacao', 'Aguardando liquidação', 'primary', 'financeiro')
    case 'aguardando_pagamento':
    case 'pagamento_parcial':
      return base('aguardando_pagamento', 'Liquidada — aguardando pagamento', 'primary', 'financeiro')
    case 'suspenso':
      return base('suspensa', 'Pagamento suspenso', 'warning', 'financeiro')
    default:
      return base('concluida', 'Paga — concluída', 'success', null)
  }
}

export const ETAPAS_COMPETENCIA = [
  ['aguardando_nf', 'Aguardando nota fiscal'],
  ['aguardando_fiscalizacao', 'NF recebida — aguardando fiscalização'],
  ['aguardando_atesto', 'Fiscalizada — aguardando atesto'],
  ['conferencia_gestao', 'Atestada — aguardando Gestão'],
  ['em_liquidacao', 'Aguardando liquidação'],
  ['aguardando_pagamento', 'Aguardando pagamento'],
  ['concluida', 'Paga — concluída'],
  ['suspensa', 'Suspensa'],
]

// Mantida por compatibilidade: o atesto é sempre do fiscal
export const donoDaEtapa = (dono) => dono

// Checklist da Gestão antes de liberar ao Financeiro (§15): confere, não refaz a fiscalização
export function conferenciaGestao(comp, ocorrenciasAbertas) {
  return [
    ['NF registrada', !!comp.nf_recebida],
    ['Fiscalização realizada', !!comp.relatorio_recebido],
    ['Atesto do fiscal', !!comp.atestado],
    ['Ocorrências tratadas', ocorrenciasAbertas === 0],
    ['Glosa registrada (se houver)', !comp.houve_glosa || (num(comp.glosa_valor) > 0 && !!comp.glosa_motivo)],
    ['Documentos obrigatórios conferidos', !!comp.doc_completa],
  ]
}

/* ------------------------------------------------------------------ */
/* Fiscalização: titular × substituto em atuação; formalização          */
/* ------------------------------------------------------------------ */

const ativosDoPapel = (responsaveis, papel) => responsaveis.filter((r) => r.ativo && r.papel === papel)

// Quem pratica os atos do fiscal agora: o titular, ou o substituto quando acionado
export function fiscalEmAtuacao(c, responsaveis) {
  const titular = ativosDoPapel(responsaveis, 'fiscal_tecnico')[0] || null
  const substituto = ativosDoPapel(responsaveis, 'fiscal_substituto')[0] || null
  if (c.substituto_em_atuacao && substituto) return substituto
  return titular || responsaveis.find((r) => r.ativo && r.papel.startsWith('fiscal')) || null
}

// O usuário logado (fiscal) pode registrar NF/fiscalização/atesto? (mesma regra do banco)
export function fiscalPodeOperar(k, usuarioId) {
  return k.b.responsaveis.some((r) => r.ativo && r.usuario_id === usuarioId && r.papel.startsWith('fiscal')
    && (r.papel !== 'fiscal_substituto' || k.c.substituto_em_atuacao))
}

// É a vez do usuário nesta competência? (o fiscal só quando está em atuação na contratação)
export function minhaVez(k, comp, role, usuarioId) {
  const r = normalizeRole(role)
  const dono = comp.status.dono
  if (!dono) return false
  if (r === 'admin') return true
  if (dono === 'fiscal') return r === 'fiscal' && fiscalPodeOperar(k, usuarioId)
  return r === dono
}

// Portaria publicada + titular e substituto + termo de ciência de gestor(a) e fiscais
export function fiscalizacaoFormalizada(c, responsaveis) {
  const ativos = responsaveis.filter((r) => r.ativo)
  return c.portaria_status === 'publicada'
    && ativos.some((r) => r.papel === 'fiscal_tecnico')
    && ativos.some((r) => r.papel === 'fiscal_substituto')
    && ativos.filter((r) => ['gestor_titular', 'fiscal_tecnico', 'fiscal_substituto'].includes(r.papel))
      .every((r) => !!r.ciente_em)
}

// Em que etapa a contratação está até começar a execução
export function etapaContratacao(c, responsaveis, os) {
  const emExecucao = c.execucao_anterior || os.some((o) => !o.cancelado && ['vigente', 'concluida'].includes(o.status))
  if (emExecucao || ['suspenso', 'em_prorrogacao', 'em_encerramento', 'encerrado'].includes(c.situacao)) return 'em_execucao'
  if (!c.validado_gestao) return c.encaminhado_em ? 'aguardando_gestao' : 'em_cadastro'
  const ativos = responsaveis.filter((r) => r.ativo)
  if (!ativos.some((r) => r.papel === 'fiscal_tecnico') || !ativos.some((r) => r.papel === 'fiscal_substituto')) return 'designacao'
  if (c.portaria_status !== 'publicada') return c.portaria_status === 'aguardando_publicacao' ? 'publicacao' : 'portaria'
  if (!fiscalizacaoFormalizada(c, responsaveis)) return 'termo'
  return 'ordem'
}

/* ------------------------------------------------------------------ */
/* Consolidação do contrato (saldos distintos — escopo §8)             */
/* ------------------------------------------------------------------ */

export function consolidar(c, b = vazio(), params = {}) {
  // Valor e vigência vigentes = cadastro + eventos concluídos, em ordem cronológica
  const eventosOk = validos(b.eventos)
    .filter((e) => e.situacao === 'concluido')
    .sort((x, y) => String(x.data_evento || '').localeCompare(String(y.data_evento || ''))
      || String(x.created_at).localeCompare(String(y.created_at)))

  let valorAtualizado = num(c.valor_inicial)
  let vigenciaFim = c.vigencia_fim
  for (const e of eventosOk) {
    if (e.valor_posterior !== null && e.valor_posterior !== undefined) {
      const ant = e.valor_anterior ?? valorAtualizado
      valorAtualizado += num(e.valor_posterior) - num(ant)
    }
    if (e.vigencia_posterior) vigenciaFim = e.vigencia_posterior
  }

  // Competências + execução financeira
  const execPorComp = new Map(validos(b.execucoes).map((x) => [x.competencia_id, x]))
  const ocorrAbertasPorComp = new Map()
  for (const o of validos(b.ocorrencias)) {
    if (o.competencia_id && OCORRENCIA_ABERTA.includes(o.status)) {
      ocorrAbertasPorComp.set(o.competencia_id, (ocorrAbertasPorComp.get(o.competencia_id) || 0) + 1)
    }
  }
  const competencias = validos(b.competencias)
    .map((comp) => {
      const ex = execPorComp.get(comp.id) || null
      return {
        ...comp,
        execucao: ex,
        status: statusCompetencia(comp, ex, ocorrAbertasPorComp.get(comp.id) || 0),
        situacaoFin: situacaoExecucao(ex),
      }
    })
    .sort((x, y) => String(y.competencia).localeCompare(String(x.competencia)))

  const execucaoReconhecida = soma(
    competencias.filter((x) => x.atestado && !x.suspensa), (x) => x.valor_liquido)

  // Empenhos
  const movs = validos(b.movs)
  const execs = validos(b.execucoes)
  const empenhos = validos(b.empenhos).map((e) => {
    const ms = movs.filter((m) => m.empenho_id === e.id)
    const reforcos = soma(ms.filter((m) => m.tipo === 'reforco'), (m) => m.valor)
    const anulacoes = soma(ms.filter((m) => m.tipo === 'anulacao'), (m) => m.valor)
    const vinc = execs.filter((x) => x.empenho_id === e.id)
    const valorAtual = num(e.valor_inicial) + reforcos - anulacoes
    const liquidado = soma(vinc, (x) => x.valor_liquidado)
    const reservado = soma(
      vinc.filter((x) => num(x.valor_liquidado) <= EPS && !x.suspenso), (x) => x.valor_competencia)
    return {
      ...e, reforcos, anulacoes, valorAtual, liquidado, reservado,
      saldo: valorAtual - liquidado,
      saldoDisponivel: valorAtual - liquidado - reservado,
      movimentos: ms,
    }
  }).sort((x, y) => (y.exercicio - x.exercicio) || String(x.numero).localeCompare(String(y.numero)))

  const empenhado = soma(empenhos, (e) => e.valorAtual)
  const liquidado = soma(execs, (x) => x.valor_liquidado)
  const pago = soma(execs, (x) => x.valor_pago)
  const retido = soma(execs, (x) => x.retencao)
  const pendentePagamento = execs.reduce((s, x) => s + situacaoExecucao(x).pendente, 0)

  const ocorrenciasAbertas = validos(b.ocorrencias).filter((o) => OCORRENCIA_ABERTA.includes(o.status))
  const pendenciasAbertas = validos(b.pendencias).filter((p) => p.status === 'aberta')
  const emAberto = competencias.filter((x) => x.status.key !== 'concluida' && x.status.key !== 'cancelada')

  const resp = (papel) => b.responsaveis.find((r) => r.ativo && r.papel === papel) || null
  const fiscais = b.responsaveis.filter((r) => r.ativo && r.papel.startsWith('fiscal'))
  const gestores = b.responsaveis.filter((r) => r.ativo && r.papel.startsWith('gestor'))

  const maiorAlerta = Math.max(0, ...(params.alerta_vigencia_dias || [120]))
  const diasVigencia = diasAte(vigenciaFim)

  return {
    c, b,
    id: c.id,
    valorAtualizado,
    valorInicial: num(c.valor_inicial),
    acrescimos: valorAtualizado - num(c.valor_inicial),
    vigenciaFim,
    diasVigencia,
    inicioProrrogacao: vigenciaFim && c.prorrogavel
      ? toISO(new Date(parseISO(vigenciaFim).getTime() - maiorAlerta * 86400000))
      : null,
    execucaoReconhecida,
    saldoExecucao: valorAtualizado - execucaoReconhecida,
    empenhado,
    empenhos,
    saldoEmpenhos: soma(empenhos, (e) => e.saldo),
    liquidado,
    pago,
    retido,
    pendentePagamento,
    competencias,
    competenciasEmAberto: emAberto,
    ultimaCompetencia: competencias[0] || null,
    ocorrenciasAbertas,
    pendenciasAbertas,
    eventosConcluidos: eventosOk,
    gestorTitular: resp('gestor_titular'),
    fiscalTitular: resp('fiscal_tecnico'),
    fiscalSubstituto: resp('fiscal_substituto'),
    fiscalTecnico: resp('fiscal_tecnico') || fiscais[0] || null,
    fiscalEmAtuacao: fiscalEmAtuacao(c, b.responsaveis),
    fiscais,
    gestores,
    osVigente: b.os.filter((o) => !o.cancelado && o.status === 'vigente')[0] || null,
    etapa: etapaContratacao(c, b.responsaveis, b.os),
    formalizada: fiscalizacaoFormalizada(c, b.responsaveis),
    nomeGestor: (resp('gestor_titular') || gestores[0])?.nome || c.responsavel_contratacao || null,
    nomeFiscal: (resp('fiscal_tecnico') || fiscais[0])?.nome || null,
  }
}

// Meses de execução (a partir da OS vigente) que ainda não têm competência aberta
export function competenciasFaltantes(k, ref = new Date()) {
  const os = k.osVigente
  const ini = os?.data_efetiva_inicio || os?.periodo_inicio || k.c.vigencia_inicio
  if (!ini) return []
  const hoje = toISO(ref)
  const mes = competenciaISO(ref.getFullYear(), ref.getMonth() + 1)
  const fim = k.vigenciaFim && k.vigenciaFim < hoje ? k.vigenciaFim : hoje
  const existentes = new Set(validos(k.b.competencias).map((c) => c.competencia))
  return listaCompetencias(ini, fim).filter((m) => m <= mes && !existentes.has(m))
}


/* ------------------------------------------------------------------ */
/* Alertas automáticos (escopo §12)                                     */
/* ------------------------------------------------------------------ */

const SEV_ORDEM = { danger: 0, warning: 1, info: 2 }
export const ordenarAlertas = (a) =>
  [...a].sort((x, y) => SEV_ORDEM[x.severidade] - SEV_ORDEM[y.severidade]
    || (x.dias ?? 9999) - (y.dias ?? 9999))

function faixa(dias, limiares) {
  const asc = [...limiares].sort((a, b) => a - b)
  return asc.find((t) => dias <= t) ?? null
}

function aniversarios(baseISO, ref) {
  // devolve { ultimo, proximo } aniversários (n >= 1) da data-base
  const b = parseISO(baseISO)
  if (!b) return {}
  const hoje = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  let ano = ref.getFullYear()
  let cand = new Date(ano, b.getMonth(), b.getDate())
  if (cand > hoje) { ano -= 1; cand = new Date(ano, b.getMonth(), b.getDate()) }
  const ultimo = ano > b.getFullYear() ? toISO(cand) : null
  const proximo = toISO(new Date(ano + 1, b.getMonth(), b.getDate()))
  return { ultimo, proximo }
}

export function gerarAlertas(consolidados, params = {}, ref = new Date()) {
  const out = []
  const limVig = params.alerta_vigencia_dias || [120, 90, 60, 30]
  const limGar = params.alerta_garantia_dias || [60, 30]
  const limRea = params.alerta_reajuste_dias || [60, 30]
  const prazoComp = Number(params.prazo_competencia_dias ?? 10)
  const hoje = toISO(ref)
  const exercicio = ref.getFullYear()

  for (const k of consolidados) {
    const { c, b } = k
    const base = { contratoId: c.id, contratoNumero: c.numero, contratada: c.contratada }
    const push = (a) => out.push({ ...base, id: `${c.id}:${a.tipo}:${a.chave || ''}`, ...a })

    if (c.cancelado || c.situacao === 'encerrado') continue

    // Tarefas do fiscal vão para quem está em atuação (titular ou substituto acionado)
    const fiscalId = k.fiscalEmAtuacao?.usuario_id || null

    if (k.etapa === 'em_cadastro') {
      push({
        tipo: 'cadastro', categoria: 'Contratação', severidade: 'info', perfis: ['compras'],
        titulo: 'Contratação em cadastro — encaminhar à Gestão',
        detalhe: 'Complete os dados e use "Encaminhar para Gestão".',
      })
      continue
    }
    if (k.etapa === 'aguardando_gestao') {
      push({
        tipo: 'cadastro', categoria: 'Contratação', severidade: 'warning', perfis: ['gestor'],
        titulo: 'Nova contratação recebida de Compras',
        detalhe: 'Confira os dados e receba a contratação para designar a fiscalização.',
      })
      if (c.situacao === 'em_cadastro') continue
    }

    // Formalização da fiscalização (§6–§8)
    const ETAPA_ALERTA = {
      designacao: ['warning', ['gestor'], 'Designar fiscal titular e fiscal substituto', 'Selecione os fiscais no cadastro da contratação.'],
      portaria: ['warning', ['gestor'], 'Portaria de designação pendente', 'Gere a minuta e encaminhe para assinatura/publicação.'],
      publicacao: ['info', ['gabinete', 'gestor'], 'Portaria aguardando assinatura/publicação', 'Após a publicação, registre o nº, a data e o link SEI.'],
      termo: ['warning', ['gestor'], 'Termo de ciência e aceite pendente', 'Registre a ciência da gestora e dos fiscais.'],
    }
    const ea = ETAPA_ALERTA[k.etapa]
    if (ea) {
      push({ tipo: 'formalizacao', categoria: 'Fiscalização', severidade: ea[0], perfis: ea[1], chave: k.etapa, titulo: ea[2], detalhe: ea[3] })
    }

    // Nova contratação atribuída ao fiscal (designado nos últimos 7 dias)
    for (const r of b.responsaveis) {
      if (r.ativo && r.usuario_id && r.papel.startsWith('fiscal') && r.created_at
          && diasAte(String(r.created_at).slice(0, 10), ref) >= -7) {
        push({ tipo: 'atribuicao', categoria: 'Fiscalização', severidade: 'info', perfis: ['fiscal'], usuarioId: r.usuario_id,
          chave: r.id, titulo: 'Nova contratação atribuída a você',
          detalhe: `${PAPEL_RESPONSAVEL[r.papel] || 'Fiscal'} — ${c.objeto || c.contratada}` })
      }
    }

    // Vigência
    if (k.vigenciaFim) {
      const d = diasAte(k.vigenciaFim, ref)
      if (d < 0) {
        push({ tipo: 'vigencia', categoria: 'Vigência', severidade: 'danger', dias: d, perfis: ['gestor'],
          titulo: 'Vigência vencida', detalhe: `Venceu há ${-d} dia(s) (${k.vigenciaFim}).` })
      } else {
        const f = faixa(d, limVig)
        if (f !== null) {
          push({ tipo: 'vigencia', categoria: 'Vigência', dias: d, perfis: ['gestor'],
            severidade: f <= 30 ? 'danger' : f <= 60 ? 'warning' : 'info',
            titulo: `Vigência termina em ${d} dia(s)`,
            detalhe: c.prorrogavel
              ? `Prorrogável${c.limite_prorrogacao ? ` até ${c.limite_prorrogacao}` : ''} — iniciar a prorrogação.`
              : 'Contrato não prorrogável — planejar nova contratação.' })
        }
      }
    }

    // Garantia
    if (c.exige_garantia && c.garantia_vencimento) {
      const d = diasAte(c.garantia_vencimento, ref)
      if (d < 0) {
        push({ tipo: 'garantia', categoria: 'Garantia', severidade: 'danger', dias: d, perfis: ['gestor'],
          titulo: 'Garantia vencida', detalhe: `Venceu há ${-d} dia(s).` })
      } else {
        const f = faixa(d, limGar)
        if (f !== null) {
          push({ tipo: 'garantia', categoria: 'Garantia', dias: d, perfis: ['gestor'],
            severidade: f <= 30 ? 'danger' : 'warning',
            titulo: `Garantia vence em ${d} dia(s)`, detalhe: 'Solicitar renovação/complementação à contratada.' })
        }
      }
    }

    // Reajuste
    if (c.data_base_reajuste) {
      const { ultimo, proximo } = aniversarios(c.data_base_reajuste, ref)
      const evs = validos(b.eventos).filter((e) =>
        ['reajuste', 'repactuacao', 'reequilibrio'].includes(e.tipo))
      const cobre = (anivISO) => {
        const lim = toISO(new Date(parseISO(anivISO).getTime() - 60 * 86400000))
        return evs.some((e) => (e.data_solicitacao || e.data_evento || '') >= lim)
      }
      if (ultimo && !cobre(ultimo)) {
        const d = diasAte(ultimo, ref)
        push({ tipo: 'reajuste', categoria: 'Reajuste', severidade: 'warning', dias: d, perfis: ['gestor'],
          chave: ultimo, titulo: 'Reajuste pendente',
          detalhe: `Data-base ${ultimo} passou há ${-d} dia(s) sem pedido/registro de reajuste.` })
      } else if (proximo) {
        const d = diasAte(proximo, ref)
        const f = faixa(d, limRea)
        if (f !== null && !cobre(proximo)) {
          push({ tipo: 'reajuste', categoria: 'Reajuste', severidade: f <= 30 ? 'warning' : 'info', dias: d,
            perfis: ['gestor'], chave: proximo, titulo: `Data-base de reajuste em ${d} dia(s)`,
            detalhe: `Índice: ${c.indice_reajuste || 'não informado'}.` })
        }
      }
    }

    // Competências: cada etapa alerta quem tem de agir, contando desde o ato anterior.
    // A NF só é cobrada depois que o mês termina; as demais etapas, assim que chegam.
    const diasDesde = (iso) => (iso ? Math.max(0, -diasAte(String(iso).slice(0, 10), ref)) : 0)
    for (const comp of k.competenciasEmAberto) {
      const doFiscal = { perfis: ['fiscal', 'gestor'], usuarioId: fiscalId }
      let a = null
      switch (comp.status.key) {
        case 'aguardando_nf':
          if (hoje > fimDaCompetencia(comp.competencia)) {
            a = { ...doFiscal, titulo: 'Nota fiscal não recebida', dias: diasDesde(fimDaCompetencia(comp.competencia)) }
          }
          break
        case 'aguardando_fiscalizacao':
          a = { ...doFiscal, titulo: 'NF recebida — aguardando fiscalização', dias: diasDesde(comp.nf_recebimento_data || comp.nf_data || comp.updated_at) }
          break
        case 'aguardando_atesto':
          a = comp.devolvido_em
            ? { ...doFiscal, titulo: `Devolvida pela Gestão${comp.devolucao_motivo ? `: ${comp.devolucao_motivo}` : ''}`, dias: diasDesde(comp.devolvido_em) }
            : { ...doFiscal, titulo: 'Atesto pendente', dias: diasDesde(comp.relatorio_data || comp.updated_at) }
          break
        case 'conferencia_gestao':
          a = { perfis: ['gestor'], titulo: 'Competência atestada — aguardando conferência da Gestão', dias: diasDesde(comp.atesto_data || comp.updated_at) }
          break
        case 'em_liquidacao':
          a = { perfis: ['financeiro'], titulo: 'Nova competência liberada — liquidação pendente', dias: diasDesde(comp.liberado_data || comp.updated_at) }
          break
        case 'aguardando_pagamento':
          a = { perfis: ['financeiro'], titulo: 'Pagamento pendente', dias: diasDesde(comp.execucao?.data_liquidacao || comp.updated_at) }
          break
        default:
          break
      }
      if (!a) continue
      push({
        tipo: 'competencia', categoria: 'Competência', severidade: a.dias > prazoComp ? 'danger' : 'warning',
        dias: -a.dias, chave: comp.competencia, competenciaId: comp.id, perfis: a.perfis, usuarioId: a.usuarioId,
        titulo: `${a.titulo} — ${fmtCompetencia(comp.competencia)}`,
        detalhe: a.dias > 0 ? `Há ${a.dias} dia(s).` : 'Chegou hoje.',
      })
    }

    // Competências não abertas (contratação em execução)
    if (k.osVigente) {
      const faltando = competenciasFaltantes(k, ref)
      if (faltando.length) {
        push({
          tipo: 'competencia_nao_aberta', categoria: 'Competência', severidade: 'warning',
          perfis: ['gestor', 'fiscal'], usuarioId: fiscalId, titulo: `${faltando.length} competência(s) não aberta(s)`,
          detalhe: faltando.slice(-3).map(fmtCompetencia).join(', '),
        })
      }
    }

    // Pendências por prazo individual
    for (const p of k.pendenciasAbertas) {
      if (!p.prazo) continue
      const d = diasAte(p.prazo, ref)
      if (d <= 7) {
        push({ tipo: 'pendencia', categoria: 'Pendência', chave: p.id, dias: d,
          severidade: d < 0 ? 'danger' : 'warning',
          perfis: [p.perfil_responsavel || 'gestor'],
          titulo: p.descricao, detalhe: d < 0 ? `Prazo vencido há ${-d} dia(s).` : `Prazo em ${d} dia(s).` })
      }
    }

    // Ocorrências em aberto: vencida, vencendo ou só em acompanhamento
    const avisoOcorrencia = Number(params.prazo_ocorrencia_aviso_dias ?? 5)
    for (const o of k.ocorrenciasAbertas) {
      const d = o.prazo_concedido ? diasAte(o.prazo_concedido, ref) : null
      const detalhe = `${TIPO_OCORRENCIA[o.tipo] || o.tipo}: ${o.descricao}`
      const comum = { tipo: 'ocorrencia', categoria: 'Ocorrência', chave: o.id, perfis: ['gestor', 'fiscal'], usuarioId: fiscalId, detalhe }
      if (d !== null && d < 0) {
        push({ ...comum, severidade: 'danger', dias: d, titulo: 'Prazo concedido à contratada vencido' })
      } else if (d !== null && d <= avisoOcorrencia) {
        push({ ...comum, severidade: 'warning', dias: d, titulo: `Prazo de regularização vence em ${d} dia(s)` })
      } else {
        push({ ...comum, severidade: 'info', titulo: 'Ocorrência em aberto' })
      }
    }

    // OS/OC em tratamento
    for (const o of validos(b.os)) {
      const sigla = SIGLA_ORDEM[o.tipo] || 'OS'
      const m = {
        solicitada: ['info', ['gestor'], `${sigla} solicitada — preparar o rascunho`],
        em_conferencia: ['info', ['gestor'], `${sigla} em rascunho`],
        aguardando_assinatura: ['warning', ['gabinete', 'gestor'], `${sigla} aguardando assinatura`],
        emitida: ['warning', ['gestor'], `${sigla} assinada — encaminhar à contratada`],
        aguardando_ciencia: ['warning', ['gestor'], `${sigla} enviada — registrar o recebimento pela contratada`],
      }[o.status]
      if (m) {
        push({ tipo: 'os', categoria: 'OS/OC', severidade: m[0], chave: o.id, perfis: m[1], titulo: m[2],
          detalhe: o.status === 'solicitada' && !k.formalizada
            ? 'A assinatura depende da fiscalização formalizada (portaria e termo de ciência).'
            : `Solicitada em ${o.data_solicitacao || '—'}.` })
      }
    }

    // Responsáveis (contratações já em execução; antes disso, o alerta da formalização orienta)
    if (!k.gestorTitular && k.etapa !== 'aguardando_gestao') {
      push({ tipo: 'responsaveis', categoria: 'Cadastro', severidade: 'warning', chave: 'gestor', perfis: ['gestor'],
        titulo: 'Gestor(a) do contrato não designado(a)', detalhe: 'Cadastre a gestão na aba Cadastro.' })
    }
    if (!k.fiscais.length && k.etapa === 'em_execucao') {
      push({ tipo: 'responsaveis', categoria: 'Cadastro', severidade: 'warning', chave: 'fiscal', perfis: ['gestor'],
        titulo: 'Fiscal não designado', detalhe: 'Cadastre o fiscal titular e o substituto na aba Cadastro.' })
    }

    // Financeiro
    if (k.execucaoReconhecida > k.valorAtualizado + EPS) {
      push({ tipo: 'financeiro', categoria: 'Financeiro', severidade: 'danger', chave: 'exec>valor',
        perfis: ['gestor', 'financeiro'], titulo: 'Execução reconhecida acima do valor contratual',
        detalhe: `${brl(k.execucaoReconhecida)} reconhecidos para ${brl(k.valorAtualizado)} contratados.` })
    }
    for (const e of k.empenhos) {
      if (e.saldo < -EPS) {
        push({ tipo: 'financeiro', categoria: 'Financeiro', severidade: 'danger', chave: e.id,
          perfis: ['financeiro'], titulo: `Empenho ${e.numero}/${e.exercicio} com saldo negativo`,
          detalhe: `Liquidado acima do empenhado em ${brl(-e.saldo)}.` })
      }
    }
    if (SITUACOES_OPERACIONAIS.includes(c.situacao) && k.osVigente
        && !k.empenhos.some((e) => e.exercicio === exercicio)) {
      push({ tipo: 'financeiro', categoria: 'Financeiro', severidade: 'warning', chave: `emp-${exercicio}`,
        perfis: ['financeiro'], titulo: `Sem empenho para o exercício ${exercicio}`,
        detalhe: 'Contrato em execução sem empenho registrado no exercício corrente.' })
    }
  }
  return ordenarAlertas(out)
}

// Alertas que competem ao perfil (a "mesa" de cada um). Tarefas do fiscal vão só
// para quem está em atuação (titular, ou substituto acionado). Admin vê tudo.
export function alertasDoPerfil(alertas, role, usuarioId) {
  const r = normalizeRole(role)
  if (r === 'admin') return alertas
  return alertas.filter((a) => {
    if (a.perfis && !a.perfis.includes(r)) return false
    if (r === 'fiscal' && a.usuarioId && a.usuarioId !== usuarioId) return false
    return true
  })
}

// Aba da ficha da contratação onde cada tipo de alerta é tratado
export const ABA_POR_TIPO = {
  vigencia: 'eventos', reajuste: 'eventos', garantia: 'cadastro', competencia: 'competencias',
  competencia_nao_aberta: 'competencias', pendencia: 'pendencias', ocorrencia: 'ocorrencias',
  os: 'os', financeiro: 'financeiro', responsaveis: 'cadastro', cadastro: 'cadastro',
  formalizacao: 'cadastro', atribuicao: 'cadastro',
}
export const linkDoAlerta = (a) => `/contratos/${a.contratoId}?aba=${ABA_POR_TIPO[a.tipo] || 'resumo'}`

// Alerta no formato de item de lista de tarefas (mesa, painéis)
const ehIdade = (txt) => /^(Há \d+ dia|Chegou hoje)/.test(txt || '')
// semContrato: dentro da ficha, onde a contratação já está identificada
export const tarefaDoAlerta = (a, { semContrato } = {}) => ({
  ...a,
  ref: semContrato ? null : a.contratoNumero,
  sub: [semContrato ? '' : a.contratada, ehIdade(a.detalhe) ? '' : a.detalhe].filter(Boolean).join(' — '),
  to: linkDoAlerta(a),
})

/* ------------------------------------------------------------------ */
/* Agregados dos painéis                                                */
/* ------------------------------------------------------------------ */

export function painelGestao(consolidados, alertas, ref = new Date()) {
  const mes = competenciaISO(ref.getFullYear(), ref.getMonth() + 1)
  const operacionais = consolidados.filter((k) => SITUACOES_OPERACIONAIS.includes(k.c.situacao) && !k.c.cancelado)
  const comps = consolidados.flatMap((k) => k.competencias.map((x) => ({ ...x, contrato: k.c })))
  const doMes = comps.filter((x) => x.competencia === mes)
  const emAndamento = comps.filter((x) => !['concluida', 'cancelada'].includes(x.status.key))
  const porEtapa = (...keys) => emAndamento.filter((x) => keys.includes(x.status.key))

  const naEtapa = (etapa) => consolidados.filter((k) => !k.c.cancelado && k.etapa === etapa)

  return {
    ativos: operacionais.length,
    emCadastro: consolidados.filter((k) => k.c.situacao === 'em_cadastro' && !k.c.cancelado).length,
    // contratações a caminho da execução (§5–§9)
    recebidas: naEtapa('aguardando_gestao'),
    designacao: naEtapa('designacao'),
    portaria: naEtapa('portaria'),
    publicacao: naEtapa('publicacao'),
    termo: naEtapa('termo'),
    ordem: naEtapa('ordem'),
    proximosVencimento: operacionais
      .filter((k) => k.diasVigencia !== null && k.diasVigencia <= 120)
      .sort((a, b) => a.diasVigencia - b.diasVigencia),
    emProrrogacao: consolidados.filter((k) => k.c.situacao === 'em_prorrogacao'),
    reajustesPendentes: alertas.filter((a) => a.tipo === 'reajuste'),
    competenciasMes: doMes,
    competenciasMesConcluidas: doMes.filter((x) => x.status.key === 'concluida').length,
    aguardandoNF: porEtapa('aguardando_nf'),
    aguardandoFiscal: porEtapa('aguardando_fiscalizacao', 'aguardando_atesto'),
    aguardandoAtesto: porEtapa('aguardando_atesto'),
    aguardandoGestao: porEtapa('conferencia_gestao'),
    comOcorrencia: emAndamento.filter((x) => x.status.flags.some((f) => f.label === 'Com ocorrência')),
    aguardandoFinanceiro: porEtapa('em_liquidacao', 'aguardando_pagamento'),
    garantiasProximas: alertas.filter((a) => a.tipo === 'garantia'),
    criticas: alertas.filter((a) => a.severidade === 'danger'),
    ref,
  }
}

export function painelFinanceiro(consolidados) {
  const ativos = consolidados.filter((k) => !k.c.cancelado && k.c.situacao !== 'encerrado' && k.c.situacao !== 'em_cadastro')
  const todos = consolidados.filter((k) => !k.c.cancelado)
  const tot = (arr, f) => arr.reduce((s, k) => s + f(k), 0)

  // por exercício: empenhado/liquidado/pago a partir dos lançamentos
  const exerc = new Map()
  const at = (ano) => {
    if (!exerc.has(ano)) exerc.set(ano, { ano, empenhado: 0, liquidado: 0, pago: 0, reconhecido: 0 })
    return exerc.get(ano)
  }
  for (const k of todos) {
    for (const e of k.empenhos) at(e.exercicio).empenhado += e.valorAtual
    for (const comp of k.competencias) {
      const ano = exercicioDe(comp.competencia)
      if (comp.atestado && !comp.suspensa) at(ano).reconhecido += num(comp.valor_liquido)
      if (comp.execucao) {
        at(ano).liquidado += num(comp.execucao.valor_liquidado)
        at(ano).pago += num(comp.execucao.valor_pago)
      }
    }
  }

  return {
    valorContratualAtivo: tot(ativos, (k) => k.valorAtualizado),
    empenhado: tot(todos, (k) => k.empenhado),
    saldoEmpenhos: tot(todos, (k) => k.saldoEmpenhos),
    reconhecido: tot(todos, (k) => k.execucaoReconhecida),
    liquidado: tot(todos, (k) => k.liquidado),
    pago: tot(todos, (k) => k.pago),
    pendente: tot(todos, (k) => k.pendentePagamento),
    porExercicio: [...exerc.values()].sort((a, b) => b.ano - a.ano),
    hoje: hojeISO(),
  }
}

/* ------------------------------------------------------------------ */
/* Índice de documentos SEI referenciados pelos próprios lançamentos   */
/* ------------------------------------------------------------------ */

export function documentosReferenciados(k) {
  const { c, b } = k
  const out = []
  const add = (tipo, sei, origem, link, data) => {
    if (sei || link) out.push({ tipo, sei: sei || '', link: link || '', origem, data: data || '' })
  }
  add('Processo SEI da contratação', c.sei_processo, 'Cadastro', c.sei_link)
  add('Portaria de designação', c.portaria_sei, c.portaria_numero ? `Portaria nº ${c.portaria_numero}` : 'Cadastro',
    c.portaria_sei_link, c.portaria_data)
  add('Termo de ciência e aceite', c.termo_sei, 'Fiscalização', c.termo_sei_link)
  for (const r of b.responsaveis) add('Designação', r.sei_documento, `${PAPEL_RESPONSAVEL[r.papel]} — ${r.nome}`)
  for (const o of validos(b.os)) {
    const sigla = SIGLA_ORDEM[o.tipo] || 'OS'
    add(`Solicitação de ${sigla}`, o.sei_documento_solic, TIPO_ORDEM[o.tipo] || 'Ordem de serviço', null, o.data_solicitacao)
    add(TIPO_ORDEM[o.tipo] || 'Ordem de serviço', o.sei_documento, `${sigla} ${o.numero_os || ''}`.trim(), o.sei_link, o.data_emissao)
  }
  for (const e of validos(b.empenhos)) {
    add('Empenho', e.sei_documento, `Empenho ${e.numero}/${e.exercicio}`, e.sei_link, e.data)
  }
  for (const m of validos(b.movs)) {
    add(m.tipo === 'reforco' ? 'Reforço de empenho' : 'Anulação de empenho', m.sei_documento, 'Movimento de empenho', null, m.data)
  }
  for (const ev of validos(b.eventos)) {
    add(TIPO_EVENTO[ev.tipo] || 'Evento', ev.sei_documento, 'Evento contratual', ev.sei_link, ev.data_evento)
  }
  for (const comp of validos(b.competencias)) {
    const o = `Competência ${fmtCompetencia(comp.competencia)}`
    add('Relatório fiscal', comp.sei_relatorio, o, comp.sei_link_relatorio, comp.relatorio_data)
    add('Atesto', comp.sei_atesto, o, comp.sei_link_atesto, comp.atesto_data)
    add('Despacho ao financeiro', comp.sei_despacho, o, null, comp.liberado_data)
  }
  for (const x of validos(b.execucoes)) {
    add('Documento financeiro', x.sei_documento, 'Execução financeira', x.sei_link, x.data_liquidacao)
  }
  for (const oc of validos(b.ocorrencias)) {
    add('Ocorrência', oc.sei_documentos, 'Ocorrência', null, oc.data)
  }
  return out
}

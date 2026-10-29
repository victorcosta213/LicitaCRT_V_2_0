// Regras da tramitação de processos: em que estado cada processo está, há quanto tempo está parado
// na unidade e como resumir isso por unidade. Funções puras, usadas pelas telas e testadas à parte.
import { diasAte } from './format'

export const DIAS_PARADO_PADRAO = 5
const DIA = 86400000

export const TIPOS_PROCESSO = [
  'Requerimento', 'Solicitação de compra', 'Solicitação de serviço', 'Prestação de contas',
  'Pagamento', 'Contratação', 'Assunto administrativo', 'Outro',
]

export const PRIORIDADES = {
  baixa: { label: 'Baixa', kind: 'secondary', ordem: 3 },
  normal: { label: 'Normal', kind: 'secondary', ordem: 2 },
  alta: { label: 'Alta', kind: 'warning', ordem: 1 },
  urgente: { label: 'Urgente', kind: 'danger', ordem: 0 },
}

export const MOVIMENTOS = {
  abertura: { label: 'Processo aberto', icone: 'bi-plus-circle' },
  envio: { label: 'Enviado', icone: 'bi-send' },
  recebimento: { label: 'Recebido', icone: 'bi-inbox' },
  alteracao: { label: 'Dados alterados', icone: 'bi-pencil' },
  conclusao: { label: 'Concluído', icone: 'bi-check2-circle' },
  reabertura: { label: 'Reaberto', icone: 'bi-arrow-counterclockwise' },
}

// dias inteiros desde um instante (nunca negativo)
export const diasDesde = (iso, agora = new Date()) => (iso ? Math.max(0, Math.floor((agora - new Date(iso)) / DIA)) : null)

export const ESTADOS = {
  atrasado: { label: 'Atrasado', kind: 'danger' },
  parado: { label: 'Parado', kind: 'warning' },
  aguardando_recebimento: { label: 'Aguardando recebimento', kind: 'info' },
  em_analise: { label: 'Em análise', kind: 'success' },
  concluido: { label: 'Concluído', kind: 'secondary' },
}

// Estado do processo hoje. `parado` = em andamento há `diasParado` dias ou mais sem movimentação;
// `atrasado` = passou do prazo final. Atrasado vale mais que parado, que vale mais que o resto.
export function estadoDoProcesso(p, { agora = new Date(), diasParado = DIAS_PARADO_PADRAO } = {}) {
  const diasNaUnidade = diasDesde(p.desde, agora)
  if (p.situacao === 'concluido') return { chave: 'concluido', ...ESTADOS.concluido, diasNaUnidade, diasPrazo: null }
  const diasPrazo = p.prazo ? diasAte(p.prazo, agora) : null
  const atrasado = diasPrazo !== null && diasPrazo < 0
  const parado = diasNaUnidade !== null && diasNaUnidade >= diasParado
  const chave = atrasado ? 'atrasado' : parado ? 'parado' : !p.recebido_em ? 'aguardando_recebimento' : 'em_analise'
  return { chave, ...ESTADOS[chave], diasNaUnidade, diasPrazo, parado, atrasado }
}

// Contagens do topo do painel de acompanhamento
export function indicadores(processos, opcoes = {}) {
  const agora = opcoes.agora || new Date()
  const base = { emAndamento: 0, parados: 0, atrasados: 0, aguardandoRecebimento: 0, concluidosNoMes: 0 }
  for (const p of processos) {
    const e = estadoDoProcesso(p, opcoes)
    if (e.chave === 'concluido') {
      const c = p.concluido_em && new Date(p.concluido_em)
      if (c && c.getFullYear() === agora.getFullYear() && c.getMonth() === agora.getMonth()) base.concluidosNoMes += 1
      continue
    }
    base.emAndamento += 1
    if (e.parado) base.parados += 1
    if (e.atrasado) base.atrasados += 1
    if (!p.recebido_em) base.aguardandoRecebimento += 1
  }
  return base
}

// Onde estão os processos em andamento: por unidade, com o que está parado e o tempo médio de espera
export function resumoPorUnidade(processos, unidades, opcoes = {}) {
  const porId = new Map(unidades.map((u) => [u.id, { unidade: u, total: 0, parados: 0, atrasados: 0, somaDias: 0, maisAntigo: null }]))
  for (const p of processos) {
    if (p.situacao === 'concluido') continue
    const linha = porId.get(p.unidade_atual)
    if (!linha) continue
    const e = estadoDoProcesso(p, opcoes)
    linha.total += 1
    linha.somaDias += e.diasNaUnidade || 0
    if (e.parado) linha.parados += 1
    if (e.atrasado) linha.atrasados += 1
    if (!linha.maisAntigo || (e.diasNaUnidade || 0) > linha.maisAntigo) linha.maisAntigo = e.diasNaUnidade || 0
  }
  return [...porId.values()]
    .filter((l) => l.total > 0)
    .map((l) => ({ ...l, mediaDias: Math.round((l.somaDias / l.total) * 10) / 10 }))
    .sort((a, b) => b.parados - a.parados || b.total - a.total || a.unidade.sigla.localeCompare(b.unidade.sigla))
}

// Processos que pedem atenção, os mais antigos na unidade primeiro
export function processosTravados(processos, opcoes = {}) {
  return processos
    .map((p) => ({ p, e: estadoDoProcesso(p, opcoes) }))
    .filter(({ e }) => e.parado || e.atrasado)
    .sort((a, b) => (b.e.diasNaUnidade || 0) - (a.e.diasNaUnidade || 0))
}

// Por onde o processo passou: cada permanência numa unidade, com o tempo gasto.
// Uma permanência começa na abertura, em cada envio ou na reabertura, e termina no movimento seguinte.
export function permanencias(processo, tramitacoes, unidadesPorId, agora = new Date()) {
  const marcos = tramitacoes.filter((t) => ['abertura', 'envio', 'reabertura'].includes(t.tipo))
  const fim = processo.situacao === 'concluido' && processo.concluido_em ? new Date(processo.concluido_em) : agora
  return marcos.map((m, i) => {
    const inicio = new Date(m.criada_em)
    const ate = marcos[i + 1] ? new Date(marcos[i + 1].criada_em) : fim
    return {
      id: m.id,
      unidade: unidadesPorId.get(m.para_unidade) || null,
      inicio: m.criada_em,
      ate: marcos[i + 1] ? marcos[i + 1].criada_em : (processo.situacao === 'concluido' ? processo.concluido_em : null),
      dias: Math.max(0, Math.floor((ate - inicio) / DIA)),
      atual: !marcos[i + 1] && processo.situacao !== 'concluido',
    }
  })
}

// Tarefa da Minha mesa: processo que chegou na minha unidade e ainda não foi recebido, ou que está parado
export function tarefaDeProcesso(p, estado) {
  const severidade = estado.atrasado ? 'danger' : estado.parado ? 'warning' : 'info'
  const titulo = estado.atrasado
    ? 'Processo com prazo vencido'
    : estado.parado ? `Processo parado há ${estado.diasNaUnidade} dias` : p.recebido_em ? 'Processo na sua unidade' : 'Processo aguardando o seu recebimento'
  return {
    id: `tr:${p.id}`, categoria: 'Tramitação', severidade,
    dias: estado.atrasado ? estado.diasPrazo : -(estado.diasNaUnidade || 0),
    titulo, ref: p.numero, sub: `${p.assunto}${p.tipo ? ` — ${p.tipo}` : ''}`, to: `/processos/${p.id}`,
  }
}

// Vistas da lista de processos
export const VISTAS = [
  ['todos', 'Todos'],
  ['minha', 'Na minha unidade'],
  ['meus', 'Abertos por mim'],
  ['receber', 'Aguardando recebimento'],
  ['atencao', 'Precisam de atenção'],
  ['concluidos', 'Concluídos'],
]

// O processo entra na vista? `usuarioId` e `unidadeId` são de quem está olhando.
export function naVista(p, vista, { usuarioId, unidadeId, ...opcoes } = {}) {
  const andamento = p.situacao === 'em_andamento'
  switch (vista) {
    case 'minha': return andamento && ((!!unidadeId && p.unidade_atual === unidadeId) || (!!usuarioId && p.responsavel_atual === usuarioId))
    case 'meus': return !!usuarioId && p.aberto_por === usuarioId
    case 'receber': return andamento && !p.recebido_em
    case 'atencao': { const e = estadoDoProcesso(p, opcoes); return andamento && (e.parado || e.atrasado) }
    case 'concluidos': return p.situacao === 'concluido'
    default: return true
  }
}

// Busca por protocolo, assunto, interessado, tipo ou unidade
export function combinaBusca(p, termo, unidadesPorId) {
  const q = String(termo || '').trim().toLowerCase()
  if (!q) return true
  const u = unidadesPorId.get(p.unidade_atual)
  return [p.numero, p.assunto, p.interessado, p.tipo, p.responsavel_nome, u?.sigla, u?.nome]
    .some((v) => String(v || '').toLowerCase().includes(q))
}

// Em andamento primeiro, e entre eles o que está há mais tempo na unidade; concluídos por último
export function ordenarParaLista(processos) {
  return [...processos].sort((a, b) => {
    const ca = a.situacao === 'concluido' ? 1 : 0
    const cb = b.situacao === 'concluido' ? 1 : 0
    if (ca !== cb) return ca - cb
    if (ca === 1) return new Date(b.concluido_em || 0) - new Date(a.concluido_em || 0)
    return new Date(a.desde) - new Date(b.desde)
  })
}

// Tempo desde um instante, em palavras: "agora", "há 5 min", "há 3 h", "há 2 dias"
export function haQuanto(iso, agora = new Date()) {
  if (!iso) return ''
  const min = Math.max(0, Math.floor((agora - new Date(iso)) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

// O que a pessoa fez, no passado, para montar a frase "Fulano enviou o processo X"
export const VERBOS_MOVIMENTO = {
  abertura: 'abriu', envio: 'enviou', recebimento: 'recebeu', alteracao: 'alterou os dados de', conclusao: 'concluiu', reabertura: 'reabriu',
}

// "1 parado" / "3 parados"
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

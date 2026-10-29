// Regras de apresentação das solicitações ao Compras: situação, vistas, tarefas e o DFD.
import { itensValidos, totalItens } from '../modelos/base'

export const STATUS_SOL = {
  enviada: { label: 'Aguardando análise', kind: 'warning' },
  devolvida: { label: 'Devolvida para ajuste', kind: 'danger' },
  aceita: { label: 'Processo aberto', kind: 'success' },
  recusada: { label: 'Recusada', kind: 'secondary' },
  cancelada: { label: 'Cancelada', kind: 'secondary' },
}

export const TIPOS_SOL = {
  dfd: 'Com DFD assinado',
  solicitacao: 'Solicitação simples',
}

export const PRIORIDADES_SOL = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'urgente', rotulo: 'Urgente' },
]

export const PCA = [
  { valor: 'sim', rotulo: 'Sim, está no plano' },
  { valor: 'nao', rotulo: 'Não está no plano' },
  { valor: 'nao-elaborado', rotulo: 'O órgão não elaborou plano' },
]

// O Compras começa pelo que espera análise; os setores, pelo que é seu
export const vistasSol = (ehCompras) => (ehCompras
  ? [['analise', 'Aguardando análise'], ['devolvidas', 'Devolvidas'], ['aceitas', 'Processo aberto'], ['encerradas', 'Recusadas e canceladas'], ['todas', 'Todas']]
  : [['todas', 'Todas'], ['analise', 'Aguardando análise'], ['devolvidas', 'Devolvidas para ajuste'], ['aceitas', 'Processo aberto'], ['encerradas', 'Recusadas e canceladas']])

export function naVistaSol(s, vista) {
  switch (vista) {
    case 'analise': return s.status === 'enviada'
    case 'devolvidas': return s.status === 'devolvida'
    case 'aceitas': return s.status === 'aceita'
    case 'encerradas': return s.status === 'recusada' || s.status === 'cancelada'
    default: return true
  }
}

export function combinaBuscaSol(s, termo, unidadesPorId = new Map()) {
  const q = String(termo || '').trim().toLowerCase()
  if (!q) return true
  const u = unidadesPorId.get(s.unidade_id)
  return [s.numero, s.objeto, s.solicitante_nome, s.justificativa, u?.sigla, u?.nome].some((v) => String(v || '').toLowerCase().includes(q))
}

// Urgentes primeiro, depois as mais antigas aguardando (quem chegou antes é atendido antes)
const ORDEM_PRIORIDADE = { urgente: 0, alta: 1, normal: 2, baixa: 3 }
const ORDEM_STATUS = { devolvida: 0, enviada: 1, aceita: 2, recusada: 3, cancelada: 4 }
export const ordenarSolicitacoes = (lista) => [...lista].sort((a, b) => (ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status])
  || (a.status === 'enviada' ? (ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade]) || String(a.enviada_em).localeCompare(String(b.enviada_em)) : 0)
  || String(b.enviada_em).localeCompare(String(a.enviada_em)))

// Quem pode corrigir e cancelar: quem pediu ou a unidade solicitante (e a administração)
export const podeEditarSol = (s, { usuarioId, unidadeId, master }) => !!s && (master || s.solicitante === usuarioId || (!!unidadeId && s.unidade_id === unidadeId))

const diasDesde = (iso, agora = Date.now()) => Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 86400000))

// Tarefas da mesa: o Compras vê o que espera análise; a unidade vê o que voltou para ajuste
export function tarefasDeSolicitacoes(lista, { ehCompras, usuarioId, unidadeId, agora = Date.now() }) {
  const tarefas = []
  for (const s of lista) {
    if (ehCompras && s.status === 'enviada') {
      const dias = diasDesde(s.enviada_em, agora)
      tarefas.push({
        id: `sol:${s.id}`, categoria: 'Solicitação', severidade: s.prioridade === 'urgente' || dias > 5 ? 'danger' : 'warning',
        titulo: 'Solicitação aguardando análise do Compras', ref: s.numero, sub: `${s.objeto} · há ${dias} dia(s)`, to: `/solicitacoes/${s.id}`,
      })
    }
    if (s.status === 'devolvida' && podeEditarSol(s, { usuarioId, unidadeId, master: false })) {
      tarefas.push({
        id: `sol:${s.id}`, categoria: 'Solicitação', severidade: 'danger',
        titulo: 'Solicitação devolvida pelo Compras: corrija e reenvie', ref: s.numero, sub: s.motivo || s.objeto, to: `/solicitacoes/${s.id}`,
      })
    }
  }
  return tarefas
}

// Dados do pedido ao Compras, tirados da DFD (nada é redigitado): objeto, itens, total, prazo e prioridade
const PRIORIDADE_DO_DFD = { alta: 'alta', media: 'normal', baixa: 'baixa' }
export function dadosDoDfd(documento) {
  const c = documento?.conteudo || {}
  const itens = itensValidos(c.itens)
  const total = totalItens(itens)
  return {
    objeto: c.objeto || documento?.titulo || '',
    quantidade: itens.length ? itens.map((l) => `${Number(l.quantidade).toLocaleString('pt-BR')} ${l.unidade} — ${l.nome}`).join('\n') : (c.quantidade || ''),
    justificativa: [c.necessidade, c.consequencia ? `Se não for contratada: ${c.consequencia}` : '', c.resultados ? `Resultados pretendidos: ${c.resultados}` : '']
      .filter(Boolean).join('\n\n'),
    objeto_tipo: c.objeto_tipo || '',
    valor_estimado: total > 0 ? total : '',
    data_pretendida: c.data_pretendida || '',
    prioridade: PRIORIDADE_DO_DFD[c.prioridade] || 'normal',
    previsto_pca: c.previsto_pca || '',
  }
}

// Pedidos da secretaria devolvidos pelo Compras (uma DFD nova pode responder a eles)
export const devolvidasDaUnidade = (solicitacoes, { usuarioId, unidadeId }) =>
  solicitacoes.filter((s) => s.status === 'devolvida' && podeEditarSol(s, { usuarioId, unidadeId, master: false }))

// A DFD já está num pedido em andamento ou aceito?
export const dfdJaEnviada = (solicitacoes, documentoId) =>
  solicitacoes.some((s) => s.documento_id === documentoId && ['enviada', 'devolvida', 'aceita'].includes(s.status))

// DFDs que a pessoa pode enviar: assinados, fora de processo e ainda não enviados (ou na própria solicitação)
export function dfdsDisponiveis(documentos, solicitacoes, { atual = null } = {}) {
  const usados = new Set(solicitacoes
    .filter((s) => s.documento_id && s.id !== atual && ['enviada', 'devolvida', 'aceita'].includes(s.status))
    .map((s) => s.documento_id))
  return documentos.filter((d) => d.modelo === 'dfd' && d.status === 'assinado' && !d.processo_id && !usados.has(d.id))
}

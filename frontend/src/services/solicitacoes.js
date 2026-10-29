import { supabase } from './supabase'
import { EVENTO_MUDANCA } from './tramitacao'

// Tabelas das solicitações ao Compras e do roteiro do processo: as telas se atualizam quando mudam
export const TABELAS_SOLICITACOES = ['cp_solicitacoes', 'cp_eventos', 'cp_checklist']

// Avisa as telas desta aba (lista, mesa, menu e o processo) que algo mudou
export const EVENTO_SOLICITACAO = 'solicitacoes:mudou'
const avisarMudanca = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EVENTO_SOLICITACAO))
  window.dispatchEvent(new Event(EVENTO_MUDANCA))
}

const falha = (error) => { if (error) throw error }
const texto = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim())
const numero = (v) => {
  if (v === undefined || v === null || v === '') return null
  const s = String(v).trim()
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) // aceita 15.000,50 e 15000.5
  return Number.isFinite(n) ? n : null
}

// O banco só devolve as solicitações que a pessoa pode ver (RLS)
export async function listarSolicitacoes() {
  const { data, error } = await supabase.from('cp_solicitacoes').select('*').order('enviada_em', { ascending: false }).limit(2000)
  falha(error)
  return data || []
}

export async function obterSolicitacao(id) {
  const [s, ev] = await Promise.all([
    supabase.from('cp_solicitacoes').select('*').eq('id', id).maybeSingle(),
    supabase.from('cp_eventos').select('*').eq('solicitacao_id', id).order('criada_em', { ascending: true }).order('id', { ascending: true }),
  ])
  falha(s.error)
  falha(ev.error)
  return { solicitacao: s.data, eventos: ev.data || [] }
}

// Solicitação que deu origem ao processo (se houver)
export async function solicitacaoDoProcesso(processoId) {
  const { data, error } = await supabase.from('cp_solicitacoes').select('*').eq('processo_id', processoId).maybeSingle()
  falha(error)
  return data
}

// Marcações do roteiro (documentos juntados fora da plataforma); sem processo, todas as visíveis
export async function listarMarcas(processoId) {
  let q = supabase.from('cp_checklist').select('*')
  if (processoId) q = q.eq('processo_id', processoId)
  const { data, error } = await q
  falha(error)
  return data || []
}

async function chamar(funcao, args) {
  const { data, error } = await supabase.rpc(funcao, args)
  falha(error)
  avisarMudanca()
  return data
}

const dadosDaSolicitacao = (d) => ({
  p_tipo: d.tipo, p_documento: d.tipo === 'dfd' ? texto(d.documento_id) : null, p_objeto: texto(d.objeto), p_quantidade: texto(d.quantidade),
  p_justificativa: texto(d.justificativa), p_objeto_tipo: texto(d.objeto_tipo), p_valor_estimado: numero(d.valor_estimado),
  p_data_pretendida: texto(d.data_pretendida), p_prioridade: d.prioridade || 'normal', p_previsto_pca: texto(d.previsto_pca),
})

// Devolve o id da solicitação criada
export const enviarSolicitacao = (d) => chamar('cp_enviar_solicitacao', dadosDaSolicitacao(d))
export const reenviarSolicitacao = (id, d, resposta) => chamar('cp_reenviar_solicitacao', { p_id: id, ...dadosDaSolicitacao(d), p_resposta: texto(resposta) })
export const cancelarSolicitacao = (id, motivo) => chamar('cp_cancelar_solicitacao', { p_id: id, p_motivo: motivo })
export const devolverSolicitacao = (id, motivo) => chamar('cp_devolver_solicitacao', { p_id: id, p_motivo: motivo })
export const recusarSolicitacao = (id, motivo) => chamar('cp_recusar_solicitacao', { p_id: id, p_motivo: motivo })

// Devolve o id do processo de contratação aberto
export const aceitarSolicitacao = (id, d) => chamar('cp_aceitar_solicitacao', {
  p_id: id, p_modalidade: d.modalidade, p_objeto_tipo: texto(d.objeto_tipo), p_prioridade: texto(d.prioridade), p_despacho: texto(d.despacho),
})
export const registrarProcessoContratacao = (d) => chamar('cp_registrar_processo', {
  p_objeto: texto(d.objeto), p_unidade_demandante: texto(d.unidade_demandante), p_justificativa: texto(d.justificativa),
  p_modalidade: d.modalidade, p_objeto_tipo: texto(d.objeto_tipo), p_prioridade: d.prioridade || 'normal',
  p_valor_estimado: numero(d.valor_estimado), p_prazo: texto(d.prazo), p_despacho: texto(d.despacho),
})

export const marcarItem = (processoId, item, situacao, referencia) =>
  chamar('cp_marcar_item', { p_processo: processoId, p_item: item, p_situacao: situacao, p_referencia: referencia })
export const desmarcarItem = (processoId, item) => chamar('cp_desmarcar_item', { p_processo: processoId, p_item: item })

// Envia a DFD: pedido novo ou resposta a um pedido devolvido; devolve o id do pedido
export async function enviarDfdAoCompras(dados, devolvidaId, resposta) {
  if (devolvidaId) {
    await reenviarSolicitacao(devolvidaId, dados, resposta)
    return devolvidaId
  }
  return enviarSolicitacao(dados)
}

export function mensagemErroSolicitacao(err) {
  const msg = String(err?.message || '')
  if (err?.code === '42501' && !/Somente|Só |perfil/i.test(msg)) return 'Seu perfil não tem permissão para esta ação.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  return msg || 'Não foi possível concluir a operação.'
}

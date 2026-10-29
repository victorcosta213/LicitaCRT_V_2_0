import { supabase } from './supabase'

// Tabelas que mudam com a tramitação: as telas se atualizam sozinhas quando alguma delas muda
export const TABELAS_TRAMITACAO = ['tr_processos', 'tr_tramitacoes', 'tr_unidades']

const falha = (error) => { if (error) throw error }

// Avisa as telas desta aba que um processo mudou, para atualizarem na hora (sem esperar o Realtime)
export const EVENTO_MUDANCA = 'tramitacao:mudou'
const avisarMudanca = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_MUDANCA))
}

export async function listarUnidades() {
  const { data, error } = await supabase.from('tr_unidades').select('*').order('sigla', { ascending: true })
  falha(error)
  return data
}

// O banco só devolve os processos que a pessoa pode ver (RLS)
export async function listarProcessosAdm() {
  const { data, error } = await supabase.from('tr_processos').select('*')
    .order('aberto_em', { ascending: false }).limit(2000)
  falha(error)
  return data
}

export async function obterProcessoAdm(id) {
  const [proc, hist] = await Promise.all([
    supabase.from('tr_processos').select('*').eq('id', id).maybeSingle(),
    supabase.from('tr_tramitacoes').select('*').eq('processo_id', id).order('criada_em', { ascending: true }).order('id', { ascending: true }),
  ])
  falha(proc.error)
  falha(hist.error)
  return { processo: proc.data, tramitacoes: hist.data || [] }
}

export async function listarPessoasDaUnidade(unidadeId) {
  const { data, error } = await supabase.rpc('tr_pessoas_da_unidade', { p_unidade: unidadeId })
  falha(error)
  return data || []
}

async function chamar(funcao, args) {
  const { data, error } = await supabase.rpc(funcao, args)
  falha(error)
  avisarMudanca()
  return data
}

const texto = (v) => (v === undefined || v === null || v === '' ? null : v)

// Devolve o id do processo criado
export const abrirProcessoAdm = (d) => chamar('tr_abrir_processo', {
  p_tipo: d.tipo, p_assunto: d.assunto, p_interessado: texto(d.interessado), p_descricao: texto(d.descricao),
  p_prioridade: d.prioridade || 'normal', p_prazo: texto(d.prazo), p_unidade_destino: texto(d.unidade_destino), p_despacho: texto(d.despacho),
})

export const tramitarProcessoAdm = (id, d) => chamar('tr_tramitar', {
  p_id: id, p_unidade_destino: d.unidade_destino, p_usuario_destino: texto(d.usuario_destino), p_despacho: d.despacho, p_prazo: texto(d.prazo),
})

export const receberProcessoAdm = (id) => chamar('tr_receber', { p_id: id })

export const atualizarDadosProcessoAdm = (id, d) => chamar('tr_atualizar_dados', {
  p_id: id, p_assunto: d.assunto, p_interessado: texto(d.interessado), p_descricao: texto(d.descricao),
  p_prioridade: d.prioridade, p_prazo: texto(d.prazo),
})

export const concluirProcessoAdm = (id, motivo) => chamar('tr_concluir', { p_id: id, p_motivo: motivo })
export const reabrirProcessoAdm = (id, motivo) => chamar('tr_reabrir', { p_id: id, p_motivo: motivo })

// Unidades (somente o administrador grava; a RLS também impede os demais)
export async function criarUnidade({ sigla, nome }) {
  const { error } = await supabase.from('tr_unidades').insert([{ sigla: sigla.trim().toUpperCase(), nome: nome.trim() }])
  falha(error)
  avisarMudanca()
}

export async function atualizarUnidade(id, campos) {
  const { error } = await supabase.from('tr_unidades').update(campos).eq('id', id)
  falha(error)
  avisarMudanca()
}

export function mensagemErroTramitacao(err) {
  const msg = String(err?.message || '')
  if (err?.code === '23505' && /sigla/i.test(`${msg} ${err?.details || ''}`)) return 'Já existe uma unidade com esta sigla.'
  if (err?.code === '42501' && !/Somente|perfil/i.test(msg)) return 'Seu perfil não tem permissão para esta ação.'
  return msg || 'Não foi possível concluir a operação.'
}

// Histórico de vários processos de uma vez (acompanhamento dos pedidos); só os que a pessoa pode ver
export async function listarTramitacoesDe(ids) {
  if (!ids?.length) return []
  const { data, error } = await supabase.from('tr_tramitacoes').select('*').in('processo_id', ids)
    .order('criada_em', { ascending: true }).order('id', { ascending: true })
  falha(error)
  return data || []
}

// Últimas movimentações de todos os processos que a pessoa pode ver (a autoridade vê todas)
export async function listarMovimentacoesRecentes(limite = 15) {
  const { data, error } = await supabase.from('tr_tramitacoes').select('*')
    .order('criada_em', { ascending: false }).order('id', { ascending: false }).limit(limite)
  falha(error)
  return data || []
}

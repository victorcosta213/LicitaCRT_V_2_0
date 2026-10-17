import { supabase } from './supabase'

export const TABELAS = {
  contratos: 'gc_contratos',
  responsaveis: 'gc_responsaveis',
  ordens: 'gc_ordens_servico',
  competencias: 'gc_competencias',
  empenhos: 'gc_empenhos',
  movs: 'gc_empenho_movs',
  execucoes: 'gc_execucoes',
  eventos: 'gc_eventos',
  ocorrencias: 'gc_ocorrencias',
  documentos: 'gc_documentos',
  pendencias: 'gc_pendencias',
}

const PAGE = 1000

async function buscarTudo(tabela) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

export function tabelaAusente(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`
  return err?.code === '42P01' || err?.code === 'PGRST205' || /does not exist|schema cache/i.test(msg)
}

export async function carregarTudo() {
  const chaves = Object.keys(TABELAS)
  const resultados = await Promise.all(chaves.map((k) => buscarTudo(TABELAS[k])))
  const raw = {}
  chaves.forEach((k, i) => { raw[k] = resultados[i] })

  const { data: pars, error } = await supabase.from('gc_parametros').select('chave, valor')
  if (error) throw error
  const params = {}
  for (const p of pars || []) params[p.chave] = p.valor
  return { raw, params }
}

export async function carregarAuditoria(contratoId, limite = 300) {
  const { data, error } = await supabase
    .from('gc_auditoria')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('em', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data
}

export function mensagemErro(err) {
  if (!err) return 'Erro desconhecido.'
  if (err.code === '42501' || /row-level security/i.test(err.message || '')) {
    return 'Seu perfil não tem permissão para esta ação.'
  }
  if (err.code === '23505') return 'Já existe um registro com estes dados (número/competência duplicado).'
  if (err.code === '23503') return 'Registro relacionado não encontrado.'
  if (err.code === '23514') return 'Algum valor informado é inválido.'
  return err.message || 'Erro ao salvar.'
}

// insere (sem id) ou atualiza (com id). Nunca exclui: use `cancelar`.
export async function salvar(chave, valores, id) {
  const tabela = TABELAS[chave]
  const q = id
    ? supabase.from(tabela).update(valores).eq('id', id)
    : supabase.from(tabela).insert([valores])
  const { data, error } = await q.select().single()
  if (error) throw new Error(mensagemErro(error))
  return data
}

export async function salvarVarios(chave, lista) {
  if (!lista.length) return []
  const { data, error } = await supabase.from(TABELAS[chave]).insert(lista).select()
  if (error) throw new Error(mensagemErro(error))
  return data
}

// Nunca exclui: marca como cancelado, sempre com justificativa (exigida também pelo banco)
export const cancelar = (chave, id, motivo, extra = {}) =>
  salvar(chave, { ...extra, cancelado: true, cancelamento_motivo: motivo }, id)

// Ações do fluxo executadas no banco (validam o perfil e as regras lá)
export async function executar(funcao, args) {
  const { error } = await supabase.rpc(funcao, args)
  if (error) throw new Error(mensagemErro(error))
}

export async function salvarParametro(chave, valor) {
  const { error } = await supabase
    .from('gc_parametros')
    .upsert({ chave, valor, updated_at: new Date().toISOString() })
  if (error) throw new Error(mensagemErro(error))
}

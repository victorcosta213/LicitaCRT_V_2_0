import { supabase } from './supabase'

// Catálogo de itens: o administrador cadastra; a DFD escolhe daqui e informa só a quantidade
export const TABELAS_ITENS = ['cp_itens']
export const EVENTO_ITENS = 'itens:mudou'
const avisar = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_ITENS)) }
const falha = (error) => { if (error) throw error }
const texto = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim())

export async function listarItens() {
  const { data, error } = await supabase.from('cp_itens').select('*').order('nome', { ascending: true })
  falha(error)
  return data || []
}

const campos = (d) => ({
  codigo: texto(d.codigo), nome: texto(d.nome), especificacao: texto(d.especificacao), unidade_medida: texto(d.unidade_medida) || 'unidade',
  categoria: texto(d.categoria), objeto_tipo: texto(d.objeto_tipo),
  valor_referencia: d.valor_referencia === '' || d.valor_referencia == null ? null : Number(d.valor_referencia),
})

export async function criarItem(d) {
  const { error } = await supabase.from('cp_itens').insert([campos(d)])
  falha(error)
  avisar()
}

export async function atualizarItem(id, d) {
  const { error } = await supabase.from('cp_itens').update({ ...campos(d), updated_at: new Date().toISOString() }).eq('id', id)
  falha(error)
  avisar()
}

export async function ativarItem(id, ativo) {
  const { error } = await supabase.from('cp_itens').update({ ativo, updated_at: new Date().toISOString() }).eq('id', id)
  falha(error)
  avisar()
}

export function mensagemErroItem(err) {
  const msg = String(err?.message || '')
  if (err?.code === '23505') return 'Já existe um item com este código.'
  if (err?.code === '42501' || /row-level security/i.test(msg)) return 'Somente a administração cadastra itens no catálogo.'
  return msg || 'Não foi possível salvar o item.'
}

// Cópia do item para a linha da DFD (o documento guarda o item como estava no momento da escolha)
export const linhaDoItem = (item, quantidade = '') => ({
  item_id: item.id, codigo: item.codigo || '', nome: item.nome, especificacao: item.especificacao, unidade: item.unidade_medida,
  valor_unitario: item.valor_referencia ?? '', quantidade,
})

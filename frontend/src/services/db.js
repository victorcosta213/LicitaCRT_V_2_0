import { supabase } from './supabase'

const PAGINA = 1000

// Lê a tabela inteira em páginas (o Supabase devolve no máximo 1000 linhas por consulta)
export async function listAll(col, orderField = 'created_at', ascending = false) {
  const rows = []
  for (let from = 0; ; from += PAGINA) {
    const { data, error } = await supabase
      .from(col)
      .select('*')
      .order(orderField, { ascending })
      .range(from, from + PAGINA - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGINA) break
  }
  return rows
}

export async function createDoc(col, data = {}) {
  const { data: inserted, error } = await supabase
    .from(col)
    .insert([data])
    .select()
    .single()

  if (error) throw error
  return inserted
}

// Insere vários registros em uma única chamada (em lotes)
export async function createMany(col, rows = [], batchSize = 200) {
  const out = []
  for (let i = 0; i < rows.length; i += batchSize) {
    const { data, error } = await supabase.from(col).insert(rows.slice(i, i + batchSize)).select()
    if (error) throw error
    out.push(...data)
  }
  return out
}

export async function updateById(col, id, data = {}) {
  const cleanData = JSON.parse(JSON.stringify(data))
  const { error } = await supabase
    .from(col)
    .update(cleanData)
    .eq('id', id)

  if (error) throw error
  return true
}

export async function removeById(col, id) {
  const { error } = await supabase
    .from(col)
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

export async function findBy(col, field, value) {
  const { data, error } = await supabase.from(col).select('*').eq(field, value)
  if (error) throw error
  return data
}

import { createClient } from '@supabase/supabase-js'

// Endereço e chave pública do projeto Supabase (variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Sem as variáveis o sistema não pode funcionar; a tela inicial avisa em vez de ficar em branco
// (o cliente do Supabase lança erro no carregamento se receber um endereço vazio).
export const configuracaoCompleta = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(supabaseUrl || 'http://configuracao.invalid', supabaseAnonKey || 'sem-chave')

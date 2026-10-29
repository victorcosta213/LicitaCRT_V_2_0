import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Perfil (public.usuarios) do usuário logado. O banco libera acesso pelo id do
// login (gc_role), então a interface usa a mesma regra. Devolve null se não houver
// perfil e lança erro se a consulta falhar (rede, etc.).
export async function getUserProfile(uid) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('id', uid).maybeSingle()
  if (error) throw error
  return data
}

// Mensagens do Supabase Auth / banco em português
export function mensagemErroUsuario(err) {
  const msg = String(err?.message || '')
  if (/already (been )?registered|já está cadastrado/i.test(msg)) return 'Este e-mail já está cadastrado.'
  if (err?.code === 'same_password' || /different from the old password/i.test(msg)) return 'A nova senha precisa ser diferente da atual.'
  if (err?.code === 'weak_password' || /password should be|at least/i.test(msg)) return 'Senha fraca: use pelo menos 8 caracteres, misturando letras e números.'
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'E-mail inválido.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  if (err?.code === '42501' || /row-level security/i.test(msg)) return 'Seu perfil não tem permissão para esta ação.'
  if (err?.code === '23505') return 'Já existe um perfil para este usuário.'
  return msg || 'Ocorreu um erro.'
}

export async function listarUsuarios() {
  const { data, error } = await supabase.from('usuarios').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

function getSecondaryClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  // Cliente separado que NÃO guarda sessão, para o admin não ser deslogado
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

// Devolve { uid, precisaConfirmar, trocaObrigatoria }:
//  precisaConfirmar = a pessoa ainda tem de clicar no e-mail para entrar;
//  trocaObrigatoria = o sistema vai exigir que ela crie a própria senha no primeiro acesso
//  (false só se a migration 20261020 ainda não foi aplicada: o usuário é criado do mesmo jeito)
export async function criarUsuario({ nome, email, password, role, unidade_id }) {
  const secondary = getSecondaryClient()

  // 1. Cria o login. Com a confirmação de e-mail ligada no Supabase, ele envia o link; desligada,
  //    o login já nasce confirmado (e o Auth devolve uma sessão, que este cliente descarta).
  const { data: authData, error: authErr } = await secondary.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  })
  if (authErr) throw authErr

  const uid = authData.user?.id
  if (!uid) throw new Error('Usuário não retornado pelo Auth')
  // E-mail já cadastrado: o Supabase responde com um usuário sem identidades
  if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
    throw new Error('Este e-mail já está cadastrado.')
  }

  // 2. Cria o perfil com o mesmo id do login
  const { error: dbErr } = await supabase.from('usuarios').insert([{
    id: uid,
    nome,
    email,
    role,
    ativo: true,
    // só envia a unidade quando escolhida (antes da migration da tramitação a coluna não existe)
    ...(unidade_id ? { unidade_id } : {}),
  }])

  if (dbErr) throw dbErr

  // 3. A senha digitada pelo administrador é provisória: a pessoa cria a dela no primeiro acesso
  const { error: provErr } = await supabase.rpc('gc_marcar_senha_provisoria', { p_uid: uid })
  if (provErr) console.error('[users] não foi possível exigir a troca de senha:', provErr)
  return { uid, precisaConfirmar: !authData.session, trocaObrigatoria: !provErr }
}

// O administrador devolve a senha de uma pessoa à senha padrão (segredo SENHA_PADRAO da Edge
// Function resetar-senha); no próximo acesso a pessoa é obrigada a criar uma nova.
export async function resetarSenha(uid) {
  const { error } = await supabase.functions.invoke('resetar-senha', { body: { uid } })
  if (error) throw new Error(await mensagemDaFuncao(error))
}

async function mensagemDaFuncao(error) {
  const resposta = error?.context
  if (resposta?.status === 404) return 'A função de redefinição ainda não foi publicada no Supabase (veja backend/README.md).'
  try {
    const corpo = await resposta?.json?.()
    if (corpo?.erro) return corpo.erro
  } catch { /* resposta sem corpo legível */ }
  return 'Não foi possível redefinir a senha. Verifique a conexão e tente de novo.'
}

// Primeiro acesso: grava a senha escolhida e confirma ao banco que a provisória foi substituída
export async function trocarSenhaPrimeiroAcesso(novaSenha) {
  const { error } = await supabase.auth.updateUser({ password: novaSenha })
  if (error) throw error
  const { error: confirmaErr } = await supabase.rpc('gc_senha_trocada')
  if (confirmaErr) throw confirmaErr
}

export async function atualizarUsuario(uid, { nome, role, unidade_id }) {
  const payload = {}
  if (nome !== undefined) payload.nome = nome
  if (role !== undefined) payload.role = role
  if (unidade_id !== undefined) payload.unidade_id = unidade_id || null
  payload.updated_at = new Date().toISOString()

  const { error } = await supabase.from('usuarios').update(payload).eq('id', uid)
  if (error) throw error
}

export async function toggleAtivo(uid, ativo) {
  const { error } = await supabase.from('usuarios').update({
    ativo,
    updated_at: new Date().toISOString(),
  }).eq('id', uid)
  if (error) throw error
}

// Apaga o perfil: a pessoa perde o acesso na hora (o banco trata login sem
// perfil como "sem acesso"). O login em si continua no Supabase Auth.
export async function deletarUsuario(uid) {
  const { error } = await supabase.from('usuarios').delete().eq('id', uid)
  if (error) throw error
}

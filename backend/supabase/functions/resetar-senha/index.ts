// Edge Function: o administrador redefine a senha de um usuário para a senha padrão.
// A pessoa entra com a senha padrão e o sistema a obriga a criar uma nova (migration 20261020).
//
// Só o servidor pode trocar a senha de outra pessoa (chave service_role), e é por isso que a
// senha padrão fica aqui, num segredo, e nunca no site (variáveis VITE_ vão para o navegador).
//
// Segredo (Supabase > Edge Functions > Secrets, ou `supabase secrets set SENHA_PADRAO=...`):
//   SENHA_PADRAO   a senha padrão (mínimo 8 caracteres)
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { resetarSenha } from './logica.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // quem chamou: o cliente age com o token da própria pessoa, então a regra de papel do banco vale
  const quem = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const corpo = await req.json().catch(() => ({}))
  const r = await resetarSenha({ metodo: req.method, uid: corpo?.uid }, {
    chamador: async () => (await quem.auth.getUser()).data.user,
    papel: async () => (await quem.rpc('gc_role')).data,
    senhaPadrao: Deno.env.get('SENHA_PADRAO'),
    atualizarSenha: async (uid: string, senha: string) => {
      const { error } = await servico.auth.admin.updateUserById(uid, { password: senha })
      return error ? { erro: true } : {}
    },
    marcarProvisoria: async (uid: string) => {
      const { error } = await quem.rpc('gc_marcar_senha_provisoria', { p_uid: uid })
      return error ? { erro: true } : {}
    },
  })
  return json(r.status, r.corpo)
})

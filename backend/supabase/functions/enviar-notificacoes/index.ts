// Edge Function: envia os e-mails pendentes da fila gc_notificacoes (§19 do fluxo).
// A fila é preenchida pelos triggers da migration 20261018 ("Existe uma nova tarefa
// aguardando sua atuação"). Agende a execução a cada 10 minutos (ver backend/README.md).
//
// Variáveis (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY   chave da API do Resend (https://resend.com)
//   EMAIL_REMETENTE  ex.: "LicitaCRT <nao-responda@seudominio.gov.br>" (domínio verificado no Resend)
//   APP_URL          endereço da plataforma, ex.: https://licitacrt.vercel.app
//   CRON_SECRET      segredo enviado pelo agendamento no cabeçalho x-cron-secret
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das Edge Functions.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { MAX_TENTATIVAS, montarEmail } from './mensagem.js'

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('Não autorizado', { status: 401 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: pendentes, error } = await supabase
    .from('gc_notificacoes')
    .select('*')
    .is('enviada_em', null)
    .lt('tentativas', MAX_TENTATIVAS)
    .order('criada_em', { ascending: true })
    .limit(50)
  if (error) return new Response(error.message, { status: 500 })

  const opcoes = { remetente: Deno.env.get('EMAIL_REMETENTE'), appUrl: Deno.env.get('APP_URL') }
  let enviadas = 0
  for (const n of pendentes ?? []) {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(montarEmail(n, opcoes)),
    })
    if (resposta.ok) {
      enviadas += 1
      await supabase.from('gc_notificacoes').update({ enviada_em: new Date().toISOString(), erro: null }).eq('id', n.id)
    } else {
      await supabase.from('gc_notificacoes')
        .update({ tentativas: n.tentativas + 1, erro: (await resposta.text()).slice(0, 500) })
        .eq('id', n.id)
    }
  }

  return Response.json({ pendentes: pendentes?.length ?? 0, enviadas })
})

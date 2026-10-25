# LicitaCRT — Backend (Supabase)

O backend da plataforma é o projeto Supabase: Postgres, Auth e Storage. Não há servidor
próprio. As regras que não podem depender do navegador (quem vê e quem grava o quê,
auditoria, bloqueio de exclusão) estão no banco, nestes scripts.

```
supabase/
  migrations/
    20261015_gestao_contratual.sql    tabelas gc_*, RLS por perfil, triggers, auditoria,
                                      importação dos contratos legados
    20261016_processos_importacao.sql colunas da planilha de processos licitatórios
    20261017_correcoes_producao.sql   acesso só com perfil ativo, RLS de usuarios/processos,
                                      bucket privado de anexos, regras de atesto,
                                      correção dos valores legados
    20261018_fluxo_funcional.sql      fluxo Compras → Gestão → Fiscal → Gestão → Financeiro:
                                      encaminhamento, portaria, termo de ciência, OS/OC com
                                      assinaturas, NF/glosa/atesto do fiscal, substituto em
                                      atuação, perfil Gabinete, justificativa ao cancelar,
                                      fila de e-mails (gc_notificacoes)
    20261019_atualizacao_automatica.sql  liga o Supabase Realtime nas tabelas do sistema: o que um
                                      setor envia ao outro aparece na tela do outro sem F5
  functions/enviar-notificacoes/      Edge Function que envia os e-mails da fila
  verificacao.sql                     checagem pós-migração (somente leitura)
tests/
  migrations.test.js                  roda as migrations num Postgres em memória
  notificacoes.test.js                montagem dos e-mails
```

## Aplicar no Supabase

1. Faça um backup (Table Editor → exportar CSV de `usuarios`, `processos`, `contratos` e `gc_contratos`).
2. No SQL Editor, execute as migrations **na ordem do nome do arquivo**. Todas são
   idempotentes: rodar de novo não duplica nem apaga dados.
3. Execute `verificacao.sql` e confira a coluna `status`: todos os itens devem estar ✅.
   O último item mostra quantos logins, perfis, processos e contratos existem.

Alternativa ao SQL Editor: com `DATABASE_URL` em `backend/.env` (ignorado pelo Git; use a
connection string do *Session pooler*, porta 5432), o script `scripts/banco.mjs` faz
`diagnostico` (só leitura), `backup <pasta>`, `aplicar <arquivos.sql>` (cada um numa
transação) e `verificar`. Apague o `.env` ao terminar.

**Atualização automática.** A migration `20261019` adiciona as tabelas à publicação `supabase_realtime`
(o item 15 do `verificacao.sql` confere). Sem ela o sistema continua funcionando: as telas se
atualizam sozinhas a cada minuto e ao voltar para a aba, só que sem a resposta imediata.

Nova alteração de banco = novo arquivo em `migrations/` com a data no nome
(`AAAAMMDD_descricao.sql`). Não edite migrations já aplicadas em produção.

## E-mails de tarefa (opcional)

Os triggers já gravam em `gc_notificacoes` cada tarefa nova ("Nova contratação recebida de
Compras", "Competência atestada…", "Nova competência liberada…" etc.). Para que saiam por
e-mail:

1. Crie uma conta no [Resend](https://resend.com), verifique o domínio do remetente e gere uma chave de API.
2. Instale a [Supabase CLI](https://supabase.com/docs/guides/cli), faça `supabase login` e
   `supabase link --project-ref <ref do projeto>` dentro desta pasta.
3. Cadastre os segredos e publique a função:
   ```
   supabase secrets set RESEND_API_KEY=... EMAIL_REMETENTE="LicitaCRT <nao-responda@seudominio>" \
     APP_URL=https://<endereço da plataforma> CRON_SECRET=<um texto aleatório longo>
   supabase functions deploy enviar-notificacoes
   ```
4. No SQL Editor, ative as extensões `pg_cron` e `pg_net` (Database → Extensions) e agende a cada 10 minutos:
   ```sql
   select cron.schedule('enviar-notificacoes', '*/10 * * * *', $$
     select net.http_post(
       url := 'https://<ref do projeto>.supabase.co/functions/v1/enviar-notificacoes',
       headers := jsonb_build_object('Content-Type', 'application/json',
         'Authorization', 'Bearer <chave anon do projeto>', 'x-cron-secret', '<CRON_SECRET>'),
       body := '{}'::jsonb)
   $$);
   ```

Sem esses passos a plataforma funciona normalmente: as tarefas aparecem nos alertas e painéis,
apenas não são enviadas por e-mail. O item 14 do `verificacao.sql` mostra falhas de envio.

## Testes

```
npm install
npm test
```

Os testes sobem um Postgres em memória ([PGlite](https://pglite.dev)), simulam o que o
Supabase oferece (papel `authenticated`, `auth.uid()`, `auth.users` e Storage), aplicam as
migrations reais e verificam, perfil a perfil: o que cada um lê e grava (RLS), os bloqueios
dos triggers, a auditoria, as políticas dos anexos, a correção dos contratos legados e o
próprio `verificacao.sql`. Não acessam o Supabase real.

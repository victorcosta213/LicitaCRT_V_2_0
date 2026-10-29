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
    20261020_senha_provisoria.sql     troca de senha no primeiro acesso e depois de redefinida pelo
                                      administrador (tabela fechada + 3 funções)
    20261021_tramitacao.sql           processos administrativos: unidades, protocolo, histórico de
                                      tramitação, quem vê/age em cada processo, funções tr_*
    20261022_perfil_presidente.sql    perfil Presidente / Prefeito (usuário mestre): vale como administrador
                                      nas regras de acesso (gc_role)
  functions/enviar-notificacoes/      Edge Function que envia os e-mails da fila
  functions/resetar-senha/            Edge Function: o administrador devolve a senha de alguém à senha padrão
  verificacao.sql                     checagem pós-migração (somente leitura)
tests/
  migrations.test.js                  roda as migrations num Postgres em memória
  notificacoes.test.js                montagem dos e-mails
  resetarSenha.test.js                regras da redefinição de senha
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

**Senha provisória.** A migration `20261020` faz quem recebe um acesso novo (ou teve a senha
redefinida) criar a própria senha no primeiro acesso (item 16 do `verificacao.sql`). Os logins
que já existiam não são afetados. Sem a migration, o sistema funciona: só não exige a troca.

**Tramitação de processos.** A migration `20261021` cria as unidades (setores), os processos com
protocolo `AAAA/NNNNNN` e o histórico de movimentações (item 17 do `verificacao.sql`). Toda gravação passa
pelas funções `tr_*`, então o histórico nunca diverge do estado atual; a RLS (`tr_pode_ver`) decide quem lê.
Depois de aplicar: em **Administração → Unidades** confira os setores e, em **Usuários e perfis**, ligue cada
pessoa à sua unidade (sem unidade, a pessoa não abre nem recebe processos). Sem a migration o sistema funciona:
as telas de Processos apenas avisam que a tramitação ainda não foi ativada.

**Perfil Presidente / Prefeito.** A migration `20261022` aceita o perfil `presidente` em `usuarios.role` e faz
`gc_role()` tratá-lo como `admin`: como toda regra de acesso (RLS e funções) passa por `gc_role()`, ele vê e faz
tudo, inclusive administrar usuários, unidades e redefinir senhas. O perfil gravado continua "presidente", então a tela
mostra o cargo e o histórico registra o nome de quem agiu (item 18 do `verificacao.sql`). Para limitar o que o
presidente pode fazer, altere só essa função.

**Perfis setoriais.** A migration `20261023` aceita os perfis `juridico`, `administrativo`, `rh` e `ti`:
Jurídico consulta contratações; Administrativo, RH e TI não veem contratações nem valores (item 19 do `verificacao.sql`).

**Documentos e assinatura eletrônica.** A migration `20261024` cria `documentos` e `assinaturas` e as funções `doc_*`
(item 20 do `verificacao.sql`). O texto é guardado em blocos (jsonb) e o hash é `sha256(numero, titulo, corpo)`; ao enviar
para assinatura o texto fica congelado. Assinar exige reconfirmar a senha: o app autentica de novo (cliente secundário,
sem gravar sessão) e `doc_assinar` só aceita se o JWT tiver autenticação por senha (`amr`) de até 180 s, registrando
também IP e navegador. `doc_verificar(codigo)` é pública e devolve só número, situação, assinaturas e integridade, nunca o
conteúdo. É assinatura eletrônica **avançada** (Lei 14.063/2020); para assinatura **qualificada** (ICP-Brasil/gov.br)
será preciso integrar um provedor. Sem a migration, as telas de Documentos apenas avisam que o recurso não foi ativado.

**Solicitações ao Compras e processos de contratação.** A migration `20261025` cria `cp_solicitacoes`, `cp_eventos`
e `cp_checklist` e as funções `cp_*` (item 21 do `verificacao.sql`). Os setores enviam a solicitação, de preferência com o
DFD assinado (`cp_enviar_solicitacao`); o Compras devolve, recusa ou aceita. `cp_aceitar_solicitacao` abre o processo na
tramitação (tipo "Contratação", já na unidade do Compras, com a forma de contratação definida), junta o DFD ao processo,
deixa a unidade solicitante acompanhá-lo e registra o processo no quadro (`processos.tr_processo_id`). `cp_registrar_processo`
abre o processo sem solicitação. `cp_marcar_item` registra no roteiro da Lei 14.133/2021 o que foi juntado fora da
plataforma ou não se aplica. A migration também amplia `doc_pode_ver`: o Compras lê o DFD anexado a uma solicitação.
Sem a migration, as telas de Solicitações apenas avisam que o recurso não foi ativado.

**Fluxo das secretarias.** A migration `20261026` organiza o fluxo Prefeito → Secretários → Compras ↔ Jurídico,
Financeiro e Gestão de contratos (item 22 do `verificacao.sql`):
- perfil `secretario`: o único que cria a DFD (`doc_criar` recusa o modelo `dfd` para os demais) e envia o pedido ao
  Compras, sempre com a DFD assinada. Não lê contratações nem o quadro licitatório. Ligue cada secretário à unidade da
  sua secretaria (cadastre as secretarias em Administração → Unidades);
- `cp_itens`: catálogo de itens com a especificação, cadastrado só pela administração (itens são desativados, não
  apagados). A DFD guarda uma cópia do item escolhido;
- `doc_criar_arquivo`: um arquivo (até 20 MB, bucket privado `documentos`, na pasta da própria pessoa) vira documento
  `ANX`, com o SHA-256 do arquivo no conteúdo assinado. O bloco do arquivo é montado e preservado pelo banco;
- `doc_encaminhar`: encaminha um documento assinado a uma unidade (abre um processo "Comunicação oficial" ou move o
  processo em que ele já está);
- `cp_registrar_processo` passa a ser só da administração (lançar processos antigos, que começaram em papel).
Os perfis Gabinete, Visualizador, RH, TI e Administrativo continuam aceitos pelo banco, mas ficam ocultos no cadastro.

Nova alteração de banco = novo arquivo em `migrations/` com a data no nome
(`AAAAMMDD_descricao.sql`). Não edite migrations já aplicadas em produção.

## Redefinição de senha pelo administrador
O botão **Redefinir senha** (Administração → Usuários e perfis) devolve a senha de uma pessoa à
**senha padrão**; ao entrar, ela é obrigada a criar uma nova. Só o servidor pode trocar a senha
de outra pessoa, então isso roda numa Edge Function, e a senha padrão fica num **segredo** dela.
Não use variável `VITE_…` para isso: ela iria dentro do site e ficaria visível a qualquer visitante.

1. Aplique a migration `20261020_senha_provisoria.sql`.
2. Com a [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase login` e `supabase link --project-ref <ref do projeto>`):
   ```
   supabase secrets set SENHA_PADRAO=<a senha padrão, mínimo de 8 caracteres>
   supabase functions deploy resetar-senha
   ```
3. Para trocar a senha padrão no futuro, rode só o primeiro comando de novo. Quem já foi redefinido
   continua com a senha antiga até ser redefinido outra vez.

Sem a função publicada, o botão avisa "ainda não foi publicada" e nada é alterado. A função
exige que quem chama seja **administrador ativo** e nunca devolve a senha na resposta.
Enquanto uma pessoa não troca a senha padrão, qualquer um que a conheça entra na conta dela:
redefina só quando ela for entrar logo em seguida.

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

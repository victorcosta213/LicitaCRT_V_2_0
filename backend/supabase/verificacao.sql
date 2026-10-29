-- =====================================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO — rode no SQL Editor e confira a coluna "status".
-- Somente leitura: não altera nada.
-- =====================================================================
with checks(ordem, ok, item, detalhe) as (
  select 1, to_regprocedure('public.gc_parse_valor(text)') is not null,
         'Migration 20261017_correcoes_producao aplicada', ''::text

  union all
  select 2, coalesce(bool_and(rowsecurity), false),
         'RLS ativa em usuarios, processos e tabelas gc_*',
         coalesce(string_agg(tablename, ', ') filter (where not rowsecurity), '')
    from pg_tables
   where schemaname = 'public' and (tablename in ('usuarios', 'processos') or tablename like 'gc\_%')

  union all
  select 3, count(*) = 0,
         'Sem políticas antigas somando permissões em usuarios/processos',
         coalesce(string_agg(tablename || '.' || policyname, ', '), '')
    from pg_policies
   where schemaname = 'public' and tablename in ('usuarios', 'processos')
     and policyname not in ('usuarios_sel', 'usuarios_ins', 'usuarios_upd', 'usuarios_del',
                            'processos_sel', 'processos_ins', 'processos_upd', 'processos_del')

  union all
  select 4, exists (select 1 from storage.buckets where id = 'anexos' and not public),
         'Bucket "anexos" existe e é privado', ''

  union all
  select 5, count(*) = 0,
         'Outras políticas no Storage (revise se alguma libera o bucket "anexos" a qualquer logado)',
         coalesce(string_agg(policyname || ' [' || cmd || ']', ', '), '')
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname not like 'licitacrt\_%'

  union all
  select 6, count(*) >= 1, 'Há pelo menos um administrador ativo', count(*)::text
    from public.usuarios where role = 'admin' and coalesce(ativo, true)

  union all
  select 7, count(*) = 0,
         'Conta de teste teste123@gmail.com (apague em Authentication > Users)',
         coalesce(string_agg(email, ', '), '')
    from auth.users where lower(email) = 'teste123@gmail.com'

  union all
  select 8, count(*) = 0,
         'Logins sem perfil — não acessam nada; apague os que você não reconhece',
         coalesce(string_agg(a.email || ' (' || to_char(a.created_at, 'DD/MM/YY') || ')', ', '), '')
    from auth.users a left join public.usuarios u on u.id = a.id
   where u.id is null

  union all
  select 9, count(*) = 0,
         'Perfis sem login correspondente (essas pessoas não conseguem entrar)',
         coalesce(string_agg(coalesce(u.email, u.id::text), ', '), '')
    from public.usuarios u left join auth.users a on a.id = u.id
   where a.id is null

  union all
  select 10, count(*) = 0,
         'Gatilhos em auth.users (criação automática de perfil ao se cadastrar)',
         coalesce(string_agg(tgname, ', '), '')
    from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal

  union all
  select 11, count(*) = 0,
         'Contratos legados com valor zero (confira se é o valor real)',
         coalesce(string_agg(numero, ', '), '')
    from public.gc_contratos where legacy_id is not null and valor_inicial = 0 and not cancelado

  union all
  select 12, true,
         'Inventário (confira se os dados migrados do sistema antigo estão aqui)',
         'logins: ' || (select count(*) from auth.users)
         || ' · perfis ativos: ' || (select count(*) from public.usuarios where coalesce(ativo, true))
         || ' · processos: ' || (select count(*) from public.processos)
         || ' · contratos: ' || (select count(*) from public.gc_contratos where not cancelado)

  union all
  select 13, to_regprocedure('public.gc_encaminhar_contratacao(uuid,text)') is not null,
         'Migration 20261018_fluxo_funcional aplicada', ''

  union all
  select 14, count(*) = 0,
         'E-mails de tarefa com falha de envio (confira a Edge Function enviar-notificacoes)',
         coalesce(string_agg(distinct coalesce(erro, ''), ' | '), '')
    from public.gc_notificacoes where enviada_em is null and tentativas > 0

  union all
  select 15, count(*) = 0,
         'Atualização automática das telas (Realtime): tabelas que ainda não avisam as mudanças',
         case when not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
              then 'publicação supabase_realtime inexistente'
              else coalesce(string_agg(t, ', '), '') end
    from unnest(array['gc_contratos', 'gc_responsaveis', 'gc_ordens_servico', 'gc_competencias', 'gc_empenhos',
                      'gc_empenho_movs', 'gc_execucoes', 'gc_eventos', 'gc_ocorrencias', 'gc_documentos',
                      'gc_pendencias', 'gc_parametros', 'processos', 'usuarios']) as t
   where not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t)

  union all
  select 16, to_regprocedure('public.gc_senha_trocada()') is not null
             and to_regprocedure('public.gc_marcar_senha_provisoria(uuid)') is not null
             and to_regclass('public.usuarios_senha_provisoria') is not null,
         'Migration 20261020_senha_provisoria aplicada (troca de senha no primeiro acesso)', ''

  union all
  select 17, to_regclass('public.tr_processos') is not null
             and to_regprocedure('public.tr_tramitar(uuid,uuid,uuid,text,date)') is not null
             and exists (select 1 from public.tr_unidades),
         'Migration 20261021_tramitacao aplicada (tramitação de processos)', ''

  union all
  select 18, exists (select 1 from pg_constraint
                      where conname = 'usuarios_role_valido' and pg_get_constraintdef(oid) like '%presidente%'),
         'Migration 20261022_perfil_presidente aplicada (perfil Presidente / Prefeito)', ''

  union all
  select 19, exists (select 1 from pg_constraint
                      where conname = 'usuarios_role_valido' and pg_get_constraintdef(oid) like '%juridico%'),
         'Migration 20261023_perfis_setoriais aplicada (Jurídico, Administrativo, RH e TI)', ''

  union all
  select 20, to_regclass('public.doc_documentos') is not null
             and to_regprocedure('public.doc_assinar(uuid)') is not null
             and to_regprocedure('public.doc_verificar(text)') is not null,
         'Migration 20261024_documentos_assinatura aplicada (documentos e assinatura eletrônica)', ''

  union all
  select 21, to_regclass('public.cp_solicitacoes') is not null
             and to_regclass('public.cp_checklist') is not null
             and to_regprocedure('public.cp_aceitar_solicitacao(uuid,text,text,text,text)') is not null,
         'Migration 20261025_solicitacoes_compras aplicada (solicitações/DFD e processos de contratação)', ''

  union all
  select 22, to_regclass('public.cp_itens') is not null
             and to_regprocedure('public.doc_criar_arquivo(text,text,uuid,text,text,text,bigint,text)') is not null
             and to_regprocedure('public.doc_encaminhar(uuid,uuid,text)') is not null,
         'Migration 20261026_fluxo_secretarias aplicada (secretário, catálogo de itens, arquivos e encaminhamento)', ''
)
select ordem, case when ok then '✅' else '⚠️' end as status, item, detalhe
  from checks
 order by ordem;

-- =====================================================================
-- CORREÇÕES PARA PRODUÇÃO — CRT-08
-- Aplicar depois de 20261015 e 20261016 (Supabase > SQL Editor > Run).
-- É idempotente (pode ser executado mais de uma vez).
--
--  1. Acesso: só quem tem perfil ATIVO em public.usuarios enxerga dados.
--  2. usuarios: RLS (ninguém se promove a admin) e perfil novo nasce inativo.
--  3. processos: colunas de arquivamento + RLS por perfil.
--  4. Anexos: bucket privado + políticas por perfil.
--  5. Competência: atesto e liberação só com os pré-requisitos.
--  6. Contratos legados: corrige valores importados com erro.
--  7. Perfis antigos: religa o perfil ao login pelo e-mail.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Acesso
--    Antes: sem perfil ou desativado = "viewer" (lia tudo). Como o cadastro
--    público do Supabase está aberto, qualquer pessoa podia criar uma conta
--    e ler os contratos. Agora é "sem_acesso" e não enxerga nada.
-- ---------------------------------------------------------------------
create or replace function public.gc_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when role = 'editor' then 'compras' else coalesce(role, 'viewer') end
       from public.usuarios
      where id = auth.uid() and coalesce(ativo, true)),
    'sem_acesso')
$$;

create or replace function public.gc_pode_ver(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.gc_role() = 'sem_acesso' then false
    when public.gc_role() = 'fiscal' then exists (
      select 1 from public.gc_responsaveis r
       where r.contrato_id = p_contrato and r.usuario_id = auth.uid() and r.ativo)
    else true
  end
$$;

drop policy if exists gc_sel on public.gc_parametros;
create policy gc_sel on public.gc_parametros for select to authenticated
  using (public.gc_role() <> 'sem_acesso');

-- ---------------------------------------------------------------------
-- 2. usuarios
-- ---------------------------------------------------------------------
-- Perfil criado por qualquer outro caminho começa sem acesso
-- (a tela de Usuários grava ativo = true explicitamente).
alter table public.usuarios alter column ativo set default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_role_valido') then
    alter table public.usuarios add constraint usuarios_role_valido
      check (role is null or role in ('admin','compras','gestor','fiscal','financeiro','editor','viewer')) not valid;
  end if;
end $$;

-- O administrador não pode tirar o próprio acesso (evita ficar sem nenhum admin)
create or replace function public.usuarios_guard() returns trigger
language plpgsql as $$
begin
  if old.id = auth.uid() and old.role = 'admin'
     and (new.role is distinct from 'admin' or not coalesce(new.ativo, true)) then
    raise exception 'Você não pode remover o seu próprio acesso de administrador.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard on public.usuarios;
create trigger trg_guard before update on public.usuarios
  for each row execute function public.usuarios_guard();

alter table public.usuarios enable row level security;
do $$
declare p record;
begin
  -- remove políticas antigas (criadas fora das migrations) para não somarem permissões
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'usuarios' loop
    execute format('drop policy %I on public.usuarios', p.policyname);
  end loop;
end $$;
-- Cada um lê o próprio perfil; gestor (designa fiscais) e admin leem todos.
create policy usuarios_sel on public.usuarios for select to authenticated
  using (id = auth.uid() or public.gc_tem_papel('{gestor}'));
create policy usuarios_ins on public.usuarios for insert to authenticated
  with check (public.gc_role() = 'admin');
create policy usuarios_upd on public.usuarios for update to authenticated
  using (public.gc_role() = 'admin') with check (public.gc_role() = 'admin');
create policy usuarios_del on public.usuarios for delete to authenticated
  using (public.gc_role() = 'admin' and id <> auth.uid());

-- ---------------------------------------------------------------------
-- 3. processos (módulo licitatório)
-- ---------------------------------------------------------------------
alter table public.processos add column if not exists arquivado  boolean not null default false;
alter table public.processos add column if not exists updated_at timestamptz;

create or replace function public.processos_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_touch on public.processos;
create trigger trg_touch before update on public.processos
  for each row execute function public.processos_touch();

alter table public.processos enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'processos' loop
    execute format('drop policy %I on public.processos', p.policyname);
  end loop;
end $$;
create policy processos_sel on public.processos for select to authenticated
  using (public.gc_role() <> 'sem_acesso');
create policy processos_ins on public.processos for insert to authenticated
  with check (public.gc_tem_papel('{compras}'));
create policy processos_upd on public.processos for update to authenticated
  using (public.gc_tem_papel('{compras}')) with check (public.gc_tem_papel('{compras}'));
create policy processos_del on public.processos for delete to authenticated
  using (public.gc_tem_papel('{compras}'));

-- ---------------------------------------------------------------------
-- 4. Anexos dos processos: bucket privado (links temporários assinados)
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public) values ('anexos', 'anexos', false)
    on conflict (id) do update set public = false;

  execute 'drop policy if exists licitacrt_anexos_sel on storage.objects';
  execute 'drop policy if exists licitacrt_anexos_ins on storage.objects';
  execute 'drop policy if exists licitacrt_anexos_upd on storage.objects';
  execute 'drop policy if exists licitacrt_anexos_del on storage.objects';
  execute $p$create policy licitacrt_anexos_sel on storage.objects for select to authenticated
    using (bucket_id = 'anexos' and public.gc_role() <> 'sem_acesso')$p$;
  execute $p$create policy licitacrt_anexos_ins on storage.objects for insert to authenticated
    with check (bucket_id = 'anexos' and public.gc_tem_papel('{compras}'))$p$;
  execute $p$create policy licitacrt_anexos_upd on storage.objects for update to authenticated
    using (bucket_id = 'anexos' and public.gc_tem_papel('{compras}'))$p$;
  execute $p$create policy licitacrt_anexos_del on storage.objects for delete to authenticated
    using (bucket_id = 'anexos' and public.gc_tem_papel('{compras}'))$p$;
end $$;

-- ---------------------------------------------------------------------
-- 5. Competência: regras do fluxo também no banco
--    (verificadas só quando o atesto/liberação é marcado, para não travar
--    a edição de registros antigos)
-- ---------------------------------------------------------------------
create or replace function public.gc_guard_competencia() returns trigger
language plpgsql as $$
begin
  if public.gc_role() = 'fiscal' and (
       new.nf_recebida, new.nf_numero, new.nf_data, new.nf_valor_bruto,
       new.certidoes_verificadas, new.doc_trabalhista_ok, new.doc_completa,
       new.houve_glosa, new.glosa_motivo, new.glosa_valor,
       new.liberado_financeiro, new.liberado_data, new.liberado_por, new.sei_despacho,
       new.suspensa, new.cancelado
     ) is distinct from (
       old.nf_recebida, old.nf_numero, old.nf_data, old.nf_valor_bruto,
       old.certidoes_verificadas, old.doc_trabalhista_ok, old.doc_completa,
       old.houve_glosa, old.glosa_motivo, old.glosa_valor,
       old.liberado_financeiro, old.liberado_data, old.liberado_por, old.sei_despacho,
       old.suspensa, old.cancelado
     ) then
    raise exception 'O fiscal registra apenas relatório, medição e ocorrências da competência.';
  end if;
  if new.atestado and not old.atestado
     and not (new.relatorio_recebido and new.nf_recebida and new.doc_completa) then
    raise exception 'O atesto exige o relatório do fiscal, a nota fiscal e a documentação completa da contratada.';
  end if;
  if new.liberado_financeiro and not old.liberado_financeiro and not new.atestado then
    raise exception 'A competência precisa estar atestada antes de ser liberada ao financeiro.';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 6. Contratos legados (tabela "contratos", valor em texto)
--    A importação original tratava todo ponto como milhar ("1500.75" virou
--    150075) e zerava valores com "R$". Corrige apenas os contratos cujo
--    valor ainda é exatamente o importado com erro (não toca nos editados)
--    e importa os que tenham ficado de fora.
-- ---------------------------------------------------------------------
create or replace function public.gc_parse_valor(v text) returns numeric
language plpgsql immutable as $$
declare s text;
begin
  if v is null then return null; end if;
  s := regexp_replace(v, '(R\$|[[:space:]]|' || chr(160) || ')', '', 'gi');
  if s !~ '^-?[0-9][0-9.,]*$' then return null; end if;
  if position(',' in s) > 0 then
    s := replace(replace(s, '.', ''), ',', '.');      -- 1.234,56
  elsif s ~ '^-?[0-9]{1,3}(\.[0-9]{3})+$' then
    s := replace(s, '.', '');                         -- 1.500 / 1.234.567
  end if;                                             -- 1500.75 fica como está
  return s::numeric;
exception when others then
  return null;
end $$;

-- regra da importação original, só para reconhecer os valores importados com erro
create or replace function public.gc_parse_valor_v1(v text) returns numeric
language plpgsql immutable as $$
begin
  if coalesce(v, '') ~ '^[0-9.,]+$' then
    return replace(replace(v, '.', ''), ',', '.')::numeric;
  end if;
  return 0;
exception when others then
  return null;
end $$;

create or replace function public.gc_parse_data(v text) returns date
language plpgsql immutable as $$
begin
  return nullif(v, '')::date;
exception when others then
  return null;
end $$;

do $$
begin
  if to_regclass('public.contratos') is null then
    return;
  end if;

  update public.gc_contratos g
     set valor_inicial = public.gc_parse_valor(s.j->>'valor')
    from (select to_jsonb(c) as j from public.contratos c) s
   where g.legacy_id = s.j->>'id'
     and public.gc_parse_valor(s.j->>'valor') is not null
     and g.valor_inicial = public.gc_parse_valor_v1(s.j->>'valor')
     and g.valor_inicial <> public.gc_parse_valor(s.j->>'valor');

  insert into public.gc_contratos
    (legacy_id, numero, contratada, objeto, sei_processo, data_assinatura,
     vigencia_inicio, vigencia_fim, valor_inicial, situacao, validado_gestao)
  select
    j->>'id',
    coalesce(nullif(j->>'numero', ''), 'S/N'),
    coalesce(nullif(j->>'fornecedor', ''), 'Não informado'),
    coalesce(nullif(j->>'objeto', ''), 'Não informado'),
    coalesce(j->>'processo_origem', j->>'processoOrigem'),
    public.gc_parse_data(coalesce(j->>'data_assinatura', j->>'dataAssinatura')),
    public.gc_parse_data(coalesce(j->>'data_assinatura', j->>'dataAssinatura')),
    public.gc_parse_data(coalesce(j->>'data_vencimento', j->>'dataVencimento')),
    coalesce(public.gc_parse_valor(j->>'valor'), 0),
    'ativo',
    false
  from (select to_jsonb(c) as j from public.contratos c) s
  where j->>'id' is not null
  on conflict (legacy_id) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- 7. Perfis antigos cujo id não é o do login (ex.: migrados do Firebase):
--    religa pelo e-mail, levando junto as designações de fiscal/gestor.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  if to_regclass('auth.users') is null then
    return;
  end if;
  for r in
    select u.id as velho, a.id as novo
      from public.usuarios u
      join auth.users a on lower(a.email) = lower(u.email)
     where not exists (select 1 from auth.users x where x.id = u.id)
       and not exists (select 1 from public.usuarios y where y.id = a.id)
  loop
    update public.gc_responsaveis set usuario_id = r.novo where usuario_id = r.velho;
    update public.usuarios set id = r.novo where id = r.velho;
  end loop;
end $$;

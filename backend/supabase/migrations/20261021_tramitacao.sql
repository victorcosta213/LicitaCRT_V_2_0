-- =====================================================================
-- Tramitação de processos administrativos
--
-- Cada processo tem um número de protocolo (AAAA/NNNNNN), está sempre em UMA unidade e tem um
-- histórico completo de movimentações (abertura, envio, recebimento, alteração, conclusão,
-- reabertura). A tela de acompanhamento usa o tempo desde a última movimentação para mostrar
-- onde o processo está e onde está parado.
--
-- Toda gravação passa pelas funções tr_* (security definer): assim o histórico nunca fica
-- diferente do estado atual, e ninguém grava direto nas tabelas. Quem pode ver cada processo é
-- decidido por tr_pode_ver (a RLS e o Realtime usam a mesma regra).
-- Idempotente: pode rodar de novo sem efeito colateral.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Unidades (setores) e a unidade de cada pessoa
-- ---------------------------------------------------------------------
create table if not exists public.tr_unidades (
  id         uuid primary key default gen_random_uuid(),
  sigla      text not null unique,
  nome       text not null,
  ativa      boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.tr_unidades (sigla, nome) values
  ('PRES', 'Presidência / Gabinete'),
  ('ADM',  'Administrativo'),
  ('COMP', 'Compras e Licitações'),
  ('GCON', 'Gestão de Contratos'),
  ('FIN',  'Financeiro'),
  ('JUR',  'Jurídico'),
  ('FISC', 'Fiscalização'),
  ('TI',   'Tecnologia da Informação'),
  ('RH',   'Recursos Humanos')
on conflict (sigla) do nothing;

alter table public.usuarios add column if not exists unidade_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_unidade_fk') then
    alter table public.usuarios add constraint usuarios_unidade_fk
      foreign key (unidade_id) references public.tr_unidades (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Processos e movimentações
-- ---------------------------------------------------------------------
create table if not exists public.tr_sequencias (
  ano    int primary key,
  ultimo int not null default 0
);

create table if not exists public.tr_processos (
  id                uuid primary key default gen_random_uuid(),
  numero            text not null unique,
  tipo              text not null,
  assunto           text not null,
  interessado       text,
  descricao         text,
  prioridade        text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  prazo             date,
  situacao          text not null default 'em_andamento' check (situacao in ('em_andamento', 'concluido')),
  unidade_atual     uuid references public.tr_unidades (id),
  responsavel_atual uuid,
  responsavel_nome  text,                                -- nomes gravados: quem não é gestor não lê a tabela de usuários
  desde             timestamptz not null default now(),  -- chegou na unidade atual em
  recebido_em       timestamptz,                         -- a unidade abriu o processo em
  aberto_por        uuid,
  aberto_por_nome   text,
  aberto_em         timestamptz not null default now(),
  concluido_em      timestamptz,
  motivo_conclusao  text,
  updated_at        timestamptz not null default now()
);
create index if not exists tr_processos_unidade_idx on public.tr_processos (unidade_atual) where situacao = 'em_andamento';

create table if not exists public.tr_tramitacoes (
  id           bigint generated always as identity primary key,
  processo_id  uuid not null references public.tr_processos (id) on delete cascade,
  tipo         text not null check (tipo in ('abertura', 'envio', 'recebimento', 'alteracao', 'conclusao', 'reabertura')),
  de_unidade   uuid references public.tr_unidades (id),
  para_unidade uuid references public.tr_unidades (id),
  para_usuario uuid,
  para_usuario_nome text,
  despacho     text,
  prazo        date,
  criada_em    timestamptz not null default now(),
  criada_por   uuid,
  criada_por_nome text
);
create index if not exists tr_tramitacoes_processo_idx on public.tr_tramitacoes (processo_id, criada_em);

-- ---------------------------------------------------------------------
-- 3. Regras de acesso
-- ---------------------------------------------------------------------
create or replace function public.tr_unidade_do_usuario() returns uuid
language sql stable security definer set search_path = public as $$
  select unidade_id from public.usuarios where id = auth.uid() and coalesce(ativo, true)
$$;

-- Vê o processo: quem acompanha a instituição (gestão, gabinete, consulta, administrador) e quem
-- já participou dele (abriu, é o responsável, está na unidade atual ou a sua unidade já o recebeu).
create or replace function public.tr_pode_ver(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.gc_role() <> 'sem_acesso' and (
    public.gc_tem_papel('{gestor,gabinete,viewer}')
    or exists (select 1 from public.tr_processos p
                where p.id = p_id
                  and (p.aberto_por = auth.uid() or p.responsavel_atual = auth.uid()
                       or p.unidade_atual = public.tr_unidade_do_usuario()))
    or exists (select 1 from public.tr_tramitacoes t
                where t.processo_id = p_id
                  and (t.criada_por = auth.uid() or t.para_usuario = auth.uid()
                       or t.de_unidade = public.tr_unidade_do_usuario()
                       or t.para_unidade = public.tr_unidade_do_usuario()))
  )
$$;

-- Atua no processo (receber, enviar, alterar, concluir): administrador, responsável atual ou
-- qualquer pessoa da unidade onde ele está.
create or replace function public.tr_pode_atuar(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.gc_role() = 'admin'
    or exists (select 1 from public.tr_processos p
                where p.id = p_id
                  and public.gc_role() not in ('viewer', 'sem_acesso')
                  and (p.responsavel_atual = auth.uid() or p.unidade_atual = public.tr_unidade_do_usuario()))
  )
$$;

-- Nome da pessoa gravado junto com o registro (o histórico não muda se ela for renomeada ou removida)
create or replace function public.tr_nome(p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(nome), ''), email) from public.usuarios where id = p_uid
$$;

create or replace function public.tr_gravar_nomes_processo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.aberto_por_nome := public.tr_nome(new.aberto_por); end if;
  new.responsavel_nome := public.tr_nome(new.responsavel_atual);
  return new;
end $$;
drop trigger if exists trg_tr_nomes on public.tr_processos;
create trigger trg_tr_nomes before insert or update on public.tr_processos
  for each row execute function public.tr_gravar_nomes_processo();

create or replace function public.tr_gravar_nomes_tramitacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.criada_por_nome := public.tr_nome(new.criada_por);
  new.para_usuario_nome := public.tr_nome(new.para_usuario);
  return new;
end $$;
drop trigger if exists trg_tr_nomes on public.tr_tramitacoes;
create trigger trg_tr_nomes before insert on public.tr_tramitacoes
  for each row execute function public.tr_gravar_nomes_tramitacao();

alter table public.tr_unidades    enable row level security;
alter table public.tr_sequencias  enable row level security;
alter table public.tr_processos   enable row level security;
alter table public.tr_tramitacoes enable row level security;

drop policy if exists tr_unidades_sel on public.tr_unidades;
drop policy if exists tr_unidades_ins on public.tr_unidades;
drop policy if exists tr_unidades_upd on public.tr_unidades;
create policy tr_unidades_sel on public.tr_unidades for select to authenticated using (auth.uid() is not null);
create policy tr_unidades_ins on public.tr_unidades for insert to authenticated with check (public.gc_role() = 'admin');
create policy tr_unidades_upd on public.tr_unidades for update to authenticated
  using (public.gc_role() = 'admin') with check (public.gc_role() = 'admin');

drop policy if exists tr_processos_sel on public.tr_processos;
drop policy if exists tr_tramitacoes_sel on public.tr_tramitacoes;
create policy tr_processos_sel   on public.tr_processos   for select to authenticated using (public.tr_pode_ver(id));
create policy tr_tramitacoes_sel on public.tr_tramitacoes for select to authenticated using (public.tr_pode_ver(processo_id));

-- sem políticas de gravação: processos e movimentações só mudam pelas funções abaixo
revoke insert, update, delete on public.tr_processos, public.tr_tramitacoes, public.tr_sequencias from anon, authenticated;
revoke all on public.tr_sequencias from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Operações
-- ---------------------------------------------------------------------
create or replace function public.tr_proximo_numero() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ano int := extract(year from now())::int;
  v_n   int;
begin
  insert into public.tr_sequencias (ano, ultimo) values (v_ano, 1)
    on conflict (ano) do update set ultimo = public.tr_sequencias.ultimo + 1
    returning ultimo into v_n;
  return v_ano || '/' || lpad(v_n::text, 6, '0');
end $$;

create or replace function public.tr_abrir_processo(
  p_tipo text, p_assunto text, p_interessado text, p_descricao text,
  p_prioridade text, p_prazo date, p_unidade_destino uuid, p_despacho text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_origem  uuid := public.tr_unidade_do_usuario();
  v_destino uuid;
  v_id      uuid;
  v_aqui    boolean;
begin
  if not public.gc_tem_papel('{compras,gestor,fiscal,financeiro,gabinete}') then
    raise exception 'Seu perfil não pode abrir processos.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_tipo, ''))) = 0 then raise exception 'Informe o tipo do processo.'; end if;
  if length(trim(coalesce(p_assunto, ''))) < 3 then raise exception 'Informe o assunto do processo.'; end if;
  if v_origem is null and public.gc_role() <> 'admin' then
    raise exception 'Peça ao administrador para definir a sua unidade antes de abrir processos.';
  end if;

  v_destino := coalesce(p_unidade_destino, v_origem);
  if v_destino is null then raise exception 'Informe a unidade de destino.'; end if;
  if not exists (select 1 from public.tr_unidades where id = v_destino and ativa) then
    raise exception 'Unidade de destino inexistente ou inativa.';
  end if;
  v_aqui := v_destino is not distinct from v_origem;

  insert into public.tr_processos (numero, tipo, assunto, interessado, descricao, prioridade, prazo,
                                   unidade_atual, responsavel_atual, desde, recebido_em, aberto_por)
    values (public.tr_proximo_numero(), trim(p_tipo), trim(p_assunto), nullif(trim(coalesce(p_interessado, '')), ''),
            nullif(trim(coalesce(p_descricao, '')), ''), coalesce(nullif(p_prioridade, ''), 'normal'), p_prazo,
            v_destino, case when v_aqui then auth.uid() end, now(), case when v_aqui then now() end, auth.uid())
    returning id into v_id;

  insert into public.tr_tramitacoes (processo_id, tipo, de_unidade, para_unidade, despacho, prazo, criada_por)
    values (v_id, 'abertura', v_origem, v_destino, nullif(trim(coalesce(p_despacho, '')), ''), p_prazo, auth.uid());
  return v_id;
end $$;

create or replace function public.tr_tramitar(
  p_id uuid, p_unidade_destino uuid, p_usuario_destino uuid, p_despacho text, p_prazo date
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.tr_processos%rowtype;
begin
  select * into v_p from public.tr_processos where id = p_id for update;
  if not found then raise exception 'Processo não encontrado.' using errcode = 'P0002'; end if;
  if not public.tr_pode_atuar(p_id) then
    raise exception 'Somente a unidade onde o processo está pode enviá-lo.' using errcode = '42501';
  end if;
  if v_p.situacao <> 'em_andamento' then raise exception 'O processo está concluído. Reabra-o para enviar.'; end if;
  if length(trim(coalesce(p_despacho, ''))) < 3 then raise exception 'Escreva o despacho: o que a próxima unidade deve fazer.'; end if;
  if p_unidade_destino is null or not exists (select 1 from public.tr_unidades where id = p_unidade_destino and ativa) then
    raise exception 'Unidade de destino inexistente ou inativa.';
  end if;
  if p_unidade_destino = v_p.unidade_atual and p_usuario_destino is null then
    raise exception 'O processo já está nesta unidade.';
  end if;
  if p_usuario_destino is not null and not exists (
       select 1 from public.usuarios u
        where u.id = p_usuario_destino and coalesce(u.ativo, true) and u.unidade_id = p_unidade_destino) then
    raise exception 'A pessoa escolhida não está ativa nessa unidade.';
  end if;

  update public.tr_processos
     set unidade_atual = p_unidade_destino, responsavel_atual = p_usuario_destino, desde = now(),
         recebido_em = null, prazo = coalesce(p_prazo, prazo), updated_at = now()
   where id = p_id;
  insert into public.tr_tramitacoes (processo_id, tipo, de_unidade, para_unidade, para_usuario, despacho, prazo, criada_por)
    values (p_id, 'envio', v_p.unidade_atual, p_unidade_destino, p_usuario_destino, trim(p_despacho), p_prazo, auth.uid());
end $$;

create or replace function public.tr_receber(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.tr_processos%rowtype;
begin
  select * into v_p from public.tr_processos where id = p_id for update;
  if not found then raise exception 'Processo não encontrado.' using errcode = 'P0002'; end if;
  if not public.tr_pode_atuar(p_id) then
    raise exception 'Somente a unidade onde o processo está pode recebê-lo.' using errcode = '42501';
  end if;
  if v_p.situacao <> 'em_andamento' or v_p.recebido_em is not null then return; end if;

  update public.tr_processos
     set recebido_em = now(), responsavel_atual = coalesce(responsavel_atual, auth.uid()), updated_at = now()
   where id = p_id;
  insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, criada_por)
    values (p_id, 'recebimento', v_p.unidade_atual, auth.uid());
end $$;

create or replace function public.tr_atualizar_dados(
  p_id uuid, p_assunto text, p_interessado text, p_descricao text, p_prioridade text, p_prazo date
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.tr_processos%rowtype;
begin
  select * into v_p from public.tr_processos where id = p_id for update;
  if not found then raise exception 'Processo não encontrado.' using errcode = 'P0002'; end if;
  if not public.tr_pode_atuar(p_id) then
    raise exception 'Somente a unidade onde o processo está pode alterá-lo.' using errcode = '42501';
  end if;
  if v_p.situacao <> 'em_andamento' then raise exception 'O processo está concluído. Reabra-o para alterar.'; end if;
  if length(trim(coalesce(p_assunto, ''))) < 3 then raise exception 'Informe o assunto do processo.'; end if;
  if p_prioridade not in ('baixa', 'normal', 'alta', 'urgente') then raise exception 'Prioridade inválida.'; end if;

  update public.tr_processos
     set assunto = trim(p_assunto), interessado = nullif(trim(coalesce(p_interessado, '')), ''),
         descricao = nullif(trim(coalesce(p_descricao, '')), ''), prioridade = p_prioridade, prazo = p_prazo,
         updated_at = now()
   where id = p_id;
  insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, despacho, criada_por)
    values (p_id, 'alteracao', v_p.unidade_atual, 'Dados do processo alterados.', auth.uid());
end $$;

create or replace function public.tr_concluir(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.tr_processos%rowtype;
begin
  select * into v_p from public.tr_processos where id = p_id for update;
  if not found then raise exception 'Processo não encontrado.' using errcode = 'P0002'; end if;
  if not public.tr_pode_atuar(p_id) then
    raise exception 'Somente a unidade onde o processo está pode concluí-lo.' using errcode = '42501';
  end if;
  if v_p.situacao <> 'em_andamento' then raise exception 'O processo já está concluído.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe como o processo foi resolvido.'; end if;

  update public.tr_processos
     set situacao = 'concluido', concluido_em = now(), motivo_conclusao = trim(p_motivo), updated_at = now()
   where id = p_id;
  insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, despacho, criada_por)
    values (p_id, 'conclusao', v_p.unidade_atual, trim(p_motivo), auth.uid());
end $$;

create or replace function public.tr_reabrir(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.tr_processos%rowtype;
begin
  select * into v_p from public.tr_processos where id = p_id for update;
  if not found then raise exception 'Processo não encontrado.' using errcode = 'P0002'; end if;
  if not (public.tr_pode_atuar(p_id) or public.gc_tem_papel('{gestor,gabinete}')) then
    raise exception 'Seu perfil não pode reabrir este processo.' using errcode = '42501';
  end if;
  if v_p.situacao <> 'concluido' then raise exception 'O processo não está concluído.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo da reabertura.'; end if;

  update public.tr_processos
     set situacao = 'em_andamento', concluido_em = null, motivo_conclusao = null, desde = now(),
         recebido_em = null, updated_at = now()
   where id = p_id;
  insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, despacho, criada_por)
    values (p_id, 'reabertura', v_p.unidade_atual, trim(p_motivo), auth.uid());
end $$;

-- Pessoas ativas de uma unidade (para escolher o destinatário ao enviar um processo)
create or replace function public.tr_pessoas_da_unidade(p_unidade uuid) returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select u.id, coalesce(nullif(trim(u.nome), ''), u.email)
    from public.usuarios u
   where u.unidade_id = p_unidade and coalesce(u.ativo, true)
     and public.gc_role() not in ('viewer', 'sem_acesso')
   order by 2
$$;

-- só quem está logado chama as funções
revoke all on function public.tr_unidade_do_usuario(), public.tr_pode_ver(uuid), public.tr_pode_atuar(uuid),
  public.tr_proximo_numero(), public.tr_nome(uuid), public.tr_pessoas_da_unidade(uuid),
  public.tr_abrir_processo(text, text, text, text, text, date, uuid, text),
  public.tr_tramitar(uuid, uuid, uuid, text, date), public.tr_receber(uuid),
  public.tr_atualizar_dados(uuid, text, text, text, text, date),
  public.tr_concluir(uuid, text), public.tr_reabrir(uuid, text)
  from public, anon;
grant execute on function public.tr_unidade_do_usuario(), public.tr_pode_ver(uuid), public.tr_pode_atuar(uuid),
  public.tr_pessoas_da_unidade(uuid),
  public.tr_abrir_processo(text, text, text, text, text, date, uuid, text),
  public.tr_tramitar(uuid, uuid, uuid, text, date), public.tr_receber(uuid),
  public.tr_atualizar_dados(uuid, text, text, text, text, date),
  public.tr_concluir(uuid, text), public.tr_reabrir(uuid, text)
  to authenticated;
-- tr_proximo_numero fica só para as funções acima (sem execute para os usuários)

-- Limite de dias sem movimentação para o processo ser considerado "parado" (editável em Parâmetros)
insert into public.gc_parametros (chave, valor) values ('tr_dias_parado', '5'::jsonb)
  on conflict (chave) do nothing;

-- ---------------------------------------------------------------------
-- 5. Atualização automática das telas (Realtime)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['tr_unidades', 'tr_processos', 'tr_tramitacoes'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

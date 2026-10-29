-- =====================================================================
-- Documentos e assinatura eletrônica
--
-- Documentos produzidos na plataforma (ofícios, despachos, pareceres, ETP, TR, minutas de contrato…),
-- com número próprio, vínculo opcional a um processo e assinatura eletrônica AVANÇADA:
--   · o conteúdo é congelado ao ser enviado para assinatura e guardado com o hash SHA-256;
--   · quem assina precisa ter digitado a SENHA há poucos minutos (conferido no próprio token do login:
--     claim "amr"), e o hash é conferido de novo na hora de assinar;
--   · data e hora, IP e navegador são gravados pelo SERVIDOR, não pelo navegador;
--   · depois de assinado nada do documento muda (gatilhos), só pode ser cancelado, com motivo;
--   · qualquer pessoa confere o documento pelo código de verificação (função doc_verificar).
--
-- Toda gravação passa pelas funções doc_* (security definer); ninguém grava direto nas tabelas.
-- Idempotente: pode rodar de novo sem efeito colateral.
-- =====================================================================

create table if not exists public.doc_sequencias (
  sigla  text not null,
  ano    int  not null,
  ultimo int  not null default 0,
  primary key (sigla, ano)
);

create table if not exists public.doc_documentos (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,                       -- OF-2026/000001
  sigla               text not null,
  modelo              text not null,                              -- código do modelo (ex.: etp-bens-servicos)
  modelo_versao       int  not null default 1,
  titulo              text not null,
  processo_id         uuid references public.tr_processos (id) on delete set null,
  unidade_id          uuid references public.tr_unidades (id),   -- unidade de origem
  conteudo            jsonb not null default '{}'::jsonb,         -- valores do formulário (editável no rascunho)
  corpo               jsonb not null default '[]'::jsonb,         -- blocos exibidos e assinados
  status              text not null default 'rascunho'
                      check (status in ('rascunho', 'aguardando_assinatura', 'assinado', 'cancelado')),
  versao              int  not null default 1,                    -- sobe quando a assinatura é recusada e o texto volta a ser editado
  hash                text,                                       -- SHA-256 do conteúdo congelado
  codigo_verificacao  text unique,
  criado_por          uuid,
  criado_por_nome     text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  assinado_em         timestamptz,
  cancelado_em        timestamptz,
  motivo_cancelamento text
);
create index if not exists doc_documentos_processo_idx on public.doc_documentos (processo_id);
create index if not exists doc_documentos_unidade_idx on public.doc_documentos (unidade_id);

create table if not exists public.doc_assinaturas (
  id            bigint generated always as identity primary key,
  documento_id  uuid not null references public.doc_documentos (id) on delete cascade,
  versao        int  not null,
  ordem         int  not null,
  papel         text not null,
  usuario_id    uuid not null,
  nome          text,
  status        text not null default 'pendente' check (status in ('pendente', 'assinada', 'recusada', 'cancelada')),
  assinada_em   timestamptz,
  hash          text,
  ip            text,
  agente        text,
  metodo        text,
  motivo_recusa text,
  unique (documento_id, versao, usuario_id)
);
create index if not exists doc_assinaturas_usuario_idx on public.doc_assinaturas (usuario_id) where status = 'pendente';

-- Histórico do processo: passa a aceitar o registro de documentos
alter table public.tr_tramitacoes drop constraint if exists tr_tramitacoes_tipo_check;
alter table public.tr_tramitacoes add constraint tr_tramitacoes_tipo_check check (tipo in
  ('abertura', 'envio', 'recebimento', 'alteracao', 'conclusao', 'reabertura', 'documento'));

-- Como o processo será contratado: define quais artefatos da Lei 14.133/2021 se esperam dele
alter table public.tr_processos add column if not exists contratacao_modalidade text;
alter table public.tr_processos add column if not exists contratacao_objeto text;

-- ---------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------
create or replace function public.doc_hash(p_numero text, p_titulo text, p_corpo jsonb) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p_numero || E'\n' || p_titulo || E'\n' || p_corpo::text, 'UTF8')), 'hex')
$$;

create or replace function public.doc_pode_ver(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.gc_role() <> 'sem_acesso' and exists (
    select 1 from public.doc_documentos d
     where d.id = p_id
       and (public.gc_role() = 'admin'
            or d.criado_por = auth.uid()
            or exists (select 1 from public.doc_assinaturas a where a.documento_id = d.id and a.usuario_id = auth.uid())
            or (d.unidade_id is not null and d.unidade_id = public.tr_unidade_do_usuario())
            or (d.processo_id is not null and public.tr_pode_ver(d.processo_id))))
$$;

-- Edita: só rascunho, e só o autor, a unidade de origem ou o administrador/presidente
create or replace function public.doc_pode_editar(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.gc_role() not in ('viewer', 'sem_acesso') and exists (
    select 1 from public.doc_documentos d
     where d.id = p_id and d.status = 'rascunho'
       and (public.gc_role() = 'admin'
            or d.criado_por = auth.uid()
            or (d.unidade_id is not null and d.unidade_id = public.tr_unidade_do_usuario())))
$$;

create or replace function public.doc_proximo_numero(p_sigla text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ano int := extract(year from now())::int;
  v_n   int;
begin
  insert into public.doc_sequencias (sigla, ano, ultimo) values (p_sigla, v_ano, 1)
    on conflict (sigla, ano) do update set ultimo = public.doc_sequencias.ultimo + 1
    returning ultimo into v_n;
  return p_sigla || '-' || v_ano || '/' || lpad(v_n::text, 6, '0');
end $$;

-- Registra no histórico do processo (quando o documento está vinculado a um)
create or replace function public.doc_registrar_no_processo(p_processo uuid, p_texto text) returns void
language sql security definer set search_path = public as $$
  insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, despacho, criada_por)
  select p.id, 'documento', p.unidade_atual, p_texto, auth.uid() from public.tr_processos p where p.id = p_processo
$$;

-- ---------------------------------------------------------------------
-- Gatilhos de proteção
-- ---------------------------------------------------------------------
create or replace function public.doc_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Documentos não são apagados: cancele com justificativa.';
  end if;
  if new.id <> old.id or new.numero <> old.numero or new.criado_por is distinct from old.criado_por then
    raise exception 'Identificação do documento não pode ser alterada.';
  end if;
  if old.status <> 'rascunho' and (new.titulo is distinct from old.titulo or new.corpo is distinct from old.corpo
       or new.conteudo is distinct from old.conteudo or new.modelo is distinct from old.modelo) then
    raise exception 'Documento enviado para assinatura ou assinado não pode ser alterado.';
  end if;
  if old.status in ('assinado', 'cancelado') and new.status is distinct from old.status
     and not (old.status = 'assinado' and new.status = 'cancelado') then
    raise exception 'Situação do documento não pode voltar atrás.';
  end if;
  return new;
end $$;
drop trigger if exists trg_doc_guard on public.doc_documentos;
create trigger trg_doc_guard before update or delete on public.doc_documentos
  for each row execute function public.doc_guard();

create or replace function public.doc_assinatura_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    -- só cai aqui se o documento for apagado (impedido por doc_guard)
    raise exception 'Assinaturas não são apagadas.';
  end if;
  if old.status = 'assinada' and (new.status <> 'assinada' or new.assinada_em is distinct from old.assinada_em
       or new.hash is distinct from old.hash or new.usuario_id <> old.usuario_id) then
    raise exception 'Assinatura já realizada não pode ser alterada.';
  end if;
  return new;
end $$;
drop trigger if exists trg_doc_assinatura_guard on public.doc_assinaturas;
create trigger trg_doc_assinatura_guard before update or delete on public.doc_assinaturas
  for each row execute function public.doc_assinatura_guard();

-- ---------------------------------------------------------------------
-- Acesso (RLS): leitura pela regra doc_pode_ver; nenhuma gravação direta
-- ---------------------------------------------------------------------
alter table public.doc_sequencias enable row level security;
alter table public.doc_documentos enable row level security;
alter table public.doc_assinaturas enable row level security;

drop policy if exists doc_documentos_sel on public.doc_documentos;
drop policy if exists doc_assinaturas_sel on public.doc_assinaturas;
create policy doc_documentos_sel on public.doc_documentos for select to authenticated using (public.doc_pode_ver(id));
create policy doc_assinaturas_sel on public.doc_assinaturas for select to authenticated using (public.doc_pode_ver(documento_id));

revoke insert, update, delete on public.doc_documentos, public.doc_assinaturas, public.doc_sequencias from anon, authenticated;
revoke all on public.doc_sequencias from anon, authenticated;

-- ---------------------------------------------------------------------
-- Operações
-- ---------------------------------------------------------------------
create or replace function public.doc_criar(
  p_sigla text, p_modelo text, p_modelo_versao int, p_titulo text, p_processo uuid, p_conteudo jsonb, p_corpo jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.gc_role() in ('viewer', 'sem_acesso') then
    raise exception 'Seu perfil não pode criar documentos.' using errcode = '42501';
  end if;
  if p_sigla is null or p_sigla !~ '^[A-Z0-9]{2,8}$' then raise exception 'Modelo inválido.'; end if;
  if p_modelo is null or p_modelo !~ '^[a-z0-9-]{2,60}$' then raise exception 'Modelo inválido.'; end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 then raise exception 'Informe o título do documento.'; end if;
  if p_processo is not null and not public.tr_pode_ver(p_processo) then
    raise exception 'Você não tem acesso a este processo.' using errcode = '42501';
  end if;

  insert into public.doc_documentos (numero, sigla, modelo, modelo_versao, titulo, processo_id, unidade_id, conteudo, corpo,
                                     criado_por, criado_por_nome)
    values (public.doc_proximo_numero(p_sigla), p_sigla, p_modelo, coalesce(p_modelo_versao, 1), trim(p_titulo), p_processo,
            public.tr_unidade_do_usuario(), coalesce(p_conteudo, '{}'::jsonb), coalesce(p_corpo, '[]'::jsonb),
            auth.uid(), public.tr_nome(auth.uid()))
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.doc_salvar(p_id uuid, p_titulo text, p_conteudo jsonb, p_corpo jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.doc_pode_editar(p_id) then
    raise exception 'Este documento não pode mais ser editado por você.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 then raise exception 'Informe o título do documento.'; end if;
  update public.doc_documentos
     set titulo = trim(p_titulo), conteudo = coalesce(p_conteudo, '{}'::jsonb), corpo = coalesce(p_corpo, '[]'::jsonb),
         atualizado_em = now()
   where id = p_id;
end $$;

-- p_signatarios: [{"usuario_id": "...", "papel": "Presidente"}, ...]
create or replace function public.doc_enviar_assinatura(p_id uuid, p_signatarios jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.doc_documentos%rowtype;
  s jsonb;
  v_ordem int := 0;
  v_hash text;
begin
  select * into d from public.doc_documentos where id = p_id for update;
  if not found then raise exception 'Documento não encontrado.' using errcode = 'P0002'; end if;
  if not public.doc_pode_editar(p_id) then
    raise exception 'Este documento não pode ser enviado para assinatura por você.' using errcode = '42501';
  end if;
  if jsonb_typeof(d.corpo) <> 'array' or jsonb_array_length(d.corpo) = 0 then
    raise exception 'O documento está vazio. Preencha antes de enviar.';
  end if;
  if jsonb_typeof(p_signatarios) <> 'array' or jsonb_array_length(p_signatarios) not between 1 and 10 then
    raise exception 'Escolha de 1 a 10 pessoas para assinar.';
  end if;
  if (select count(distinct x->>'usuario_id') from jsonb_array_elements(p_signatarios) x) <> jsonb_array_length(p_signatarios) then
    raise exception 'A mesma pessoa foi escolhida mais de uma vez.';
  end if;

  v_hash := public.doc_hash(d.numero, d.titulo, d.corpo);
  update public.doc_documentos
     set status = 'aguardando_assinatura', hash = v_hash, atualizado_em = now(),
         codigo_verificacao = coalesce(codigo_verificacao, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)))
   where id = p_id;

  for s in select * from jsonb_array_elements(p_signatarios) loop
    if not exists (select 1 from public.usuarios u
                    where u.id = (s->>'usuario_id')::uuid and coalesce(u.ativo, true) and u.role is not null and u.role <> 'viewer') then
      raise exception 'Uma das pessoas escolhidas não pode assinar (inativa ou só consulta).';
    end if;
    if length(trim(coalesce(s->>'papel', ''))) = 0 then raise exception 'Informe o papel de cada assinante.'; end if;
    v_ordem := v_ordem + 1;
    insert into public.doc_assinaturas (documento_id, versao, ordem, papel, usuario_id, nome)
      values (p_id, d.versao, v_ordem, trim(s->>'papel'), (s->>'usuario_id')::uuid, public.tr_nome((s->>'usuario_id')::uuid));
  end loop;

  perform public.doc_registrar_no_processo(d.processo_id, 'Documento ' || d.numero || ' enviado para assinatura.');
end $$;

create or replace function public.doc_assinar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.doc_documentos%rowtype;
  a public.doc_assinaturas%rowtype;
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
begin
  select * into d from public.doc_documentos where id = p_id for update;
  if not found then raise exception 'Documento não encontrado.' using errcode = 'P0002'; end if;
  if d.status <> 'aguardando_assinatura' then raise exception 'Este documento não está aguardando assinatura.'; end if;

  select * into a from public.doc_assinaturas
   where documento_id = p_id and versao = d.versao and usuario_id = auth.uid() and status = 'pendente' for update;
  if not found then raise exception 'Você não tem assinatura pendente neste documento.' using errcode = '42501'; end if;

  -- a senha precisa ter sido digitada agora há pouco (claim amr do login)
  if not exists (select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
                  where e ->> 'method' = 'password'
                    and (e ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 180) then
    raise exception 'Confirme a sua senha para assinar.' using errcode = 'P0001';
  end if;

  -- o que está guardado tem de ser exatamente o que foi congelado
  if d.hash is distinct from public.doc_hash(d.numero, d.titulo, d.corpo) then
    raise exception 'O conteúdo do documento não confere com o que foi enviado para assinatura. Assinatura recusada.';
  end if;

  update public.doc_assinaturas
     set status = 'assinada', assinada_em = now(), hash = d.hash,
         ip = nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
         agente = nullif(left(coalesce(v_headers ->> 'user-agent', ''), 300), ''),
         metodo = 'senha reconfirmada (assinatura eletrônica avançada)'
   where id = a.id;

  if not exists (select 1 from public.doc_assinaturas where documento_id = p_id and versao = d.versao and status = 'pendente') then
    update public.doc_documentos set status = 'assinado', assinado_em = now(), atualizado_em = now() where id = p_id;
    perform public.doc_registrar_no_processo(d.processo_id, 'Documento ' || d.numero || ' assinado por todos os signatários.');
  else
    perform public.doc_registrar_no_processo(d.processo_id, 'Documento ' || d.numero || ' assinado por ' || coalesce(a.nome, 'um signatário') || '.');
  end if;
end $$;

-- Quem recusa devolve o documento para edição (nova versão); as demais assinaturas pendentes caem
create or replace function public.doc_recusar(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.doc_documentos%rowtype;
  a public.doc_assinaturas%rowtype;
begin
  select * into d from public.doc_documentos where id = p_id for update;
  if not found then raise exception 'Documento não encontrado.' using errcode = 'P0002'; end if;
  if d.status <> 'aguardando_assinatura' then raise exception 'Este documento não está aguardando assinatura.'; end if;
  select * into a from public.doc_assinaturas
   where documento_id = p_id and versao = d.versao and usuario_id = auth.uid() and status = 'pendente' for update;
  if not found then raise exception 'Você não tem assinatura pendente neste documento.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo da recusa.'; end if;

  update public.doc_assinaturas set status = 'recusada', motivo_recusa = trim(p_motivo) where id = a.id;
  update public.doc_assinaturas set status = 'cancelada'
   where documento_id = p_id and versao = d.versao and status = 'pendente';
  update public.doc_documentos set status = 'rascunho', versao = versao + 1, hash = null, atualizado_em = now() where id = p_id;
  perform public.doc_registrar_no_processo(d.processo_id, 'Assinatura do documento ' || d.numero || ' recusada: ' || trim(p_motivo));
end $$;

create or replace function public.doc_cancelar(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.doc_documentos%rowtype;
begin
  select * into d from public.doc_documentos where id = p_id for update;
  if not found then raise exception 'Documento não encontrado.' using errcode = 'P0002'; end if;
  if not (public.gc_role() = 'admin' or d.criado_por = auth.uid()) then
    raise exception 'Só quem criou o documento (ou a administração) pode cancelá-lo.' using errcode = '42501';
  end if;
  if d.status = 'cancelado' then raise exception 'O documento já está cancelado.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;

  update public.doc_assinaturas set status = 'cancelada' where documento_id = p_id and status = 'pendente';
  update public.doc_documentos
     set status = 'cancelado', cancelado_em = now(), motivo_cancelamento = trim(p_motivo), atualizado_em = now()
   where id = p_id;
  perform public.doc_registrar_no_processo(d.processo_id, 'Documento ' || d.numero || ' cancelado: ' || trim(p_motivo));
end $$;

-- Conferência pública pelo código: devolve só o necessário (sem o conteúdo e sem o título)
create or replace function public.doc_verificar(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d public.doc_documentos%rowtype;
begin
  select * into d from public.doc_documentos
   where codigo_verificacao = regexp_replace(upper(coalesce(p_codigo, '')), '[^A-Z0-9]', '', 'g');
  if not found then return jsonb_build_object('encontrado', false); end if;
  return jsonb_build_object(
    'encontrado', true,
    'numero', d.numero,
    'situacao', d.status,
    'assinado_em', d.assinado_em,
    'cancelado_em', d.cancelado_em,
    'hash', d.hash,
    'integro', d.hash is not null and d.hash = public.doc_hash(d.numero, d.titulo, d.corpo),
    'assinaturas', coalesce((select jsonb_agg(jsonb_build_object('nome', a.nome, 'papel', a.papel, 'situacao', a.status, 'assinada_em', a.assinada_em) order by a.ordem)
                               from public.doc_assinaturas a
                              where a.documento_id = d.id and a.versao = d.versao and a.status in ('assinada', 'pendente')), '[]'::jsonb));
end $$;

-- Pessoas que podem ser escolhidas como signatárias
create or replace function public.doc_pessoas() returns table (id uuid, nome text, role text, unidade_id uuid)
language sql stable security definer set search_path = public as $$
  select u.id, coalesce(nullif(trim(u.nome), ''), u.email), u.role, u.unidade_id
    from public.usuarios u
   where coalesce(u.ativo, true) and u.role is not null and u.role <> 'viewer'
     and public.gc_role() not in ('viewer', 'sem_acesso')
   order by 2
$$;

-- Tipo de contratação do processo (define o checklist de artefatos da Lei 14.133/2021)
create or replace function public.tr_definir_contratacao(p_id uuid, p_modalidade text, p_objeto text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.tr_processos%rowtype;
begin
  select * into v_p from public.tr_processos where id = p_id for update;
  if not found then raise exception 'Processo não encontrado.' using errcode = 'P0002'; end if;
  if not public.tr_pode_atuar(p_id) then
    raise exception 'Somente a unidade onde o processo está pode alterá-lo.' using errcode = '42501';
  end if;
  if p_modalidade is not null and p_modalidade not in ('pregao', 'concorrencia', 'dispensa', 'inexigibilidade', 'adesao-ata') then
    raise exception 'Forma de contratação inválida.';
  end if;
  if p_objeto is not null and p_objeto not in ('bens-consumo', 'bens-permanentes', 'servicos-comuns',
       'servicos-continuos-demo', 'tic', 'obras-engenharia', 'locacao') then
    raise exception 'Tipo de objeto inválido.';
  end if;
  update public.tr_processos set contratacao_modalidade = p_modalidade, contratacao_objeto = p_objeto, updated_at = now() where id = p_id;
  insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, despacho, criada_por)
    values (p_id, 'alteracao', v_p.unidade_atual,
            'Tipo de contratação definido: ' || coalesce(p_modalidade, '—') || ' / ' || coalesce(p_objeto, '—') || '.', auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------
revoke all on function public.doc_hash(text, text, jsonb), public.doc_pode_ver(uuid), public.doc_pode_editar(uuid),
  public.doc_proximo_numero(text), public.doc_registrar_no_processo(uuid, text),
  public.doc_criar(text, text, int, text, uuid, jsonb, jsonb), public.doc_salvar(uuid, text, jsonb, jsonb),
  public.doc_enviar_assinatura(uuid, jsonb), public.doc_assinar(uuid), public.doc_recusar(uuid, text),
  public.doc_cancelar(uuid, text), public.doc_verificar(text), public.doc_pessoas(),
  public.tr_definir_contratacao(uuid, text, text) from public, anon;
grant execute on function public.doc_pode_ver(uuid), public.doc_pode_editar(uuid), public.doc_hash(text, text, jsonb),
  public.doc_criar(text, text, int, text, uuid, jsonb, jsonb), public.doc_salvar(uuid, text, jsonb, jsonb),
  public.doc_enviar_assinatura(uuid, jsonb), public.doc_assinar(uuid), public.doc_recusar(uuid, text),
  public.doc_cancelar(uuid, text), public.doc_pessoas(), public.tr_definir_contratacao(uuid, text, text) to authenticated;
-- a conferência é pública (a página /verificar abre sem login)
grant execute on function public.doc_verificar(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Atualização automática das telas (Realtime)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array['doc_documentos', 'doc_assinaturas'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

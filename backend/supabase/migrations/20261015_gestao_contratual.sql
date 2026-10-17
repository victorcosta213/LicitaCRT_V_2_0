-- =====================================================================
-- PLATAFORMA DE GESTÃO CONTRATUAL E FINANCEIRA — CRT-08
-- Migration: tabelas gc_* (cadastro mestre, OS, competências, financeiro,
-- eventos, ocorrências, dossiê SEI, pendências, parâmetros e auditoria).
--
-- Como aplicar: Supabase > SQL Editor > colar este arquivo > Run.
-- É idempotente (pode ser executado mais de uma vez).
-- Não altera as tabelas existentes (processos, contratos, usuarios, ...).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfis
--    usuarios.role passa a aceitar: admin | compras | gestor | fiscal |
--    financeiro | editor (legado, tratado como compras) | viewer
-- ---------------------------------------------------------------------
create or replace function public.gc_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when role = 'editor' then 'compras' else role end
       from public.usuarios
      where id = auth.uid() and coalesce(ativo, true)),
    'viewer')
$$;

create or replace function public.gc_tem_papel(papeis text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.gc_role() = 'admin' or public.gc_role() = any (papeis)
$$;

-- ---------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.gc_contratos (
  id                  uuid primary key default gen_random_uuid(),
  id_interno          bigint generated always as identity,
  legacy_id           text unique,

  -- identificação
  numero              text not null,
  sei_processo        text,
  sei_link            text,
  contratada          text not null,
  cnpj                text,
  objeto              text not null,
  unidade_demandante  text,
  tipo_contrato       text,
  modalidade          text,
  numero_licitacao    text,
  fundamento          text,
  responsavel_contratacao text,

  -- vigência
  data_assinatura     date,
  vigencia_inicio     date,
  vigencia_fim        date,
  prazo_execucao_dias integer,
  prorrogavel         boolean not null default false,
  limite_prorrogacao  date,
  situacao            text not null default 'em_cadastro'
    check (situacao in ('em_cadastro','ativo','suspenso','em_prorrogacao','em_encerramento','encerrado')),

  -- valores
  valor_inicial       numeric(15,2) not null default 0,
  valor_anual_estimado numeric(15,2),
  forma_pagamento     text,
  periodicidade       text,
  indice_reajuste     text,
  data_base_reajuste  date,

  -- designação
  portaria_sei        text,
  portaria_data       date,

  -- garantia
  exige_garantia      boolean not null default false,
  garantia_modalidade text,
  garantia_valor      numeric(15,2),
  garantia_inicio     date,
  garantia_vencimento date,
  garantia_situacao   text,

  -- validação pela gestão
  validado_gestao     boolean not null default false,
  validado_em         timestamptz,
  validado_por        uuid,

  cancelado           boolean not null default false,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);
create index if not exists gc_contratos_situacao_idx on public.gc_contratos (situacao);
create index if not exists gc_contratos_fim_idx on public.gc_contratos (vigencia_fim);

create table if not exists public.gc_responsaveis (
  id          uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.gc_contratos(id),
  usuario_id  uuid,   -- usuarios.id quando o responsável tem acesso próprio
  nome        text not null,
  email       text,
  papel       text not null check (papel in
    ('gestor_titular','gestor_substituto','fiscal_tecnico','fiscal_administrativo','fiscal_substituto')),
  ativo       boolean not null default true,
  sei_documento text,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index if not exists gc_responsaveis_contrato_idx on public.gc_responsaveis (contrato_id);
create index if not exists gc_responsaveis_usuario_idx on public.gc_responsaveis (usuario_id);

create table if not exists public.gc_ordens_servico (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references public.gc_contratos(id),
  status       text not null default 'solicitada'
    check (status in ('solicitada','em_conferencia','emitida','aguardando_ciencia','vigente','concluida','cancelada')),

  -- solicitação (Compras)
  solicitante_id      uuid,
  solicitante_nome    text,
  data_solicitacao    date not null default current_date,
  sei_processo        text,
  sei_documento_solic text,
  observacoes         text,

  -- conferência / emissão (Gestão)
  conferencia         jsonb,
  numero_os           text,
  data_emissao        date,
  objeto_autorizado   text,
  periodo_inicio      date,
  periodo_fim         date,
  valor               numeric(15,2),
  data_prevista_inicio date,
  data_efetiva_inicio  date,
  gestor_nome         text,
  fiscal_nome         text,
  preposto_nome       text,
  data_ciencia        date,
  sei_documento       text,
  sei_link            text,

  cancelado    boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
create index if not exists gc_os_contrato_idx on public.gc_ordens_servico (contrato_id);

create table if not exists public.gc_competencias (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.gc_contratos(id),
  competencia   date not null,                       -- sempre dia 1 do mês
  fiscal_id     uuid,
  fiscal_nome   text,

  -- fiscalização
  relatorio_recebido  boolean not null default false,
  relatorio_data      date,
  execucao_regular    boolean,
  medicao_realizada   boolean not null default false,
  valor_medido        numeric(15,2),
  houve_ocorrencia    boolean not null default false,
  houve_descumprimento boolean not null default false,
  obs_fiscal          text,
  sei_relatorio       text,
  sei_link_relatorio  text,

  -- documentação da contratada
  nf_recebida         boolean not null default false,
  nf_numero           text,
  nf_data             date,
  nf_valor_bruto      numeric(15,2),
  certidoes_verificadas boolean not null default false,
  doc_trabalhista_ok  boolean not null default false,
  doc_completa        boolean not null default false,

  -- glosa
  houve_glosa         boolean not null default false,
  glosa_motivo        text,
  glosa_valor         numeric(15,2),

  -- atesto
  atestado            boolean not null default false,
  atesto_responsavel  text,
  atesto_data         date,
  sei_atesto          text,

  -- encaminhamento financeiro
  liberado_financeiro boolean not null default false,
  liberado_data       date,
  liberado_por        text,
  sei_despacho        text,

  suspensa            boolean not null default false,
  observacoes         text,
  cancelado           boolean not null default false,

  valor_liquido numeric(15,2) generated always as
    (coalesce(nf_valor_bruto, valor_medido, 0) - coalesce(glosa_valor, 0)) stored,

  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (contrato_id, competencia)
);

create table if not exists public.gc_empenhos (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.gc_contratos(id),
  numero        text not null,
  exercicio     integer not null,
  data          date,
  valor_inicial numeric(15,2) not null default 0,
  fonte_dotacao text,
  sei_documento text,
  sei_link      text,
  observacao    text,
  cancelado     boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  unique (contrato_id, numero, exercicio)
);

create table if not exists public.gc_empenho_movs (
  id          uuid primary key default gen_random_uuid(),
  empenho_id  uuid not null references public.gc_empenhos(id),
  contrato_id uuid not null references public.gc_contratos(id),
  tipo        text not null check (tipo in ('reforco','anulacao')),
  valor       numeric(15,2) not null check (valor > 0),
  data        date,
  sei_documento text,
  observacao  text,
  cancelado   boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.gc_execucoes (
  id              uuid primary key default gen_random_uuid(),
  contrato_id     uuid not null references public.gc_contratos(id),
  competencia_id  uuid not null references public.gc_competencias(id),
  empenho_id      uuid references public.gc_empenhos(id),
  valor_competencia numeric(15,2) not null default 0,
  data_liquidacao date,
  valor_liquidado numeric(15,2),
  data_pagamento  date,
  valor_pago      numeric(15,2),
  retencao        numeric(15,2),
  suspenso        boolean not null default false,
  observacoes     text,
  sei_documento   text,
  sei_link        text,
  cancelado       boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  unique (competencia_id)
);

create table if not exists public.gc_eventos (
  id               uuid primary key default gen_random_uuid(),
  contrato_id      uuid not null references public.gc_contratos(id),
  tipo             text not null check (tipo in
    ('termo_aditivo','apostilamento','reajuste','repactuacao','reequilibrio','prorrogacao',
     'acrescimo','supressao','suspensao','alteracao_responsavel','alteracao_garantia',
     'encerramento','outros')),
  data_solicitacao date,
  data_evento      date,
  responsavel      text,
  situacao         text not null default 'solicitado'
    check (situacao in ('solicitado','em_analise','concluido','cancelado')),
  valor_anterior   numeric(15,2),
  valor_posterior  numeric(15,2),
  vigencia_anterior date,
  vigencia_posterior date,
  sei_documento    text,
  sei_link         text,
  observacao       text,
  cancelado        boolean not null default false,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
create index if not exists gc_eventos_contrato_idx on public.gc_eventos (contrato_id);

create table if not exists public.gc_ocorrencias (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references public.gc_contratos(id),
  competencia_id uuid references public.gc_competencias(id),
  data           date not null default current_date,
  tipo           text not null check (tipo in
    ('atraso','execucao_irregular','descumprimento','ausencia_empregado',
     'entrega_desconforme','notificacao','glosa','advertencia','solicitacao_correcao','outros')),
  fiscal_nome    text,
  descricao      text not null,
  providencia    text,
  prazo_concedido date,
  resposta_contratada text,
  resultado      text,
  status         text not null default 'aberta'
    check (status in ('aberta','aguardando_contratada','em_analise','regularizada',
                      'encaminhada_apuracao','encerrada')),
  sei_documentos text,
  cancelado      boolean not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
create index if not exists gc_ocorrencias_contrato_idx on public.gc_ocorrencias (contrato_id);

create table if not exists public.gc_documentos (
  id          uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.gc_contratos(id),
  tipo        text not null,
  numero_sei  text,
  data        date,
  link        text,
  descricao   text,
  cancelado   boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index if not exists gc_documentos_contrato_idx on public.gc_documentos (contrato_id);

create table if not exists public.gc_pendencias (
  id          uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.gc_contratos(id),
  descricao   text not null,
  prazo       date,
  perfil_responsavel text,
  status      text not null default 'aberta' check (status in ('aberta','concluida','cancelada')),
  cancelado   boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.gc_parametros (
  chave       text primary key,
  valor       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.gc_auditoria (
  id           bigint generated always as identity primary key,
  em           timestamptz not null default now(),
  tabela       text not null,
  registro_id  uuid,
  contrato_id  uuid,
  acao         text not null,
  usuario_id   uuid,
  usuario_nome text,
  antes        jsonb,
  depois       jsonb
);
create index if not exists gc_auditoria_contrato_idx on public.gc_auditoria (contrato_id, em desc);

-- ---------------------------------------------------------------------
-- 3. Visibilidade: o fiscal só enxerga contratos em que está designado
-- ---------------------------------------------------------------------
create or replace function public.gc_pode_ver(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.gc_role() = 'fiscal' then exists (
      select 1 from public.gc_responsaveis r
       where r.contrato_id = p_contrato and r.usuario_id = auth.uid() and r.ativo)
    else true
  end
$$;

-- ---------------------------------------------------------------------
-- 4. Triggers: carimbo de usuário/data, auditoria e bloqueio de exclusão
-- ---------------------------------------------------------------------
create or replace function public.gc_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create or replace function public.gc_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_reg uuid; v_contrato uuid; v_nome text;
begin
  v_old := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new := to_jsonb(new);
  if tg_op = 'UPDATE'
     and (v_old - 'updated_at' - 'updated_by') = (v_new - 'updated_at' - 'updated_by') then
    return new;
  end if;
  v_reg := (v_new ->> 'id')::uuid;
  v_contrato := case when tg_table_name = 'gc_contratos' then v_reg
                     else (v_new ->> 'contrato_id')::uuid end;
  select coalesce(nome, email) into v_nome from public.usuarios where id = auth.uid();
  insert into public.gc_auditoria (tabela, registro_id, contrato_id, acao, usuario_id, usuario_nome, antes, depois)
  values (tg_table_name, v_reg, v_contrato, tg_op, auth.uid(), v_nome, v_old, v_new);
  return new;
end $$;

create or replace function public.gc_no_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Registros da gestão contratual não podem ser excluídos. Marque como cancelado para preservar o histórico.';
end $$;

-- Compras só altera o cadastro enquanto a gestão não validou
create or replace function public.gc_guard_contrato() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and public.gc_role() = 'compras' and old.validado_gestao then
    raise exception 'Contrato já validado pela gestão: alteração permitida apenas ao gestor.';
  end if;
  if public.gc_role() = 'compras' and new.validado_gestao and not coalesce(old.validado_gestao, false) then
    raise exception 'A validação do cadastro é atribuição da gestão do contrato.';
  end if;
  return new;
end $$;

-- Compras só mexe na OS enquanto estiver apenas solicitada
create or replace function public.gc_guard_os() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and public.gc_role() = 'compras' and old.status <> 'solicitada' then
    raise exception 'A OS já está em tratamento pela gestão.';
  end if;
  if tg_op = 'INSERT' and public.gc_role() = 'compras' and new.status <> 'solicitada' then
    raise exception 'Compras só pode registrar a solicitação da OS.';
  end if;
  return new;
end $$;

-- Fiscal só altera os campos de fiscalização da competência
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
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['gc_contratos','gc_responsaveis','gc_ordens_servico','gc_competencias',
                           'gc_empenhos','gc_empenho_movs','gc_execucoes','gc_eventos',
                           'gc_ocorrencias','gc_documentos','gc_pendencias'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before insert or update on public.%I
                    for each row execute function public.gc_touch()', t);
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update on public.%I
                    for each row execute function public.gc_audit()', t);
    execute format('drop trigger if exists trg_no_delete on public.%I', t);
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function public.gc_no_delete()', t);
  end loop;
end $$;

drop trigger if exists trg_guard on public.gc_contratos;
create trigger trg_guard before insert or update on public.gc_contratos
  for each row execute function public.gc_guard_contrato();
drop trigger if exists trg_guard on public.gc_ordens_servico;
create trigger trg_guard before insert or update on public.gc_ordens_servico
  for each row execute function public.gc_guard_os();
drop trigger if exists trg_guard on public.gc_competencias;
create trigger trg_guard before update on public.gc_competencias
  for each row execute function public.gc_guard_competencia();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
--    Leitura: todo usuário autenticado (fiscal: só seus contratos).
--    Escrita: por perfil. Não há política de DELETE.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  col text;
begin
  for r in select * from (values
    ('gc_contratos',     '{compras,gestor}',            '{compras,gestor}'),
    ('gc_responsaveis',  '{gestor}',                    '{gestor}'),
    ('gc_ordens_servico','{compras,gestor}',            '{compras,gestor}'),
    ('gc_competencias',  '{gestor}',                    '{fiscal,gestor}'),
    ('gc_empenhos',      '{financeiro}',                '{financeiro}'),
    ('gc_empenho_movs',  '{financeiro}',                '{financeiro}'),
    ('gc_execucoes',     '{financeiro}',                '{financeiro}'),
    ('gc_eventos',       '{gestor}',                    '{gestor}'),
    ('gc_ocorrencias',   '{fiscal,gestor}',             '{fiscal,gestor}'),
    ('gc_documentos',    '{compras,gestor,fiscal,financeiro}', '{compras,gestor,fiscal,financeiro}'),
    ('gc_pendencias',    '{gestor}',                    '{gestor}')
  ) as v(tabela, ins, upd) loop
    col := case when r.tabela = 'gc_contratos' then 'id' else 'contrato_id' end;
    execute format('alter table public.%I enable row level security', r.tabela);
    execute format('drop policy if exists gc_sel on public.%I', r.tabela);
    execute format('drop policy if exists gc_ins on public.%I', r.tabela);
    execute format('drop policy if exists gc_upd on public.%I', r.tabela);
    execute format('create policy gc_sel on public.%I for select to authenticated using (public.gc_pode_ver(%I))',
                   r.tabela, col);
    execute format('create policy gc_ins on public.%I for insert to authenticated
                    with check (public.gc_tem_papel(%L::text[]))', r.tabela, r.ins);
    execute format('create policy gc_upd on public.%I for update to authenticated
                    using (public.gc_tem_papel(%L::text[]) and public.gc_pode_ver(%I))
                    with check (public.gc_tem_papel(%L::text[]))', r.tabela, r.upd, col, r.upd);
  end loop;
end $$;

alter table public.gc_auditoria enable row level security;
drop policy if exists gc_sel on public.gc_auditoria;
create policy gc_sel on public.gc_auditoria for select to authenticated
  using (contrato_id is not null and public.gc_pode_ver(contrato_id));

alter table public.gc_parametros enable row level security;
drop policy if exists gc_sel on public.gc_parametros;
drop policy if exists gc_ins on public.gc_parametros;
drop policy if exists gc_upd on public.gc_parametros;
create policy gc_sel on public.gc_parametros for select to authenticated using (true);
create policy gc_ins on public.gc_parametros for insert to authenticated
  with check (public.gc_role() = 'admin');
create policy gc_upd on public.gc_parametros for update to authenticated
  using (public.gc_role() = 'admin') with check (public.gc_role() = 'admin');

-- ---------------------------------------------------------------------
-- 6. Parâmetros padrão
-- ---------------------------------------------------------------------
insert into public.gc_parametros (chave, valor) values
  ('alerta_vigencia_dias',  '[120,90,60,30]'),
  ('alerta_garantia_dias',  '[60,30]'),
  ('alerta_reajuste_dias',  '[60,30]'),
  ('prazo_competencia_dias','10'),
  ('atesto_por',            '"fiscal"'),
  ('tipos_contrato',        '["Serviço continuado","Fornecimento","Obra / engenharia","TIC / software","Locação","Outros"]'),
  ('modalidades',           '["Pregão eletrônico","Concorrência","Dispensa","Inexigibilidade","Adesão a ata","Outra"]'),
  ('indices_reajuste',      '["IPCA","IGP-M","INPC","ICTI","Convenção coletiva","Outro"]')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------
-- 7. Importação dos contratos da tabela legada "contratos" (se existir)
--    Aceita colunas em snake_case ou camelCase. Idempotente via legacy_id.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.contratos') is not null then
    insert into public.gc_contratos
      (legacy_id, numero, contratada, objeto, sei_processo, data_assinatura,
       vigencia_inicio, vigencia_fim, valor_inicial, situacao, validado_gestao)
    select
      j->>'id',
      coalesce(nullif(j->>'numero',''), 'S/N'),
      coalesce(nullif(j->>'fornecedor',''), 'Não informado'),
      coalesce(nullif(j->>'objeto',''), 'Não informado'),
      coalesce(j->>'processo_origem', j->>'processoOrigem'),
      nullif(coalesce(j->>'data_assinatura', j->>'dataAssinatura'), '')::date,
      nullif(coalesce(j->>'data_assinatura', j->>'dataAssinatura'), '')::date,
      nullif(coalesce(j->>'data_vencimento', j->>'dataVencimento'), '')::date,
      case when coalesce(j->>'valor','') ~ '^[0-9.,]+$'
           then replace(replace(j->>'valor', '.', ''), ',', '.')::numeric
           else 0 end,
      'ativo',
      false
    from (select to_jsonb(c) as j from public.contratos c) s
    where j->>'id' is not null
    on conflict (legacy_id) do nothing;
  end if;
exception when others then
  raise notice 'Importação de contratos legados ignorada: %', sqlerrm;
end $$;

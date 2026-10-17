-- =====================================================================
-- FLUXO FUNCIONAL — Compras → Gestão → Fiscal → Gestão → Financeiro
-- Aplicar depois de 20261017 (Supabase > SQL Editor > Run). Idempotente.
--
--  1. Contratação: instrumento, dados da contratada, encaminhamento de Compras,
--     portaria, termo de ciência e fiscal substituto em atuação.
--  2. OS/OC: tipo, assinaturas (Presidente + Diretor Financeiro) e envio.
--  3. Competência: NF, fiscalização, glosa e atesto passam ao FISCAL;
--     a Gestão confere, devolve ou libera ao Financeiro.
--  4. Perfil Gabinete (portaria e assinatura de OS/OC).
--  5. Cancelamento sempre com justificativa.
--  6. Fila de e-mails de tarefas (enviados pela função enviar-notificacoes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Novas colunas
-- ---------------------------------------------------------------------
do $$
begin
  -- encaminhamento: contratações já existentes contam como encaminhadas (uma única vez)
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'gc_contratos' and column_name = 'encaminhado_em') then
    alter table public.gc_contratos add column encaminhado_em timestamptz;
    update public.gc_contratos set encaminhado_em = created_at;
  end if;
  -- portaria: as já registradas (nº SEI informado) contam como publicadas (uma única vez)
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'gc_contratos' and column_name = 'portaria_status') then
    alter table public.gc_contratos add column portaria_status text
      check (portaria_status in ('rascunho', 'aguardando_publicacao', 'publicada'));
    alter table public.gc_contratos add column portaria_publicacao_data date;
    update public.gc_contratos
       set portaria_status = 'publicada', portaria_publicacao_data = portaria_data
     where portaria_sei is not null;
  end if;
  -- contratações que já estavam em execução antes da plataforma (as importadas da
  -- tabela legada) não refazem portaria/termo/OS: seguem direto para a execução
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'gc_contratos' and column_name = 'execucao_anterior') then
    alter table public.gc_contratos add column execucao_anterior boolean not null default false;
    update public.gc_contratos set execucao_anterior = true where legacy_id is not null;
  end if;
end $$;

alter table public.gc_contratos add column if not exists instrumento text not null default 'contrato'
  check (instrumento in ('contrato', 'nota_empenho', 'outro'));
alter table public.gc_contratos add column if not exists empenho_referencia       text;
alter table public.gc_contratos add column if not exists contratada_endereco      text;
alter table public.gc_contratos add column if not exists contratada_representante text;
alter table public.gc_contratos add column if not exists contratada_email         text;
alter table public.gc_contratos add column if not exists encaminhado_por          uuid;
alter table public.gc_contratos add column if not exists portaria_numero          text;
alter table public.gc_contratos add column if not exists portaria_publicacao_meio text;
alter table public.gc_contratos add column if not exists portaria_sei_link        text;
alter table public.gc_contratos add column if not exists termo_sei                text;
alter table public.gc_contratos add column if not exists termo_sei_link           text;
alter table public.gc_contratos add column if not exists substituto_em_atuacao    boolean not null default false;
alter table public.gc_contratos add column if not exists substituto_desde         date;

alter table public.gc_responsaveis add column if not exists ciente_em date;   -- termo de ciência e aceite

alter table public.gc_ordens_servico add column if not exists tipo text not null default 'os'
  check (tipo in ('os', 'oc'));
alter table public.gc_ordens_servico add column if not exists local_execucao           text;
alter table public.gc_ordens_servico add column if not exists assinatura_presidente_em date;
alter table public.gc_ordens_servico add column if not exists assinatura_diretor_em    date;
alter table public.gc_ordens_servico add column if not exists envio_data               date;
alter table public.gc_ordens_servico add column if not exists envio_meio               text;
alter table public.gc_ordens_servico add column if not exists envio_comprovante        text;
alter table public.gc_ordens_servico drop constraint if exists gc_ordens_servico_status_check;
alter table public.gc_ordens_servico add constraint gc_ordens_servico_status_check check (status in
  ('solicitada', 'em_conferencia', 'aguardando_assinatura', 'emitida', 'aguardando_ciencia',
   'vigente', 'concluida', 'cancelada'));

alter table public.gc_competencias add column if not exists nf_recebimento_data date;
alter table public.gc_competencias add column if not exists execucao_realizada  boolean;
alter table public.gc_competencias add column if not exists conforme_contrato   boolean;
alter table public.gc_competencias add column if not exists quantidade_adequada text
  check (quantidade_adequada in ('sim', 'nao', 'na'));
alter table public.gc_competencias add column if not exists qualidade_adequada  boolean;
alter table public.gc_competencias add column if not exists prazo_cumprido      boolean;
alter table public.gc_competencias add column if not exists glosa_obs           text;
alter table public.gc_competencias add column if not exists sei_link_atesto     text;
alter table public.gc_competencias add column if not exists devolucao_motivo    text;
alter table public.gc_competencias add column if not exists devolvido_em        timestamptz;

-- ---------------------------------------------------------------------
-- 2. Perfil Gabinete
-- ---------------------------------------------------------------------
alter table public.usuarios drop constraint if exists usuarios_role_valido;
alter table public.usuarios add constraint usuarios_role_valido check (role is null or role in
  ('admin', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'editor', 'viewer')) not valid;

-- ---------------------------------------------------------------------
-- 3. Funções de apoio
-- ---------------------------------------------------------------------
-- Gabinete vê apenas as contratações com ato aguardando sua atuação
create or replace function public.gc_pode_ver(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.gc_role() = 'sem_acesso' then false
    when public.gc_role() = 'fiscal' then exists (
      select 1 from public.gc_responsaveis r
       where r.contrato_id = p_contrato and r.usuario_id = auth.uid() and r.ativo)
    when public.gc_role() = 'gabinete' then
      exists (select 1 from public.gc_contratos c
               where c.id = p_contrato and c.portaria_status = 'aguardando_publicacao')
      or exists (select 1 from public.gc_ordens_servico o
                  where o.contrato_id = p_contrato and o.status = 'aguardando_assinatura' and not o.cancelado)
    else true
  end
$$;

-- Fiscalização formalizada = portaria publicada + titular e substituto designados
-- + termo de ciência registrado para gestor(a) e fiscais
create or replace function public.gc_fiscalizacao_formalizada(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select c.portaria_status = 'publicada' from public.gc_contratos c where c.id = p_contrato), false)
     and exists (select 1 from public.gc_responsaveis r
                  where r.contrato_id = p_contrato and r.ativo and r.papel = 'fiscal_tecnico')
     and exists (select 1 from public.gc_responsaveis r
                  where r.contrato_id = p_contrato and r.ativo and r.papel = 'fiscal_substituto')
     and not exists (select 1 from public.gc_responsaveis r
                      where r.contrato_id = p_contrato and r.ativo and r.ciente_em is null
                        and r.papel in ('gestor_titular', 'fiscal_tecnico', 'fiscal_substituto'))
$$;

-- O fiscal pode praticar atos na contratação? (titular sempre; substituto só em atuação)
create or replace function public.gc_fiscal_pode_operar(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.gc_role() <> 'fiscal' or exists (
    select 1 from public.gc_responsaveis r
      join public.gc_contratos c on c.id = r.contrato_id
     where r.contrato_id = p_contrato and r.usuario_id = auth.uid() and r.ativo
       and r.papel like 'fiscal%'
       and (r.papel <> 'fiscal_substituto' or c.substituto_em_atuacao))
$$;

-- Quem recebe as tarefas do fiscal agora (titular, ou substituto em atuação)
create or replace function public.gc_fiscais_em_atuacao(p_contrato uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select r.usuario_id
    from public.gc_responsaveis r
    join public.gc_contratos c on c.id = r.contrato_id
   where r.contrato_id = p_contrato and r.ativo and r.usuario_id is not null
     and r.papel = case when c.substituto_em_atuacao then 'fiscal_substituto' else 'fiscal_tecnico' end
$$;

-- ---------------------------------------------------------------------
-- 4. Regras de negócio no banco (triggers)
-- ---------------------------------------------------------------------
create or replace function public.gc_guard_contrato() returns trigger
language plpgsql as $$
declare
  papel text := public.gc_role();
  faltas text[] := '{}';
begin
  if papel = 'compras' then
    if tg_op = 'UPDATE' and old.validado_gestao then
      raise exception 'Contrato já validado pela gestão: alteração permitida apenas ao gestor.';
    end if;
    if tg_op = 'UPDATE' and old.encaminhado_em is not null then
      raise exception 'Contratação já encaminhada à Gestão: Compras mantém apenas a consulta.';
    end if;
    if new.validado_gestao and not coalesce(old.validado_gestao, false) then
      raise exception 'A validação do cadastro é atribuição da gestão do contrato.';
    end if;
    if new.situacao <> 'em_cadastro' then
      raise exception 'A situação da contratação é definida pela Gestão.';
    end if;
    if new.execucao_anterior then
      raise exception 'Somente a Gestão marca uma contratação como já em execução.';
    end if;
  end if;

  -- Encaminhamento de Compras: dados mínimos da contratação
  if new.encaminhado_em is not null and (tg_op = 'INSERT' or old.encaminhado_em is null) then
    if coalesce(btrim(new.numero), '') = '' then faltas := array_append(faltas, 'nº do instrumento'); end if;
    if coalesce(btrim(new.sei_processo), '') = '' then faltas := array_append(faltas, 'processo SEI'); end if;
    if coalesce(btrim(new.contratada), '') = '' then faltas := array_append(faltas, 'contratada'); end if;
    if coalesce(btrim(new.objeto), '') = '' then faltas := array_append(faltas, 'objeto'); end if;
    if coalesce(new.valor_inicial, 0) <= 0 then faltas := array_append(faltas, 'valor'); end if;
    if new.vigencia_fim is null and new.prazo_execucao_dias is null then
      faltas := array_append(faltas, 'vigência ou prazo de execução');
    end if;
    if array_length(faltas, 1) > 0 then
      raise exception 'Para encaminhar à Gestão, preencha: %.', array_to_string(faltas, ', ');
    end if;
  end if;

  -- Portaria de designação
  if new.portaria_status is distinct from (case when tg_op = 'UPDATE' then old.portaria_status end) then
    if new.portaria_status in ('aguardando_publicacao', 'publicada') and not (
         exists (select 1 from public.gc_responsaveis r
                  where r.contrato_id = new.id and r.ativo and r.papel = 'fiscal_tecnico')
         and exists (select 1 from public.gc_responsaveis r
                      where r.contrato_id = new.id and r.ativo and r.papel = 'fiscal_substituto')) then
      raise exception 'Designe o fiscal titular e o fiscal substituto antes de encaminhar a portaria.';
    end if;
    if new.portaria_status = 'publicada'
       and (coalesce(btrim(new.portaria_numero), '') = '' or new.portaria_data is null or new.portaria_publicacao_data is null) then
      raise exception 'Para registrar a publicação, informe o nº da portaria, a data e a data de publicação.';
    end if;
  end if;
  return new;
end $$;

create or replace function public.gc_guard_os() returns trigger
language plpgsql as $$
declare papel text := public.gc_role();
begin
  if tg_op = 'UPDATE' and papel = 'compras' and old.status <> 'solicitada' then
    raise exception 'A OS já está em tratamento pela gestão.';
  end if;
  if tg_op = 'INSERT' and papel = 'compras' and new.status <> 'solicitada' then
    raise exception 'Compras só pode registrar a solicitação da OS.';
  end if;
  if tg_op = 'INSERT' and new.status not in ('solicitada', 'em_conferencia') then
    raise exception 'Uma OS/OC nova começa como solicitada ou rascunho.';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('aguardando_assinatura', 'emitida', 'aguardando_ciencia', 'vigente')
       and old.status in ('solicitada', 'em_conferencia')
       and not public.gc_fiscalizacao_formalizada(new.contrato_id) then
      raise exception 'A OS/OC só segue para assinatura com a fiscalização formalizada (portaria publicada e termo de ciência registrado).';
    end if;
    if new.status = 'emitida' and (new.assinatura_presidente_em is null or new.assinatura_diretor_em is null) then
      raise exception 'Registre as assinaturas do Presidente e do Diretor Financeiro.';
    end if;
    if new.status = 'aguardando_ciencia' and (new.envio_data is null or coalesce(btrim(new.envio_meio), '') = '') then
      raise exception 'Informe a data e o meio de envio à contratada.';
    end if;
    if new.status = 'vigente' and (new.data_ciencia is null or new.data_efetiva_inicio is null) then
      raise exception 'Informe a data de recebimento pela contratada e o início da execução.';
    end if;
  end if;
  return new;
end $$;

-- Competência: o fiscal registra NF, fiscalização, glosa, documentação e atesto;
-- a Gestão confere, devolve ao fiscal ou libera ao Financeiro.
create or replace function public.gc_guard_competencia() returns trigger
language plpgsql as $$
declare papel text := public.gc_role();
begin
  if tg_op = 'INSERT' then
    if new.atestado or new.liberado_financeiro or new.suspensa then
      raise exception 'A competência começa sem atesto nem liberação.';
    end if;
    if papel = 'gestor' and (new.nf_recebida or new.relatorio_recebido or new.houve_glosa or new.doc_completa) then
      raise exception 'NF, fiscalização, glosa e atesto são registrados pelo fiscal. A Gestão acompanha e confere.';
    end if;
    return new;
  end if;

  if papel = 'fiscal' and (
       new.liberado_financeiro, new.liberado_data, new.liberado_por, new.sei_despacho, new.suspensa, new.cancelado
     ) is distinct from (
       old.liberado_financeiro, old.liberado_data, old.liberado_por, old.sei_despacho, old.suspensa, old.cancelado
     ) then
    raise exception 'A liberação ao Financeiro, a suspensão e o cancelamento da competência são atos da Gestão.';
  end if;

  if papel = 'gestor' then
    if (new.nf_recebida, new.nf_recebimento_data, new.nf_numero, new.nf_data, new.nf_valor_bruto,
        new.certidoes_verificadas, new.doc_trabalhista_ok, new.doc_completa,
        new.relatorio_recebido, new.relatorio_data, new.execucao_realizada, new.conforme_contrato,
        new.quantidade_adequada, new.qualidade_adequada, new.prazo_cumprido, new.execucao_regular,
        new.medicao_realizada, new.valor_medido, new.houve_descumprimento, new.obs_fiscal,
        new.sei_relatorio, new.sei_link_relatorio,
        new.houve_glosa, new.glosa_motivo, new.glosa_valor, new.glosa_obs,
        new.atesto_responsavel, new.atesto_data, new.sei_atesto, new.sei_link_atesto)
       is distinct from
       (old.nf_recebida, old.nf_recebimento_data, old.nf_numero, old.nf_data, old.nf_valor_bruto,
        old.certidoes_verificadas, old.doc_trabalhista_ok, old.doc_completa,
        old.relatorio_recebido, old.relatorio_data, old.execucao_realizada, old.conforme_contrato,
        old.quantidade_adequada, old.qualidade_adequada, old.prazo_cumprido, old.execucao_regular,
        old.medicao_realizada, old.valor_medido, old.houve_descumprimento, old.obs_fiscal,
        old.sei_relatorio, old.sei_link_relatorio,
        old.houve_glosa, old.glosa_motivo, old.glosa_valor, old.glosa_obs,
        old.atesto_responsavel, old.atesto_data, old.sei_atesto, old.sei_link_atesto) then
      raise exception 'NF, fiscalização, glosa e atesto são registrados pelo fiscal. A Gestão acompanha e confere.';
    end if;
    if new.atestado is distinct from old.atestado
       and (new.atestado or new.liberado_financeiro or coalesce(btrim(new.devolucao_motivo), '') = '') then
      raise exception 'A Gestão não atesta. Para devolver a competência ao fiscal, informe o motivo.';
    end if;
  end if;

  if new.atestado and not old.atestado
     and not (new.nf_recebida and new.relatorio_recebido and new.doc_completa) then
    raise exception 'O atesto exige NF registrada, fiscalização concluída e documentação conferida.';
  end if;
  if new.liberado_financeiro and not new.atestado then
    raise exception 'A competência precisa estar atestada antes de ser liberada ao financeiro.';
  end if;
  if new.liberado_financeiro and not old.liberado_financeiro then
    if exists (select 1 from public.gc_ocorrencias o
                where o.competencia_id = new.id and not o.cancelado
                  and o.status in ('aberta', 'aguardando_contratada', 'em_analise')) then
      raise exception 'Há ocorrência em aberto nesta competência: trate-a antes de liberar ao financeiro.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard on public.gc_competencias;
create trigger trg_guard before insert or update on public.gc_competencias
  for each row execute function public.gc_guard_competencia();

-- Financeiro só lança competências liberadas pela Gestão
create or replace function public.gc_guard_execucao() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.gc_competencias c
                  where c.id = new.competencia_id and c.liberado_financeiro and not c.cancelado) then
    raise exception 'O Financeiro só lança competências liberadas pela Gestão.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard on public.gc_execucoes;
create trigger trg_guard before insert or update on public.gc_execucoes
  for each row execute function public.gc_guard_execucao();

-- Cancelar exige justificativa (o registro permanece no histórico)
create or replace function public.gc_exigir_justificativa() returns trigger
language plpgsql as $$
begin
  if new.cancelado and not old.cancelado and coalesce(btrim(new.cancelamento_motivo), '') = '' then
    raise exception 'Informe a justificativa do cancelamento.';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['gc_contratos','gc_ordens_servico','gc_competencias',
                           'gc_empenhos','gc_empenho_movs','gc_execucoes','gc_eventos',
                           'gc_ocorrencias','gc_documentos','gc_pendencias'] loop
    execute format('alter table public.%I add column if not exists cancelamento_motivo text', t);
    execute format('drop trigger if exists trg_cancelamento on public.%I', t);
    execute format('create trigger trg_cancelamento before update on public.%I
                    for each row execute function public.gc_exigir_justificativa()', t);
  end loop;
end $$;

-- Gestor/fiscal não é cancelado, é desativado: a desativação também exige justificativa
alter table public.gc_responsaveis add column if not exists cancelamento_motivo text;
create or replace function public.gc_exigir_justificativa_inativacao() returns trigger
language plpgsql as $$
begin
  if old.ativo and not new.ativo and coalesce(btrim(new.cancelamento_motivo), '') = '' then
    raise exception 'Informe a justificativa da desativação.';
  end if;
  return new;
end $$;
drop trigger if exists trg_cancelamento on public.gc_responsaveis;
create trigger trg_cancelamento before update on public.gc_responsaveis
  for each row execute function public.gc_exigir_justificativa_inativacao();

-- Designação completa (titular + substituto) encerra a solicitação de Compras
create or replace function public.gc_apos_designacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.gc_responsaveis where contrato_id = new.contrato_id and ativo and papel = 'fiscal_tecnico')
     and exists (select 1 from public.gc_responsaveis where contrato_id = new.contrato_id and ativo and papel = 'fiscal_substituto') then
    update public.gc_pendencias set status = 'concluida'
     where contrato_id = new.contrato_id and status = 'aberta' and descricao like 'Designar fiscal titular%';
  end if;
  return new;
end $$;
drop trigger if exists trg_apos_designacao on public.gc_responsaveis;
create trigger trg_apos_designacao after insert or update on public.gc_responsaveis
  for each row execute function public.gc_apos_designacao();

-- ---------------------------------------------------------------------
-- 5. RLS: só quem enxerga a contratação grava nela; substituto só em atuação
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  t text;
begin
  for r in select * from (values
    ('gc_responsaveis',  '{gestor}'),
    ('gc_ordens_servico','{compras,gestor}'),
    ('gc_empenhos',      '{financeiro}'),
    ('gc_empenho_movs',  '{financeiro}'),
    ('gc_execucoes',     '{financeiro}'),
    ('gc_eventos',       '{gestor}'),
    ('gc_documentos',    '{compras,gestor,fiscal,financeiro}'),
    ('gc_pendencias',    '{gestor}')
  ) as v(tabela, papeis) loop
    execute format('drop policy if exists gc_ins on public.%I', r.tabela);
    execute format('create policy gc_ins on public.%I for insert to authenticated
                    with check (public.gc_tem_papel(%L::text[]) and public.gc_pode_ver(contrato_id))', r.tabela, r.papeis);
  end loop;

  foreach t in array array['gc_competencias', 'gc_ocorrencias'] loop
    execute format('drop policy if exists gc_ins on public.%I', t);
    execute format('drop policy if exists gc_upd on public.%I', t);
    execute format('create policy gc_ins on public.%I for insert to authenticated
                    with check (public.gc_tem_papel(''{fiscal,gestor}'') and public.gc_pode_ver(contrato_id)
                                and public.gc_fiscal_pode_operar(contrato_id))', t);
    execute format('create policy gc_upd on public.%I for update to authenticated
                    using (public.gc_tem_papel(''{fiscal,gestor}'') and public.gc_pode_ver(contrato_id)
                           and public.gc_fiscal_pode_operar(contrato_id))
                    with check (public.gc_tem_papel(''{fiscal,gestor}'') and public.gc_pode_ver(contrato_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Ações do fluxo (chamadas pela plataforma; validam o perfil)
-- ---------------------------------------------------------------------
-- Compras encaminha: gera a solicitação de designação dos fiscais e a de OS/OC
create or replace function public.gc_encaminhar_contratacao(p_contrato uuid, p_tipo_ordem text default 'os')
returns void language plpgsql security definer set search_path = public as $$
declare c public.gc_contratos;
begin
  if not public.gc_tem_papel('{compras}') then
    raise exception 'Somente Compras encaminha a contratação à Gestão.';
  end if;
  if p_tipo_ordem not in ('os', 'oc') then
    raise exception 'Tipo de ordem inválido (use os ou oc).';
  end if;
  select * into c from public.gc_contratos where id = p_contrato and not cancelado;
  if not found then
    raise exception 'Contratação não encontrada.';
  end if;
  if c.encaminhado_em is not null then
    raise exception 'Contratação já encaminhada à Gestão.';
  end if;

  update public.gc_contratos set encaminhado_em = now(), encaminhado_por = auth.uid() where id = p_contrato;
  insert into public.gc_pendencias (contrato_id, descricao, prazo, perfil_responsavel)
  values (p_contrato, 'Designar fiscal titular e fiscal substituto (solicitado por Compras)', current_date + 5, 'gestor');
  insert into public.gc_ordens_servico (contrato_id, tipo, status, solicitante_id, solicitante_nome, sei_processo, observacoes)
  values (p_contrato, p_tipo_ordem, 'solicitada', auth.uid(),
          (select coalesce(nome, email) from public.usuarios where id = auth.uid()),
          c.sei_processo, 'Solicitação gerada no encaminhamento da contratação por Compras.');
end $$;

-- Gestão ou Gabinete registra a publicação da portaria
create or replace function public.gc_registrar_publicacao_portaria(
  p_contrato uuid, p_numero text, p_data date, p_publicacao_data date,
  p_publicacao_meio text default null, p_sei text default null, p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.gc_tem_papel('{gestor,gabinete}') then
    raise exception 'Somente a Gestão ou o Gabinete registra a publicação da portaria.';
  end if;
  if public.gc_role() = 'gabinete' and not exists (
       select 1 from public.gc_contratos where id = p_contrato and portaria_status = 'aguardando_publicacao') then
    raise exception 'Esta portaria não está aguardando publicação.';
  end if;
  update public.gc_contratos
     set portaria_numero = p_numero, portaria_data = p_data,
         portaria_publicacao_data = p_publicacao_data, portaria_publicacao_meio = p_publicacao_meio,
         portaria_sei = coalesce(nullif(btrim(p_sei), ''), portaria_sei),
         portaria_sei_link = coalesce(nullif(btrim(p_link), ''), portaria_sei_link),
         portaria_status = 'publicada'
   where id = p_contrato;
end $$;

-- Gestão ou Gabinete registra as assinaturas da OS/OC (Presidente + Diretor Financeiro)
create or replace function public.gc_registrar_assinatura_os(
  p_os uuid, p_presidente date, p_diretor date, p_sei text default null, p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.gc_ordens_servico;
begin
  if not public.gc_tem_papel('{gestor,gabinete}') then
    raise exception 'Somente a Gestão ou o Gabinete registra as assinaturas.';
  end if;
  select * into o from public.gc_ordens_servico where id = p_os and not cancelado;
  if not found or o.status <> 'aguardando_assinatura' then
    raise exception 'Esta OS/OC não está aguardando assinatura.';
  end if;
  update public.gc_ordens_servico
     set assinatura_presidente_em = coalesce(p_presidente, assinatura_presidente_em),
         assinatura_diretor_em = coalesce(p_diretor, assinatura_diretor_em),
         sei_documento = coalesce(nullif(btrim(p_sei), ''), sei_documento),
         sei_link = coalesce(nullif(btrim(p_link), ''), sei_link),
         status = case when coalesce(p_presidente, assinatura_presidente_em) is not null
                        and coalesce(p_diretor, assinatura_diretor_em) is not null
                       then 'emitida' else status end
   where id = p_os;
end $$;

-- "Fiscal substituto em atuação": Gestão ou os próprios fiscais da contratação
create or replace function public.gc_definir_substituto_em_atuacao(p_contrato uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.gc_tem_papel('{gestor}') or (public.gc_role() = 'fiscal' and exists (
            select 1 from public.gc_responsaveis r
             where r.contrato_id = p_contrato and r.usuario_id = auth.uid() and r.ativo
               and r.papel in ('fiscal_tecnico', 'fiscal_substituto')))) then
    raise exception 'Somente a Gestão ou os fiscais da contratação alteram o fiscal em atuação.';
  end if;
  if p_ativo and not exists (select 1 from public.gc_responsaveis r
                              where r.contrato_id = p_contrato and r.ativo and r.papel = 'fiscal_substituto') then
    raise exception 'Não há fiscal substituto designado nesta contratação.';
  end if;
  update public.gc_contratos
     set substituto_em_atuacao = p_ativo,
         substituto_desde = case when p_ativo then current_date end
   where id = p_contrato;
end $$;

-- ---------------------------------------------------------------------
-- 7. Fila de e-mails de tarefas ("Existe uma nova tarefa aguardando sua atuação")
--    Preenchida pelos triggers abaixo; enviada pela Edge Function enviar-notificacoes.
-- ---------------------------------------------------------------------
create table if not exists public.gc_notificacoes (
  id          bigint generated always as identity primary key,
  criada_em   timestamptz not null default now(),
  usuario_id  uuid,
  email       text not null,
  contrato_id uuid,
  assunto     text not null,
  mensagem    text not null,
  enviada_em  timestamptz,
  tentativas  integer not null default 0,
  erro        text
);
create index if not exists gc_notificacoes_pendentes_idx on public.gc_notificacoes (criada_em) where enviada_em is null;
alter table public.gc_notificacoes enable row level security;
drop policy if exists gc_sel on public.gc_notificacoes;
create policy gc_sel on public.gc_notificacoes for select to authenticated
  using (usuario_id = auth.uid() or public.gc_role() = 'admin');

create or replace function public.gc_notificar(p_usuarios uuid[], p_contrato uuid, p_tarefa text)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select numero, contratada into c from public.gc_contratos where id = p_contrato;
  insert into public.gc_notificacoes (usuario_id, email, contrato_id, assunto, mensagem)
  select u.id, u.email, p_contrato,
         'LicitaCRT — nova tarefa: ' || p_tarefa,
         'Existe uma nova tarefa aguardando sua atuação na plataforma LicitaCRT.' || chr(10) || chr(10)
           || p_tarefa || chr(10)
           || 'Contratação ' || coalesce(c.numero, '') || ' — ' || coalesce(c.contratada, '')
    from public.usuarios u
   where u.id = any (p_usuarios) and coalesce(u.ativo, true) and coalesce(btrim(u.email), '') <> '';
end $$;

create or replace function public.gc_usuarios_do_perfil(p_perfil text) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.usuarios
   where coalesce(ativo, true) and (case when role = 'editor' then 'compras' else role end) = p_perfil
$$;

create or replace function public.gc_notificar_eventos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'gc_contratos' then
    if new.encaminhado_em is not null and old.encaminhado_em is null then
      perform public.gc_notificar(public.gc_usuarios_do_perfil('gestor'), new.id, 'Nova contratação recebida de Compras');
    end if;
    if new.portaria_status = 'aguardando_publicacao' and old.portaria_status is distinct from 'aguardando_publicacao' then
      perform public.gc_notificar(public.gc_usuarios_do_perfil('gabinete'), new.id, 'Portaria de designação aguardando assinatura/publicação');
    end if;
    if new.substituto_em_atuacao and not old.substituto_em_atuacao then
      perform public.gc_notificar(array(select public.gc_fiscais_em_atuacao(new.id)), new.id,
                                  'Você está em atuação como fiscal substituto');
    end if;
  elsif tg_table_name = 'gc_responsaveis' then
    if new.usuario_id is not null and new.ativo and new.papel like 'fiscal%'
       and (tg_op = 'INSERT' or old.usuario_id is distinct from new.usuario_id or not old.ativo) then
      perform public.gc_notificar(array[new.usuario_id], new.contrato_id, 'Nova contratação atribuída a você para fiscalização');
    end if;
  elsif tg_table_name = 'gc_ordens_servico' then
    if new.status = 'aguardando_assinatura' and old.status is distinct from 'aguardando_assinatura' then
      perform public.gc_notificar(public.gc_usuarios_do_perfil('gabinete'), new.contrato_id, 'OS/OC aguardando assinatura');
    end if;
  elsif tg_table_name = 'gc_competencias' then
    if new.atestado and not old.atestado then
      perform public.gc_notificar(public.gc_usuarios_do_perfil('gestor'), new.contrato_id,
                                  'Competência atestada pelo fiscal — aguardando conferência da Gestão');
    end if;
    if new.liberado_financeiro and not old.liberado_financeiro then
      perform public.gc_notificar(public.gc_usuarios_do_perfil('financeiro'), new.contrato_id,
                                  'Nova competência liberada pela Gestão — liquidação pendente');
    end if;
    if old.atestado and not new.atestado and new.devolvido_em is not null then
      perform public.gc_notificar(array(select public.gc_fiscais_em_atuacao(new.contrato_id)), new.contrato_id,
                                  'Competência devolvida pela Gestão: ' || coalesce(new.devolucao_motivo, ''));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_notificar on public.gc_contratos;
create trigger trg_notificar after update on public.gc_contratos
  for each row execute function public.gc_notificar_eventos();
drop trigger if exists trg_notificar on public.gc_responsaveis;
create trigger trg_notificar after insert or update on public.gc_responsaveis
  for each row execute function public.gc_notificar_eventos();
drop trigger if exists trg_notificar on public.gc_ordens_servico;
create trigger trg_notificar after update on public.gc_ordens_servico
  for each row execute function public.gc_notificar_eventos();
drop trigger if exists trg_notificar on public.gc_competencias;
create trigger trg_notificar after update on public.gc_competencias
  for each row execute function public.gc_notificar_eventos();

-- ---------------------------------------------------------------------
-- 8. Parâmetros dos documentos e alertas (editáveis em Parâmetros)
-- ---------------------------------------------------------------------
insert into public.gc_parametros (chave, valor) values
  ('orgao_nome',              '"Conselho Regional dos Técnicos Industriais — CRT-08"'),
  ('orgao_cidade',            '""'),
  ('presidente_nome',         '""'),
  ('diretor_financeiro_nome', '""'),
  ('email_gestao_contratos',  '""'),
  ('prazo_ocorrencia_aviso_dias', '5'),
  ('atribuicoes_fiscal',      '"I – acompanhar e fiscalizar a execução do objeto, verificando a conformidade com o contrato, o termo de referência e a ordem de serviço/compra;\nII – receber as notas fiscais e a documentação da contratada, conferindo-as;\nIII – registrar as ocorrências da execução e determinar o necessário à regularização das faltas observadas;\nIV – propor glosas e informar à gestão situações que exijam decisão ou providência superior;\nV – atestar a execução para fins de liquidação e pagamento;\nVI – na ausência ou impedimento do fiscal titular, as atribuições serão exercidas pelo fiscal substituto."')
on conflict (chave) do nothing;

-- =====================================================================
-- Solicitações de contratação e processos de contratação (Compras)
--
-- Os setores enviam ao Compras uma solicitação, de preferência com o Documento de Formalização
-- da Demanda (DFD) já assinado (Lei 14.133/2021, art. 18 e art. 72, I). O Compras analisa:
-- devolve para ajuste, recusa ou aceita. Ao aceitar, o sistema abre o processo de contratação
-- (protocolo da tramitação, já na unidade do Compras e com a forma de contratação definida),
-- liga o DFD ao processo e registra o processo no quadro do módulo licitatório.
--
-- O Compras também registra processos que chegaram fora do sistema (cp_registrar_processo) e
-- marca, no roteiro de documentos da Lei 14.133/2021, o que foi juntado ao processo sem ser
-- produzido na plataforma (propostas, certidões, publicação no PNCP…).
--
-- Toda gravação passa pelas funções cp_* (security definer). Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.cp_sequencias (
  ano    int primary key,
  ultimo int not null default 0
);

create table if not exists public.cp_solicitacoes (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,                                   -- SOL-2026/000001
  tipo             text not null check (tipo in ('dfd', 'solicitacao')),   -- com DFD assinado ou pedido simples
  documento_id     uuid references public.doc_documentos (id) on delete set null,
  objeto           text not null,
  quantidade       text,
  justificativa    text not null,
  objeto_tipo      text,
  valor_estimado   numeric(15,2) check (valor_estimado is null or valor_estimado >= 0),
  data_pretendida  date,
  prioridade       text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  previsto_pca     text check (previsto_pca is null or previsto_pca in ('sim', 'nao', 'nao-elaborado')),
  unidade_id       uuid references public.tr_unidades (id),                -- unidade solicitante
  solicitante      uuid,
  solicitante_nome text,
  status           text not null default 'enviada'
                   check (status in ('enviada', 'devolvida', 'aceita', 'recusada', 'cancelada')),
  motivo           text,                                                   -- última devolução, recusa ou cancelamento
  analisada_por    uuid,
  analisada_por_nome text,
  analisada_em     timestamptz,
  processo_id      uuid references public.tr_processos (id) on delete set null,
  enviada_em       timestamptz not null default now(),
  criada_em        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists cp_solicitacoes_status_idx on public.cp_solicitacoes (status);
create index if not exists cp_solicitacoes_unidade_idx on public.cp_solicitacoes (unidade_id);

create table if not exists public.cp_eventos (
  id              bigint generated always as identity primary key,
  solicitacao_id  uuid not null references public.cp_solicitacoes (id) on delete cascade,
  tipo            text not null check (tipo in ('envio', 'devolucao', 'reenvio', 'aceite', 'recusa', 'cancelamento')),
  texto           text,
  criada_por      uuid,
  criada_por_nome text,
  criada_em       timestamptz not null default now()
);
create index if not exists cp_eventos_solicitacao_idx on public.cp_eventos (solicitacao_id, criada_em);

-- Documentos do roteiro juntados ao processo fora da plataforma (ou dispensados, quando opcionais)
create table if not exists public.cp_checklist (
  processo_id     uuid not null references public.tr_processos (id) on delete cascade,
  item            text not null check (item ~ '^[a-z0-9-]{2,60}$'),
  situacao        text not null check (situacao in ('juntado', 'nao_se_aplica')),
  referencia      text,                                                   -- nº do documento, folha, link
  marcado_por     uuid,
  marcado_por_nome text,
  marcado_em      timestamptz not null default now(),
  primary key (processo_id, item)
);

-- Processo de contratação ↔ quadro do módulo licitatório
alter table public.processos add column if not exists tipo           text;
alter table public.processos add column if not exists tr_processo_id uuid;

-- ---------------------------------------------------------------------
-- 2. Regras de acesso
-- ---------------------------------------------------------------------
-- Vê a solicitação: quem a fez, a unidade solicitante, o Compras e quem acompanha a instituição
create or replace function public.cp_pode_ver(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.gc_role() <> 'sem_acesso' and (
    public.gc_tem_papel('{compras,gestor,gabinete,viewer}')
    or exists (select 1 from public.cp_solicitacoes s
                where s.id = p_id
                  and (s.solicitante = auth.uid()
                       or (s.unidade_id is not null and s.unidade_id = public.tr_unidade_do_usuario())))
  )
$$;

-- Corrige, reenvia e cancela: quem fez ou a sua unidade (e a administração)
create or replace function public.cp_pode_editar(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.gc_role() not in ('viewer', 'sem_acesso') and exists (
    select 1 from public.cp_solicitacoes s
     where s.id = p_id
       and (public.gc_role() = 'admin' or s.solicitante = auth.uid()
            or (s.unidade_id is not null and s.unidade_id = public.tr_unidade_do_usuario())))
$$;

-- O Compras precisa ler o DFD anexado antes de aceitar: o DFD de uma solicitação visível também fica visível
create or replace function public.doc_pode_ver(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.gc_role() <> 'sem_acesso' and exists (
    select 1 from public.doc_documentos d
     where d.id = p_id
       and (public.gc_role() = 'admin'
            or d.criado_por = auth.uid()
            or exists (select 1 from public.doc_assinaturas a where a.documento_id = d.id and a.usuario_id = auth.uid())
            or (d.unidade_id is not null and d.unidade_id = public.tr_unidade_do_usuario())
            or (d.processo_id is not null and public.tr_pode_ver(d.processo_id))
            or exists (select 1 from public.cp_solicitacoes s where s.documento_id = d.id and public.cp_pode_ver(s.id))))
$$;

alter table public.cp_sequencias   enable row level security;
alter table public.cp_solicitacoes enable row level security;
alter table public.cp_eventos      enable row level security;
alter table public.cp_checklist    enable row level security;

drop policy if exists cp_solicitacoes_sel on public.cp_solicitacoes;
drop policy if exists cp_eventos_sel on public.cp_eventos;
drop policy if exists cp_checklist_sel on public.cp_checklist;
create policy cp_solicitacoes_sel on public.cp_solicitacoes for select to authenticated using (public.cp_pode_ver(id));
create policy cp_eventos_sel on public.cp_eventos for select to authenticated using (public.cp_pode_ver(solicitacao_id));
create policy cp_checklist_sel on public.cp_checklist for select to authenticated using (public.tr_pode_ver(processo_id));

revoke insert, update, delete on public.cp_solicitacoes, public.cp_eventos, public.cp_checklist from anon, authenticated;
revoke all on public.cp_sequencias from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Apoio
-- ---------------------------------------------------------------------
create or replace function public.cp_proximo_numero() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ano int := extract(year from now())::int;
  v_n   int;
begin
  insert into public.cp_sequencias (ano, ultimo) values (v_ano, 1)
    on conflict (ano) do update set ultimo = public.cp_sequencias.ultimo + 1
    returning ultimo into v_n;
  return 'SOL-' || v_ano || '/' || lpad(v_n::text, 6, '0');
end $$;

create or replace function public.cp_evento(p_id uuid, p_tipo text, p_texto text) returns void
language sql security definer set search_path = public as $$
  insert into public.cp_eventos (solicitacao_id, tipo, texto, criada_por, criada_por_nome)
    values (p_id, p_tipo, nullif(trim(coalesce(p_texto, '')), ''), auth.uid(), public.tr_nome(auth.uid()))
$$;

create or replace function public.cp_validar_modalidade(p_modalidade text, p_objeto_tipo text) returns void
language plpgsql immutable as $$
begin
  if p_modalidade is null or p_modalidade not in ('pregao', 'concorrencia', 'dispensa', 'inexigibilidade', 'adesao-ata') then
    raise exception 'Escolha a forma de contratação.';
  end if;
  if p_objeto_tipo is not null and p_objeto_tipo not in ('bens-consumo', 'bens-permanentes', 'servicos-comuns',
       'servicos-continuos-demo', 'tic', 'obras-engenharia', 'locacao') then
    raise exception 'Tipo de objeto inválido.';
  end if;
end $$;

-- Valida os dados da solicitação (envio e reenvio)
create or replace function public.cp_validar_solicitacao(
  p_id uuid, p_tipo text, p_documento uuid, p_objeto text, p_justificativa text, p_objeto_tipo text,
  p_prioridade text, p_previsto_pca text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_d public.doc_documentos%rowtype;
begin
  if p_tipo not in ('dfd', 'solicitacao') then raise exception 'Tipo de solicitação inválido.'; end if;
  if length(trim(coalesce(p_objeto, ''))) < 5 then raise exception 'Descreva o que precisa ser contratado.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 10 then raise exception 'Explique por que a contratação é necessária.'; end if;
  if p_prioridade not in ('baixa', 'normal', 'alta', 'urgente') then raise exception 'Prioridade inválida.'; end if;
  if p_previsto_pca is not null and p_previsto_pca not in ('sim', 'nao', 'nao-elaborado') then
    raise exception 'Informe se a demanda está no Plano de Contratações Anual.';
  end if;
  if p_objeto_tipo is not null and p_objeto_tipo not in ('bens-consumo', 'bens-permanentes', 'servicos-comuns',
       'servicos-continuos-demo', 'tic', 'obras-engenharia', 'locacao') then
    raise exception 'Tipo de objeto inválido.';
  end if;

  if p_tipo = 'dfd' then
    if p_documento is null then raise exception 'Escolha o DFD assinado que acompanha a solicitação.'; end if;
    select * into v_d from public.doc_documentos where id = p_documento;
    if not found or not public.doc_pode_ver(p_documento) then raise exception 'DFD não encontrado.'; end if;
    if v_d.modelo <> 'dfd' then raise exception 'O documento escolhido não é um DFD.'; end if;
    if v_d.status <> 'assinado' then raise exception 'O DFD precisa estar assinado antes de ser enviado ao Compras.'; end if;
    if v_d.processo_id is not null then raise exception 'Este DFD já faz parte de um processo.'; end if;
    if exists (select 1 from public.cp_solicitacoes s
                where s.documento_id = p_documento and s.status in ('enviada', 'devolvida', 'aceita')
                  and s.id is distinct from p_id) then
      raise exception 'Este DFD já foi enviado em outra solicitação.';
    end if;
  elsif p_documento is not null then
    raise exception 'Solicitação simples não leva DFD: escolha "Com DFD".';
  end if;
end $$;

-- Abre o processo de contratação na unidade do Compras (usado pelo aceite e pelo registro direto)
create or replace function public.cp_criar_processo(
  p_objeto text, p_unidade_demandante uuid, p_descricao text, p_modalidade text, p_objeto_tipo text,
  p_prioridade text, p_prazo date, p_valor numeric, p_despacho text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_compras uuid := coalesce(public.tr_unidade_do_usuario(),
                             case when public.gc_role() = 'admin' then (select id from public.tr_unidades where sigla = 'COMP') end);
  v_dem     public.tr_unidades%rowtype;
  v_id      uuid;
  v_numero  text;
begin
  if v_compras is null then
    raise exception 'Peça ao administrador para definir a sua unidade antes de abrir processos.';
  end if;
  perform public.cp_validar_modalidade(p_modalidade, p_objeto_tipo);
  if coalesce(p_prioridade, 'normal') not in ('baixa', 'normal', 'alta', 'urgente') then raise exception 'Prioridade inválida.'; end if;
  select * into v_dem from public.tr_unidades where id = p_unidade_demandante;

  v_numero := public.tr_proximo_numero();
  insert into public.tr_processos (numero, tipo, assunto, interessado, descricao, prioridade, prazo, unidade_atual,
                                   responsavel_atual, desde, recebido_em, aberto_por, contratacao_modalidade, contratacao_objeto)
    values (v_numero, 'Contratação', trim(p_objeto), coalesce(v_dem.sigla || ' — ' || v_dem.nome, null),
            nullif(trim(coalesce(p_descricao, '')), ''), coalesce(p_prioridade, 'normal'), p_prazo, v_compras,
            auth.uid(), now(), now(), auth.uid(), p_modalidade, p_objeto_tipo)
    returning id into v_id;
  -- a unidade demandante consta como origem: assim ela acompanha o processo (tr_pode_ver)
  insert into public.tr_tramitacoes (processo_id, tipo, de_unidade, para_unidade, despacho, criada_por)
    values (v_id, 'abertura', coalesce(v_dem.id, v_compras), v_compras, nullif(trim(coalesce(p_despacho, '')), ''), auth.uid());

  -- quadro do módulo licitatório
  insert into public.processos (numero, objeto, etapa, tipo, unidade_demandante, modalidade, valor_estimado, tr_processo_id)
    values (v_numero, trim(p_objeto), 'Aberto',
            case p_modalidade when 'pregao' then 'Pregao' when 'concorrencia' then 'Concorrencia' when 'dispensa' then 'Dispensa'
                              when 'inexigibilidade' then 'Inexigibilidade' when 'adesao-ata' then 'ARP' end,
            v_dem.nome,
            case p_modalidade when 'pregao' then 'Pregão' when 'concorrencia' then 'Concorrência' when 'dispensa' then 'Dispensa'
                              when 'inexigibilidade' then 'Inexigibilidade' when 'adesao-ata' then 'Adesão a ata' end,
            p_valor, v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Operações do setor solicitante
-- ---------------------------------------------------------------------
create or replace function public.cp_enviar_solicitacao(
  p_tipo text, p_documento uuid, p_objeto text, p_quantidade text, p_justificativa text, p_objeto_tipo text,
  p_valor_estimado numeric, p_data_pretendida date, p_prioridade text, p_previsto_pca text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_unidade uuid := public.tr_unidade_do_usuario();
  v_id uuid;
begin
  if public.gc_role() in ('viewer', 'sem_acesso') then
    raise exception 'Seu perfil não pode enviar solicitações.' using errcode = '42501';
  end if;
  if v_unidade is null and public.gc_role() <> 'admin' then
    raise exception 'Peça ao administrador para definir a sua unidade antes de enviar solicitações.';
  end if;
  perform public.cp_validar_solicitacao(null, p_tipo, p_documento, p_objeto, p_justificativa, p_objeto_tipo,
                                        coalesce(p_prioridade, 'normal'), p_previsto_pca);
  if p_valor_estimado is not null and p_valor_estimado < 0 then raise exception 'O valor estimado não pode ser negativo.'; end if;

  insert into public.cp_solicitacoes (numero, tipo, documento_id, objeto, quantidade, justificativa, objeto_tipo, valor_estimado,
                                      data_pretendida, prioridade, previsto_pca, unidade_id, solicitante, solicitante_nome)
    values (public.cp_proximo_numero(), p_tipo, p_documento, trim(p_objeto), nullif(trim(coalesce(p_quantidade, '')), ''),
            trim(p_justificativa), p_objeto_tipo, p_valor_estimado, p_data_pretendida, coalesce(p_prioridade, 'normal'),
            p_previsto_pca, v_unidade, auth.uid(), public.tr_nome(auth.uid()))
    returning id into v_id;
  perform public.cp_evento(v_id, 'envio', null);
  return v_id;
end $$;

create or replace function public.cp_reenviar_solicitacao(
  p_id uuid, p_tipo text, p_documento uuid, p_objeto text, p_quantidade text, p_justificativa text, p_objeto_tipo text,
  p_valor_estimado numeric, p_data_pretendida date, p_prioridade text, p_previsto_pca text, p_resposta text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_s public.cp_solicitacoes%rowtype;
begin
  select * into v_s from public.cp_solicitacoes where id = p_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode = 'P0002'; end if;
  if not public.cp_pode_editar(p_id) then
    raise exception 'Só quem fez a solicitação (ou a sua unidade) pode corrigi-la.' using errcode = '42501';
  end if;
  if v_s.status <> 'devolvida' then raise exception 'Só uma solicitação devolvida pode ser corrigida e reenviada.'; end if;
  perform public.cp_validar_solicitacao(p_id, p_tipo, p_documento, p_objeto, p_justificativa, p_objeto_tipo,
                                        coalesce(p_prioridade, 'normal'), p_previsto_pca);
  if p_valor_estimado is not null and p_valor_estimado < 0 then raise exception 'O valor estimado não pode ser negativo.'; end if;

  update public.cp_solicitacoes
     set tipo = p_tipo, documento_id = p_documento, objeto = trim(p_objeto), quantidade = nullif(trim(coalesce(p_quantidade, '')), ''),
         justificativa = trim(p_justificativa), objeto_tipo = p_objeto_tipo, valor_estimado = p_valor_estimado,
         data_pretendida = p_data_pretendida, prioridade = coalesce(p_prioridade, 'normal'), previsto_pca = p_previsto_pca,
         status = 'enviada', enviada_em = now(), updated_at = now()
   where id = p_id;
  perform public.cp_evento(p_id, 'reenvio', p_resposta);
end $$;

create or replace function public.cp_cancelar_solicitacao(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_s public.cp_solicitacoes%rowtype;
begin
  select * into v_s from public.cp_solicitacoes where id = p_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode = 'P0002'; end if;
  if not public.cp_pode_editar(p_id) then
    raise exception 'Só quem fez a solicitação (ou a sua unidade) pode cancelá-la.' using errcode = '42501';
  end if;
  if v_s.status not in ('enviada', 'devolvida') then raise exception 'Esta solicitação não pode mais ser cancelada.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  update public.cp_solicitacoes set status = 'cancelada', motivo = trim(p_motivo), updated_at = now() where id = p_id;
  perform public.cp_evento(p_id, 'cancelamento', p_motivo);
end $$;

-- ---------------------------------------------------------------------
-- 5. Operações do Compras
-- ---------------------------------------------------------------------
create or replace function public.cp_exigir_compras() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.gc_tem_papel('{compras}') then
    raise exception 'Somente o Compras analisa solicitações e abre processos de contratação.' using errcode = '42501';
  end if;
end $$;

create or replace function public.cp_devolver_solicitacao(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_s public.cp_solicitacoes%rowtype;
begin
  perform public.cp_exigir_compras();
  select * into v_s from public.cp_solicitacoes where id = p_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode = 'P0002'; end if;
  if v_s.status <> 'enviada' then raise exception 'Só uma solicitação aguardando análise pode ser devolvida.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Diga o que precisa ser ajustado.'; end if;
  update public.cp_solicitacoes
     set status = 'devolvida', motivo = trim(p_motivo), analisada_por = auth.uid(), analisada_por_nome = public.tr_nome(auth.uid()),
         analisada_em = now(), updated_at = now()
   where id = p_id;
  perform public.cp_evento(p_id, 'devolucao', p_motivo);
end $$;

create or replace function public.cp_recusar_solicitacao(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_s public.cp_solicitacoes%rowtype;
begin
  perform public.cp_exigir_compras();
  select * into v_s from public.cp_solicitacoes where id = p_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode = 'P0002'; end if;
  if v_s.status <> 'enviada' then raise exception 'Só uma solicitação aguardando análise pode ser recusada.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo da recusa.'; end if;
  update public.cp_solicitacoes
     set status = 'recusada', motivo = trim(p_motivo), analisada_por = auth.uid(), analisada_por_nome = public.tr_nome(auth.uid()),
         analisada_em = now(), updated_at = now()
   where id = p_id;
  perform public.cp_evento(p_id, 'recusa', p_motivo);
end $$;

-- Aceita a solicitação e abre o processo de contratação; devolve o id do processo
create or replace function public.cp_aceitar_solicitacao(
  p_id uuid, p_modalidade text, p_objeto_tipo text, p_prioridade text, p_despacho text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_s    public.cp_solicitacoes%rowtype;
  v_proc uuid;
  v_num  text;
begin
  perform public.cp_exigir_compras();
  select * into v_s from public.cp_solicitacoes where id = p_id for update;
  if not found then raise exception 'Solicitação não encontrada.' using errcode = 'P0002'; end if;
  if v_s.status <> 'enviada' then raise exception 'Só uma solicitação aguardando análise pode ser aceita.'; end if;

  v_proc := public.cp_criar_processo(
    v_s.objeto, v_s.unidade_id,
    'Justificativa da demanda: ' || v_s.justificativa || coalesce(E'\nQuantidade: ' || v_s.quantidade, ''),
    p_modalidade, coalesce(p_objeto_tipo, v_s.objeto_tipo), coalesce(nullif(p_prioridade, ''), v_s.prioridade),
    v_s.data_pretendida, v_s.valor_estimado,
    'Aberto a partir da solicitação ' || v_s.numero || coalesce('. ' || nullif(trim(coalesce(p_despacho, '')), ''), '') || '.');
  select numero into v_num from public.tr_processos where id = v_proc;

  if v_s.documento_id is not null then
    update public.doc_documentos set processo_id = v_proc where id = v_s.documento_id and processo_id is null;
    insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, despacho, criada_por)
      select v_proc, 'documento', p.unidade_atual, 'DFD ' || d.numero || ' juntado ao processo.', auth.uid()
        from public.tr_processos p, public.doc_documentos d where p.id = v_proc and d.id = v_s.documento_id;
  end if;

  update public.cp_solicitacoes
     set status = 'aceita', motivo = null, processo_id = v_proc, analisada_por = auth.uid(),
         analisada_por_nome = public.tr_nome(auth.uid()), analisada_em = now(), updated_at = now()
   where id = p_id;
  perform public.cp_evento(p_id, 'aceite', 'Processo ' || v_num || ' aberto.');
  return v_proc;
end $$;

-- Registra um processo de contratação sem solicitação no sistema (demanda recebida por outro meio)
create or replace function public.cp_registrar_processo(
  p_objeto text, p_unidade_demandante uuid, p_justificativa text, p_modalidade text, p_objeto_tipo text,
  p_prioridade text, p_valor_estimado numeric, p_prazo date, p_despacho text
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  perform public.cp_exigir_compras();
  if length(trim(coalesce(p_objeto, ''))) < 5 then raise exception 'Descreva o objeto da contratação.'; end if;
  if p_unidade_demandante is null or not exists (select 1 from public.tr_unidades where id = p_unidade_demandante) then
    raise exception 'Informe a unidade demandante.';
  end if;
  if p_valor_estimado is not null and p_valor_estimado < 0 then raise exception 'O valor estimado não pode ser negativo.'; end if;
  return public.cp_criar_processo(p_objeto, p_unidade_demandante, p_justificativa, p_modalidade, p_objeto_tipo,
                                  p_prioridade, p_prazo, p_valor_estimado,
                                  coalesce(nullif(trim(coalesce(p_despacho, '')), ''), 'Processo de contratação registrado pelo Compras.'));
end $$;

-- Marca um documento do roteiro como juntado ao processo (ou "não se aplica") e desfaz a marcação
create or replace function public.cp_marcar_item(p_processo uuid, p_item text, p_situacao text, p_referencia text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.tr_processos%rowtype;
begin
  select * into v_p from public.tr_processos where id = p_processo;
  if not found then raise exception 'Processo não encontrado.' using errcode = 'P0002'; end if;
  if not public.tr_pode_atuar(p_processo) then
    raise exception 'Somente a unidade onde o processo está pode registrar os documentos.' using errcode = '42501';
  end if;
  if v_p.situacao <> 'em_andamento' then raise exception 'O processo está concluído. Reabra-o para alterar.'; end if;
  if p_item is null or p_item !~ '^[a-z0-9-]{2,60}$' then raise exception 'Item inválido.'; end if;
  if p_situacao not in ('juntado', 'nao_se_aplica') then raise exception 'Situação inválida.'; end if;
  if p_situacao = 'juntado' and length(trim(coalesce(p_referencia, ''))) < 2 then
    raise exception 'Informe onde o documento está (número, folha ou link).';
  end if;
  if p_situacao = 'nao_se_aplica' and length(trim(coalesce(p_referencia, ''))) < 5 then
    raise exception 'Justifique por que o documento não se aplica.';
  end if;
  insert into public.cp_checklist (processo_id, item, situacao, referencia, marcado_por, marcado_por_nome, marcado_em)
    values (p_processo, p_item, p_situacao, trim(p_referencia), auth.uid(), public.tr_nome(auth.uid()), now())
    on conflict (processo_id, item) do update
      set situacao = excluded.situacao, referencia = excluded.referencia, marcado_por = excluded.marcado_por,
          marcado_por_nome = excluded.marcado_por_nome, marcado_em = now();
  insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, despacho, criada_por)
    values (p_processo, 'documento', v_p.unidade_atual,
            case p_situacao when 'juntado' then 'Documento juntado (' || p_item || '): ' || trim(p_referencia)
                            else 'Documento não se aplica (' || p_item || '): ' || trim(p_referencia) end,
            auth.uid());
end $$;

create or replace function public.cp_desmarcar_item(p_processo uuid, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.tr_processos%rowtype;
begin
  select * into v_p from public.tr_processos where id = p_processo;
  if not found then raise exception 'Processo não encontrado.' using errcode = 'P0002'; end if;
  if not public.tr_pode_atuar(p_processo) then
    raise exception 'Somente a unidade onde o processo está pode registrar os documentos.' using errcode = '42501';
  end if;
  if v_p.situacao <> 'em_andamento' then raise exception 'O processo está concluído. Reabra-o para alterar.'; end if;
  delete from public.cp_checklist where processo_id = p_processo and item = p_item;
  if found then
    insert into public.tr_tramitacoes (processo_id, tipo, para_unidade, despacho, criada_por)
      values (p_processo, 'documento', v_p.unidade_atual, 'Marcação desfeita (' || p_item || ').', auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Permissões das funções
-- ---------------------------------------------------------------------
revoke all on function public.cp_pode_ver(uuid), public.cp_pode_editar(uuid), public.cp_proximo_numero(),
  public.cp_evento(uuid, text, text), public.cp_validar_modalidade(text, text),
  public.cp_validar_solicitacao(uuid, text, uuid, text, text, text, text, text),
  public.cp_criar_processo(text, uuid, text, text, text, text, date, numeric, text), public.cp_exigir_compras(),
  public.cp_enviar_solicitacao(text, uuid, text, text, text, text, numeric, date, text, text),
  public.cp_reenviar_solicitacao(uuid, text, uuid, text, text, text, text, numeric, date, text, text, text),
  public.cp_cancelar_solicitacao(uuid, text), public.cp_devolver_solicitacao(uuid, text),
  public.cp_recusar_solicitacao(uuid, text), public.cp_aceitar_solicitacao(uuid, text, text, text, text),
  public.cp_registrar_processo(text, uuid, text, text, text, text, numeric, date, text),
  public.cp_marcar_item(uuid, text, text, text), public.cp_desmarcar_item(uuid, text) from public, anon;
grant execute on function public.cp_pode_ver(uuid), public.cp_pode_editar(uuid),
  public.cp_enviar_solicitacao(text, uuid, text, text, text, text, numeric, date, text, text),
  public.cp_reenviar_solicitacao(uuid, text, uuid, text, text, text, text, numeric, date, text, text, text),
  public.cp_cancelar_solicitacao(uuid, text), public.cp_devolver_solicitacao(uuid, text),
  public.cp_recusar_solicitacao(uuid, text), public.cp_aceitar_solicitacao(uuid, text, text, text, text),
  public.cp_registrar_processo(text, uuid, text, text, text, text, numeric, date, text),
  public.cp_marcar_item(uuid, text, text, text), public.cp_desmarcar_item(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Atualização automática das telas (Realtime)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array['cp_solicitacoes', 'cp_eventos', 'cp_checklist'] loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

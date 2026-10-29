-- =====================================================================
-- Fluxo das secretarias: Prefeito → Secretários → Compras ↔ Jurídico / Financeiro / Gestão de contratos
--
--  · Perfil `secretario`: recebe ofícios e despachos do Prefeito, é o ÚNICO que cria a DFD (e, por ela,
--    o pedido ao Compras). Não lê contratações nem o quadro licitatório.
--  · Catálogo de itens (cp_itens): o administrador cadastra os itens com a especificação; a DFD
--    escolhe do catálogo e informa só a quantidade (o documento guarda uma cópia do item escolhido).
--  · Arquivos enviados: um PDF/imagem/planilha pode virar documento do sistema, com o SHA-256 do arquivo
--    no conteúdo assinado; segue o mesmo fluxo de assinatura dos documentos produzidos aqui.
--  · Encaminhar documento: o documento (ex.: ofício do Prefeito) vai a uma unidade pela tramitação.
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfil Secretário
-- ---------------------------------------------------------------------
alter table public.usuarios drop constraint if exists usuarios_role_valido;
alter table public.usuarios add constraint usuarios_role_valido check (role is null or role in
  ('admin', 'presidente', 'secretario', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete',
   'juridico', 'administrativo', 'rh', 'ti', 'editor', 'viewer')) not valid;

create or replace function public.gc_pode_ver(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.gc_role() = 'sem_acesso' then false
    when public.gc_role() in ('rh', 'ti', 'administrativo', 'secretario') then false
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

drop policy if exists processos_sel on public.processos;
create policy processos_sel on public.processos for select to authenticated
  using (public.gc_role() not in ('sem_acesso', 'rh', 'ti', 'administrativo', 'secretario'));

do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  execute 'drop policy if exists licitacrt_anexos_sel on storage.objects';
  execute $p$create policy licitacrt_anexos_sel on storage.objects for select to authenticated
    using (bucket_id = 'anexos' and public.gc_role() not in ('sem_acesso', 'rh', 'ti', 'administrativo', 'secretario'))$p$;
end $$;

-- O secretário também abre e movimenta processos da sua secretaria
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
  if not public.gc_tem_papel('{secretario,compras,gestor,fiscal,financeiro,gabinete,juridico,administrativo,rh,ti}') then
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

-- ---------------------------------------------------------------------
-- 2. Catálogo de itens (cadastrado pelo administrador)
-- ---------------------------------------------------------------------
create table if not exists public.cp_itens (
  id               uuid primary key default gen_random_uuid(),
  codigo           text unique,                                        -- código interno ou CATMAT/CATSER
  nome             text not null,
  especificacao    text not null,
  unidade_medida   text not null default 'unidade',
  categoria        text,
  objeto_tipo      text check (objeto_tipo is null or objeto_tipo in ('bens-consumo', 'bens-permanentes', 'servicos-comuns',
                     'servicos-continuos-demo', 'tic', 'obras-engenharia', 'locacao')),
  valor_referencia numeric(15,2) check (valor_referencia is null or valor_referencia >= 0),
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.cp_itens enable row level security;
drop policy if exists cp_itens_sel on public.cp_itens;
drop policy if exists cp_itens_ins on public.cp_itens;
drop policy if exists cp_itens_upd on public.cp_itens;
create policy cp_itens_sel on public.cp_itens for select to authenticated using (public.gc_role() <> 'sem_acesso');
create policy cp_itens_ins on public.cp_itens for insert to authenticated with check (public.gc_role() = 'admin');
create policy cp_itens_upd on public.cp_itens for update to authenticated
  using (public.gc_role() = 'admin') with check (public.gc_role() = 'admin');
-- itens não são apagados (a DFD antiga guarda a cópia, mas o histórico fica coerente): desative
revoke delete on public.cp_itens from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Documentos: DFD só pelo secretário; arquivo enviado como documento
-- ---------------------------------------------------------------------
alter table public.doc_documentos add column if not exists arquivo_path text;   -- objeto no bucket "documentos"
create unique index if not exists doc_documentos_arquivo_idx on public.doc_documentos (arquivo_path) where arquivo_path is not null;

create or replace function public.doc_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Documentos não são apagados: cancele com justificativa.';
  end if;
  if new.id <> old.id or new.numero <> old.numero or new.criado_por is distinct from old.criado_por
     or new.arquivo_path is distinct from old.arquivo_path then
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
  if p_modelo = 'arquivo' then raise exception 'Use o envio de arquivo para juntar um documento de fora.'; end if;
  if p_modelo = 'dfd' and not public.gc_tem_papel('{secretario}') then
    raise exception 'Somente o secretário cria a DFD da sua secretaria.' using errcode = '42501';
  end if;
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

-- O conteúdo de um arquivo enviado é montado aqui (o navegador não escolhe o que será assinado)
create or replace function public.doc_corpo_arquivo(p_titulo text, p_descricao text, p_nome text, p_tipo text, p_tamanho bigint, p_sha256 text)
returns jsonb
language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('t', 'titulo', 'x', trim(p_titulo)),
    jsonb_build_object('t', 'p', 'x', coalesce(nullif(trim(coalesce(p_descricao, '')), ''), 'Documento enviado como arquivo.')),
    jsonb_build_object('t', 'arquivo', 'nome', p_nome, 'tipo', p_tipo, 'tamanho', p_tamanho, 'sha256', lower(p_sha256)))
$$;

create or replace function public.doc_criar_arquivo(
  p_titulo text, p_descricao text, p_processo uuid, p_path text, p_nome text, p_tipo text, p_tamanho bigint, p_sha256 text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.gc_role() in ('viewer', 'sem_acesso') then
    raise exception 'Seu perfil não pode enviar documentos.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 then raise exception 'Informe o título do documento.'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'Arquivo inválido.'; end if;
  if p_sha256 is null or lower(p_sha256) !~ '^[0-9a-f]{64}$' then raise exception 'Código do arquivo inválido.'; end if;
  if coalesce(p_tamanho, 0) <= 0 or p_tamanho > 20 * 1024 * 1024 then raise exception 'O arquivo deve ter até 20 MB.'; end if;
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Arquivo inválido.'; end if;
  if p_processo is not null and not public.tr_pode_ver(p_processo) then
    raise exception 'Você não tem acesso a este processo.' using errcode = '42501';
  end if;

  insert into public.doc_documentos (numero, sigla, modelo, modelo_versao, titulo, processo_id, unidade_id, conteudo, corpo,
                                     criado_por, criado_por_nome, arquivo_path)
    values (public.doc_proximo_numero('ANX'), 'ANX', 'arquivo', 1, trim(p_titulo), p_processo, public.tr_unidade_do_usuario(),
            jsonb_build_object('descricao', nullif(trim(coalesce(p_descricao, '')), '')),
            public.doc_corpo_arquivo(p_titulo, p_descricao, trim(p_nome), p_tipo, p_tamanho, p_sha256),
            auth.uid(), public.tr_nome(auth.uid()), p_path)
    returning id into v_id;
  if p_processo is not null then
    perform public.doc_registrar_no_processo(p_processo, 'Arquivo ' || trim(p_nome) || ' juntado ao processo.');
  end if;
  return v_id;
end $$;

-- No arquivo enviado, só o título e a descrição mudam; o bloco do arquivo (nome e SHA-256) é preservado
create or replace function public.doc_salvar(p_id uuid, p_titulo text, p_conteudo jsonb, p_corpo jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_d public.doc_documentos%rowtype;
  v_arq jsonb;
begin
  if not public.doc_pode_editar(p_id) then
    raise exception 'Este documento não pode mais ser editado por você.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 3 then raise exception 'Informe o título do documento.'; end if;
  select * into v_d from public.doc_documentos where id = p_id;
  if v_d.modelo = 'arquivo' then
    select b into v_arq from jsonb_array_elements(v_d.corpo) b where b->>'t' = 'arquivo' limit 1;
    update public.doc_documentos
       set titulo = trim(p_titulo), conteudo = jsonb_build_object('descricao', p_conteudo->>'descricao'),
           corpo = public.doc_corpo_arquivo(p_titulo, p_conteudo->>'descricao', v_arq->>'nome', v_arq->>'tipo',
                                            (v_arq->>'tamanho')::bigint, v_arq->>'sha256'),
           atualizado_em = now()
     where id = p_id;
    return;
  end if;
  update public.doc_documentos
     set titulo = trim(p_titulo), conteudo = coalesce(p_conteudo, '{}'::jsonb), corpo = coalesce(p_corpo, '[]'::jsonb),
         atualizado_em = now()
   where id = p_id;
end $$;

-- Encaminha o documento a uma unidade pela tramitação: se já está num processo, envia o processo;
-- se não, abre um processo de comunicação com ele (ex.: ofício do Prefeito à Secretaria de Saúde).
create or replace function public.doc_encaminhar(p_id uuid, p_unidade uuid, p_despacho text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_d    public.doc_documentos%rowtype;
  v_proc uuid;
  v_origem uuid := public.tr_unidade_do_usuario();
begin
  select * into v_d from public.doc_documentos where id = p_id for update;
  if not found or not public.doc_pode_ver(p_id) then raise exception 'Documento não encontrado.' using errcode = 'P0002'; end if;
  if public.gc_role() in ('viewer', 'sem_acesso') then raise exception 'Seu perfil não pode encaminhar documentos.' using errcode = '42501'; end if;
  if v_d.status <> 'assinado' then raise exception 'Só um documento assinado pode ser encaminhado.'; end if;
  if p_unidade is null or not exists (select 1 from public.tr_unidades where id = p_unidade and ativa) then
    raise exception 'Unidade de destino inexistente ou inativa.';
  end if;
  if length(trim(coalesce(p_despacho, ''))) < 3 then raise exception 'Escreva o despacho: o que a unidade deve fazer.'; end if;

  if v_d.processo_id is not null then
    perform public.tr_tramitar(v_d.processo_id, p_unidade, null, p_despacho, null);
    return v_d.processo_id;
  end if;

  if v_origem is null and public.gc_role() <> 'admin' then
    raise exception 'Peça ao administrador para definir a sua unidade antes de encaminhar documentos.';
  end if;
  if p_unidade is not distinct from v_origem then raise exception 'O documento já está nesta unidade.'; end if;
  insert into public.tr_processos (numero, tipo, assunto, interessado, prioridade, unidade_atual, desde, aberto_por)
    values (public.tr_proximo_numero(), 'Comunicação oficial',
            coalesce(nullif(trim(coalesce(v_d.conteudo->>'assunto', '')), ''), v_d.titulo),  -- o assunto do ofício, se houver
            (select sigla || ' — ' || nome from public.tr_unidades where id = v_origem), 'normal', p_unidade, now(), auth.uid())
    returning id into v_proc;
  insert into public.tr_tramitacoes (processo_id, tipo, de_unidade, para_unidade, despacho, criada_por)
    values (v_proc, 'abertura', v_origem, p_unidade, trim(p_despacho), auth.uid());
  update public.doc_documentos set processo_id = v_proc where id = p_id;
  perform public.doc_registrar_no_processo(v_proc, 'Documento ' || v_d.numero || ' encaminhado.');
  return v_proc;
end $$;

-- Arquivos dos documentos: bucket privado; lê quem vê o documento; envia cada um na própria pasta
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false) on conflict (id) do nothing;
  execute 'drop policy if exists licitacrt_documentos_sel on storage.objects';
  execute 'drop policy if exists licitacrt_documentos_ins on storage.objects';
  execute $p$create policy licitacrt_documentos_sel on storage.objects for select to authenticated
    using (bucket_id = 'documentos' and (
      split_part(name, '/', 1) = auth.uid()::text
      or exists (select 1 from public.doc_documentos d where d.arquivo_path = name and public.doc_pode_ver(d.id))))$p$;
  execute $p$create policy licitacrt_documentos_ins on storage.objects for insert to authenticated
    with check (bucket_id = 'documentos' and split_part(name, '/', 1) = auth.uid()::text
                and public.gc_role() not in ('viewer', 'sem_acesso'))$p$;
end $$;

-- ---------------------------------------------------------------------
-- 4. Pedido ao Compras: só o secretário, sempre com a DFD assinada
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
  if not public.gc_tem_papel('{secretario}') then
    raise exception 'Somente o secretário envia a DFD ao Compras.' using errcode = '42501';
  end if;
  if v_unidade is null and public.gc_role() <> 'admin' then
    raise exception 'Peça ao administrador para definir a sua unidade antes de enviar solicitações.';
  end if;
  if p_tipo <> 'dfd' then raise exception 'O pedido ao Compras é feito com a DFD assinada.'; end if;
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
  if not public.gc_tem_papel('{secretario}') or not public.cp_pode_editar(p_id) then
    raise exception 'Só o secretário que fez o pedido (ou da mesma secretaria) pode corrigi-lo.' using errcode = '42501';
  end if;
  if v_s.status <> 'devolvida' then raise exception 'Só uma solicitação devolvida pode ser corrigida e reenviada.'; end if;
  if p_tipo <> 'dfd' then raise exception 'O pedido ao Compras é feito com a DFD assinada.'; end if;
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

-- O processo de contratação nasce da DFD do secretário; o registro direto fica só com a administração
-- (para lançar processos antigos, que começaram em papel)
create or replace function public.cp_registrar_processo(
  p_objeto text, p_unidade_demandante uuid, p_justificativa text, p_modalidade text, p_objeto_tipo text,
  p_prioridade text, p_valor_estimado numeric, p_prazo date, p_despacho text
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if public.gc_role() <> 'admin' then
    raise exception 'O processo de contratação começa pela DFD do secretário. Só a administração lança processos antigos.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_objeto, ''))) < 5 then raise exception 'Descreva o objeto da contratação.'; end if;
  if p_unidade_demandante is null or not exists (select 1 from public.tr_unidades where id = p_unidade_demandante) then
    raise exception 'Informe a unidade demandante.';
  end if;
  if p_valor_estimado is not null and p_valor_estimado < 0 then raise exception 'O valor estimado não pode ser negativo.'; end if;
  return public.cp_criar_processo(p_objeto, p_unidade_demandante, p_justificativa, p_modalidade, p_objeto_tipo,
                                  p_prioridade, p_prazo, p_valor_estimado,
                                  coalesce(nullif(trim(coalesce(p_despacho, '')), ''), 'Processo de contratação lançado pela administração.'));
end $$;

-- ---------------------------------------------------------------------
-- 5. Permissões e Realtime
-- ---------------------------------------------------------------------
revoke all on function public.doc_corpo_arquivo(text, text, text, text, bigint, text),
  public.doc_criar_arquivo(text, text, uuid, text, text, text, bigint, text), public.doc_encaminhar(uuid, uuid, text) from public, anon;
grant execute on function public.doc_criar_arquivo(text, text, uuid, text, text, text, bigint, text),
  public.doc_encaminhar(uuid, uuid, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cp_itens') then
    alter publication supabase_realtime add table public.cp_itens;
  end if;
end $$;

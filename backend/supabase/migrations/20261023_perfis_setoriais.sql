-- =====================================================================
-- Perfis setoriais: Jurídico, Administrativo (protocolo/secretaria), RH e TI
--
--  · Jurídico     acompanha as contratações em modo leitura (precisa para emitir pareceres) e
--                 recebe processos pela unidade; assina pareceres.
--  · Administrativo, RH e TI  abrem, recebem e enviam processos e produzem documentos, mas NÃO enxergam
--                 contratações nem processos licitatórios (princípio do menor acesso).
--
-- Nenhum desses perfis grava em contratações: as políticas de escrita listam os perfis permitidos,
-- então quem não está na lista só lê (e, para RH/TI/Administrativo, nem lê).
-- Idempotente: pode rodar de novo sem efeito colateral.
-- =====================================================================

alter table public.usuarios drop constraint if exists usuarios_role_valido;
alter table public.usuarios add constraint usuarios_role_valido check (role is null or role in
  ('admin', 'presidente', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete',
   'juridico', 'administrativo', 'rh', 'ti', 'editor', 'viewer')) not valid;

-- Contratações: RH, TI e Administrativo não veem nenhuma
create or replace function public.gc_pode_ver(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.gc_role() = 'sem_acesso' then false
    when public.gc_role() in ('rh', 'ti', 'administrativo') then false
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

-- Processos licitatórios e seus anexos: também fechados para RH, TI e Administrativo
drop policy if exists processos_sel on public.processos;
create policy processos_sel on public.processos for select to authenticated
  using (public.gc_role() not in ('sem_acesso', 'rh', 'ti', 'administrativo'));

do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  execute 'drop policy if exists licitacrt_anexos_sel on storage.objects';
  execute $p$create policy licitacrt_anexos_sel on storage.objects for select to authenticated
    using (bucket_id = 'anexos' and public.gc_role() not in ('sem_acesso', 'rh', 'ti', 'administrativo'))$p$;
end $$;

-- Quem pode abrir processo administrativo: todos os perfis de trabalho (a consulta só acompanha)
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
  if not public.gc_tem_papel('{compras,gestor,fiscal,financeiro,gabinete,juridico,administrativo,rh,ti}') then
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
revoke all on function public.tr_abrir_processo(text, text, text, text, text, date, uuid, text) from public, anon;
grant execute on function public.tr_abrir_processo(text, text, text, text, text, date, uuid, text) to authenticated;

-- =====================================================================
-- Atualização automática das telas (Supabase Realtime)
--
-- O sistema avisa os navegadores abertos quando alguém muda um registro (por exemplo, quando
-- um setor encaminha algo para outro), e a tela se atualiza sozinha. O Realtime respeita as
-- regras de acesso (RLS): cada pessoa só recebe o aviso das linhas que já pode ler.
--
-- Idempotente: pode rodar de novo sem efeito. Se o projeto não tiver a publicação
-- `supabase_realtime`, nada é feito e o sistema segue atualizando por leitura periódica.
-- =====================================================================

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe: Realtime não configurado (a tela usa a leitura periódica).';
    return;
  end if;

  foreach t in array array[
    'gc_contratos', 'gc_responsaveis', 'gc_ordens_servico', 'gc_competencias', 'gc_empenhos',
    'gc_empenho_movs', 'gc_execucoes', 'gc_eventos', 'gc_ocorrencias', 'gc_documentos',
    'gc_pendencias', 'gc_parametros', 'processos', 'usuarios'
  ] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

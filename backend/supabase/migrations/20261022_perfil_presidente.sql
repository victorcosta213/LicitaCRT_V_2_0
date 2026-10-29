-- =====================================================================
-- Perfil Presidente / Prefeito (usuário mestre)
--
-- A autoridade máxima do órgão acompanha tudo e pode fazer tudo. No banco isso é simples porque
-- TODA regra de acesso passa por gc_role(): para as políticas (RLS) e para as funções, o perfil
-- "presidente" vale como "admin". Nenhuma tabela ou função precisa mudar.
--
-- O perfil gravado em usuarios continua "presidente" (a tela mostra o cargo certo e o histórico
-- registra o nome de quem fez). Quem quiser limitar o que o presidente faz, muda só esta função.
-- Idempotente: pode rodar de novo sem efeito colateral.
-- =====================================================================

-- usuarios.role passa a aceitar "presidente"
alter table public.usuarios drop constraint if exists usuarios_role_valido;
alter table public.usuarios add constraint usuarios_role_valido check (role is null or role in
  ('admin', 'presidente', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'editor', 'viewer')) not valid;

-- gc_role(): perfil efetivo usado em todas as regras de acesso
create or replace function public.gc_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case role
              when 'editor' then 'compras'
              when 'presidente' then 'admin'
              else coalesce(role, 'viewer')
            end
       from public.usuarios
      where id = auth.uid() and coalesce(ativo, true)),
    'sem_acesso')
$$;

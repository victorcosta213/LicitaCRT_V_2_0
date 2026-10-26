-- Senha provisória: quem recebe um acesso novo, ou teve a senha redefinida pelo administrador,
-- precisa criar a própria senha no primeiro acesso.
--
-- O que fica registrado é uma "referência" do hash da senha provisória, numa tabela que os
-- usuários não conseguem ler (RLS sem políticas, só as funções abaixo enxergam). A pessoa só
-- deixa de ser "provisória" quando o hash do login muda de verdade: não basta chamar a função.
-- Idempotente: pode ser executada de novo sem efeito colateral.

create table if not exists public.usuarios_senha_provisoria (
  usuario_id uuid primary key,
  hash_ref   text not null,
  criada_em  timestamptz not null default now()
);
alter table public.usuarios_senha_provisoria enable row level security;
revoke all on public.usuarios_senha_provisoria from anon, authenticated;

-- Marca a senha atual do login como provisória (só o administrador). Chamada ao criar o usuário
-- e pela Edge Function resetar-senha, logo depois de trocar a senha para a padrão.
create or replace function public.gc_marcar_senha_provisoria(p_uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_hash text;
begin
  if public.gc_role() is distinct from 'admin' then
    raise exception 'Somente o administrador pode redefinir senhas.' using errcode = '42501';
  end if;
  select encrypted_password into v_hash from auth.users where id = p_uid;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  insert into public.usuarios_senha_provisoria (usuario_id, hash_ref)
    values (p_uid, coalesce(v_hash, ''))
    on conflict (usuario_id) do update set hash_ref = excluded.hash_ref, criada_em = now();
end $$;

-- A pessoa logada ainda está com a senha provisória?
create or replace function public.gc_precisa_trocar_senha() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_senha_provisoria where usuario_id = auth.uid())
$$;

-- Chamada depois que a pessoa criou a senha nova: só libera se o hash do login mudou.
create or replace function public.gc_senha_trocada() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_ref   text;
  v_atual text;
begin
  select hash_ref into v_ref from public.usuarios_senha_provisoria where usuario_id = auth.uid();
  if not found then return; end if;
  select encrypted_password into v_atual from auth.users where id = auth.uid();
  if v_atual is not distinct from v_ref then
    raise exception 'A senha ainda é a provisória. Crie uma nova senha.' using errcode = 'P0001';
  end if;
  delete from public.usuarios_senha_provisoria where usuario_id = auth.uid();
end $$;

revoke all on function public.gc_marcar_senha_provisoria(uuid) from public, anon;
revoke all on function public.gc_precisa_trocar_senha()       from public, anon;
revoke all on function public.gc_senha_trocada()              from public, anon;
grant execute on function public.gc_marcar_senha_provisoria(uuid) to authenticated;
grant execute on function public.gc_precisa_trocar_senha()       to authenticated;
grant execute on function public.gc_senha_trocada()              to authenticated;

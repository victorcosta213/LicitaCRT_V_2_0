// Administração do banco de produção (Supabase) a partir da máquina local.
// Lê DATABASE_URL de backend/.env (ignorado pelo Git) — a senha nunca é impressa.
//
//   node scripts/banco.mjs diagnostico            só leitura: estado atual do banco
//   node scripts/banco.mjs backup <pasta>         exporta as tabelas do sistema em JSON
//   node scripts/banco.mjs aplicar <arq.sql>...   aplica cada arquivo numa transação
//   node scripts/banco.mjs verificar              roda supabase/verificacao.sql
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const raiz = new URL('..', import.meta.url)
const lerEnv = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const linha = readFileSync(new URL('.env', raiz), 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
  if (!linha) throw new Error('DATABASE_URL não encontrada em backend/.env')
  return linha.slice('DATABASE_URL='.length).trim()
}

async function conectar() {
  // o certificado do pooler do Supabase não está na cadeia padrão do Node
  const client = new pg.Client({ connectionString: lerEnv(), ssl: { rejectUnauthorized: false }, statement_timeout: 120000 })
  await client.connect()
  return client
}

const q = async (db, sql, params) => (await db.query(sql, params)).rows

// Mesmas regras de gc_parse_valor (nova) e da importação original (v1), para prever a correção
function parseNovo(v) {
  if (v === null || v === undefined) return null
  let s = String(v).replace(/R\$|\s| /gi, '')
  if (!/^-?[0-9][0-9.,]*$/.test(s)) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(/,/g, '.')
  else if (/^-?[0-9]{1,3}(\.[0-9]{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
function parseV1(v) {
  if (!/^[0-9.,]+$/.test(String(v ?? ''))) return 0
  const n = Number(String(v).replace(/\./g, '').replace(/,/g, '.'))
  return Number.isFinite(n) ? n : null
}

async function diagnostico(db) {
  const r = {}
  r.servidor = (await q(db, `select current_user, version()`))[0]
  r.objetos = (await q(db, `select
      to_regclass('public.usuarios') is not null as usuarios, to_regclass('public.processos') is not null as processos,
      to_regclass('public.contratos') is not null as contratos_legado, to_regclass('public.gc_contratos') is not null as gc_contratos,
      to_regclass('storage.buckets') is not null as storage, to_regclass('auth.users') is not null as auth_users,
      to_regprocedure('public.gc_role()') is not null as migration_20261015,
      to_regprocedure('public.gc_parse_valor(text)') is not null as migration_20261017,
      to_regprocedure('public.gc_encaminhar_contratacao(uuid,text)') is not null as migration_20261018`))[0]
  r.colunas_processos = (await q(db, `select column_name from information_schema.columns
      where table_schema='public' and table_name='processos' order by ordinal_position`)).map((x) => x.column_name)
  r.colunas_usuarios = (await q(db, `select column_name || ' ' || data_type as c from information_schema.columns
      where table_schema='public' and table_name='usuarios' order by ordinal_position`)).map((x) => x.c)
  r.contagens = (await q(db, `select
      (select count(*) from public.usuarios)::int as usuarios,
      (select count(*) from public.usuarios where coalesce(ativo, true))::int as usuarios_ativos,
      (select count(*) from public.processos)::int as processos,
      (select count(*) from public.gc_contratos)::int as gc_contratos,
      (select count(*) from public.gc_contratos where legacy_id is not null)::int as gc_contratos_legados,
      (select count(*) from public.gc_contratos where situacao = 'em_cadastro')::int as gc_em_cadastro,
      (select count(*) from public.gc_contratos where validado_gestao)::int as gc_validados,
      (select count(*) from public.gc_responsaveis)::int as gc_responsaveis,
      (select count(*) from public.gc_ordens_servico)::int as gc_os,
      (select count(*) from public.gc_competencias)::int as gc_competencias,
      (select count(*) from public.gc_empenhos)::int as gc_empenhos,
      (select count(*) from public.gc_execucoes)::int as gc_execucoes,
      (select count(*) from auth.users)::int as logins`))[0]
  if (r.objetos.contratos_legado) r.contagens.contratos_legado = (await q(db, `select count(*)::int as n from public.contratos`))[0].n
  r.perfis = await q(db, `select coalesce(role, '(nulo)') as role, count(*)::int as n,
      count(*) filter (where not coalesce(ativo, true))::int as inativos from public.usuarios group by 1 order by 2 desc`)
  r.os_por_status = await q(db, `select status, count(*)::int as n from public.gc_ordens_servico group by 1`)
  r.rls = await q(db, `select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('usuarios','processos')`)
  r.politicas = await q(db, `select schemaname || '.' || tablename as tabela, policyname, cmd, roles::text, qual, with_check
      from pg_policies where (schemaname='public' and tablename in ('usuarios','processos')) or (schemaname='storage' and tablename='objects')
      order by 1, 2`)
  r.gatilhos_auth_users = await q(db, `select tgname, pg_get_triggerdef(t.oid) as def from pg_trigger t
      where tgrelid = 'auth.users'::regclass and not tgisinternal`)
  r.fks_para_usuarios = await q(db, `select conrelid::regclass::text as tabela, conname from pg_constraint
      where contype='f' and confrelid='public.usuarios'::regclass`)
  r.fk_usuarios_para_auth = await q(db, `select conname from pg_constraint where contype='f' and conrelid='public.usuarios'::regclass`)
  r.perfis_sem_login = await q(db, `select u.email, u.role from public.usuarios u left join auth.users a on a.id = u.id where a.id is null`)
  r.perfis_religaveis_por_email = await q(db, `select u.email from public.usuarios u join auth.users a on lower(a.email) = lower(u.email)
      where a.id <> u.id`)
  r.logins_sem_perfil = await q(db, `select a.email, a.created_at::date::text as criado, a.last_sign_in_at::date::text as ultimo_acesso,
      a.email_confirmed_at is not null as confirmado
      from auth.users a left join public.usuarios u on u.id = a.id where u.id is null order by a.created_at`)
  r.bucket_anexos = await q(db, `select id, public, (select count(*)::int from storage.objects o where o.bucket_id = b.id) as arquivos
      from storage.buckets b where id = 'anexos'`)
  r.processos_com_anexo = (await q(db, `select count(*)::int as n from public.processos
      where coalesce(anexo_url, '') <> '' or coalesce(anexo_path, '') <> ''`))[0].n
  if (r.objetos.contratos_legado) {
    const linhas = await q(db, `select c.numero, (to_jsonb(c) ->> 'valor') as valor, g.valor_inicial::float8 as atual
        from public.contratos c join public.gc_contratos g on g.legacy_id = (to_jsonb(c) ->> 'id')`)
    r.correcao_valores_legados = linhas
      .map((l) => ({ ...l, novo: parseNovo(l.valor), v1: parseV1(l.valor) }))
      .filter((l) => l.novo !== null && l.atual === l.v1 && Math.abs(l.atual - l.novo) > 0.0001)
    r.legados_valor_zero = linhas.filter((l) => l.atual === 0).map((l) => `${l.numero}: "${l.valor}"`)
    r.legados_nao_importados = (await q(db, `select count(*)::int as n from public.contratos c
        where (to_jsonb(c) ->> 'id') is not null
          and not exists (select 1 from public.gc_contratos g where g.legacy_id = (to_jsonb(c) ->> 'id'))`))[0].n
  }
  return r
}

async function backup(db, pasta) {
  mkdirSync(pasta, { recursive: true })
  const tabelas = (await q(db, `select table_name from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE'
        and (table_name in ('usuarios','processos','contratos') or table_name like 'gc\\_%') order by 1`)).map((t) => t.table_name)
  const resumo = {}
  for (const t of tabelas) {
    const rows = await q(db, `select * from public."${t}"`)
    writeFileSync(join(pasta, `${t}.json`), JSON.stringify(rows, null, 1))
    resumo[t] = rows.length
  }
  // logins: só identificação (sem hash de senha)
  const logins = await q(db, `select id, email, created_at, last_sign_in_at, email_confirmed_at from auth.users`)
  writeFileSync(join(pasta, 'auth_users.json'), JSON.stringify(logins, null, 1))
  resumo.auth_users = logins.length
  const politicas = await q(db, `select * from pg_policies where schemaname in ('public','storage')`)
  writeFileSync(join(pasta, 'politicas_rls.json'), JSON.stringify(politicas, null, 1))
  resumo.politicas_rls = politicas.length
  return resumo
}

async function aplicar(db, arquivos) {
  for (const arq of arquivos) {
    const sql = readFileSync(arq, 'utf8')
    process.stdout.write(`Aplicando ${arq} ... `)
    await db.query('begin')
    try {
      await db.query(sql)
      await db.query('commit')
      console.log('OK')
    } catch (err) {
      await db.query('rollback')
      console.log('ERRO — nada foi alterado por este arquivo')
      throw err
    }
  }
}

async function verificar(db) {
  return q(db, readFileSync(new URL('supabase/verificacao.sql', raiz), 'utf8'))
}

const [cmd, ...args] = process.argv.slice(2)
const db = await conectar()
try {
  if (cmd === 'diagnostico') console.log(JSON.stringify(await diagnostico(db), null, 2))
  else if (cmd === 'backup') console.log(JSON.stringify(await backup(db, args[0]), null, 2))
  else if (cmd === 'aplicar') await aplicar(db, args)
  else if (cmd === 'verificar') console.table((await verificar(db)).map((r) => ({ ...r, detalhe: String(r.detalhe).slice(0, 140) })))
  else console.log('Uso: node scripts/banco.mjs diagnostico | backup <pasta> | aplicar <arquivos.sql> | verificar')
} catch (err) {
  console.error(`\n${err.message}${err.detail ? `\n${err.detail}` : ''}${err.where ? `\n${err.where}` : ''}`)
  process.exitCode = 1
} finally {
  await db.end()
}

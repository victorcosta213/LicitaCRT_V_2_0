// Executa as migrations reais num Postgres em memória (PGlite) e verifica RLS,
// triggers, auditoria e correções de dados, simulando o Supabase
// (papel authenticated + auth.uid(), auth.users e Storage).
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), 'utf8')
const MIGRATIONS = ['20261015_gestao_contratual.sql', '20261016_processos_importacao.sql',
  '20261017_correcoes_producao.sql', '20261018_fluxo_funcional.sql', '20261019_atualizacao_automatica.sql', '20261020_senha_provisoria.sql', '20261021_tramitacao.sql', '20261022_perfil_presidente.sql', '20261023_perfis_setoriais.sql', '20261024_documentos_assinatura.sql', '20261025_solicitacoes_compras.sql', '20261026_fluxo_secretarias.sql']
  .map((f) => ler(`../supabase/migrations/${f}`))
const [M1, M2, M3] = MIGRATIONS
const VERIFICACAO = ler('../supabase/verificacao.sql')

// O que o Supabase já tem antes das migrations (papéis, auth, storage e tabelas legadas)
const SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create table auth.users (id uuid primary key, email text, encrypted_password text, created_at timestamptz default now());
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
    name text not null, owner uuid
  );
  alter table storage.objects enable row level security;
  grant usage on schema auth, public, storage to authenticated, anon;
  create table public.usuarios (
    id uuid primary key, nome text, email text, role text, ativo boolean default true,
    created_at timestamptz default now(), updated_at timestamptz
  );
  create table public.processos (
    id uuid primary key default gen_random_uuid(), numero text, objeto text, etapa text,
    prazo date, fluxo jsonb, created_at timestamptz default now()
  );
`
const GRANTS = `
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to authenticated;
`

async function novoBanco({ antes = '', migrations = MIGRATIONS } = {}) {
  const banco = new PGlite()
  await banco.exec(SUPABASE + antes)
  for (const sql of migrations) await banco.exec(sql)
  await banco.exec(GRANTS)
  return banco
}

const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const U = {
  admin: uid(1), compras: uid(2), gestor: uid(3), fiscal: uid(4), fiscal2: uid(5),
  financeiro: uid(6), viewer: uid(7), inativo: uid(8), editor: uid(9), substituto: uid(10), gabinete: uid(11), presidente: uid(12),
  juridico: uid(13), administrativo: uid(14), rh: uid(15), ti: uid(16), secretario: uid(17), secretario2: uid(18),
  semPerfil: uid(99),
}
const C1 = uid(101)
const C2 = uid(102)
const C3 = uid(103) // contratação criada por Compras durante os testes do fluxo
const K1 = uid(201)
const P1 = uid(301)

let db

// Executa SQL como um usuário autenticado (RLS ativa); o papel é desfeito ao fim.
async function como(usuario, sql, params = [], banco = db) {
  return banco.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [U[usuario] ?? usuario])
    await tx.exec('set local role authenticated')
    return tx.query(sql, params)
  })
}
const contar = async (usuario, tabela) => Number((await como(usuario, `select count(*)::int as n from ${tabela}`)).rows[0].n)
const novoContrato = (usuario, { validado = false } = {}) => como(usuario,
  `insert into gc_contratos (numero, contratada, objeto, valor_inicial, validado_gestao)
   values ('900/2026', 'Nova', 'Objeto', 1000, $1) returning *`, [validado])

beforeAll(async () => {
  db = await novoBanco()
  await db.exec(`
    insert into usuarios (id, nome, email, role, ativo) values
      ('${U.admin}', 'Admin', 'admin@x', 'admin', true),
      ('${U.compras}', 'Compras', 'compras@x', 'compras', true),
      ('${U.gestor}', 'Gestor', 'gestor@x', 'gestor', true),
      ('${U.fiscal}', 'Fiscal', 'fiscal@x', 'fiscal', true),
      ('${U.fiscal2}', 'Fiscal 2', 'fiscal2@x', 'fiscal', true),
      ('${U.financeiro}', 'Financeiro', 'fin@x', 'financeiro', true),
      ('${U.viewer}', 'Viewer', 'viewer@x', 'viewer', true),
      ('${U.inativo}', 'Ex-gestor', 'ex@x', 'gestor', false),
      ('${U.editor}', 'Editor', 'editor@x', 'editor', true),
      ('${U.substituto}', 'Substituto', 'substituto@x', 'fiscal', true),
      ('${U.gabinete}', 'Gabinete', 'gabinete@x', 'gabinete', true),
      ('${U.presidente}', 'Presidente', 'presidente@x', 'presidente', true),
      ('${U.juridico}', 'Jurídico', 'juridico@x', 'juridico', true),
      ('${U.administrativo}', 'Administrativo', 'adm@x', 'administrativo', true),
      ('${U.rh}', 'RH', 'rh@x', 'rh', true),
      ('${U.ti}', 'TI', 'ti@x', 'ti', true);
    insert into gc_contratos (id, numero, contratada, objeto, valor_inicial, situacao) values
      ('${C1}', '001/2026', 'ACME', 'Limpeza', 120000, 'ativo'),
      ('${C2}', '002/2026', 'Beta', 'Vigilância', 80000, 'ativo');
    insert into gc_responsaveis (contrato_id, usuario_id, nome, papel) values
      ('${C1}', '${U.fiscal}', 'Fiscal', 'fiscal_tecnico');
    insert into gc_competencias (id, contrato_id, competencia) values ('${K1}', '${C1}', '2026-09-01');
    insert into processos (id, numero, objeto) values ('${P1}', '2026/001', 'Papel A4');
  `)
}, 60000)

describe('migrations', () => {
  it('são idempotentes (podem ser executadas de novo)', async () => {
    const outro = await novoBanco()
    for (const sql of MIGRATIONS) await outro.exec(sql)
    const { rows } = await outro.query(`select count(*)::int as n from gc_parametros`)
    expect(rows[0].n).toBe(16)
    await outro.close()
  }, 60000)

  it('criam os parâmetros padrão', async () => {
    const { rows } = await db.query(`select valor from gc_parametros where chave = 'alerta_vigencia_dias'`)
    expect(rows[0].valor).toEqual([120, 90, 60, 30])
  })

  it('completam a tabela processos (importação e arquivamento)', async () => {
    const { rows } = await db.query(`select column_name from information_schema.columns where table_name = 'processos'`)
    expect(rows.map((r) => r.column_name)).toEqual(expect.arrayContaining([
      'situacao_sei', 'unidade_demandante', 'modalidade', 'valor_estimado', 'arquivado', 'updated_at',
    ]))
  })

  it('o script de verificação roda e confirma os itens resolvidos pela migration', async () => {
    const { rows } = await db.query(VERIFICACAO)
    expect(rows).toHaveLength(22)
    const status = Object.fromEntries(rows.map((r) => [r.ordem, r.status]))
    for (const ordem of [1, 2, 3, 4, 5, 6, 7, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22]) expect(status[ordem], `item ${ordem}`).toBe('✅')
    expect(rows.find((r) => r.ordem === 12).detalhe).toMatch(/perfis ativos: 15 · processos: 1 · contratos: 2/)
  })
})

describe('perfis no banco (gc_role)', () => {
  it.each([
    ['admin', 'admin'], ['presidente', 'admin'], ['gestor', 'gestor'], ['viewer', 'viewer'], ['editor', 'compras'], ['gabinete', 'gabinete'],
    ['inativo', 'sem_acesso'], ['semPerfil', 'sem_acesso'],
  ])('%s → %s', async (usuario, papel) => {
    const { rows } = await como(usuario, 'select public.gc_role() as r')
    expect(rows[0].r).toBe(papel)
  })
})

describe('sem perfil ativo não há acesso (cadastro público do Supabase está aberto)', () => {
  it.each(['gc_contratos', 'gc_competencias', 'gc_responsaveis', 'gc_parametros', 'gc_auditoria', 'gc_notificacoes', 'processos', 'usuarios'])(
    'conta sem perfil não lê %s', async (tabela) => {
      expect(await contar('semPerfil', tabela)).toBe(0)
    })

  it('usuário desativado não lê contratos nem processos', async () => {
    expect(await contar('inativo', 'gc_contratos')).toBe(0)
    expect(await contar('inativo', 'processos')).toBe(0)
  })

  it('usuário desativado ainda lê o próprio perfil (para a tela avisar "acesso desativado")', async () => {
    expect(await contar('inativo', 'usuarios')).toBe(1)
  })

  it('visualizador continua lendo tudo', async () => {
    expect(await contar('viewer', `gc_contratos where id in ('${C1}', '${C2}')`)).toBe(2)
    expect(await contar('viewer', 'processos')).toBeGreaterThan(0)
  })
})

describe('exclusão proibida', () => {
  it('usuário comum não consegue excluir (nenhuma política de DELETE)', async () => {
    const r = await como('gestor', `delete from gc_contratos where id = $1`, [C1])
    expect(r.affectedRows).toBe(0)
    expect((await db.query(`select 1 from gc_contratos where id = $1`, [C1])).rows).toHaveLength(1)
  })

  it('nem com a chave de serviço: o trigger bloqueia', async () => {
    await expect(db.query(`delete from gc_competencias where id = $1`, [K1])).rejects.toThrow(/não podem ser excluídos/)
  })
})

describe('cadastro do contrato (Compras × Gestão)', () => {
  it('Compras cadastra e o banco carimba autor e situação inicial', async () => {
    const { rows: [c] } = await como('compras', `insert into gc_contratos (numero, contratada, objeto, created_by)
      values ('010/2026', 'X', 'Y', '${U.admin}') returning *`)
    expect(c.situacao).toBe('em_cadastro')
    expect(c.created_by).toBe(U.compras)
    expect(Number(c.id_interno)).toBeGreaterThan(0)
  })

  it('Compras não valida o cadastro', async () => {
    await expect(novoContrato('compras', { validado: true })).rejects.toThrow(/atribuição da gestão/)
  })

  it('após a validação da gestão, Compras não altera mais', async () => {
    const { rows: [c] } = await novoContrato('compras')
    await como('gestor', `update gc_contratos set validado_gestao = true where id = $1`, [c.id])
    await expect(como('compras', `update gc_contratos set objeto = 'mudou' where id = $1`, [c.id]))
      .rejects.toThrow(/alteração permitida apenas ao gestor/)
    const r = await como('gestor', `update gc_contratos set objeto = 'mudou' where id = $1 returning created_by, updated_by`, [c.id])
    expect(r.rows[0]).toEqual({ created_by: U.compras, updated_by: U.gestor })
  })

  it.each(['fiscal', 'financeiro', 'viewer', 'inativo', 'semPerfil'])('%s não cadastra contrato', async (usuario) => {
    await expect(novoContrato(usuario)).rejects.toThrow(/row-level security/)
  })
})

describe('ordem de serviço', () => {
  it('Compras só registra a solicitação', async () => {
    await expect(como('compras', `insert into gc_ordens_servico (contrato_id, status) values ($1, 'emitida')`, [C1]))
      .rejects.toThrow(/só pode registrar a solicitação/)
  })

  it('depois que a gestão assume, Compras não altera a OS', async () => {
    const { rows: [os] } = await como('compras', `insert into gc_ordens_servico (contrato_id) values ($1) returning id`, [C1])
    await como('gestor', `update gc_ordens_servico set status = 'em_conferencia' where id = $1`, [os.id])
    await expect(como('compras', `update gc_ordens_servico set observacoes = 'x' where id = $1`, [os.id]))
      .rejects.toThrow(/já está em tratamento/)
  })
})

describe('visibilidade do fiscal', () => {
  it('fiscal vê apenas os contratos em que está designado', async () => {
    expect(await contar('fiscal', `gc_contratos where id in ('${C1}', '${C2}')`)).toBe(1)
    expect(await contar('fiscal2', `gc_contratos where id in ('${C1}', '${C2}')`)).toBe(0)
    expect(await contar('gestor', `gc_contratos where id in ('${C1}', '${C2}')`)).toBe(2)
  })

  it('o mesmo vale para competências e auditoria', async () => {
    expect(await contar('fiscal', `gc_competencias where id = '${K1}'`)).toBe(1)
    expect(await contar('fiscal2', `gc_competencias where id = '${K1}'`)).toBe(0)
    expect(await contar('fiscal2', `gc_auditoria where contrato_id = '${C1}'`)).toBe(0)
  })
})

const notificados = async (contrato, trecho) => (await db.query(
  `select email from gc_notificacoes where contrato_id = $1 and assunto ilike $2 order by email`, [contrato, `%${trecho}%`]))
  .rows.map((r) => r.email)

describe('competência: o fiscal registra NF, fiscalização e atesto; a Gestão confere', () => {
  it('fiscal registra a NF e a fiscalização', async () => {
    const r = await como('fiscal', `update gc_competencias set nf_recebida = true, nf_numero = '458', nf_valor_bruto = 1000,
      nf_recebimento_data = '2026-10-16', relatorio_recebido = true, execucao_realizada = true where id = $1`, [K1])
    expect(r.affectedRows).toBe(1)
  })

  it('fiscal não libera ao Financeiro nem suspende', async () => {
    await expect(como('fiscal', `update gc_competencias set liberado_financeiro = true where id = $1`, [K1]))
      .rejects.toThrow(/atos da Gestão/)
    await expect(como('fiscal', `update gc_competencias set suspensa = true where id = $1`, [K1]))
      .rejects.toThrow(/atos da Gestão/)
  })

  it('a Gestão não registra NF, glosa nem atesta', async () => {
    await expect(como('gestor', `update gc_competencias set nf_numero = '999' where id = $1`, [K1]))
      .rejects.toThrow(/registrados pelo fiscal/)
    await expect(como('gestor', `update gc_competencias set houve_glosa = true where id = $1`, [K1]))
      .rejects.toThrow(/registrados pelo fiscal/)
    await expect(como('gestor', `update gc_competencias set atestado = true where id = $1`, [K1]))
      .rejects.toThrow(/A Gestão não atesta/)
  })

  it('fiscal de outro contrato não altera nada', async () => {
    const r = await como('fiscal2', `update gc_competencias set relatorio_recebido = false where id = $1`, [K1])
    expect(r.affectedRows).toBe(0)
  })

  it('o fiscal abre a competência ao receber a NF', async () => {
    const { rows: [k] } = await como('fiscal', `insert into gc_competencias (contrato_id, competencia, nf_recebida, nf_numero, nf_recebimento_data)
      values ($1, '2027-01-01', true, '501', '2027-02-02') returning nf_numero`, [C1])
    expect(k.nf_numero).toBe('501')
  })

  it('fiscal não abre competência em contratação alheia', async () => {
    await expect(como('fiscal2', `insert into gc_competencias (contrato_id, competencia) values ($1, '2027-02-01')`, [C1]))
      .rejects.toThrow(/row-level security/)
  })

  it('a Gestão pode abrir a competência, mas sem dados do fiscal', async () => {
    await como('gestor', `insert into gc_competencias (contrato_id, competencia) values ($1, '2027-03-01')`, [C1])
    await expect(como('gestor', `insert into gc_competencias (contrato_id, competencia, nf_recebida) values ($1, '2027-04-01', true)`, [C1]))
      .rejects.toThrow(/registrados pelo fiscal/)
  })

  it('uma competência por contrato e mês', async () => {
    await expect(como('gestor', `insert into gc_competencias (contrato_id, competencia) values ($1, '2026-09-01')`, [C1]))
      .rejects.toMatchObject({ code: '23505' })
  })

  it('valor líquido = NF (ou medição) − glosa, calculado pelo banco', async () => {
    const { rows } = await como('fiscal', `insert into gc_competencias (contrato_id, competencia, nf_valor_bruto, valor_medido, glosa_valor)
      values ($1, '2026-10-01', 1000, 900, 150), ($1, '2026-11-01', null, 500, null) returning valor_liquido`, [C1])
    expect(rows.map((r) => Number(r.valor_liquido))).toEqual([850, 500])
  })

  describe('atesto, devolução, ocorrência e liberação', () => {
    let k
    beforeAll(async () => {
      ({ rows: [k] } = await como('fiscal', `insert into gc_competencias (contrato_id, competencia, nf_recebida, relatorio_recebido)
        values ($1, '2026-08-01', true, true) returning id`, [C1]))
    })

    it('atesto exige NF, fiscalização e documentação conferida', async () => {
      await expect(como('fiscal', `update gc_competencias set atestado = true where id = $1`, [k.id]))
        .rejects.toThrow(/O atesto exige/)
      await como('fiscal', `update gc_competencias set doc_completa = true, atestado = true, atesto_data = '2026-10-17' where id = $1`, [k.id])
      expect(await notificados(C1, 'atestada')).toEqual(['gestor@x'])
    })

    it('a Gestão devolve ao fiscal somente com motivo', async () => {
      await expect(como('gestor', `update gc_competencias set atestado = false where id = $1`, [k.id]))
        .rejects.toThrow(/informe o motivo/)
      await como('gestor', `update gc_competencias set atestado = false, devolucao_motivo = 'NF sem retenção',
        devolvido_em = now() where id = $1`, [k.id])
      expect(await notificados(C1, 'devolvida')).toEqual(['fiscal@x'])
      await como('fiscal', `update gc_competencias set atestado = true where id = $1`, [k.id])
    })

    it('ocorrência em aberto impede a liberação ao Financeiro', async () => {
      const { rows: [o] } = await como('fiscal', `insert into gc_ocorrencias (contrato_id, competencia_id, tipo, descricao)
        values ($1, $2, 'atraso', 'Atraso na entrega') returning id`, [C1, k.id])
      await expect(como('gestor', `update gc_competencias set liberado_financeiro = true where id = $1`, [k.id]))
        .rejects.toThrow(/ocorrência em aberto/)
      await como('gestor', `update gc_ocorrencias set status = 'regularizada' where id = $1`, [o.id])
      await como('gestor', `update gc_competencias set liberado_financeiro = true, liberado_data = '2026-10-18' where id = $1`, [k.id])
      expect(await notificados(C1, 'liberada')).toEqual(['fin@x'])
    })

    it('competência liberada não pode perder o atesto', async () => {
      await expect(como('fiscal', `update gc_competencias set atestado = false where id = $1`, [k.id]))
        .rejects.toThrow(/atestada antes de ser liberada/)
    })

    it('o Financeiro só lança competências liberadas pela Gestão', async () => {
      await como('financeiro', `insert into gc_execucoes (contrato_id, competencia_id, valor_competencia) values ($1, $2, 1000)`, [C1, k.id])
      await expect(como('financeiro', `insert into gc_execucoes (contrato_id, competencia_id, valor_competencia) values ($1, $2, 1000)`, [C1, K1]))
        .rejects.toThrow(/só lança competências liberadas/)
    })
  })
})

describe('Compras encaminha a contratação à Gestão', () => {
  it('a contratação pode ser Nota de Empenho; sem os dados mínimos não é encaminhada', async () => {
    const { rows: [c] } = await como('compras', `insert into gc_contratos (id, numero, contratada, objeto, instrumento)
      values ('${C3}', 'NE 77/2026', 'Omega', 'Toner', 'nota_empenho') returning instrumento`)
    expect(c.instrumento).toBe('nota_empenho')
    await expect(como('compras', `select public.gc_encaminhar_contratacao($1, 'oc')`, [C3]))
      .rejects.toThrow(/preencha: processo SEI, valor, vigência ou prazo de execução/)
  })

  it('encaminha, gera a solicitação de fiscais e a de OS/OC, e avisa a Gestão', async () => {
    await como('compras', `update gc_contratos set sei_processo = '0001/2026', valor_inicial = 5000, prazo_execucao_dias = 30 where id = $1`, [C3])
    await como('compras', `select public.gc_encaminhar_contratacao($1, 'oc')`, [C3])
    expect((await db.query(`select tipo, status from gc_ordens_servico where contrato_id = $1`, [C3])).rows)
      .toEqual([{ tipo: 'oc', status: 'solicitada' }])
    expect((await db.query(`select descricao, status from gc_pendencias where contrato_id = $1`, [C3])).rows)
      .toEqual([{ descricao: expect.stringMatching(/^Designar fiscal titular/), status: 'aberta' }])
    expect(await notificados(C3, 'recebida de Compras')).toEqual(['gestor@x'])
  })

  it('depois de encaminhar, Compras só consulta', async () => {
    await expect(como('compras', `update gc_contratos set objeto = 'mudou' where id = $1`, [C3]))
      .rejects.toThrow(/Compras mantém apenas a consulta/)
    expect(await contar('compras', `gc_contratos where id = '${C3}'`)).toBe(1)
  })

  it('só a Gestão marca uma contratação como já em execução', async () => {
    await expect(como('compras', `insert into gc_contratos (numero, contratada, objeto, execucao_anterior)
      values ('X1', 'Y', 'Z', true)`)).rejects.toThrow(/Somente a Gestão marca/)
    const { rows: [c] } = await como('gestor', `insert into gc_contratos (numero, contratada, objeto, execucao_anterior)
      values ('X2', 'Y', 'Z', true) returning execucao_anterior`)
    expect(c.execucao_anterior).toBe(true)
  })

  it('não encaminha duas vezes e só Compras encaminha', async () => {
    await expect(como('compras', `select public.gc_encaminhar_contratacao($1, 'os')`, [C3])).rejects.toThrow(/já encaminhada/)
    await expect(como('gestor', `select public.gc_encaminhar_contratacao($1, 'os')`, [C3])).rejects.toThrow(/Somente Compras/)
  })
})

describe('formalização da fiscalização e OS/OC', () => {
  const os = async () => (await db.query(`select id from gc_ordens_servico where contrato_id = $1`, [C3])).rows[0].id
  const formalizada = async () => (await db.query(`select public.gc_fiscalizacao_formalizada($1) as f`, [C3])).rows[0].f

  it('a Gestão recebe, mas a portaria não segue sem titular e substituto', async () => {
    await como('gestor', `update gc_contratos set validado_gestao = true, situacao = 'ativo' where id = $1`, [C3])
    await expect(como('gestor', `update gc_contratos set portaria_status = 'aguardando_publicacao' where id = $1`, [C3]))
      .rejects.toThrow(/fiscal titular e o fiscal substituto/)
  })

  it('designar titular e substituto encerra a solicitação de Compras e avisa os fiscais', async () => {
    await como('gestor', `insert into gc_responsaveis (contrato_id, usuario_id, nome, papel)
      values ($1, $2, 'Fiscal', 'fiscal_tecnico'), ($1, $3, 'Substituto', 'fiscal_substituto')`, [C3, U.fiscal, U.substituto])
    expect((await db.query(`select status from gc_pendencias where contrato_id = $1`, [C3])).rows).toEqual([{ status: 'concluida' }])
    expect(await notificados(C3, 'atribuída a você')).toEqual(['fiscal@x', 'substituto@x'])
  })

  it('a portaria segue ao Gabinete, que passa a ver apenas esta contratação', async () => {
    expect(await contar('gabinete', 'gc_contratos')).toBe(0)
    await como('gestor', `update gc_contratos set portaria_status = 'aguardando_publicacao' where id = $1`, [C3])
    expect(await contar('gabinete', 'gc_contratos')).toBe(1)
    expect(await notificados(C3, 'Portaria')).toEqual(['gabinete@x'])
  })

  it('o Gabinete registra a publicação (com os dados obrigatórios)', async () => {
    await expect(como('gabinete', `select public.gc_registrar_publicacao_portaria($1, '', null, null)`, [C3]))
      .rejects.toThrow(/informe o nº da portaria/)
    await expect(como('gabinete', `select public.gc_registrar_publicacao_portaria($1, '1', '2026-10-01', '2026-10-01')`, [C1]))
      .rejects.toThrow(/não está aguardando publicação/)
    await como('gabinete', `select public.gc_registrar_publicacao_portaria($1, '12/2026', '2026-10-10', '2026-10-11', 'Diário Oficial', '123456', 'https://sei/123456')`, [C3])
    const { rows: [c] } = await db.query(`select portaria_status, portaria_numero, portaria_sei from gc_contratos where id = $1`, [C3])
    expect(c).toEqual({ portaria_status: 'publicada', portaria_numero: '12/2026', portaria_sei: '123456' })
  })

  it('sem o termo de ciência, a fiscalização não está formalizada e a OS/OC não vai à assinatura', async () => {
    expect(await formalizada()).toBe(false)
    await como('gestor', `update gc_ordens_servico set status = 'em_conferencia' where id = $1`, [await os()])
    await expect(como('gestor', `update gc_ordens_servico set status = 'aguardando_assinatura' where id = $1`, [await os()]))
      .rejects.toThrow(/fiscalização formalizada/)
  })

  it('com o termo registrado: assinatura do Presidente e do Diretor Financeiro, envio e início da execução', async () => {
    await como('gestor', `update gc_responsaveis set ciente_em = '2026-10-12' where contrato_id = $1`, [C3])
    expect(await formalizada()).toBe(true)
    const id = await os()
    await como('gestor', `update gc_ordens_servico set status = 'aguardando_assinatura' where id = $1`, [id])
    expect(await notificados(C3, 'OS/OC aguardando assinatura')).toEqual(['gabinete@x'])

    await como('gabinete', `select public.gc_registrar_assinatura_os($1, '2026-10-13', null)`, [id])
    expect((await db.query(`select status from gc_ordens_servico where id = $1`, [id])).rows[0].status).toBe('aguardando_assinatura')
    await como('gabinete', `select public.gc_registrar_assinatura_os($1, null, '2026-10-14', '777', null)`, [id])
    expect((await db.query(`select status, sei_documento from gc_ordens_servico where id = $1`, [id])).rows[0])
      .toEqual({ status: 'emitida', sei_documento: '777' })

    await expect(como('gestor', `update gc_ordens_servico set status = 'aguardando_ciencia' where id = $1`, [id]))
      .rejects.toThrow(/data e o meio de envio/)
    await como('gestor', `update gc_ordens_servico set status = 'aguardando_ciencia', envio_data = '2026-10-15', envio_meio = 'e-mail' where id = $1`, [id])
    await expect(como('gestor', `update gc_ordens_servico set status = 'vigente' where id = $1`, [id]))
      .rejects.toThrow(/recebimento pela contratada/)
    await como('gestor', `update gc_ordens_servico set status = 'vigente', data_ciencia = '2026-10-15', data_efetiva_inicio = '2026-10-16' where id = $1`, [id])
  })

  it('OS/OC nova sempre começa do início do fluxo', async () => {
    await expect(como('gestor', `insert into gc_ordens_servico (contrato_id, status) values ($1, 'vigente')`, [C3]))
      .rejects.toThrow(/começa como solicitada ou rascunho/)
  })
})

describe('fiscal substituto em atuação', () => {
  it('o substituto só pratica atos quando acionado', async () => {
    const abrir = () => como('substituto', `insert into gc_competencias (contrato_id, competencia) values ($1, '2026-11-01')`, [C3])
    expect(await contar('substituto', `gc_contratos where id = '${C3}'`)).toBe(1)
    await expect(abrir()).rejects.toThrow(/row-level security/)
    await como('fiscal', `select public.gc_definir_substituto_em_atuacao($1, true)`, [C3])
    expect(await notificados(C3, 'em atuação')).toEqual(['substituto@x'])
    await abrir()
  })

  it('só a Gestão ou os fiscais da contratação acionam o substituto', async () => {
    await expect(como('viewer', `select public.gc_definir_substituto_em_atuacao($1, false)`, [C3])).rejects.toThrow(/Somente a Gestão/)
    await expect(como('fiscal2', `select public.gc_definir_substituto_em_atuacao($1, false)`, [C3])).rejects.toThrow(/Somente a Gestão/)
    await como('gestor', `select public.gc_definir_substituto_em_atuacao($1, false)`, [C3])
  })
})

describe('cancelamento e notificações', () => {
  it('cancelar exige justificativa', async () => {
    const { rows: [p] } = await como('gestor', `insert into gc_pendencias (contrato_id, descricao) values ($1, 'Teste') returning id`, [C1])
    await expect(como('gestor', `update gc_pendencias set cancelado = true where id = $1`, [p.id])).rejects.toThrow(/justificativa/)
    await como('gestor', `update gc_pendencias set cancelado = true, cancelamento_motivo = 'Lançada em duplicidade' where id = $1`, [p.id])
  })

  it('desativar gestor/fiscal também exige justificativa', async () => {
    const { rows: [r] } = await como('gestor', `insert into gc_responsaveis (contrato_id, nome, papel)
      values ($1, 'Temporário', 'fiscal_administrativo') returning id`, [C2])
    await expect(como('gestor', `update gc_responsaveis set ativo = false where id = $1`, [r.id]))
      .rejects.toThrow(/justificativa da desativação/)
    await como('gestor', `update gc_responsaveis set ativo = false, cancelamento_motivo = 'Substituído' where id = $1`, [r.id])
  })

  it('cada um vê só as próprias notificações; o admin vê todas', async () => {
    const proprias = Number((await db.query(`select count(*)::int as n from gc_notificacoes where usuario_id = $1`, [U.fiscal])).rows[0].n)
    expect(proprias).toBeGreaterThan(0)
    expect(await contar('fiscal', 'gc_notificacoes')).toBe(proprias)
    const total = Number((await db.query('select count(*)::int as n from gc_notificacoes')).rows[0].n)
    expect(await contar('admin', 'gc_notificacoes')).toBe(total)
  })
})

describe('financeiro', () => {
  it.each(['compras', 'gestor', 'fiscal'])('%s não registra empenho', async (usuario) => {
    await expect(como(usuario, `insert into gc_empenhos (contrato_id, numero, exercicio, valor_inicial) values ($1, 'NE${usuario}', 2026, 10)`, [C1]))
      .rejects.toThrow(/row-level security/)
  })

  it('financeiro registra empenho e reforço; valor do movimento precisa ser positivo', async () => {
    const { rows: [e] } = await como('financeiro', `insert into gc_empenhos (contrato_id, numero, exercicio, valor_inicial)
      values ($1, '2026NE001', 2026, 50000) returning id`, [C1])
    await como('financeiro', `insert into gc_empenho_movs (empenho_id, contrato_id, tipo, valor) values ($1, $2, 'reforco', 100)`, [e.id, C1])
    await expect(como('financeiro', `insert into gc_empenho_movs (empenho_id, contrato_id, tipo, valor) values ($1, $2, 'reforco', 0)`, [e.id, C1]))
      .rejects.toMatchObject({ code: '23514' })
  })
})

describe('parâmetros', () => {
  it('somente admin altera', async () => {
    await expect(como('gestor', `insert into gc_parametros (chave, valor) values ('novo', '1')`)).rejects.toThrow(/row-level security/)
    const r = await como('gestor', `update gc_parametros set valor = '"gestor"' where chave = 'atesto_por'`)
    expect(r.affectedRows).toBe(0)
    const ok = await como('admin', `update gc_parametros set valor = '"gestor"' where chave = 'atesto_por'`)
    expect(ok.affectedRows).toBe(1)
  })
})

describe('usuarios (perfis)', () => {
  it('cada um lê só o próprio perfil', async () => {
    expect(await contar('fiscal', 'usuarios')).toBe(1)
    expect(await contar('compras', 'usuarios')).toBe(1)
  })

  it('gestor (designa fiscais) e admin leem todos', async () => {
    const total = Number((await db.query('select count(*)::int as n from usuarios')).rows[0].n)
    expect(await contar('gestor', 'usuarios')).toBe(total)
    expect(await contar('admin', 'usuarios')).toBe(total)
  })

  it('ninguém se promove a administrador', async () => {
    const r = await como('compras', `update usuarios set role = 'admin' where id = $1`, [U.compras])
    expect(r.affectedRows).toBe(0)
    expect((await db.query('select role from usuarios where id = $1', [U.compras])).rows[0].role).toBe('compras')
    await expect(como('gestor', `insert into usuarios (id, email, role, ativo) values ('${uid(50)}', 'x@x', 'admin', true)`))
      .rejects.toThrow(/row-level security/)
  })

  it('admin cria perfil; sem informar "ativo", ele nasce sem acesso', async () => {
    await como('admin', `insert into usuarios (id, nome, email, role) values ('${uid(51)}', 'Novo', 'novo@x', 'fiscal')`)
    expect((await db.query('select ativo from usuarios where id = $1', [uid(51)])).rows[0].ativo).toBe(false)
  })

  it('admin altera o perfil de outra pessoa', async () => {
    const r = await como('admin', `update usuarios set nome = 'Visualizador' where id = $1`, [U.viewer])
    expect(r.affectedRows).toBe(1)
  })

  it('admin não tira o próprio acesso nem se apaga', async () => {
    await expect(como('admin', `update usuarios set role = 'viewer' where id = $1`, [U.admin])).rejects.toThrow(/próprio acesso/)
    await expect(como('admin', `update usuarios set ativo = false where id = $1`, [U.admin])).rejects.toThrow(/próprio acesso/)
    expect((await como('admin', `delete from usuarios where id = $1`, [U.admin])).affectedRows).toBe(0)
  })

  it('perfil inexistente é recusado', async () => {
    await expect(como('admin', `update usuarios set role = 'superadmin' where id = $1`, [U.viewer]))
      .rejects.toMatchObject({ code: '23514' })
  })
})

describe('processos (módulo licitatório)', () => {
  it('Compras cria, edita, arquiva e exclui; o banco registra a alteração', async () => {
    const { rows: [p] } = await como('compras', `insert into processos (numero, objeto) values ('2026/050', 'Cadeiras') returning *`)
    expect(p.arquivado).toBe(false)
    const { rows: [e] } = await como('compras', `update processos set arquivado = true where id = $1 returning updated_at`, [p.id])
    expect(e.updated_at).not.toBeNull()
    expect((await como('compras', `delete from processos where id = $1`, [p.id])).affectedRows).toBe(1)
  })

  it('visualizador lê, mas não grava', async () => {
    expect(await contar('viewer', 'processos')).toBeGreaterThan(0)
    await expect(como('viewer', `insert into processos (numero, objeto) values ('x', 'y')`)).rejects.toThrow(/row-level security/)
    expect((await como('viewer', `update processos set objeto = 'z' where id = $1`, [P1])).affectedRows).toBe(0)
  })

  it.each(['gestor', 'fiscal', 'financeiro'])('%s não grava processos', async (usuario) => {
    await expect(como(usuario, `insert into processos (numero, objeto) values ('x', 'y')`)).rejects.toThrow(/row-level security/)
  })
})

describe('anexos (Storage)', () => {
  const enviar = (usuario, nome) => como(usuario, `insert into storage.objects (bucket_id, name) values ('anexos', $1)`, [nome])

  it('o bucket "anexos" é privado', async () => {
    const { rows } = await db.query(`select public from storage.buckets where id = 'anexos'`)
    expect(rows).toEqual([{ public: false }])
  })

  it('Compras envia; quem tem perfil abre; sem perfil não vê', async () => {
    await enviar('compras', 'anexos/2026/001/edital.pdf')
    expect(await contar('viewer', `storage.objects where bucket_id = 'anexos'`)).toBe(1)
    expect(await contar('semPerfil', `storage.objects where bucket_id = 'anexos'`)).toBe(0)
  })

  it.each(['viewer', 'gestor', 'semPerfil'])('%s não envia anexo', async (usuario) => {
    await expect(enviar(usuario, `x-${usuario}.pdf`)).rejects.toThrow(/row-level security/)
  })
})

describe('auditoria', () => {
  it('registra quem alterou, antes e depois', async () => {
    await como('gestor', `update gc_contratos set objeto = 'Limpeza predial' where id = $1`, [C1])
    const { rows } = await db.query(`select * from gc_auditoria where registro_id = $1 and acao = 'UPDATE' order by id desc limit 1`, [C1])
    expect(rows[0]).toMatchObject({ tabela: 'gc_contratos', contrato_id: C1, usuario_id: U.gestor, usuario_nome: 'Gestor' })
    expect(rows[0].antes.objeto).toBe('Limpeza')
    expect(rows[0].depois.objeto).toBe('Limpeza predial')
  })

  it('não registra atualização sem mudança real', async () => {
    const antes = (await db.query(`select count(*)::int as n from gc_auditoria where registro_id = $1`, [C1])).rows[0].n
    await como('gestor', `update gc_contratos set objeto = objeto where id = $1`, [C1])
    const depois = (await db.query(`select count(*)::int as n from gc_auditoria where registro_id = $1`, [C1])).rows[0].n
    expect(depois).toBe(antes)
  })

  it('usuário não grava auditoria diretamente', async () => {
    await expect(como('admin', `insert into gc_auditoria (tabela, acao) values ('x', 'FAKE')`)).rejects.toThrow(/row-level security/)
  })
})

describe('contratos legados (tabela "contratos", valor em texto como em produção)', () => {
  const LEGADO = `
    create table public.contratos (
      id uuid primary key default gen_random_uuid(), numero text, fornecedor text, objeto text,
      valor text, data_assinatura date, data_vencimento date
    );
    insert into public.contratos (numero, fornecedor, objeto, valor, data_assinatura, data_vencimento) values
      ('001', 'ACME', 'Limpeza', '1.234,56', '2026-01-10', '2027-01-09'),
      ('002', 'Beta', 'TI', '1500.75', null, null),
      ('003', 'Gama', 'Obra', 'R$ 2.000,00', null, null),
      ('005', 'Delta', 'Copa', '2500.50', null, null),
      ('',    '',     '',     '',          null, null);
  `
  const valorDe = async (banco, numero) => Number((await banco.query(
    `select g.valor_inicial from gc_contratos g join contratos c on g.legacy_id = c.id::text where c.numero = $1`, [numero])).rows[0].valor_inicial)

  let legado
  beforeAll(async () => {
    // estado de produção: só as duas primeiras migrations aplicadas
    legado = await novoBanco({ antes: LEGADO, migrations: [M1, M2] })
  }, 60000)

  it('a importação original errava valores com ponto decimal e com "R$"', async () => {
    expect(await valorDe(legado, '001')).toBe(1234.56)
    expect(await valorDe(legado, '002')).toBe(150075)
    expect(await valorDe(legado, '003')).toBe(0)
  })

  it('a migration de correção ajusta só o que ficou errado e preserva o que alguém editou', async () => {
    await legado.exec(`update gc_contratos g set valor_inicial = 3000 from contratos c where g.legacy_id = c.id::text and c.numero = '005'`)
    await legado.exec(M3)
    expect(await valorDe(legado, '001')).toBe(1234.56)
    expect(await valorDe(legado, '002')).toBe(1500.75)
    expect(await valorDe(legado, '003')).toBe(2000)
    expect(await valorDe(legado, '005')).toBe(3000)
  })

  it('reexecutar não duplica nem altera', async () => {
    await legado.exec(M3)
    expect(Number((await legado.query('select count(*)::int as n from gc_contratos')).rows[0].n)).toBe(5)
    expect(await valorDe(legado, '002')).toBe(1500.75)
  })

  it('instalação nova (todas as migrations de uma vez) já fica correta', async () => {
    const novo = await novoBanco({ antes: LEGADO })
    expect(await valorDe(novo, '002')).toBe(1500.75)
    expect(await valorDe(novo, '003')).toBe(2000)
    const { rows } = await novo.query(`select numero, contratada, situacao, validado_gestao, execucao_anterior,
      vigencia_inicio::text as inicio, vigencia_fim::text as fim from gc_contratos order by numero`)
    expect(rows).toHaveLength(5)
    expect(rows.every((r) => r.situacao === 'ativo' && r.validado_gestao === false)).toBe(true)
    // já estavam em execução: não refazem portaria, termo e OS/OC na plataforma
    expect(rows.every((r) => r.execucao_anterior === true)).toBe(true)
    expect(rows.find((r) => r.numero === 'S/N')).toMatchObject({ contratada: 'Não informado' })
    expect(rows.find((r) => r.numero === '001')).toMatchObject({ inicio: '2026-01-10', fim: '2027-01-09' })
    await novo.close()
  }, 60000)
})

describe('perfis antigos com id diferente do login', () => {
  it('são religados pelo e-mail, levando junto as designações', async () => {
    const velho = uid(700)
    const novo = uid(701)
    const banco = await novoBanco({ migrations: [M1, M2] })
    await banco.exec(`
      insert into auth.users (id, email) values ('${novo}', 'ana@crt08.gov.br');
      insert into usuarios (id, nome, email, role, ativo) values ('${velho}', 'Ana', 'Ana@CRT08.gov.br', 'fiscal', true);
      insert into gc_contratos (id, numero, contratada, objeto) values ('${C1}', '1', 'X', 'Y');
      insert into gc_responsaveis (contrato_id, usuario_id, nome, papel) values ('${C1}', '${velho}', 'Ana', 'fiscal_tecnico');
    `)
    await banco.exec(M3)
    expect((await banco.query('select id from usuarios')).rows).toEqual([{ id: novo }])
    expect((await banco.query('select usuario_id from gc_responsaveis')).rows).toEqual([{ usuario_id: novo }])
    expect((await como(novo, 'select public.gc_role() as r', [], banco)).rows[0].r).toBe('fiscal')
    expect(Number((await como(novo, 'select count(*)::int as n from gc_contratos', [], banco)).rows[0].n)).toBe(1)
    await banco.close()
  }, 60000)
})

describe('atualização automática (Realtime)', () => {
  it('a verificação (item 15) acusa o Realtime ausente e aprova quando está configurado', async () => {
    const sem = await novoBanco()
    const itemSem = (await sem.query(VERIFICACAO)).rows.find((r) => Number(r.ordem) === 15)
    expect(itemSem.status).toBe('⚠️')
    expect(itemSem.detalhe).toMatch(/inexistente/)
    await sem.close()
    const com = await novoBanco({ antes: 'create publication supabase_realtime;' })
    expect((await com.query(VERIFICACAO)).rows.find((r) => Number(r.ordem) === 15).status).toBe('✅')
    await com.close()
  }, 60000)

  const REALTIME = ['gc_contratos', 'gc_responsaveis', 'gc_ordens_servico', 'gc_competencias', 'gc_empenhos',
    'gc_empenho_movs', 'gc_execucoes', 'gc_eventos', 'gc_ocorrencias', 'gc_documentos', 'gc_pendencias',
    'gc_parametros', 'processos', 'usuarios', 'tr_unidades', 'tr_processos', 'tr_tramitacoes', 'doc_documentos', 'doc_assinaturas', 'cp_solicitacoes', 'cp_eventos', 'cp_checklist', 'cp_itens']
  const M5 = MIGRATIONS[4]
  const publicadas = async (banco) => (await banco.query(
    `select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1`)).rows.map((r) => r.tablename)

  it('com a publicação do Supabase, adiciona as tabelas do sistema (e só elas)', async () => {
    const banco = await novoBanco({ antes: 'create publication supabase_realtime;' })
    expect(await publicadas(banco)).toEqual([...REALTIME].sort())
    await banco.close()
  }, 60000)

  it('é idempotente e não mexe em tabela que já estava publicada', async () => {
    const banco = await novoBanco({ antes: 'create publication supabase_realtime;' })
    await banco.exec(M5)
    await banco.exec(M5)
    expect(await publicadas(banco)).toEqual([...REALTIME].sort())
    await banco.close()
  }, 60000)

  it('sem a publicação (Realtime não configurado), a migration passa sem erro e sem criar nada', async () => {
    const banco = await novoBanco()
    expect((await banco.query(`select count(*)::int as n from pg_publication where pubname = 'supabase_realtime'`)).rows[0].n).toBe(0)
    await banco.close()
  }, 60000)

  it('não publica tabelas internas (notificações, auditoria)', async () => {
    const banco = await novoBanco({ antes: 'create publication supabase_realtime;' })
    const lista = await publicadas(banco)
    expect(lista).not.toContain('gc_notificacoes')
    expect(lista).not.toContain('gc_auditoria')
    await banco.close()
  }, 60000)
})

describe('senha provisória (primeiro acesso e redefinição)', () => {
  const NOVO = uid(60)
  const OUTRO = uid(61)
  const precisa = async (usuario) => (await como(usuario, 'select public.gc_precisa_trocar_senha() as v')).rows[0].v

  beforeAll(async () => {
    await db.exec(`insert into auth.users (id, email, encrypted_password) values
      ('${NOVO}', 'novo@x', 'hash-provisorio'), ('${OUTRO}', 'outro@x', 'hash-outro')`)
    await db.exec(`insert into usuarios (id, nome, email, role, ativo) values
      ('${NOVO}', 'Novo', 'novo@x', 'fiscal', true), ('${OUTRO}', 'Outro', 'outro@x', 'fiscal', true)`)
  })

  it('só o administrador marca uma senha como provisória', async () => {
    for (const quem of ['gestor', 'compras', 'fiscal', 'viewer', 'inativo']) {
      await expect(como(quem, 'select public.gc_marcar_senha_provisoria($1)', [NOVO]), quem).rejects.toThrow(/Somente o administrador/)
    }
    expect(await precisa(NOVO)).toBe(false)
  })

  it('marcar um login que não existe é recusado', async () => {
    await expect(como('admin', 'select public.gc_marcar_senha_provisoria($1)', [uid(777)])).rejects.toThrow(/não encontrado/)
  })

  it('depois de marcada, só a própria pessoa fica obrigada a trocar', async () => {
    await como('admin', 'select public.gc_marcar_senha_provisoria($1)', [NOVO])
    expect(await precisa(NOVO)).toBe(true)
    expect(await precisa(OUTRO)).toBe(false)
    expect(await precisa('admin')).toBe(false)
  })

  it('os usuários não leem nem gravam a tabela de referência (nem o admin, nem o gestor)', async () => {
    for (const quem of ['admin', 'gestor', NOVO]) {
      expect(await contar(quem, 'usuarios_senha_provisoria'), quem).toBe(0)
    }
    await expect(como(NOVO, `delete from usuarios_senha_provisoria where usuario_id = $1`, [NOVO]).then((r) => r.affectedRows)).resolves.toBe(0)
    expect((await db.query('select count(*)::int as n from usuarios_senha_provisoria')).rows[0].n).toBe(1)
  })

  it('a pessoa não se livra da exigência sem trocar a senha de verdade', async () => {
    await expect(como(NOVO, 'select public.gc_senha_trocada()')).rejects.toThrow(/ainda é a provisória/)
    expect(await precisa(NOVO)).toBe(true)
  })

  it('quem não estava marcado chama a função sem efeito nem erro', async () => {
    await como(OUTRO, 'select public.gc_senha_trocada()')
    expect(await precisa(OUTRO)).toBe(false)
  })

  it('depois que o hash do login muda, a exigência cai', async () => {
    await db.exec(`update auth.users set encrypted_password = 'hash-novo-escolhido-pela-pessoa' where id = '${NOVO}'`)
    await como(NOVO, 'select public.gc_senha_trocada()')
    expect(await precisa(NOVO)).toBe(false)
  })

  it('redefinir de novo volta a exigir a troca, com a nova referência', async () => {
    await db.exec(`update auth.users set encrypted_password = 'hash-padrao-de-novo' where id = '${NOVO}'`)
    await como('admin', 'select public.gc_marcar_senha_provisoria($1)', [NOVO])
    expect(await precisa(NOVO)).toBe(true)
    await expect(como(NOVO, 'select public.gc_senha_trocada()')).rejects.toThrow(/ainda é a provisória/)
    await db.exec(`update auth.users set encrypted_password = 'outro-hash' where id = '${NOVO}'`)
    await como(NOVO, 'select public.gc_senha_trocada()')
    expect(await precisa(NOVO)).toBe(false)
  })

  it('sem login não há acesso às funções', async () => {
    await expect(db.transaction(async (tx) => {
      await tx.exec('set local role anon')
      return tx.query('select public.gc_precisa_trocar_senha()')
    })).rejects.toThrow(/permission denied/)
  })
})

describe('tramitação de processos', () => {
  const unidade = async (sigla) => (await db.query('select id from tr_unidades where sigla = $1', [sigla])).rows[0].id
  const abrir = (quem, { tipo = 'Requerimento', assunto = 'Compra de cadeiras', destino = null, despacho = 'Para análise', prioridade = 'normal', prazo = null } = {}) =>
    como(quem, 'select tr_abrir_processo($1, $2, $3, $4, $5, $6, $7, $8) as id', [tipo, assunto, 'Interessado', 'Descrição', prioridade, prazo, destino, despacho])
  const estado = async (id) => (await db.query('select * from tr_processos where id = $1', [id])).rows[0]
  const historico = async (id) => (await db.query('select tipo, de_unidade, para_unidade, para_usuario, despacho from tr_tramitacoes where processo_id = $1 order by id', [id])).rows
  const visiveis = async (quem) => Number((await como(quem, 'select count(*)::int as n from tr_processos')).rows[0].n)
  let COMP, GCON, FISC, FIN, PRES, ADM, P

  beforeAll(async () => {
    ;[COMP, GCON, FISC, FIN, PRES, ADM] = await Promise.all(['COMP', 'GCON', 'FISC', 'FIN', 'PRES', 'ADM'].map(unidade))
    await db.exec(`
      update usuarios set unidade_id = '${COMP}' where id in ('${U.compras}', '${U.editor}');
      update usuarios set unidade_id = '${GCON}' where id = '${U.gestor}';
      update usuarios set unidade_id = '${FISC}' where id = '${U.fiscal}';
      update usuarios set unidade_id = '${ADM}' where id = '${U.fiscal2}';
      update usuarios set unidade_id = '${FIN}' where id = '${U.financeiro}';
      update usuarios set unidade_id = '${PRES}' where id = '${U.gabinete}';`)
  })

  it('vem com as unidades e o limite de dias parado', async () => {
    expect((await db.query('select count(*)::int as n from tr_unidades')).rows[0].n).toBe(9)
    expect((await db.query(`select valor from gc_parametros where chave = 'tr_dias_parado'`)).rows[0].valor).toBe(5)
  })

  describe('abertura', () => {
    it('numera por ano em sequência e registra a abertura no histórico', async () => {
      P = (await abrir('compras', { destino: GCON, prazo: '2026-12-31' })).rows[0].id
      const p = await estado(P)
      expect(p.numero).toMatch(/^\d{4}\/000001$/)
      expect(p).toMatchObject({ unidade_atual: GCON, situacao: 'em_andamento', recebido_em: null, responsavel_atual: null, aberto_por: U.compras })
      const outro = await estado((await abrir('compras', { destino: GCON })).rows[0].id)
      expect(outro.numero).toMatch(/^\d{4}\/000002$/)
      expect(await historico(P)).toEqual([{ tipo: 'abertura', de_unidade: COMP, para_unidade: GCON, para_usuario: null, despacho: 'Para análise' }])
    })

    it('sem destino, o processo fica na própria unidade, já recebido por quem abriu', async () => {
      const p = await estado((await abrir('gestor')).rows[0].id)
      expect(p).toMatchObject({ unidade_atual: GCON, responsavel_atual: U.gestor })
      expect(p.recebido_em).not.toBeNull()
    })

    it('recusa quem não pode abrir, quem não tem unidade e dados inválidos', async () => {
      await expect(abrir('viewer', { destino: GCON })).rejects.toThrow(/não pode abrir/)
      await expect(abrir('substituto', { destino: GCON })).rejects.toThrow(/definir a sua unidade/)
      await expect(abrir('compras', { assunto: ' x ' })).rejects.toThrow(/assunto/)
      await expect(abrir('compras', { tipo: '' })).rejects.toThrow(/tipo/)
      await expect(abrir('compras', { destino: uid(555) })).rejects.toThrow(/inexistente ou inativa/)
      await expect(abrir('compras', { prioridade: 'qualquer' })).rejects.toMatchObject({ code: '23514' })
    })

    it('o administrador abre mesmo sem unidade, desde que informe o destino', async () => {
      await expect(abrir('admin')).rejects.toThrow(/unidade de destino/)
      const p = await estado((await abrir('admin', { destino: PRES })).rows[0].id)
      expect(p.unidade_atual).toBe(PRES)
    })

    it('unidade desativada não recebe processos', async () => {
      await db.exec(`update tr_unidades set ativa = false where sigla = 'RH'`)
      const rh = await unidade('RH')
      await expect(abrir('compras', { destino: rh })).rejects.toThrow(/inexistente ou inativa/)
      await db.exec(`update tr_unidades set ativa = true where sigla = 'RH'`)
    })
  })

  describe('quem vê cada processo', () => {
    it('administração, gestão, gabinete e consulta veem todos; quem abriu e a unidade atual também', async () => {
      const total = Number((await db.query('select count(*)::int as n from tr_processos')).rows[0].n)
      for (const quem of ['admin', 'gestor', 'gabinete', 'viewer']) expect(await visiveis(quem), quem).toBe(total)
      expect(await visiveis('compras')).toBeGreaterThanOrEqual(2) // os que abriu
    })

    it('quem não participou não vê (nem as movimentações)', async () => {
      expect(await visiveis('fiscal')).toBe(0)
      expect(await visiveis('financeiro')).toBe(0)
      expect(Number((await como('fiscal', 'select count(*)::int as n from tr_tramitacoes')).rows[0].n)).toBe(0)
    })

    it('quem inativo ou sem perfil não vê nada', async () => {
      expect(await visiveis('inativo')).toBe(0)
      expect(await visiveis('semPerfil')).toBe(0)
    })
  })

  describe('enviar para outra unidade', () => {
    it('só a unidade onde o processo está pode enviar', async () => {
      await expect(como('fiscal', 'select tr_tramitar($1, $2, null, $3, null)', [P, FISC, 'tentando'])).rejects.toThrow(/Somente a unidade/)
      await expect(como('compras', 'select tr_tramitar($1, $2, null, $3, null)', [P, FISC, 'quem abriu não está mais com ele'])).rejects.toThrow(/Somente a unidade/)
      await expect(como('viewer', 'select tr_tramitar($1, $2, null, $3, null)', [P, FISC, 'consulta'])).rejects.toThrow(/Somente a unidade/)
    })

    it('exige despacho e destino válido', async () => {
      await expect(como('gestor', 'select tr_tramitar($1, $2, null, $3, null)', [P, FISC, ' '])).rejects.toThrow(/despacho/)
      await expect(como('gestor', 'select tr_tramitar($1, null, null, $2, null)', [P, 'Despacho válido'])).rejects.toThrow(/inexistente ou inativa/)
      await expect(como('gestor', 'select tr_tramitar($1, $2, null, $3, null)', [P, GCON, 'mesma unidade'])).rejects.toThrow(/já está nesta unidade/)
      await expect(como('gestor', 'select tr_tramitar($1, $2, $3, $4, null)', [P, FISC, U.compras, 'pessoa de outra unidade'])).rejects.toThrow(/não está ativa nessa unidade/)
    })

    it('move o processo, zera o recebimento e registra no histórico', async () => {
      await como('gestor', 'select tr_tramitar($1, $2, $3, $4, $5)', [P, FISC, U.fiscal, 'Verificar a especificação', '2026-11-30'])
      const p = await estado(P)
      expect(p).toMatchObject({ unidade_atual: FISC, responsavel_atual: U.fiscal, recebido_em: null })
      expect(String(p.prazo.toISOString?.() ?? p.prazo)).toMatch(/2026-11-30/)
      const h = await historico(P)
      expect(h.at(-1)).toEqual({ tipo: 'envio', de_unidade: GCON, para_unidade: FISC, para_usuario: U.fiscal, despacho: 'Verificar a especificação' })
    })

    it('quem recebeu passa a ver o processo, e quem abriu continua vendo', async () => {
      expect(await visiveis('fiscal')).toBe(1)
      expect((await como('compras', 'select 1 from tr_processos where id = $1', [P])).rows).toHaveLength(1)
    })
  })

  describe('receber', () => {
    it('a unidade recebe uma vez; repetir não duplica o histórico', async () => {
      await expect(como('financeiro', 'select tr_receber($1)', [P])).rejects.toThrow(/Somente a unidade/)
      await como('fiscal', 'select tr_receber($1)', [P])
      await como('fiscal', 'select tr_receber($1)', [P])
      const p = await estado(P)
      expect(p.recebido_em).not.toBeNull()
      expect((await historico(P)).filter((h) => h.tipo === 'recebimento')).toHaveLength(1)
    })
  })

  describe('alterar dados', () => {
    it('só a unidade atual altera, com prioridade válida, e fica no histórico', async () => {
      await expect(como('gestor', 'select tr_atualizar_dados($1, $2, null, null, $3, null)', [P, 'Novo assunto', 'alta'])).rejects.toThrow(/Somente a unidade/)
      await expect(como('fiscal', 'select tr_atualizar_dados($1, $2, null, null, $3, null)', [P, 'Novo assunto', 'maxima'])).rejects.toThrow(/Prioridade inválida/)
      await expect(como('fiscal', 'select tr_atualizar_dados($1, $2, null, null, $3, null)', [P, '  ', 'alta'])).rejects.toThrow(/assunto/)
      await como('fiscal', 'select tr_atualizar_dados($1, $2, $3, null, $4, $5)', [P, 'Compra de cadeiras ergonômicas', 'Fulano', 'alta', '2026-12-15'])
      expect(await estado(P)).toMatchObject({ assunto: 'Compra de cadeiras ergonômicas', interessado: 'Fulano', prioridade: 'alta' })
      expect((await historico(P)).at(-1).tipo).toBe('alteracao')
    })
  })

  describe('concluir e reabrir', () => {
    it('exige o motivo, e depois de concluído não envia nem altera', async () => {
      await expect(como('fiscal', 'select tr_concluir($1, $2)', [P, ' '])).rejects.toThrow(/Informe como/)
      await expect(como('gestor', 'select tr_concluir($1, $2)', [P, 'não é a unidade'])).rejects.toThrow(/Somente a unidade/)
      await como('fiscal', 'select tr_concluir($1, $2)', [P, 'Cadeiras entregues e conferidas'])
      const p = await estado(P)
      expect(p).toMatchObject({ situacao: 'concluido', motivo_conclusao: 'Cadeiras entregues e conferidas' })
      expect(p.concluido_em).not.toBeNull()
      await expect(como('fiscal', 'select tr_tramitar($1, $2, null, $3, null)', [P, GCON, 'devolver'])).rejects.toThrow(/concluído/)
      await expect(como('fiscal', 'select tr_atualizar_dados($1, $2, null, null, $3, null)', [P, 'Outro', 'normal'])).rejects.toThrow(/concluído/)
      await expect(como('fiscal', 'select tr_concluir($1, $2)', [P, 'de novo'])).rejects.toThrow(/já está concluído/)
    })

    it('a gestão reabre mesmo sem estar na unidade; consulta não', async () => {
      await expect(como('viewer', 'select tr_reabrir($1, $2)', [P, 'quero ver'])).rejects.toThrow(/não pode reabrir/)
      await expect(como('gestor', 'select tr_reabrir($1, $2)', [P, ''])).rejects.toThrow(/motivo/)
      await como('gestor', 'select tr_reabrir($1, $2)', [P, 'Faltou uma peça'])
      expect(await estado(P)).toMatchObject({ situacao: 'em_andamento', concluido_em: null, motivo_conclusao: null, recebido_em: null })
      expect((await historico(P)).map((h) => h.tipo)).toEqual(['abertura', 'envio', 'recebimento', 'alteracao', 'conclusao', 'reabertura'])
    })
  })

  describe('nomes no histórico', () => {
    it('grava o nome de quem fez cada movimentação, mesmo para quem não lê a tabela de usuários', async () => {
      const h = (await db.query('select tipo, criada_por_nome, para_usuario_nome from tr_tramitacoes where processo_id = $1 order by id', [P])).rows
      expect(h[0]).toMatchObject({ tipo: 'abertura', criada_por_nome: 'Compras' })
      expect(h[1]).toMatchObject({ tipo: 'envio', criada_por_nome: 'Gestor', para_usuario_nome: 'Fiscal' })
      expect(h[2]).toMatchObject({ tipo: 'recebimento', criada_por_nome: 'Fiscal' })
      const p = await estado(P)
      expect(p.aberto_por_nome).toBe('Compras')
    })

    it('o responsável atual acompanha quem recebeu', async () => {
      const novo = (await abrir('gestor', { destino: FISC })).rows[0].id
      expect((await estado(novo)).responsavel_nome).toBeNull()
      await como('fiscal', 'select tr_receber($1)', [novo])
      expect((await estado(novo)).responsavel_nome).toBe('Fiscal')
    })

    it('lista as pessoas ativas da unidade; consulta e inativos não usam', async () => {
      const nomes = (await como('gestor', 'select * from tr_pessoas_da_unidade($1)', [FISC])).rows.map((r) => r.nome)
      expect(nomes).toEqual(['Fiscal'])
      expect((await como('viewer', 'select * from tr_pessoas_da_unidade($1)', [FISC])).rows).toEqual([])
    })
  })

  describe('proteções', () => {
    it('ninguém grava direto nas tabelas, nem o dono do processo', async () => {
      await expect(como('compras', `insert into tr_processos (numero, tipo, assunto) values ('9999/000001', 'x', 'direto')`)).rejects.toThrow(/row-level security|permission denied/)
      expect((await como('compras', `update tr_processos set assunto = 'alterado direto' where id = $1`, [P]).catch(() => ({ affectedRows: 0 }))).affectedRows).toBe(0)
      expect((await como('admin', `delete from tr_tramitacoes where processo_id = $1`, [P]).catch(() => ({ affectedRows: 0 }))).affectedRows).toBe(0)
      expect((await historico(P)).length).toBe(6)
    })

    it('só o administrador cria e altera unidades; todos leem', async () => {
      await expect(como('compras', `insert into tr_unidades (sigla, nome) values ('X', 'Nova')`)).rejects.toThrow(/row-level security|permission denied/)
      await como('admin', `insert into tr_unidades (sigla, nome) values ('OUV', 'Ouvidoria')`)
      expect((await como('admin', `update tr_unidades set nome = 'Ouvidoria Geral' where sigla = 'OUV'`)).affectedRows).toBe(1)
      expect((await como('fiscal', `update tr_unidades set nome = 'X' where sigla = 'OUV'`).catch(() => ({ affectedRows: 0 }))).affectedRows).toBe(0)
      expect(Number((await como('fiscal', 'select count(*)::int as n from tr_unidades')).rows[0].n)).toBeGreaterThanOrEqual(10)
    })

    it('sem login as funções não executam; e ninguém chama o gerador de número direto', async () => {
      await expect(db.transaction(async (tx) => {
        await tx.exec('set local role anon')
        return tx.query('select tr_receber($1)', [P])
      })).rejects.toThrow(/permission denied/)
      await expect(como('compras', 'select tr_proximo_numero()')).rejects.toThrow(/permission denied/)
    })

    it('o administrador pode atuar em qualquer processo', async () => {
      await como('admin', 'select tr_tramitar($1, $2, null, $3, null)', [P, ADM, 'Encaminhado pela administração'])
      expect((await estado(P)).unidade_atual).toBe(ADM)
    })
  })
})

describe('perfil presidente (usuário mestre)', () => {
  let UNI, COMP2
  beforeAll(async () => {
    UNI = (await db.query(`select id from tr_unidades where sigla = 'FIN'`)).rows[0].id
    COMP2 = (await db.query(`select id from tr_unidades where sigla = 'COMP'`)).rows[0].id
  })

  it('o perfil gravado continua "presidente", mas as regras o tratam como administrador', async () => {
    expect((await db.query('select role from usuarios where id = $1', [U.presidente])).rows[0].role).toBe('presidente')
    expect((await como('presidente', 'select public.gc_role() as r')).rows[0].r).toBe('admin')
  })

  it('presidente desativado perde o acesso, como qualquer outro', async () => {
    await db.exec(`update usuarios set ativo = false where id = '${U.presidente}'`)
    expect((await como('presidente', 'select public.gc_role() as r')).rows[0].r).toBe('sem_acesso')
    expect(await contar('presidente', 'gc_contratos')).toBe(0)
    await db.exec(`update usuarios set ativo = true where id = '${U.presidente}'`)
  })

  it('vê tudo: contratações, processos, histórico e todos os perfis', async () => {
    const total = async (t) => Number((await db.query(`select count(*)::int as n from ${t}`)).rows[0].n)
    for (const t of ['gc_contratos', 'gc_competencias', 'usuarios', 'tr_processos', 'tr_tramitacoes', 'processos']) {
      expect(await contar('presidente', t), t).toBe(await total(t))
    }
    expect(await contar('presidente', 'tr_processos')).toBeGreaterThan(0)
  })

  it('faz o que cada setor faz: cadastra contratação e abre processo sem ter unidade', async () => {
    const r = await como('presidente', `insert into gc_contratos (numero, contratada, objeto, valor_inicial) values ('P01/2026', 'X', 'Y', 10) returning id`)
    expect(r.rows).toHaveLength(1)
    const id = (await como('presidente', 'select tr_abrir_processo($1, $2, null, null, $3, null, $4, $5) as id',
      ['Requerimento', 'Processo aberto pelo presidente', 'normal', UNI, 'Para análise'])).rows[0].id
    expect(id).toBeTruthy()
  })

  it('movimenta qualquer processo, mesmo fora da sua unidade, e o histórico registra o nome dele', async () => {
    const id = (await db.query(`select id from tr_processos where aberto_por_nome = 'Presidente' limit 1`)).rows[0].id
    await como('presidente', 'select tr_receber($1)', [id])
    await como('presidente', 'select tr_tramitar($1, $2, null, $3, null)', [id, COMP2, 'Encaminhado pela presidência'])
    const h = (await db.query('select tipo, criada_por_nome, despacho from tr_tramitacoes where processo_id = $1 order by id', [id])).rows
    expect(h.map((x) => x.tipo)).toEqual(['abertura', 'recebimento', 'envio'])
    expect(h.every((x) => x.criada_por_nome === 'Presidente')).toBe(true)
  })

  it('administra: cria usuários e unidades, altera parâmetros e redefine senhas', async () => {
    await como('presidente', `insert into usuarios (id, nome, email, role, ativo) values ('${uid(70)}', 'Novo', 'novo70@x', 'fiscal', true)`)
    await como('presidente', `insert into tr_unidades (sigla, nome) values ('GAB2', 'Gabinete 2')`)
    expect((await como('presidente', `update gc_parametros set valor = '"gestor"' where chave = 'atesto_por'`)).affectedRows).toBe(1)
    await db.exec(`insert into auth.users (id, email, encrypted_password) values ('${uid(70)}', 'novo70@x', 'h') on conflict do nothing`)
    await como('presidente', 'select public.gc_marcar_senha_provisoria($1)', [uid(70)])
  })

  it('o perfil é aceito no cadastro de usuários (e perfis inventados continuam recusados)', async () => {
    await como('admin', `insert into usuarios (id, nome, email, role, ativo) values ('${uid(71)}', 'Outro Presidente', 'p71@x', 'presidente', true)`)
    await expect(como('admin', `insert into usuarios (id, nome, email, role, ativo) values ('${uid(72)}', 'X', 'x72@x', 'superadmin', true)`))
      .rejects.toMatchObject({ code: '23514' })
  })

  it('ninguém se promove a presidente (só o administrador/presidente define perfis)', async () => {
    expect((await como('gestor', `update usuarios set role = 'presidente' where id = $1`, [U.gestor])).affectedRows).toBe(0)
    expect((await db.query('select role from usuarios where id = $1', [U.gestor])).rows[0].role).toBe('gestor')
  })

  it('o gestor, sem ser presidente, continua sem poder administrar', async () => {
    await expect(como('gestor', `insert into tr_unidades (sigla, nome) values ('NAO', 'Não')`)).rejects.toThrow(/row-level security|permission denied/)
    await expect(como('gestor', 'select public.gc_marcar_senha_provisoria($1)', [uid(70)])).rejects.toThrow(/Somente o administrador/)
  })
})

describe('perfis setoriais (Jurídico, Administrativo, RH e TI)', () => {
  it('cada um vale pelo próprio perfil', async () => {
    for (const p of ['juridico', 'administrativo', 'rh', 'ti']) {
      expect((await como(p, 'select public.gc_role() as r')).rows[0].r, p).toBe(p)
    }
  })

  it('o perfil é aceito no cadastro de usuários', async () => {
    await como('admin', `insert into usuarios (id, nome, email, role, ativo) values ('${uid(80)}', 'Nova', 'n80@x', 'juridico', true)`)
  })

  it('o Jurídico acompanha as contratações em modo leitura, sem gravar', async () => {
    const total = Number((await db.query('select count(*)::int as n from gc_contratos')).rows[0].n)
    expect(await contar('juridico', 'gc_contratos')).toBe(total)
    expect(await contar('juridico', 'processos')).toBeGreaterThan(0)
    await expect(como('juridico', `insert into gc_contratos (numero, contratada, objeto, valor_inicial) values ('J1/2026', 'X', 'Y', 1)`)).rejects.toThrow(/row-level security/)
    expect((await como('juridico', `update gc_contratos set objeto = 'alterado' where id = $1`, [C1])).affectedRows).toBe(0)
  })

  it.each(['rh', 'ti', 'administrativo'])('%s não vê contratações nem processos licitatórios', async (perfil) => {
    for (const tabela of ['gc_contratos', 'gc_competencias', 'gc_responsaveis', 'gc_ordens_servico', 'gc_empenhos', 'processos']) {
      expect(await contar(perfil, tabela), `${perfil} em ${tabela}`).toBe(0)
    }
  })

  it.each(['rh', 'ti', 'administrativo'])('%s também não grava contratações', async (perfil) => {
    await expect(como(perfil, `insert into gc_contratos (numero, contratada, objeto, valor_inicial) values ('Z/2026', 'X', 'Y', 1)`)).rejects.toThrow(/row-level security/)
  })

  it('quem era fiscal ou viewer continua com o mesmo alcance', async () => {
    const total = Number((await db.query('select count(*)::int as n from gc_contratos')).rows[0].n)
    const doFiscal = Number((await db.query('select count(distinct contrato_id)::int as n from gc_responsaveis where usuario_id = $1 and ativo', [U.fiscal])).rows[0].n)
    expect(await contar('viewer', 'gc_contratos')).toBe(total)
    expect(await contar('fiscal', 'gc_contratos')).toBe(doFiscal)
  })

  it.each(['juridico', 'administrativo', 'rh', 'ti'])('%s abre processo administrativo, mas só se tiver unidade', async (perfil) => {
    const dest = (await db.query(`select id from tr_unidades where sigla = 'GCON'`)).rows[0].id
    await expect(como(perfil, 'select tr_abrir_processo($1, $2, null, null, $3, null, $4, null)', ['Requerimento', 'Teste de perfil', 'normal', dest]))
      .rejects.toThrow(/definir a sua unidade/)
    const sigla = { juridico: 'JUR', administrativo: 'ADM', rh: 'RH', ti: 'TI' }[perfil]
    await db.exec(`update usuarios set unidade_id = (select id from tr_unidades where sigla = '${sigla}') where id = '${U[perfil]}'`)
    const r = await como(perfil, 'select tr_abrir_processo($1, $2, null, null, $3, null, $4, null) as id', ['Requerimento', `Aberto por ${perfil}`, 'normal', dest])
    expect(r.rows[0].id).toBeTruthy()
  })

  it('a consulta continua sem poder abrir processos', async () => {
    await expect(como('viewer', 'select tr_abrir_processo($1, $2, null, null, $3, null, null, null)', ['Requerimento', 'Teste', 'normal'])).rejects.toThrow(/não pode abrir/)
  })
})

describe('documentos e assinatura eletrônica', () => {
  const CORPO = [{ t: 'titulo', x: 'OFÍCIO' }, { t: 'p', x: 'Solicitamos providências.' }]
  const sigla = (n) => (n === 'oficio' ? 'OF' : 'DS')
  const criar = (quem, { modelo = 'oficio', titulo = 'Ofício de teste', processo = null, corpo = CORPO, conteudo = { assunto: 'x' } } = {}) =>
    como(quem, 'select doc_criar($1, $2, 1, $3, $4, $5::jsonb, $6::jsonb) as id', [sigla(modelo), modelo, titulo, processo, JSON.stringify(conteudo), JSON.stringify(corpo)])
  const doc = async (id) => (await db.query('select * from doc_documentos where id = $1', [id])).rows[0]
  const assinaturas = async (id) => (await db.query('select usuario_id, status, versao, hash, ip, agente, motivo_recusa, metodo from doc_assinaturas where documento_id = $1 order by id', [id])).rows
  const enviar = (quem, id, assinantes) => como(quem, 'select doc_enviar_assinatura($1, $2::jsonb)', [id, JSON.stringify(assinantes.map(([u, papel]) => ({ usuario_id: U[u] ?? u, papel })))])
  // executa como o usuário, com a senha digitada há `segundosAtras` segundos (null = sem login por senha)
  const comoAssinando = (quem, sql, params = [], { segundosAtras = 5, headers = {} } = {}) => db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [U[quem]])
    const claims = { sub: U[quem], amr: segundosAtras === null ? [] : [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - segundosAtras }] }
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    await tx.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'Teste/1.0', ...headers })])
    await tx.exec('set local role authenticated')
    return tx.query(sql, params)
  })
  const assinar = (quem, id, opcoes) => comoAssinando(quem, 'select doc_assinar($1)', [id], opcoes)
  const verificar = (codigo) => db.transaction(async (tx) => {
    await tx.exec('set local role anon')
    return (await tx.query('select public.doc_verificar($1) as r', [codigo])).rows[0].r
  })
  const semGuarda = async (fn) => {
    await db.exec('alter table doc_documentos disable trigger trg_doc_guard')
    try { return await fn() } finally { await db.exec('alter table doc_documentos enable trigger trg_doc_guard') }
  }

  let COMP, JUR, PROC, ID
  beforeAll(async () => {
    COMP = (await db.query(`select id from tr_unidades where sigla = 'COMP'`)).rows[0].id
    JUR = (await db.query(`select id from tr_unidades where sigla = 'JUR'`)).rows[0].id
    await db.exec(`update usuarios set unidade_id = '${JUR}' where id = '${U.juridico}'`)
    PROC = (await como('compras', 'select tr_abrir_processo($1, $2, null, null, $3, null, $4, null) as id', ['Contratação', 'Processo dos documentos', 'normal', COMP])).rows[0].id
  })

  describe('criação e edição', () => {
    it('numera por tipo e ano, em sequência, e grava a unidade e o autor', async () => {
      ID = (await criar('compras')).rows[0].id
      const d = await doc(ID)
      expect(d.numero).toMatch(/^OF-\d{4}\/000001$/)
      expect(d).toMatchObject({ status: 'rascunho', versao: 1, unidade_id: COMP, criado_por: U.compras, criado_por_nome: 'Compras', hash: null, codigo_verificacao: null })
      expect((await doc((await criar('compras')).rows[0].id)).numero).toMatch(/^OF-\d{4}\/000002$/)
      expect((await doc((await criar('compras', { modelo: 'despacho' })).rows[0].id)).numero).toMatch(/^DS-\d{4}\/000001$/)
    })

    it('a consulta não cria; modelo e título precisam ser válidos', async () => {
      await expect(criar('viewer')).rejects.toThrow(/não pode criar/)
      await expect(criar('compras', { titulo: ' ' })).rejects.toThrow(/título/)
      await expect(como('compras', `select doc_criar('x', 'oficio', 1, 'Título', null, '{}', '[]')`)).rejects.toThrow(/Modelo inválido/)
      await expect(como('compras', `select doc_criar('OF', 'Oficio Inválido', 1, 'Título', null, '{}', '[]')`)).rejects.toThrow(/Modelo inválido/)
    })

    it('só vincula a processo que a pessoa pode ver', async () => {
      await expect(criar('financeiro', { processo: PROC })).rejects.toThrow(/não tem acesso a este processo/)
      expect((await criar('compras', { processo: PROC })).rows[0].id).toBeTruthy()
    })

    it('o autor e a sua unidade editam o rascunho; os demais, não', async () => {
      await como('compras', 'select doc_salvar($1, $2, $3::jsonb, $4::jsonb)', [ID, 'Ofício revisado', '{"assunto":"y"}', JSON.stringify(CORPO)])
      expect((await doc(ID)).titulo).toBe('Ofício revisado')
      await db.exec(`update usuarios set unidade_id = '${COMP}' where id = '${U.editor}'`)
      await como('editor', 'select doc_salvar($1, $2, $3::jsonb, $4::jsonb)', [ID, 'Revisado pela unidade', '{}', JSON.stringify(CORPO)])
      await expect(como('financeiro', 'select doc_salvar($1, $2, $3::jsonb, $4::jsonb)', [ID, 'Invasor', '{}', '[]'])).rejects.toThrow(/não pode mais ser editado/)
      await expect(como('viewer', 'select doc_salvar($1, $2, $3::jsonb, $4::jsonb)', [ID, 'Consulta', '{}', '[]'])).rejects.toThrow(/não pode mais ser editado/)
    })

    it('ninguém grava direto nas tabelas', async () => {
      await expect(como('compras', `insert into doc_documentos (numero, sigla, modelo, titulo) values ('OF-2026/999999', 'OF', 'oficio', 'direto')`)).rejects.toThrow(/row-level security|permission denied/)
      expect((await como('compras', `update doc_documentos set titulo = 'direto' where id = $1`, [ID]).catch(() => ({ affectedRows: 0 }))).affectedRows).toBe(0)
      expect((await como('admin', `delete from doc_documentos where id = $1`, [ID]).catch(() => ({ affectedRows: 0 }))).affectedRows).toBe(0)
    })
  })

  describe('quem vê o documento', () => {
    it('autor, unidade, administração e quem vê o processo; os demais, não', async () => {
      const ligado = (await criar('compras', { processo: PROC })).rows[0].id
      const solto = (await criar('compras')).rows[0].id
      const ve = async (quem, id) => (await como(quem, 'select 1 from doc_documentos where id = $1', [id])).rows.length === 1
      for (const quem of ['compras', 'editor', 'admin', 'presidente']) expect(await ve(quem, solto), `${quem} vê o avulso`).toBe(true)
      for (const quem of ['financeiro', 'fiscal', 'rh', 'viewer', 'gestor']) expect(await ve(quem, solto), `${quem} não vê o avulso`).toBe(false)
      // vinculado a processo: segue a regra do processo (gestão, gabinete e consulta veem todos os processos)
      for (const quem of ['gestor', 'gabinete', 'viewer']) expect(await ve(quem, ligado), `${quem} vê o do processo`).toBe(true)
      for (const quem of ['financeiro', 'fiscal', 'rh']) expect(await ve(quem, ligado), `${quem} não vê o do processo`).toBe(false)
    })

    it('inativo e sem perfil não veem nada', async () => {
      expect(await contar('inativo', 'doc_documentos')).toBe(0)
      expect(await contar('semPerfil', 'doc_documentos')).toBe(0)
    })
  })

  describe('enviar para assinatura', () => {
    let D
    beforeAll(async () => { D = (await criar('compras', { titulo: 'Ofício para assinatura', processo: PROC })).rows[0].id })

    it('exige texto, signatários válidos e sem repetição', async () => {
      const vazio = (await criar('compras', { corpo: [] })).rows[0].id
      await expect(enviar('compras', vazio, [['gabinete', 'Presidente']])).rejects.toThrow(/vazio/)
      await expect(enviar('compras', D, [])).rejects.toThrow(/de 1 a 10 pessoas/)
      await expect(enviar('compras', D, [['gabinete', 'A'], ['gabinete', 'B']])).rejects.toThrow(/mais de uma vez/)
      await expect(enviar('compras', D, [['viewer', 'Consulta']])).rejects.toThrow(/não pode assinar/)
      await expect(enviar('compras', D, [['inativo', 'Ex']])).rejects.toThrow(/não pode assinar/)
      await expect(enviar('compras', D, [['gabinete', ' ']])).rejects.toThrow(/papel/)
      await expect(enviar('financeiro', D, [['gabinete', 'Presidente']])).rejects.toThrow(/não pode ser enviado/)
      expect((await doc(D)).status).toBe('rascunho') // nada ficou pela metade
      expect(await assinaturas(D)).toEqual([])
    })

    it('congela o conteúdo, grava o hash e gera o código de verificação', async () => {
      await enviar('compras', D, [['gabinete', 'Presidente'], ['juridico', 'Jurídico']])
      const d = await doc(D)
      expect(d.status).toBe('aguardando_assinatura')
      expect(d.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(d.hash).toBe((await db.query('select doc_hash($1, $2, $3::jsonb) as h', [d.numero, d.titulo, JSON.stringify(d.corpo)])).rows[0].h)
      expect(d.codigo_verificacao).toMatch(/^[0-9A-F]{12}$/)
      expect((await assinaturas(D)).map((a) => [a.usuario_id, a.status])).toEqual([[U.gabinete, 'pendente'], [U.juridico, 'pendente']])
    })

    it('registra no histórico do processo', async () => {
      const h = (await db.query(`select despacho from tr_tramitacoes where processo_id = $1 and tipo = 'documento' order by id`, [PROC])).rows.map((r) => r.despacho)
      expect(h.some((t) => /enviado para assinatura/.test(t))).toBe(true)
    })

    it('depois de enviado, ninguém altera o texto (nem por dentro do banco)', async () => {
      await expect(como('compras', 'select doc_salvar($1, $2, $3::jsonb, $4::jsonb)', [D, 'Outro', '{}', '[]'])).rejects.toThrow(/não pode mais ser editado/)
      await expect(db.exec(`update doc_documentos set corpo = '[{"t":"p","x":"fraude"}]'::jsonb where id = '${D}'`)).rejects.toThrow(/não pode ser alterado/)
      await expect(db.exec(`update doc_documentos set titulo = 'Fraude' where id = '${D}'`)).rejects.toThrow(/não pode ser alterado/)
      await expect(db.exec(`delete from doc_documentos where id = '${D}'`)).rejects.toThrow(/não são apagados/)
    })

    it('o signatário passa a ver o documento, mesmo de outra unidade', async () => {
      expect((await como('gabinete', 'select 1 from doc_documentos where id = $1', [D])).rows).toHaveLength(1)
      expect((await como('juridico', 'select 1 from doc_assinaturas where documento_id = $1', [D])).rows.length).toBeGreaterThan(0)
    })
  })

  describe('assinar', () => {
    let D
    beforeAll(async () => {
      D = (await criar('compras', { titulo: 'Para assinar', processo: PROC })).rows[0].id
      await enviar('compras', D, [['gabinete', 'Presidente'], ['juridico', 'Jurídico']])
    })

    it('só assina quem foi escolhido', async () => {
      await expect(assinar('financeiro', D)).rejects.toThrow(/não tem assinatura pendente/)
      await expect(assinar('compras', D)).rejects.toThrow(/não tem assinatura pendente/)
    })

    it('sem a senha digitada agora há pouco, não assina (mesmo logado)', async () => {
      await expect(assinar('gabinete', D, { segundosAtras: null })).rejects.toThrow(/Confirme a sua senha/)
      await expect(assinar('gabinete', D, { segundosAtras: 600 })).rejects.toThrow(/Confirme a sua senha/)
      expect((await assinaturas(D)).every((a) => a.status === 'pendente')).toBe(true)
    })

    it('assina com a senha recente e o servidor grava hash, IP, navegador e método', async () => {
      await assinar('gabinete', D)
      const a = (await assinaturas(D)).find((x) => x.usuario_id === U.gabinete)
      expect(a).toMatchObject({ status: 'assinada', ip: '203.0.113.7', agente: 'Teste/1.0', hash: (await doc(D)).hash })
      expect(a.metodo).toMatch(/avançada/)
      expect((await doc(D)).status).toBe('aguardando_assinatura') // falta o Jurídico
    })

    it('não assina duas vezes', async () => {
      await expect(assinar('gabinete', D)).rejects.toThrow(/não tem assinatura pendente/)
    })

    it('com todas as assinaturas, o documento fica assinado e o histórico do processo registra', async () => {
      await assinar('juridico', D)
      const d = await doc(D)
      expect(d.status).toBe('assinado')
      expect(d.assinado_em).not.toBeNull()
      const h = (await db.query(`select despacho from tr_tramitacoes where processo_id = $1 and tipo = 'documento' order by id`, [PROC])).rows.map((r) => r.despacho)
      expect(h.some((t) => /assinado por todos os signatários/.test(t))).toBe(true)
    })

    it('a assinatura feita não pode ser alterada nem desfeita', async () => {
      await expect(db.exec(`update doc_assinaturas set status = 'pendente' where documento_id = '${D}' and usuario_id = '${U.gabinete}'`)).rejects.toThrow(/não pode ser alterada/)
      await expect(db.exec(`update doc_assinaturas set hash = 'x' where documento_id = '${D}' and usuario_id = '${U.gabinete}'`)).rejects.toThrow(/não pode ser alterada/)
      await expect(db.exec(`delete from doc_assinaturas where documento_id = '${D}'`)).rejects.toThrow(/não são apagadas/)
    })

    it('se o conteúdo foi adulterado por baixo dos panos, a assinatura é recusada', async () => {
      const T = (await criar('compras', { titulo: 'Adulterado' })).rows[0].id
      await enviar('compras', T, [['gabinete', 'Presidente']])
      await semGuarda(() => db.exec(`update doc_documentos set corpo = '[{"t":"p","x":"texto trocado"}]'::jsonb where id = '${T}'`))
      await expect(assinar('gabinete', T)).rejects.toThrow(/não confere/)
      expect((await doc(T)).status).toBe('aguardando_assinatura')
    })
  })

  describe('recusar e cancelar', () => {
    it('a recusa devolve o documento para edição, em nova versão, e as outras assinaturas caem', async () => {
      const R = (await criar('compras', { titulo: 'Será recusado' })).rows[0].id
      await enviar('compras', R, [['gabinete', 'Presidente'], ['juridico', 'Jurídico']])
      await expect(como('gabinete', 'select doc_recusar($1, $2)', [R, ' '])).rejects.toThrow(/motivo/)
      await expect(como('financeiro', 'select doc_recusar($1, $2)', [R, 'não sou signatário'])).rejects.toThrow(/não tem assinatura pendente/)
      await como('gabinete', 'select doc_recusar($1, $2)', [R, 'Faltou o anexo'])
      const d = await doc(R)
      expect(d).toMatchObject({ status: 'rascunho', versao: 2, hash: null })
      expect((await assinaturas(R)).map((a) => a.status)).toEqual(['recusada', 'cancelada'])
      expect((await assinaturas(R))[0].motivo_recusa).toBe('Faltou o anexo')
      // volta a ser editável e pode ser reenviado; as assinaturas novas são da versão 2
      await como('compras', 'select doc_salvar($1, $2, $3::jsonb, $4::jsonb)', [R, 'Corrigido', '{}', JSON.stringify(CORPO)])
      await enviar('compras', R, [['gabinete', 'Presidente']])
      expect((await assinaturas(R)).filter((a) => a.versao === 2).map((a) => a.status)).toEqual(['pendente'])
      await assinar('gabinete', R)
      expect((await doc(R)).status).toBe('assinado')
    })

    it('só o autor ou a administração cancela, com motivo; o documento fica registrado como cancelado', async () => {
      const C = (await criar('compras', { titulo: 'Cancelável' })).rows[0].id
      await enviar('compras', C, [['gabinete', 'Presidente']])
      await expect(como('gabinete', 'select doc_cancelar($1, $2)', [C, 'não é meu'])).rejects.toThrow(/Só quem criou/)
      await expect(como('compras', 'select doc_cancelar($1, $2)', [C, ' '])).rejects.toThrow(/motivo/)
      await como('compras', 'select doc_cancelar($1, $2)', [C, 'Emitido por engano'])
      expect(await doc(C)).toMatchObject({ status: 'cancelado', motivo_cancelamento: 'Emitido por engano' })
      expect((await assinaturas(C)).map((a) => a.status)).toEqual(['cancelada'])
      await expect(assinar('gabinete', C)).rejects.toThrow(/não está aguardando assinatura/)
      await expect(como('compras', 'select doc_cancelar($1, $2)', [C, 'de novo'])).rejects.toThrow(/já está cancelado/)
    })

    it('documento assinado também pode ser cancelado (a assinatura fica no registro)', async () => {
      const A = (await criar('compras', { titulo: 'Assinado e cancelado' })).rows[0].id
      await enviar('compras', A, [['gabinete', 'Presidente']])
      await assinar('gabinete', A)
      await como('admin', 'select doc_cancelar($1, $2)', [A, 'Substituído por outro'])
      expect((await doc(A)).status).toBe('cancelado')
      expect((await assinaturas(A)).map((a) => a.status)).toEqual(['assinada'])
    })
  })

  describe('conferência pública', () => {
    let D, CODIGO
    beforeAll(async () => {
      D = (await criar('compras', { titulo: 'Ofício confidencial' })).rows[0].id
      await enviar('compras', D, [['gabinete', 'Presidente']])
      CODIGO = (await doc(D)).codigo_verificacao
    })

    it('sem login, confere pelo código, com ou sem hífens e em qualquer caixa', async () => {
      await assinar('gabinete', D)
      for (const forma of [CODIGO, CODIGO.toLowerCase(), `${CODIGO.slice(0, 4)}-${CODIGO.slice(4, 8)}-${CODIGO.slice(8)}`, ` ${CODIGO} `]) {
        const r = await verificar(forma)
        expect(r).toMatchObject({ encontrado: true, situacao: 'assinado', integro: true })
      }
    })

    it('mostra número, hash e quem assinou, mas nunca o título nem o conteúdo', async () => {
      const r = await verificar(CODIGO)
      expect(r.numero).toMatch(/^OF-/)
      expect(r.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(r.assinaturas).toEqual([expect.objectContaining({ nome: 'Gabinete', papel: 'Presidente', situacao: 'assinada' })])
      expect(JSON.stringify(r)).not.toMatch(/confidencial|Solicitamos/)
    })

    it('código desconhecido não revela nada', async () => {
      expect(await verificar('ZZZZZZZZZZZZ')).toEqual({ encontrado: false })
      expect(await verificar('')).toEqual({ encontrado: false })
      expect(await verificar(null)).toEqual({ encontrado: false })
    })

    it('se o texto for adulterado depois, a conferência acusa que não está íntegro', async () => {
      await semGuarda(() => db.exec(`update doc_documentos set corpo = '[{"t":"p","x":"adulterado"}]'::jsonb where id = '${D}'`))
      expect((await verificar(CODIGO)).integro).toBe(false)
    })

    it('documento cancelado aparece como cancelado', async () => {
      await como('compras', 'select doc_cancelar($1, $2)', [D, 'Cancelado após conferência'])
      expect(await verificar(CODIGO)).toMatchObject({ situacao: 'cancelado' })
    })

    it('a conferência é a única função aberta a quem não está logado', async () => {
      for (const [sql, params] of [
        ['select doc_criar($1, $1, 1, $1, null, null, null)', ['x']], ['select doc_pessoas()', []], ['select doc_assinar($1::uuid)', [uid(1)]],
      ]) {
        await expect(db.transaction(async (tx) => {
          await tx.exec('set local role anon')
          return tx.query(sql, params)
        }), sql).rejects.toThrow(/permission denied/)
      }
    })
  })

  describe('apoio', () => {
    it('lista as pessoas que podem assinar, sem consulta e sem inativos; a consulta não usa', async () => {
      const nomes = (await como('compras', 'select * from doc_pessoas()')).rows.map((r) => r.nome)
      expect(nomes).toEqual(expect.arrayContaining(['Gabinete', 'Jurídico', 'Presidente']))
      expect(nomes).not.toContain('Viewer')
      expect(nomes).not.toContain('Ex-gestor')
      expect((await como('viewer', 'select * from doc_pessoas()')).rows).toEqual([])
    })

    it('define o tipo de contratação do processo, com valores válidos, só pela unidade do processo', async () => {
      await como('compras', 'select tr_definir_contratacao($1, $2, $3)', [PROC, 'pregao', 'servicos-continuos-demo'])
      expect((await db.query('select contratacao_modalidade, contratacao_objeto from tr_processos where id = $1', [PROC])).rows[0])
        .toEqual({ contratacao_modalidade: 'pregao', contratacao_objeto: 'servicos-continuos-demo' })
      await expect(como('compras', 'select tr_definir_contratacao($1, $2, $3)', [PROC, 'leilao', null])).rejects.toThrow(/Forma de contratação inválida/)
      await expect(como('compras', 'select tr_definir_contratacao($1, $2, $3)', [PROC, null, 'foguete'])).rejects.toThrow(/Tipo de objeto inválido/)
      await expect(como('financeiro', 'select tr_definir_contratacao($1, $2, $3)', [PROC, 'pregao', null])).rejects.toThrow(/Somente a unidade/)
      await como('compras', 'select tr_definir_contratacao($1, null, null)', [PROC])
      expect((await db.query('select contratacao_modalidade from tr_processos where id = $1', [PROC])).rows[0].contratacao_modalidade).toBeNull()
    })
  })
})

describe('solicitações ao Compras e processos de contratação', () => {
  // DFD assinada da secretaria de `quem` (o secretário é o único que cria DFD)
  const novoDfd = async (quem, { assinado = true } = {}) => {
    const id = (await como(quem, `select doc_criar('DFD', 'dfd', 1, 'DFD de cadeiras', null, '{}'::jsonb, '[{"t":"p","x":"DFD"}]'::jsonb) as id`)).rows[0].id
    if (assinado) await db.query(`update doc_documentos set status = 'assinado', assinado_em = now() where id = $1`, [id])
    return id
  }
  const enviar = async (quem, d = {}) => {
    const documento = 'documento' in d ? d.documento : await novoDfd(quem).catch(() => null)
    return como(quem, 'select cp_enviar_solicitacao($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as id', [
      d.tipo ?? 'dfd', documento, d.objeto ?? 'Aquisição de 20 cadeiras ergonômicas', d.quantidade ?? '20 unidades',
      d.justificativa ?? 'As cadeiras atuais estão quebradas e causam afastamentos.', d.objeto_tipo ?? 'bens-permanentes',
      d.valor ?? 15000, d.data ?? '2026-12-01', d.prioridade ?? 'alta', d.pca ?? 'sim',
    ])
  }
  const sol = async (id) => (await db.query('select * from cp_solicitacoes where id = $1', [id])).rows[0]
  const eventos = async (id) => (await db.query('select tipo, texto, criada_por_nome from cp_eventos where solicitacao_id = $1 order by id', [id])).rows
  const aceitar = (quem, id, modalidade = 'pregao', objeto = null) =>
    como(quem, 'select cp_aceitar_solicitacao($1, $2, $3, null, $4) as id', [id, modalidade, objeto, 'Seguir com o ETP'])

  let COMP, SAUDE, EDUC
  beforeAll(async () => {
    const u = async (s) => (await db.query('select id from tr_unidades where sigla = $1', [s])).rows[0].id
    await db.exec(`insert into tr_unidades (sigla, nome) values ('SMS', 'Secretaria de Saúde'), ('SEMED', 'Secretaria de Educação') on conflict do nothing`)
    COMP = await u('COMP'); SAUDE = await u('SMS'); EDUC = await u('SEMED')
    await db.exec(`
      insert into usuarios (id, nome, email, role, ativo, unidade_id) values
        ('${U.secretario}', 'Secretária de Saúde', 'saude@x', 'secretario', true, '${SAUDE}'),
        ('${U.secretario2}', 'Secretário de Educação', 'educ@x', 'secretario', true, '${EDUC}')
      on conflict (id) do nothing;
      update usuarios set unidade_id = '${COMP}' where id = '${U.compras}';
      update usuarios set unidade_id = '${SAUDE}' where id = '${U.rh}';`)
  })

  describe('o secretário envia a DFD', () => {
    it('numera, grava a secretaria, quem pediu e o histórico', async () => {
      const id = (await enviar('secretario')).rows[0].id
      const s = await sol(id)
      expect(s.numero).toMatch(/^SOL-\d{4}\/000001$/)
      expect(s).toMatchObject({ status: 'enviada', tipo: 'dfd', unidade_id: SAUDE, solicitante: U.secretario, solicitante_nome: 'Secretária de Saúde', prioridade: 'alta' })
      expect(await eventos(id)).toEqual([{ tipo: 'envio', texto: null, criada_por_nome: 'Secretária de Saúde' }])
    })

    it('valida o essencial e as escolhas', async () => {
      await expect(enviar('secretario', { objeto: 'abc' })).rejects.toThrow(/Descreva o que precisa/)
      await expect(enviar('secretario', { justificativa: 'curta' })).rejects.toThrow(/por que a contratação/)
      await expect(enviar('secretario', { prioridade: 'maxima' })).rejects.toThrow(/Prioridade inválida/)
      await expect(enviar('secretario', { objeto_tipo: 'foguete' })).rejects.toThrow(/Tipo de objeto inválido/)
      await expect(enviar('secretario', { pca: 'talvez' })).rejects.toThrow(/Plano de Contratações/)
      await expect(enviar('secretario', { valor: -1 })).rejects.toThrow(/negativo/)
    })

    it('só o secretário cria a DFD e faz o pedido; os outros setores, não', async () => {
      for (const quem of ['rh', 'compras', 'gestor', 'juridico', 'financeiro']) {
        await expect(como(quem, `select doc_criar('DFD', 'dfd', 1, 'DFD', null, '{}'::jsonb, '[]'::jsonb)`), quem).rejects.toThrow(/Somente o secretário cria a DFD/)
        await expect(enviar(quem, { documento: null }), quem).rejects.toThrow(/Somente o secretário envia/)
      }
      await expect(enviar('viewer', { documento: null })).rejects.toThrow(/Somente o secretário envia/)
      // os demais documentos continuam livres para todos os perfis de trabalho
      await expect(como('rh', `select doc_criar('OF', 'oficio', 1, 'Ofício', null, '{}'::jsonb, '[]'::jsonb)`)).resolves.toBeTruthy()
    })

    it('sem DFD assinada não há pedido; a DFD não pode estar em outro processo ou pedido', async () => {
      await expect(enviar('secretario', { tipo: 'solicitacao', documento: null })).rejects.toThrow(/feito com a DFD assinada/)
      await expect(enviar('secretario', { documento: null })).rejects.toThrow(/Escolha o DFD/)
      const rascunho = await novoDfd('secretario', { assinado: false })
      await expect(enviar('secretario', { documento: rascunho })).rejects.toThrow(/precisa estar assinado/)
      const oficio = (await como('secretario', `select doc_criar('OF', 'oficio', 1, 'Ofício', null, '{}'::jsonb, '[]'::jsonb) as id`)).rows[0].id
      await expect(enviar('secretario', { documento: oficio })).rejects.toThrow(/não é um DFD/)
      const deOutra = await novoDfd('secretario2')
      await expect(enviar('secretario', { documento: deOutra })).rejects.toThrow(/DFD não encontrado/)
      const dfd = await novoDfd('secretario')
      await enviar('secretario', { documento: dfd })
      await expect(enviar('secretario', { documento: dfd })).rejects.toThrow(/já foi enviado/)
    })

    it('quem vê: a secretaria, o Compras e quem acompanha; outra secretaria não', async () => {
      const id = (await enviar('secretario')).rows[0].id
      for (const quem of ['secretario', 'rh', 'compras', 'gestor', 'gabinete', 'viewer', 'admin', 'presidente']) {
        expect((await como(quem, 'select 1 from cp_solicitacoes where id = $1', [id])).rows, quem).toHaveLength(1)
      }
      for (const quem of ['secretario2', 'financeiro', 'juridico']) {
        expect((await como(quem, 'select 1 from cp_solicitacoes where id = $1', [id])).rows, quem).toHaveLength(0)
        expect((await como(quem, 'select 1 from cp_eventos where solicitacao_id = $1', [id])).rows, quem).toHaveLength(0)
      }
    })

    it('o Compras lê a DFD anexada antes mesmo de aceitar', async () => {
      const dfd = await novoDfd('secretario')
      expect((await como('compras', 'select 1 from doc_documentos where id = $1', [dfd])).rows).toHaveLength(0)
      await enviar('secretario', { documento: dfd })
      expect((await como('compras', 'select 1 from doc_documentos where id = $1', [dfd])).rows).toHaveLength(1)
      expect((await como('secretario2', 'select 1 from doc_documentos where id = $1', [dfd])).rows).toHaveLength(0)
    })

    it('ninguém grava direto nas tabelas', async () => {
      const id = (await enviar('secretario')).rows[0].id
      const nada = (p) => p.then((r) => r.affectedRows).catch(() => 0)
      await expect(como('secretario', `insert into cp_solicitacoes (numero, tipo, objeto, justificativa) values ('X', 'solicitacao', 'abcdef', 'abcdefghijk')`)).rejects.toThrow(/row-level security|permission denied/)
      expect(await nada(como('compras', `update cp_solicitacoes set status = 'aceita' where id = $1`, [id]))).toBe(0)
      expect(await nada(como('admin', `delete from cp_eventos where solicitacao_id = $1`, [id]))).toBe(0)
      await expect(como('compras', `insert into cp_checklist (processo_id, item, situacao) values ($1, 'edital', 'juntado')`, [uid(1)])).rejects.toThrow(/row-level security|permission denied|foreign key/)
      expect((await sol(id)).status).toBe('enviada')
      expect(await eventos(id)).toHaveLength(1)
    })
  })

  describe('o Compras analisa', () => {
    it('só o Compras (e a administração) devolve, recusa e aceita', async () => {
      const id = (await enviar('secretario')).rows[0].id
      for (const quem of ['secretario', 'gestor', 'financeiro', 'viewer']) {
        await expect(como(quem, 'select cp_devolver_solicitacao($1, $2)', [id, 'Ajustar']), quem).rejects.toThrow(/Somente o Compras/)
        await expect(aceitar(quem, id), quem).rejects.toThrow(/Somente o Compras/)
      }
    })

    it('devolve com o motivo; o secretário refaz a DFD e reenvia; volta para análise', async () => {
      const id = (await enviar('secretario')).rows[0].id
      await expect(como('compras', 'select cp_devolver_solicitacao($1, $2)', [id, ''])).rejects.toThrow(/precisa ser ajustado/)
      await como('compras', 'select cp_devolver_solicitacao($1, $2)', [id, 'Informe a quantidade por sala.'])
      expect(await sol(id)).toMatchObject({ status: 'devolvida', motivo: 'Informe a quantidade por sala.', analisada_por_nome: 'Compras' })
      await expect(aceitar('compras', id)).rejects.toThrow(/aguardando análise/)

      const nova = await novoDfd('secretario')
      const reenviar = (quem, doc = nova) => como(quem, 'select cp_reenviar_solicitacao($1, $2, $3, $4, $5, $6, null, null, null, $7, null, $8)',
        [id, 'dfd', doc, 'Aquisição de 20 cadeiras ergonômicas', '10 na sala 1 e 10 na sala 2', 'As cadeiras atuais estão quebradas.', 'normal', 'Quantidade detalhada.'])
      await expect(reenviar('secretario2')).rejects.toThrow(/Só o secretário que fez/)
      await expect(reenviar('rh')).rejects.toThrow(/Só o secretário que fez/) // mesma secretaria, mas não é secretário
      await reenviar('secretario')
      expect(await sol(id)).toMatchObject({ status: 'enviada', documento_id: nova, quantidade: '10 na sala 1 e 10 na sala 2', prioridade: 'normal' })
      expect((await eventos(id)).map((e) => e.tipo)).toEqual(['envio', 'devolucao', 'reenvio'])
      await expect(reenviar('secretario')).rejects.toThrow(/Só uma solicitação devolvida/)
    })

    it('recusa com motivo e não deixa mais mexer', async () => {
      const id = (await enviar('secretario')).rows[0].id
      await como('compras', 'select cp_recusar_solicitacao($1, $2)', [id, 'Item já disponível no almoxarifado.'])
      expect(await sol(id)).toMatchObject({ status: 'recusada', motivo: 'Item já disponível no almoxarifado.' })
      await expect(como('secretario', 'select cp_cancelar_solicitacao($1, $2)', [id, 'Não precisa'])).rejects.toThrow(/não pode mais ser cancelada/)
      await expect(aceitar('compras', id)).rejects.toThrow(/aguardando análise/)
    })

    it('a secretaria cancela enquanto não foi aceita', async () => {
      const id = (await enviar('secretario')).rows[0].id
      await expect(como('secretario2', 'select cp_cancelar_solicitacao($1, $2)', [id, 'Errado'])).rejects.toThrow(/Só quem fez/)
      await como('secretario', 'select cp_cancelar_solicitacao($1, $2)', [id, 'Pedido duplicado'])
      expect((await sol(id)).status).toBe('cancelada')
    })

    describe('aceitar abre o processo de contratação', () => {
      let S, PROC, DFD
      beforeAll(async () => {
        DFD = await novoDfd('secretario')
        S = (await enviar('secretario', { documento: DFD, prioridade: 'urgente' })).rows[0].id
      })

      it('valida a forma de contratação e o tipo de objeto', async () => {
        await expect(aceitar('compras', S, null)).rejects.toThrow(/Escolha a forma de contratação/)
        await expect(aceitar('compras', S, 'leilao')).rejects.toThrow(/Escolha a forma de contratação/)
        await expect(aceitar('compras', S, 'pregao', 'foguete')).rejects.toThrow(/Tipo de objeto inválido/)
        expect((await sol(S)).status).toBe('enviada')
      })

      it('cria o processo no Compras, com a contratação definida, e liga a solicitação', async () => {
        PROC = (await aceitar('compras', S, 'pregao')).rows[0].id
        const p = (await db.query('select * from tr_processos where id = $1', [PROC])).rows[0]
        expect(p).toMatchObject({
          tipo: 'Contratação', assunto: 'Aquisição de 20 cadeiras ergonômicas', unidade_atual: COMP, responsavel_atual: U.compras,
          contratacao_modalidade: 'pregao', contratacao_objeto: 'bens-permanentes', prioridade: 'urgente', interessado: 'SMS — Secretaria de Saúde',
        })
        expect(p.recebido_em).not.toBeNull()
        expect(p.descricao).toMatch(/Justificativa da demanda: As cadeiras/)
        expect(await sol(S)).toMatchObject({ status: 'aceita', processo_id: PROC })
        expect((await eventos(S)).at(-1)).toMatchObject({ tipo: 'aceite', texto: `Processo ${p.numero} aberto.` })
      })

      it('a DFD passa a fazer parte do processo e o histórico registra', async () => {
        expect((await db.query('select processo_id from doc_documentos where id = $1', [DFD])).rows[0].processo_id).toBe(PROC)
        const h = (await db.query('select tipo, de_unidade, para_unidade, despacho from tr_tramitacoes where processo_id = $1 order by id', [PROC])).rows
        expect(h[0]).toMatchObject({ tipo: 'abertura', de_unidade: SAUDE, para_unidade: COMP })
        expect(h[0].despacho).toMatch(/Aberto a partir da solicitação SOL-.*Seguir com o ETP/)
        expect(h[1]).toMatchObject({ tipo: 'documento' })
        expect(h[1].despacho).toMatch(/^DFD DFD-\d{4}\/\d+ juntado ao processo\.$/)
      })

      it('a secretaria acompanha o processo; outra secretaria não', async () => {
        expect((await como('secretario', 'select 1 from tr_processos where id = $1', [PROC])).rows).toHaveLength(1)
        expect((await como('secretario2', 'select 1 from tr_processos where id = $1', [PROC])).rows).toHaveLength(0)
      })

      it('registra o processo no quadro do módulo licitatório (que o secretário não lê)', async () => {
        const numero = (await db.query('select numero from tr_processos where id = $1', [PROC])).rows[0].numero
        expect((await db.query('select numero, objeto, etapa, tipo, modalidade, unidade_demandante, valor_estimado from processos where tr_processo_id = $1', [PROC])).rows[0])
          .toEqual({ numero, objeto: 'Aquisição de 20 cadeiras ergonômicas', etapa: 'Aberto', tipo: 'Pregao', modalidade: 'Pregão', unidade_demandante: 'Secretaria de Saúde', valor_estimado: '15000.00' })
        expect(await contar('secretario', 'processos')).toBe(0)
        expect(await contar('compras', 'processos')).toBeGreaterThan(0)
      })

      it('não aceita duas vezes', async () => {
        await expect(aceitar('compras', S)).rejects.toThrow(/aguardando análise/)
      })

      it('a secretaria acompanha tudo depois que o processo sai do Compras: onde está, histórico, documentos e assinaturas', async () => {
        const JUR = (await db.query(`select id from tr_unidades where sigla = 'JUR'`)).rows[0].id
        const OF = (await como('compras', `select doc_criar('OF', 'oficio', 1, 'Ofício ao Jurídico', $1, '{}'::jsonb, '[{"t":"p","x":"x"}]'::jsonb) as id`, [PROC])).rows[0].id
        await como('compras', `select doc_enviar_assinatura($1, '[{"usuario_id":"${U.juridico}","papel":"Parecerista"}]'::jsonb)`, [OF])
        await como('compras', 'select tr_tramitar($1, $2, null, $3, null)', [PROC, JUR, 'Para parecer jurídico'])
        expect((await como('secretario', 'select unidade_atual, recebido_em from tr_processos where id = $1', [PROC])).rows[0]).toEqual({ unidade_atual: JUR, recebido_em: null })
        const h = (await como('secretario', 'select tipo, despacho from tr_tramitacoes where processo_id = $1 order by id', [PROC])).rows
        expect(h.at(-1)).toEqual({ tipo: 'envio', despacho: 'Para parecer jurídico' })
        expect((await como('secretario', 'select 1 from doc_documentos where id = $1', [OF])).rows).toHaveLength(1)
        expect((await como('secretario', `select status from doc_assinaturas where documento_id = $1`, [OF])).rows).toEqual([{ status: 'pendente' }])
        expect((await como('secretario2', 'select 1 from tr_processos where id = $1', [PROC])).rows).toHaveLength(0)
        // devolve ao Compras para os testes seguintes
        await como('juridico', 'select tr_receber($1)', [PROC])
        await como('juridico', 'select tr_tramitar($1, $2, null, $3, null)', [PROC, COMP, 'Parecer emitido'])
        await como('compras', 'select tr_receber($1)', [PROC])
      })

      describe('roteiro de documentos do processo', () => {
        const marcar = (quem, item, situacao, ref) => como(quem, 'select cp_marcar_item($1, $2, $3, $4)', [PROC, item, situacao, ref])
        const marcas = async () => (await db.query('select item, situacao, referencia, marcado_por_nome from cp_checklist where processo_id = $1 order by item', [PROC])).rows

        it('marca como juntado (com referência) ou "não se aplica" (com justificativa)', async () => {
          await expect(marcar('compras', 'publicacao-edital', 'juntado', '')).rejects.toThrow(/onde o documento está/)
          await expect(marcar('compras', 'garantia', 'nao_se_aplica', 'não')).rejects.toThrow(/Justifique/)
          await expect(marcar('compras', 'Item Inválido', 'juntado', 'fls. 10')).rejects.toThrow(/Item inválido/)
          await expect(marcar('compras', 'edital', 'feito', 'fls. 10')).rejects.toThrow(/Situação inválida/)
          await marcar('compras', 'publicacao-edital', 'juntado', 'PNCP nº 123/2026')
          await marcar('compras', 'garantia', 'nao_se_aplica', 'Edital não exige garantia contratual.')
          expect(await marcas()).toEqual([
            { item: 'garantia', situacao: 'nao_se_aplica', referencia: 'Edital não exige garantia contratual.', marcado_por_nome: 'Compras' },
            { item: 'publicacao-edital', situacao: 'juntado', referencia: 'PNCP nº 123/2026', marcado_por_nome: 'Compras' },
          ])
          const h = (await db.query(`select despacho from tr_tramitacoes where processo_id = $1 and tipo = 'documento' order by id`, [PROC])).rows.map((r) => r.despacho)
          expect(h).toContain('Documento juntado (publicacao-edital): PNCP nº 123/2026')
        })

        it('remarcar atualiza; desfazer apaga e registra', async () => {
          await marcar('compras', 'publicacao-edital', 'juntado', 'PNCP nº 124/2026')
          expect((await marcas()).find((m) => m.item === 'publicacao-edital').referencia).toBe('PNCP nº 124/2026')
          await como('compras', 'select cp_desmarcar_item($1, $2)', [PROC, 'garantia'])
          expect((await marcas()).map((m) => m.item)).toEqual(['publicacao-edital'])
        })

        it('só a unidade onde o processo está marca; quem acompanha só lê', async () => {
          await expect(marcar('secretario', 'edital', 'juntado', 'fls. 10')).rejects.toThrow(/Somente a unidade/)
          await expect(como('secretario', 'select cp_desmarcar_item($1, $2)', [PROC, 'publicacao-edital'])).rejects.toThrow(/Somente a unidade/)
          expect((await como('secretario', 'select item from cp_checklist where processo_id = $1', [PROC])).rows).toHaveLength(1)
          expect((await como('secretario2', 'select item from cp_checklist where processo_id = $1', [PROC])).rows).toHaveLength(0)
        })

        it('processo concluído não aceita marcação', async () => {
          await como('compras', 'select tr_concluir($1, $2)', [PROC, 'Contratação concluída'])
          await expect(marcar('compras', 'edital', 'juntado', 'fls. 10')).rejects.toThrow(/concluído/)
          await como('compras', 'select tr_reabrir($1, $2)', [PROC, 'Faltou uma peça'])
        })
      })
    })

    it('processo sem DFD só pela administração (para lançar processos antigos)', async () => {
      const registrar = (quem, unidade = EDUC) => como(quem, 'select cp_registrar_processo($1, $2, $3, $4, $5, $6, $7, null, null) as id',
        ['Contratação de suporte de rede', unidade, 'Processo iniciado em papel.', 'dispensa', 'tic', 'normal', 9000])
      for (const quem of ['compras', 'secretario']) await expect(registrar(quem), quem).rejects.toThrow(/começa pela DFD do secretário/)
      await expect(registrar('admin', null)).rejects.toThrow(/unidade demandante/)
      const id = (await registrar('admin')).rows[0].id
      expect((await db.query('select tipo, contratacao_modalidade, contratacao_objeto, unidade_atual, interessado from tr_processos where id = $1', [id])).rows[0])
        .toEqual({ tipo: 'Contratação', contratacao_modalidade: 'dispensa', contratacao_objeto: 'tic', unidade_atual: COMP, interessado: 'SEMED — Secretaria de Educação' })
      expect((await db.query('select tipo from processos where tr_processo_id = $1', [id])).rows[0].tipo).toBe('Dispensa')
    })

    it('o administrador sem unidade aceita e o processo abre no Compras', async () => {
      const id = (await enviar('secretario')).rows[0].id
      const proc = (await aceitar('admin', id, 'dispensa')).rows[0].id
      expect((await db.query('select unidade_atual from tr_processos where id = $1', [proc])).rows[0].unidade_atual).toBe(COMP)
    })
  })

  it('anônimo não chama nenhuma função', async () => {
    for (const sql of ['select cp_enviar_solicitacao(null, null, null, null, null, null, null, null, null, null)', 'select cp_registrar_processo(null, null, null, null, null, null, null, null, null)',
      'select doc_criar_arquivo(null, null, null, null, null, null, null, null)', 'select doc_encaminhar(null, null, null)']) {
      await expect(db.transaction(async (tx) => {
        await tx.exec('set local role anon')
        return tx.query(sql)
      }), sql).rejects.toThrow(/permission denied/)
    }
  })
})

describe('fluxo das secretarias: catálogo, arquivos e encaminhamento', () => {
  let PRES, SAUDE
  beforeAll(async () => {
    PRES = (await db.query(`select id from tr_unidades where sigla = 'PRES'`)).rows[0].id
    SAUDE = (await db.query(`select id from tr_unidades where sigla = 'SMS'`)).rows[0].id
    await db.exec(`update usuarios set unidade_id = '${PRES}' where id = '${U.presidente}'`)
  })

  describe('catálogo de itens', () => {
    const inserir = (quem, nome = 'Computador desktop') => como(quem,
      `insert into cp_itens (codigo, nome, especificacao, unidade_medida, objeto_tipo, valor_referencia) values ($1, $2, 'i5, 16 GB, SSD 512 GB', 'unidade', 'bens-permanentes', 4500) returning id`,
      [`C-${nome}-${quem}`, nome])

    it('só a administração cadastra e altera; todos leem', async () => {
      const id = (await inserir('admin')).rows[0].id
      await inserir('presidente', 'Monitor 24 polegadas')
      for (const quem of ['compras', 'secretario', 'gestor']) await expect(inserir(quem), quem).rejects.toThrow(/row-level security|permission denied/)
      expect((await como('compras', `update cp_itens set nome = 'x' where id = $1`, [id]).catch(() => ({ affectedRows: 0 }))).affectedRows).toBe(0)
      await como('admin', `update cp_itens set ativo = false where id = $1`, [id])
      expect((await como('secretario', 'select ativo from cp_itens where id = $1', [id])).rows[0].ativo).toBe(false)
      expect((await como('admin', 'delete from cp_itens where id = $1', [id]).catch(() => ({ affectedRows: 0 }))).affectedRows).toBe(0)
      expect((await db.query('select 1 from cp_itens where id = $1', [id])).rows).toHaveLength(1)
    })

    it('valida o tipo de objeto e o valor', async () => {
      await expect(como('admin', `insert into cp_itens (nome, especificacao, objeto_tipo) values ('X', 'Y', 'foguete')`)).rejects.toThrow(/check constraint/)
      await expect(como('admin', `insert into cp_itens (nome, especificacao, valor_referencia) values ('X', 'Y', -1)`)).rejects.toThrow(/check constraint/)
    })
  })

  describe('arquivo enviado como documento', () => {
    const SHA = 'a'.repeat(64)
    const criar = (quem, o = {}) => como(quem, 'select doc_criar_arquivo($1, $2, $3, $4, $5, $6, $7, $8) as id', [
      o.titulo ?? 'Proposta da empresa', o.descricao ?? 'Proposta recebida por e-mail', o.processo ?? null,
      o.path ?? `${U[quem]}/abc-proposta.pdf`, o.nome ?? 'proposta.pdf', 'application/pdf', o.tamanho ?? 1000, o.sha ?? SHA])
    const doc = async (id) => (await db.query('select * from doc_documentos where id = $1', [id])).rows[0]
    let ID

    it('vira documento ANX, com o SHA-256 do arquivo no conteúdo que será assinado', async () => {
      ID = (await criar('compras')).rows[0].id
      const d = await doc(ID)
      expect(d.numero).toMatch(/^ANX-\d{4}\/000001$/)
      expect(d).toMatchObject({ modelo: 'arquivo', status: 'rascunho', arquivo_path: `${U.compras}/abc-proposta.pdf` })
      expect(d.corpo.at(-1)).toEqual({ t: 'arquivo', nome: 'proposta.pdf', tipo: 'application/pdf', tamanho: 1000, sha256: SHA })
    })

    it('valida o caminho (pasta da própria pessoa), o código e o tamanho', async () => {
      await expect(criar('compras', { path: `${U.gestor}/x.pdf` })).rejects.toThrow(/Arquivo inválido/)
      await expect(criar('compras', { path: `${U.compras}/y.pdf`, sha: 'xyz' })).rejects.toThrow(/Código do arquivo inválido/)
      await expect(criar('compras', { path: `${U.compras}/z.pdf`, tamanho: 30 * 1024 * 1024 })).rejects.toThrow(/até 20 MB/)
      await expect(criar('viewer', { path: `${U.viewer}/v.pdf` })).rejects.toThrow(/não pode enviar/)
      await expect(como('compras', `select doc_criar('ANX', 'arquivo', 1, 'Falso', null, '{}'::jsonb, '[]'::jsonb)`)).rejects.toThrow(/envio de arquivo/)
    })

    it('ao salvar, só título e descrição mudam: o bloco do arquivo é preservado', async () => {
      const falso = JSON.stringify([{ t: 'arquivo', nome: 'outro.pdf', sha256: 'b'.repeat(64) }])
      await como('compras', 'select doc_salvar($1, $2, $3::jsonb, $4::jsonb)', [ID, 'Proposta revisada', '{"descricao":"Nova descrição"}', falso])
      const d = await doc(ID)
      expect(d.titulo).toBe('Proposta revisada')
      expect(d.corpo.at(-1)).toMatchObject({ nome: 'proposta.pdf', sha256: SHA })
      expect(d.corpo[1].x).toBe('Nova descrição')
    })

    it('o caminho do arquivo nunca muda', async () => {
      await expect(db.exec(`update doc_documentos set arquivo_path = 'x/y.pdf' where id = '${ID}'`)).rejects.toThrow(/não pode ser alterada/)
    })
  })

  describe('encaminhar documento (ofício do Prefeito à secretaria)', () => {
    const encaminhar = (quem, id, unidade, despacho = 'Providenciar a DFD dos computadores.') =>
      como(quem, 'select doc_encaminhar($1, $2, $3) as id', [id, unidade, despacho])
    let OF

    beforeAll(async () => {
      OF = (await como('presidente', `select doc_criar('OF', 'oficio', 1, 'Ofício', null, '{"assunto":"Compra de computadores para as UBS"}'::jsonb, '[{"t":"p","x":"x"}]'::jsonb) as id`)).rows[0].id
    })

    it('só documento assinado é encaminhado, com despacho', async () => {
      await expect(encaminhar('presidente', OF, SAUDE)).rejects.toThrow(/Só um documento assinado/)
      await db.query(`update doc_documentos set status = 'assinado', assinado_em = now() where id = $1`, [OF])
      await expect(encaminhar('presidente', OF, SAUDE, 'x')).rejects.toThrow(/Escreva o despacho/)
      await expect(encaminhar('presidente', OF, null)).rejects.toThrow(/Unidade de destino/)
    })

    it('abre um processo de comunicação para a secretaria, que passa a ver o ofício', async () => {
      expect((await como('secretario', 'select 1 from doc_documentos where id = $1', [OF])).rows).toHaveLength(0)
      const proc = (await encaminhar('presidente', OF, SAUDE)).rows[0].id
      expect((await db.query('select tipo, assunto, unidade_atual, recebido_em from tr_processos where id = $1', [proc])).rows[0])
        .toEqual({ tipo: 'Comunicação oficial', assunto: 'Compra de computadores para as UBS', unidade_atual: SAUDE, recebido_em: null })
      expect((await db.query('select processo_id from doc_documentos where id = $1', [OF])).rows[0].processo_id).toBe(proc)
      expect((await como('secretario', 'select 1 from doc_documentos where id = $1', [OF])).rows).toHaveLength(1)
      expect((await como('secretario2', 'select 1 from doc_documentos where id = $1', [OF])).rows).toHaveLength(0)
    })

    it('documento já num processo: encaminhar move o processo (só quem está com ele)', async () => {
      await como('secretario', 'select tr_receber(p.id) from tr_processos p join doc_documentos d on d.processo_id = p.id where d.id = $1', [OF])
      await expect(encaminhar('compras', OF, PRES, 'Devolver ao gabinete')).rejects.toThrow(/Documento não encontrado|Somente a unidade/)
      const proc = (await encaminhar('secretario', OF, PRES, 'Ciente; DFD em elaboração.')).rows[0].id
      expect((await db.query('select unidade_atual from tr_processos where id = $1', [proc])).rows[0].unidade_atual).toBe(PRES)
    })
  })
})

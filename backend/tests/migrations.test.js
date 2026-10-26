// Executa as migrations reais num Postgres em memória (PGlite) e verifica RLS,
// triggers, auditoria e correções de dados, simulando o Supabase
// (papel authenticated + auth.uid(), auth.users e Storage).
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), 'utf8')
const MIGRATIONS = ['20261015_gestao_contratual.sql', '20261016_processos_importacao.sql',
  '20261017_correcoes_producao.sql', '20261018_fluxo_funcional.sql', '20261019_atualizacao_automatica.sql', '20261020_senha_provisoria.sql']
  .map((f) => ler(`../supabase/migrations/${f}`))
const [M1, M2, M3] = MIGRATIONS
const VERIFICACAO = ler('../supabase/verificacao.sql')

// O que o Supabase já tem antes das migrations (papéis, auth, storage e tabelas legadas)
const SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
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
  financeiro: uid(6), viewer: uid(7), inativo: uid(8), editor: uid(9), substituto: uid(10), gabinete: uid(11),
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
      ('${U.gabinete}', 'Gabinete', 'gabinete@x', 'gabinete', true);
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
    expect(rows[0].n).toBe(15)
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
    expect(rows).toHaveLength(16)
    const status = Object.fromEntries(rows.map((r) => [r.ordem, r.status]))
    for (const ordem of [1, 2, 3, 4, 5, 6, 7, 10, 12, 13, 14, 16]) expect(status[ordem], `item ${ordem}`).toBe('✅')
    expect(rows.find((r) => r.ordem === 12).detalhe).toMatch(/perfis ativos: 10 · processos: 1 · contratos: 2/)
  })
})

describe('perfis no banco (gc_role)', () => {
  it.each([
    ['admin', 'admin'], ['gestor', 'gestor'], ['viewer', 'viewer'], ['editor', 'compras'], ['gabinete', 'gabinete'],
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
    'gc_parametros', 'processos', 'usuarios']
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


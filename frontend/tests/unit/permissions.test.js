import { describe, expect, it } from 'vitest'
import { can, landingFor, menuFor, moduloDaRota, modulosFor, normalizeRole, ROLES } from '../../src/utils/permissions'

const PERFIS = ['compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'viewer']

// Matriz esperada, conforme o fluxo funcional (§2). Admin pode tudo.
const ESPERADO = {
  'contrato.criar': ['compras', 'gestor'],
  'contrato.editar': ['compras', 'gestor'],
  'contrato.encaminhar': ['compras'],
  'contrato.validar': ['gestor'],
  'contrato.situacao': ['gestor'],
  'responsaveis.editar': ['gestor'],
  'portaria.gerir': ['gestor'],
  'portaria.publicar': ['gestor', 'gabinete'],
  'termo.registrar': ['gestor'],
  'substituto.alternar': ['gestor', 'fiscal'],
  'os.solicitar': ['compras', 'gestor'],
  'os.emitir': ['gestor'],
  'os.assinar': ['gestor', 'gabinete'],
  // NF, fiscalização, glosa, documentação e atesto são do fiscal; a Gestão confere e libera
  'competencia.abrir': ['fiscal', 'gestor'],
  'competencia.fiscal': ['fiscal'],
  'competencia.liberar': ['gestor'],
  'ocorrencia.registrar': ['fiscal', 'gestor'],
  'evento.registrar': ['gestor'],
  'pendencia.registrar': ['gestor'],
  'documento.registrar': ['compras', 'gestor', 'fiscal', 'financeiro'],
  'financeiro.empenho': ['financeiro'],
  'financeiro.execucao': ['financeiro'],
  'relatorio.financeiro': ['gestor', 'financeiro'],
  'processo.editar': ['compras'],
  'usuarios.admin': [],
  'parametros.admin': [],
}

describe('normalizeRole', () => {
  it('editor legado é Compras; vazio é visualizador', () => {
    expect(normalizeRole('editor')).toBe('compras')
    expect(normalizeRole(null)).toBe('viewer')
    expect(normalizeRole(undefined)).toBe('viewer')
    expect(normalizeRole('gestor')).toBe('gestor')
  })
})

describe('can — matriz de permissões', () => {
  for (const [acao, permitidos] of Object.entries(ESPERADO)) {
    it(`${acao}: ${permitidos.join(', ') || 'somente admin'}`, () => {
      for (const perfil of PERFIS) {
        expect(can(perfil, acao), `${perfil} → ${acao}`).toBe(permitidos.includes(perfil))
      }
      expect(can('admin', acao)).toBe(true)
    })
  }

  it('editor legado herda as permissões de Compras', () => {
    for (const acao of Object.keys(ESPERADO)) expect(can('editor', acao)).toBe(can('compras', acao))
  })

  it('ação desconhecida e perfil desconhecido não têm permissão', () => {
    expect(can('gestor', 'acao.inexistente')).toBe(false)
    expect(can('hacker', 'contrato.criar')).toBe(false)
    expect(can(null, 'contrato.criar')).toBe(false)
  })

  it('visualizador nunca grava nada', () => {
    for (const acao of Object.keys(ESPERADO)) expect(can('viewer', acao)).toBe(false)
  })
})

describe('landingFor e menuFor', () => {
  it.each([
    ['gestor', '/mesa'], ['fiscal', '/mesa'], ['financeiro', '/mesa'], ['gabinete', '/gabinete'],
    ['compras', '/mesa'], ['editor', '/home'], ['viewer', '/home'], ['admin', '/mesa'], [undefined, '/home'],
  ])('%s entra em %s', (perfil, rota) => {
    expect(landingFor(perfil)).toBe(rota)
  })

  const rotas = (perfil) => Object.values(menuFor(perfil)).flat().map((i) => i.to)

  it('somente admin vê Usuários e Parâmetros', () => {
    expect(rotas('admin')).toEqual(expect.arrayContaining(['/usuarios', '/parametros']))
    for (const p of PERFIS) expect(rotas(p)).not.toContain('/usuarios')
  })

  it('fiscal tem a mesa e "Minhas fiscalizações"; não vê painéis financeiros nem o módulo licitatório', () => {
    expect(rotas('fiscal')).toEqual(['/mesa', '/alertas', '/contratos', '/competencias', '/relatorios'])
    expect(menuFor('fiscal').contratos[0].label).toBe('Minhas fiscalizações')
  })

  it('Gabinete vê apenas os atos para assinatura', () => {
    expect(rotas('gabinete')).toEqual(['/gabinete'])
  })

  it('compras vê o módulo licitatório', () => {
    expect(rotas('compras')).toEqual(expect.arrayContaining(['/home', '/dashboard', '/controle', '/arquivados']))
  })

  it('a tela inicial de cada perfil aparece no seu menu', () => {
    for (const p of ['gestor', 'fiscal', 'financeiro', 'compras', 'gabinete', 'viewer', 'admin']) {
      expect(rotas(p)).toContain(landingFor(p))
    }
  })

  it('todo perfil do menu de usuários tem rótulo', () => {
    for (const r of Object.values(ROLES)) expect(r.label).toBeTruthy()
  })
})

describe('módulos (o menu mostra só as telas do módulo aberto)', () => {
  const chaves = (perfil) => modulosFor(perfil).map((m) => m.key)

  it.each([
    ['gestor', ['mesa', 'contratos', 'financeiro']],
    ['fiscal', ['mesa', 'contratos']],
    ['financeiro', ['mesa', 'financeiro', 'contratos']],
    ['compras', ['mesa', 'licitacoes', 'contratos']],
    ['gabinete', ['gabinete']],
    ['viewer', ['contratos', 'financeiro', 'licitacoes']],
    ['admin', ['mesa', 'contratos', 'financeiro', 'licitacoes', 'gabinete', 'admin']],
  ])('%s: %j', (perfil, esperado) => {
    expect(chaves(perfil)).toEqual(esperado)
  })

  it('nenhum módulo fica sem telas e toda tela tem rótulo e ícone', () => {
    for (const p of [...PERFIS, 'admin']) {
      for (const m of modulosFor(p)) {
        expect(m.itens.length, `${p}/${m.key}`).toBeGreaterThan(0)
        expect(m.label && m.curto && m.icon).toBeTruthy()
        for (const i of m.itens) expect(i.label && i.icon && i.to.startsWith('/')).toBeTruthy()
      }
    }
  })

  it('para o fiscal, o módulo de contratações é a Fiscalização', () => {
    expect(modulosFor('fiscal')[1]).toMatchObject({ key: 'contratos', label: 'Fiscalização' })
  })

  it('a rota aberta indica o módulo e a tela (a ficha fica em Contratações)', () => {
    const m = modulosFor('gestor')
    expect(moduloDaRota(m, '/contratos/abc')).toMatchObject({ modulo: { key: 'contratos' }, item: { to: '/contratos' } })
    expect(moduloDaRota(m, '/gestao')).toMatchObject({ modulo: { key: 'contratos' }, item: { label: 'Painel da gestão' } })
    expect(moduloDaRota(m, '/financeiro')).toMatchObject({ modulo: { key: 'financeiro' } })
    expect(moduloDaRota(m, '/mesa')).toMatchObject({ modulo: { key: 'mesa' } })
    // /contratos-x não é a ficha de /contratos
    expect(moduloDaRota(m, '/contratos-x').item).toBeNull()
  })

  it('rota fora do menu fica no primeiro módulo, sem tela marcada', () => {
    expect(moduloDaRota(modulosFor('fiscal'), '/nao-existe')).toEqual({ modulo: expect.objectContaining({ key: 'mesa' }), item: null })
    expect(moduloDaRota([], '/mesa')).toEqual({ modulo: null, item: null })
  })

  it('tela presente em dois módulos fica no primeiro do perfil (Relatórios do Financeiro)', () => {
    expect(moduloDaRota(modulosFor('financeiro'), '/relatorios').modulo.key).toBe('financeiro')
  })
})

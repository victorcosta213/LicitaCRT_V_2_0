// Perfil Presidente / Prefeito: usuário mestre (vê e faz tudo, com tela inicial própria).
import { describe, expect, it } from 'vitest'
import { can, isMaster, landingFor, menuFor, modulosFor, normalizeRole, ROLES } from '../../src/utils/permissions'
import { alertasDoPerfil, minhaVez } from '../../src/utils/contrato'

const ACOES = [
  'contrato.criar', 'contrato.editar', 'contrato.encaminhar', 'contrato.validar', 'contrato.situacao', 'responsaveis.editar',
  'portaria.gerir', 'portaria.publicar', 'termo.registrar', 'substituto.alternar', 'os.solicitar', 'os.emitir', 'os.assinar',
  'competencia.abrir', 'competencia.fiscal', 'competencia.liberar', 'ocorrencia.registrar', 'evento.registrar',
  'pendencia.registrar', 'documento.registrar', 'financeiro.empenho', 'financeiro.execucao', 'relatorio.financeiro',
  'processo.editar', 'tramitacao.abrir', 'usuarios.admin', 'parametros.admin',
]

describe('perfil presidente', () => {
  it('existe, com o cargo na tela e uma descrição clara', () => {
    expect(ROLES.presidente.label).toBe('Presidente / Prefeito')
    expect(ROLES.presidente.desc).toMatch(/mestre/i)
    expect(normalizeRole('presidente')).toBe('presidente')
  })

  it('é perfil mestre, junto com o administrador, e mais ninguém', () => {
    expect(isMaster('presidente')).toBe(true)
    expect(isMaster('admin')).toBe(true)
    for (const r of ['gestor', 'compras', 'fiscal', 'financeiro', 'gabinete', 'viewer', 'editor', undefined]) expect(isMaster(r), String(r)).toBe(false)
  })

  it.each(ACOES)('pode %s', (acao) => {
    expect(can('presidente', acao)).toBe(true)
  })

  it('a tela inicial é a Visão geral, que só ele tem no menu', () => {
    expect(landingFor('presidente')).toBe('/painel')
    expect(menuFor('presidente').painel).toEqual([expect.objectContaining({ to: '/painel', label: 'Visão geral' })])
    expect(menuFor('admin').painel).toEqual([])
    for (const r of ['gestor', 'compras', 'fiscal', 'financeiro', 'gabinete', 'viewer']) expect(menuFor(r).painel, r).toEqual([])
  })

  it('os módulos começam pela Visão geral e incluem todos os demais, com a administração', () => {
    expect(modulosFor('presidente').map((m) => m.key)).toEqual(['painel', 'processos', 'documentos', 'compras', 'contratos', 'financeiro', 'licitacoes', 'gabinete', 'admin'])
  })

  it('o menu leva a todas as telas dos outros perfis', () => {
    const rotas = Object.values(menuFor('presidente')).flat().map((i) => i.to)
    for (const r of ['/painel', '/acompanhamento', '/processos', '/gestao', '/contratos', '/ordens-servico', '/competencias', '/financeiro',
      '/relatorios', '/gabinete', '/home', '/controle', '/usuarios', '/unidades', '/parametros', '/alertas']) {
      expect(rotas, r).toContain(r)
    }
  })

  it('está na vez de qualquer etapa da competência e vê todos os alertas', () => {
    const comp = (dono) => ({ status: { dono } })
    for (const dono of ['fiscal', 'gestor', 'financeiro']) expect(minhaVez({}, comp(dono), 'presidente', 'u1'), dono).toBe(true)
    const alertas = [{ id: 1, perfis: ['fiscal'] }, { id: 2, perfis: ['gestor'] }, { id: 3, perfis: ['financeiro'] }]
    expect(alertasDoPerfil(alertas, 'presidente', 'u1')).toEqual(alertas)
  })
})

// Controle de acesso por perfil nas rotas (App.jsx): telas são substituídas por marcadores.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { menuFor, landingFor } from '../../src/utils/permissions'

const auth = vi.hoisted(() => ({ value: {} }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => auth.value }))
vi.mock('../../src/AppLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return { default: () => <Outlet /> }
})

const PAGINAS = vi.hoisted(() => ({
  Home: '/home', Dashboard: '/dashboard', Controle: '/controle', Arquivados: '/arquivados',
  Contratos: '/contratos', ContratoFicha: '/contratos/:id', OrdensServico: '/ordens-servico',
  Competencias: '/competencias', Financeiro: '/financeiro', GestaoPainel: '/gestao', Alertas: '/alertas',
  Relatorios: '/relatorios', Parametros: '/parametros', Login: '/login', Usuarios: '/usuarios',
  RedefinirSenha: '/redefinir-senha', Gabinete: '/gabinete', Mesa: '/mesa',
}))
vi.mock('../../src/pages/Home', () => ({ default: () => 'PAGINA:Home' }))
vi.mock('../../src/pages/Dashboard', () => ({ default: () => 'PAGINA:Dashboard' }))
vi.mock('../../src/pages/Controle', () => ({ default: () => 'PAGINA:Controle' }))
vi.mock('../../src/pages/Arquivados', () => ({ default: () => 'PAGINA:Arquivados' }))
vi.mock('../../src/pages/Contratos', () => ({ default: () => 'PAGINA:Contratos' }))
vi.mock('../../src/pages/ContratoFicha', () => ({ default: () => 'PAGINA:ContratoFicha' }))
vi.mock('../../src/pages/OrdensServico', () => ({ default: () => 'PAGINA:OrdensServico' }))
vi.mock('../../src/pages/Competencias', () => ({ default: () => 'PAGINA:Competencias' }))
vi.mock('../../src/pages/Financeiro', () => ({ default: () => 'PAGINA:Financeiro' }))
vi.mock('../../src/pages/GestaoPainel', () => ({ default: () => 'PAGINA:GestaoPainel' }))
vi.mock('../../src/pages/Alertas', () => ({ default: () => 'PAGINA:Alertas' }))
vi.mock('../../src/pages/Relatorios', () => ({ default: () => 'PAGINA:Relatorios' }))
vi.mock('../../src/pages/Parametros', () => ({ default: () => 'PAGINA:Parametros' }))
vi.mock('../../src/pages/Login', () => ({ default: () => 'PAGINA:Login' }))
vi.mock('../../src/pages/Usuarios', () => ({ default: () => 'PAGINA:Usuarios' }))
vi.mock('../../src/pages/RedefinirSenha', () => ({ default: () => 'PAGINA:RedefinirSenha' }))
vi.mock('../../src/pages/Gabinete', () => ({ default: () => 'PAGINA:Gabinete' }))
vi.mock('../../src/pages/Mesa', () => ({ default: () => 'PAGINA:Mesa' }))

import App from '../../src/App'

const paginaDaRota = (rota) => Object.entries(PAGINAS).find(([, r]) => r === rota)?.[0]

// Renderiza a rota e devolve o texto exibido (o marcador da tela que abriu),
// esperando o carregamento sob demanda da tela terminar.
async function abrir(rota, { role = 'gestor', user = { id: 'u1' }, loading = false, acesso = 'liberado' } = {}) {
  auth.value = {
    user, loading, acesso, role: acesso === 'liberado' ? role : null,
    logout: vi.fn(), recarregarPerfil: vi.fn(),
  }
  const r = render(<MemoryRouter initialEntries={[rota]}><App /></MemoryRouter>)
  // entre o redirecionamento e o carregamento da tela há instantes vazios ou com o indicador
  if (!loading) await waitFor(() => expect(r.container.textContent).not.toMatch(/^(Carregando…)?$/))
  const texto = r.container.textContent
  r.unmount()
  return texto
}

beforeEach(() => { auth.value = {} })

describe('autenticação', () => {
  it('sem sessão, qualquer rota protegida leva ao login', async () => {
    expect(await abrir('/contratos', { user: null, acesso: null })).toBe('PAGINA:Login')
    expect(await abrir('/usuarios', { user: null, acesso: null })).toBe('PAGINA:Login')
  })

  it('enquanto a sessão carrega, mostra o indicador de carregamento', async () => {
    expect(await abrir('/contratos', { loading: true })).toBe('Carregando…')
  })

  it('redefinição de senha é pública (o link do e-mail abre sem login)', async () => {
    expect(await abrir('/redefinir-senha', { user: null, acesso: null })).toBe('PAGINA:RedefinirSenha')
  })

  it.each([
    ['sem_perfil', 'Acesso não liberado'],
    ['inativo', 'Acesso desativado'],
    ['erro', 'Não foi possível carregar seu perfil'],
  ])('logado com acesso %s não entra em nenhuma tela', async (acesso, mensagem) => {
    const texto = await abrir('/contratos', { acesso })
    expect(texto).toContain(mensagem)
    expect(texto).not.toContain('PAGINA:')
  })
})

describe('tela inicial por perfil', () => {
  it.each(['gestor', 'fiscal', 'financeiro', 'compras', 'gabinete', 'viewer', 'admin', 'editor'])('%s', async (role) => {
    expect(await abrir('/', { role })).toBe(`PAGINA:${paginaDaRota(landingFor(role))}`)
  })

  it('quem tem tarefas entra na própria mesa de trabalho', async () => {
    for (const role of ['gestor', 'fiscal', 'financeiro', 'compras']) {
      expect(await abrir('/', { role })).toBe('PAGINA:Mesa')
    }
  })

  it('rota inexistente cai na tela inicial', async () => {
    expect(await abrir('/nao-existe', { role: 'gabinete' })).toBe('PAGINA:Gabinete')
  })
})

describe('todo item de menu abre a tela (menu e rotas coerentes)', () => {
  for (const role of ['admin', 'gestor', 'fiscal', 'financeiro', 'compras', 'gabinete', 'viewer']) {
    it(role, async () => {
      for (const { to } of Object.values(menuFor(role)).flat()) {
        expect(await abrir(to, { role }), `${role} → ${to}`).toBe(`PAGINA:${paginaDaRota(to)}`)
      }
    })
  }
})

describe('bloqueios de acesso', () => {
  it.each([
    ['fiscal', '/financeiro', 'Mesa'],
    ['fiscal', '/gestao', 'Mesa'],
    ['fiscal', '/ordens-servico', 'Mesa'],
    ['fiscal', '/controle', 'Mesa'],
    ['fiscal', '/gabinete', 'Mesa'],
    ['gabinete', '/financeiro', 'Gabinete'],
    ['gabinete', '/controle', 'Gabinete'],
    ['gabinete', '/mesa', 'Gabinete'],
    ['financeiro', '/gestao', 'Mesa'],
    ['financeiro', '/arquivados', 'Mesa'],
    ['compras', '/competencias', 'Mesa'],
    ['compras', '/financeiro', 'Mesa'],
    ['gestor', '/controle', 'Mesa'],
    ['compras', '/usuarios', 'Mesa'],
    ['gestor', '/parametros', 'Mesa'],
    ['viewer', '/usuarios', 'Home'],
    ['viewer', '/mesa', 'Home'],
  ])('%s em %s é redirecionado para %s', async (role, rota, destino) => {
    expect(await abrir(rota, { role })).toBe(`PAGINA:${destino}`)
  })

  it('admin acessa administração', async () => {
    expect(await abrir('/usuarios', { role: 'admin' })).toBe('PAGINA:Usuarios')
    expect(await abrir('/parametros', { role: 'admin' })).toBe('PAGINA:Parametros')
  })

  it('ficha do contrato é acessível a todos os perfis (visibilidade do fiscal é feita pelo banco)', async () => {
    expect(await abrir('/contratos/abc', { role: 'fiscal' })).toBe('PAGINA:ContratoFicha')
  })
})

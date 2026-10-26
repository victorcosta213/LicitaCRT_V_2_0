// Guia de uso: "Por onde começar", página Ajuda e consistência dos atalhos do guia.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'

const h = vi.hoisted(() => ({ auth: {} }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/context/GcContext', () => ({ useGc: () => ({ alertas: [], consolidados: [] }) }))

import PrimeirosPassos from '../../src/components/gc/PrimeirosPassos'
import Ajuda from '../../src/pages/Ajuda'
import { CAMINHO, GLOSSARIO, GUIA, GUIA_LICITACAO } from '../../src/utils/guia'
import { ROLES, menuFor } from '../../src/utils/permissions'

const como = (role, ui) => {
  h.auth = { role, user: { id: 'u1' } }
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => { localStorage.clear() })

describe('guia de uso', () => {
  it('todo perfil usável tem um guia com passos', () => {
    for (const r of Object.keys(ROLES).filter((k) => k !== 'editor')) {
      expect(GUIA[r]?.passos.length, r).toBeGreaterThan(0)
      expect(GUIA[r].resumo, r).toBeTruthy()
    }
  })

  it('os atalhos dos passos apontam para rotas que existem no sistema', () => {
    const app = readFileSync('src/App.jsx', 'utf8')
    const rotas = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
    for (const [r, g] of Object.entries(GUIA)) {
      for (const p of g.passos) {
        const caminho = p.to.split('?')[0]
        expect(rotas, `${r}: ${p.to}`).toContain(caminho)
      }
    }
  })

  it('o perfil só recebe atalhos para telas que o menu dele oferece', () => {
    for (const [r, g] of Object.entries(GUIA)) {
      if (r === 'admin') continue
      const telas = Object.values(menuFor(r)).flat().map((i) => i.to)
      for (const p of g.passos) {
        expect(telas, `${r}: ${p.to}`).toContain(p.to.split('?')[0])
      }
    }
  })

  it('os perfis do módulo de licitações têm guia, com atalhos para telas que existem', () => {
    const app = readFileSync('src/App.jsx', 'utf8')
    const rotas = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
    expect(Object.keys(GUIA_LICITACAO).sort()).toEqual(['admin', 'compras', 'viewer'])
    for (const [r, g] of Object.entries(GUIA_LICITACAO)) {
      const telas = menuFor(r).licitacoes.map((i) => i.to)
      for (const p of g.passos) {
        expect(rotas, `${r}: ${p.to}`).toContain(p.to.split('?')[0])
        expect(telas, `${r}: ${p.to}`).toContain(p.to.split('?')[0])
      }
    }
  })

  it('o caminho e o glossário têm conteúdo', () => {
    expect(CAMINHO.length).toBeGreaterThan(5)
    expect(GLOSSARIO.map(([t]) => t)).toEqual(expect.arrayContaining(['Atesto', 'Glosa', 'Liquidação', 'OS / OC']))
  })
})

describe('Por onde começar', () => {
  it('mostra os passos do perfil, cada um com o seu botão', () => {
    como('compras', <PrimeirosPassos />)
    const guia = screen.getByRole('region', { name: 'Por onde começar' })
    expect(within(guia).getByText('Cadastre a contratação')).toBeInTheDocument()
    expect(within(guia).getByRole('link', { name: 'Nova contratação' })).toHaveAttribute('href', '/contratos?nova=1')
  })

  it('pode ser ocultado e a escolha fica guardada', async () => {
    const ui = userEvent.setup()
    const { unmount } = como('fiscal', <PrimeirosPassos />)
    await ui.click(screen.getByRole('button', { name: 'Ocultar guia' }))
    expect(screen.queryByText('Registre a nota fiscal do mês')).not.toBeInTheDocument()
    unmount()
    como('fiscal', <PrimeirosPassos />)
    expect(screen.getByRole('button', { name: 'Mostrar guia' })).toBeInTheDocument()
  })

  it('nas licitações mostra o guia próprio, com escolha independente do das contratações', async () => {
    const ui = userEvent.setup()
    como('compras', <PrimeirosPassos tipo="licitacao" />)
    const guia = screen.getByRole('region', { name: 'Por onde começar nas licitações' })
    expect(within(guia).getByText('Cadastre o processo')).toBeInTheDocument()
    expect(within(guia).getByRole('link', { name: 'Quadro de prioridades' })).toHaveAttribute('href', '/home')
    await ui.click(within(guia).getByRole('button', { name: 'Ocultar guia' }))
    expect(localStorage.getItem('guia-aberto-licitacao-compras')).toBe('0')
    expect(localStorage.getItem('guia-aberto-compras')).toBeNull()
  })

  it('funciona mesmo sem armazenamento no navegador', () => {
    const lido = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    como('gestor', <PrimeirosPassos />)
    expect(screen.getByText('Designe gestor e fiscais')).toBeInTheDocument()
    lido.mockRestore()
  })
})

describe('página Ajuda', () => {
  it('mostra o papel do perfil, o caminho da contratação e o glossário', () => {
    como('financeiro', <Ajuda />)
    expect(screen.getByRole('heading', { name: 'Ajuda' })).toBeInTheDocument()
    expect(screen.getByText(/O seu papel: Financeiro/)).toBeInTheDocument()
    expect(screen.getByText('Por onde uma contratação anda')).toBeInTheDocument()
    expect(screen.getByText('Glosa')).toBeInTheDocument()
  })

  it('quem opera as licitações vê também o guia dos processos', () => {
    como('compras', <Ajuda />)
    expect(screen.getByText('Processos licitatórios')).toBeInTheDocument()
    expect(screen.getByText('DFD')).toBeInTheDocument()
  })

  it('quem não usa as licitações não vê essa seção', () => {
    como('fiscal', <Ajuda />)
    expect(screen.queryByText('Processos licitatórios')).not.toBeInTheDocument()
  })
})

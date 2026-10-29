// Navegação por módulos: o trilho mostra os módulos do perfil e o menu ao lado,
// só as telas do módulo aberto.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const h = vi.hoisted(() => ({ auth: {}, gc: {} }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/context/GcContext', () => ({ useGc: () => h.gc }))
vi.mock('../../src/services/processos', () => ({ listarProcessos: vi.fn().mockResolvedValue([]) }))

import AppLayout from '../../src/AppLayout'

function abrir(rota, role, alertas = []) {
  h.auth = { role, user: { id: 'u1', email: 'ana@crt08.org.br' }, profile: { nome: 'Ana Ribeiro' }, nome: 'Ana Ribeiro', logout: vi.fn() }
  h.gc = { alertas, consolidados: [], porId: new Map() }
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="*" element={<div>conteúdo</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const trilho = () => within(screen.getByRole('navigation', { name: 'Módulos' }))
const menuDoModulo = () => within(screen.getByRole('complementary', { name: /^Telas de/ }))
const textos = (el) => el.getAllByRole('link').map((a) => a.textContent.replace(/\d+$/, '').trim())
// módulos do trilho (sem a marca CRT-08 e sem a contagem de pendências)
const modulos = () => trilho().getAllByRole('link').filter((a) => a.classList.contains('trilho__modulo'))
  .map((a) => a.querySelector('span').textContent)

beforeEach(() => { document.title = '' })

describe('navegação por módulos', () => {
  it('o trilho mostra só os módulos do perfil', () => {
    abrir('/gestao', 'gestor')
    expect(modulos()).toEqual(['Mesa', 'Processos', 'Documentos', 'Compras', 'Contratos', 'Financeiro'])
  })

  it('o menu lateral mostra só as telas do módulo aberto', () => {
    abrir('/gestao', 'gestor')
    expect(screen.getByRole('complementary', { name: 'Telas de Contratações' })).toBeInTheDocument()
    expect(textos(menuDoModulo())).toEqual(['Painel da gestão', 'Contratações', 'OS / OC', 'Competências', 'Relatórios'])
  })

  it('a ficha de uma contratação abre com o módulo Contratações marcado', () => {
    abrir('/contratos/abc', 'gestor')
    expect(trilho().getByRole('link', { name: /Contratos/ })).toHaveAttribute('aria-current', 'page')
    expect(menuDoModulo().getByRole('link', { name: 'Contratações' })).toHaveClass('active')
  })

  it('módulo de uma tela só dispensa o menu lateral (Gabinete)', () => {
    abrir('/gabinete', 'gabinete')
    expect(modulos()).toEqual(['Processos', 'Documentos', 'Compras', 'Gabinete'])
    expect(screen.queryByRole('complementary', { name: /^Telas de/ })).not.toBeInTheDocument()
  })

  it('para o fiscal, o módulo se chama Fiscalização', () => {
    abrir('/contratos', 'fiscal')
    expect(screen.getByRole('complementary', { name: 'Telas de Fiscalização' })).toBeInTheDocument()
    expect(menuDoModulo().getByRole('link', { name: 'Minhas fiscalizações' })).toBeInTheDocument()
  })

  it('a contagem de pendências aparece no módulo Mesa e no sino (informativos não contam)', () => {
    const alertas = [
      { id: 'a', perfis: ['gestor'], severidade: 'danger' },
      { id: 'b', perfis: ['gestor'], severidade: 'warning' },
      { id: 'c', perfis: ['gestor'], severidade: 'info' },
      { id: 'd', perfis: ['financeiro'], severidade: 'danger' },
    ]
    abrir('/gestao', 'gestor', alertas)
    expect(trilho().getByRole('link', { name: /Mesa/ })).toHaveTextContent('2')
    expect(screen.getByRole('link', { name: 'Pendências' })).toHaveTextContent('2')
  })

  it('a barra superior indica onde a pessoa está e o título da aba acompanha a tela', async () => {
    abrir('/financeiro', 'gestor')
    const trilha = within(screen.getByRole('navigation', { name: 'Você está em' }))
    expect(trilha.getByRole('link', { name: 'Financeiro' })).toBeInTheDocument()
    expect(trilha.getByText('Painel financeiro')).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Painel financeiro · Gestão de Contratações'))
  })
})

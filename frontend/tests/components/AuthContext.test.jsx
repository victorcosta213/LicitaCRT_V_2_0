import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

const h = vi.hoisted(() => ({
  session: null,
  listener: null,
  getUserProfile: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: h.session } }),
      onAuthStateChange: (cb) => { h.listener = cb; return { data: { subscription: { unsubscribe: vi.fn() } } } },
      signInWithPassword: h.signInWithPassword,
      signOut: h.signOut,
    },
  },
}))
vi.mock('../../src/services/users', () => ({ getUserProfile: h.getUserProfile }))

import { AuthProvider, useAuth } from '../../src/context/AuthContext'

function Sonda() {
  const a = useAuth()
  return (
    <>
      <pre data-testid="auth">{JSON.stringify({
        user: a.user?.id ?? null, role: a.role, acesso: a.acesso, nome: a.nome, loading: a.loading, isAdmin: a.isAdmin,
      })}</pre>
      <button onClick={a.recarregarPerfil}>recarregar</button>
    </>
  )
}
const estado = () => JSON.parse(screen.getByTestId('auth').textContent)

async function montar({ session, perfil }) {
  h.session = session
  if (perfil instanceof Error) h.getUserProfile.mockRejectedValue(perfil)
  else h.getUserProfile.mockResolvedValue(perfil)
  render(<AuthProvider><Sonda /></AuthProvider>)
  await waitFor(() => expect(estado().loading).toBe(false))
  return estado()
}

const sessao = { user: { id: 'u1', email: 'ana@crt08.gov.br' } }

beforeEach(() => {
  h.getUserProfile.mockReset()
  h.signInWithPassword.mockReset().mockResolvedValue({ error: null })
  h.signOut.mockReset().mockResolvedValue({})
})

describe('AuthContext', () => {
  it('sem sessão: deslogado', async () => {
    expect(await montar({ session: null, perfil: null })).toMatchObject({ user: null, role: null, acesso: null })
  })

  it('com perfil ativo: acesso liberado com o perfil de public.usuarios (busca só pelo id do login)', async () => {
    const s = await montar({ session: sessao, perfil: { id: 'u1', nome: 'Ana', role: 'admin', ativo: true } })
    expect(s).toMatchObject({ user: 'u1', role: 'admin', acesso: 'liberado', nome: 'Ana', isAdmin: true })
    expect(h.getUserProfile).toHaveBeenCalledWith('u1')
  })

  it('perfil sem papel definido vale como visualizador (igual ao banco)', async () => {
    expect(await montar({ session: sessao, perfil: { id: 'u1', role: null, ativo: true } })).toMatchObject({ role: 'viewer', acesso: 'liberado' })
  })

  it('sem perfil cadastrado: sem acesso (antes virava Compras)', async () => {
    expect(await montar({ session: sessao, perfil: null })).toMatchObject({ user: 'u1', role: null, acesso: 'sem_perfil' })
  })

  it('perfil desativado: sem acesso (antes mantinha o perfil antigo)', async () => {
    expect(await montar({ session: sessao, perfil: { role: 'gestor', ativo: false } })).toMatchObject({ role: null, acesso: 'inativo' })
  })

  it('falha ao ler o perfil: tela de erro, sem conceder permissões', async () => {
    expect(await montar({ session: sessao, perfil: new Error('rede') })).toMatchObject({ role: null, acesso: 'erro' })
  })

  it('"Tentar novamente" relê o perfil', async () => {
    await montar({ session: sessao, perfil: new Error('rede') })
    h.getUserProfile.mockResolvedValue({ role: 'fiscal', ativo: true })
    await act(async () => screen.getByText('recarregar').click())
    await waitFor(() => expect(estado()).toMatchObject({ role: 'fiscal', acesso: 'liberado' }))
  })

  it('falha momentânea ao renovar o token não derruba quem já estava liberado', async () => {
    await montar({ session: sessao, perfil: { role: 'gestor', ativo: true } })
    h.getUserProfile.mockRejectedValue(new Error('rede'))
    await act(async () => h.listener('TOKEN_REFRESHED', sessao))
    expect(estado()).toMatchObject({ role: 'gestor', acesso: 'liberado' })
  })

  it('desativação é percebida na próxima leitura do perfil', async () => {
    await montar({ session: sessao, perfil: { role: 'gestor', ativo: true } })
    h.getUserProfile.mockResolvedValue({ role: 'gestor', ativo: false })
    await act(async () => h.listener('TOKEN_REFRESHED', sessao))
    expect(estado()).toMatchObject({ role: null, acesso: 'inativo' })
  })

  it('logout encerra a sessão e limpa o perfil', async () => {
    await montar({ session: sessao, perfil: { role: 'gestor', ativo: true } })
    await act(async () => h.listener('SIGNED_OUT', null))
    expect(estado()).toMatchObject({ user: null, role: null, acesso: null })
  })
})

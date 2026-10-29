import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

const h = vi.hoisted(() => ({
  session: null,
  listener: null,
  getUserProfile: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: h.session } }),
      onAuthStateChange: (cb) => { h.listener = cb; return { data: { subscription: { unsubscribe: vi.fn() } } } },
      signInWithPassword: h.signInWithPassword,
      signOut: h.signOut,
    },
    rpc: h.rpc,
  },
}))
vi.mock('../../src/services/users', () => ({ getUserProfile: h.getUserProfile }))

import { AuthProvider, useAuth } from '../../src/context/AuthContext'

function Sonda() {
  const a = useAuth()
  return (
    <>
      <pre data-testid="auth">{JSON.stringify({
        user: a.user?.id ?? null, role: a.role, acesso: a.acesso, nome: a.nome, loading: a.loading, isAdmin: a.isAdmin, trocar: a.precisaTrocarSenha,
      })}</pre>
      <button onClick={a.recarregarPerfil}>recarregar</button>
      <button onClick={a.senhaTrocada}>senha trocada</button>
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
  h.rpc.mockReset().mockResolvedValue({ data: false, error: null })
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

describe('AuthContext: troca de usuário sem passar pelo login', () => {
  it('enquanto o perfil da nova pessoa é lido, nada do perfil anterior continua valendo', async () => {
    await montar({ session: sessao, perfil: { id: 'u1', role: 'gestor', ativo: true, nome: 'Ana' } })
    expect(estado()).toMatchObject({ user: 'u1', role: 'gestor', loading: false })

    let responder
    h.getUserProfile.mockReturnValue(new Promise((resolve) => { responder = resolve }))
    await act(async () => { h.listener('SIGNED_IN', { user: { id: 'u2', email: 'pres@crt08.gov.br' } }) })
    expect(estado()).toMatchObject({ user: 'u2', role: null, acesso: null, loading: true })

    await act(async () => { responder({ id: 'u2', role: 'presidente', ativo: true, nome: 'Marcos' }) })
    await waitFor(() => expect(estado()).toMatchObject({ user: 'u2', role: 'presidente', acesso: 'liberado', loading: false }))
  })

  it('renovar o token da mesma pessoa não a tira da tela', async () => {
    await montar({ session: sessao, perfil: { id: 'u1', role: 'gestor', ativo: true, nome: 'Ana' } })
    h.getUserProfile.mockResolvedValue({ id: 'u1', role: 'gestor', ativo: true, nome: 'Ana' })
    await act(async () => { h.listener('TOKEN_REFRESHED', { user: { id: 'u1', email: 'ana@crt08.gov.br' } }) })
    expect(estado()).toMatchObject({ user: 'u1', role: 'gestor', loading: false })
  })
})

describe('AuthContext: senha provisória', () => {
  const perfil = { id: 'u1', role: 'fiscal', ativo: true, nome: 'Ana' }

  it('com a senha provisória, a pessoa fica retida até criar a dela', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null })
    const e = await montar({ session: sessao, perfil })
    expect(h.rpc).toHaveBeenCalledWith('gc_precisa_trocar_senha')
    expect(e).toMatchObject({ acesso: 'liberado', trocar: true })
  })

  it('depois da troca confirmada, libera o uso do sistema', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null })
    await montar({ session: sessao, perfil })
    await act(async () => { screen.getByText('senha trocada').click() })
    expect(estado().trocar).toBe(false)
  })

  it('uma leitura antiga que termina depois da troca não volta a reter a pessoa', async () => {
    let responder
    h.rpc.mockReturnValue(new Promise((r) => { responder = r }))
    h.session = sessao
    h.getUserProfile.mockResolvedValue(perfil)
    render(<AuthProvider><Sonda /></AuthProvider>)
    await waitFor(() => expect(h.rpc).toHaveBeenCalled())
    await act(async () => { screen.getByText('senha trocada').click() })
    await act(async () => { responder({ data: true, error: null }) })
    expect(estado().trocar).toBe(false)
  })

  it('sem a migration (a consulta falha), ninguém fica trancado para fora', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'function public.gc_precisa_trocar_senha() does not exist' } })
    const e = await montar({ session: sessao, perfil })
    expect(e).toMatchObject({ acesso: 'liberado', trocar: false })
  })

  it('perfil inativo ou sem perfil nem consulta a senha provisória', async () => {
    await montar({ session: sessao, perfil: null })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('no logout, a exigência é limpa', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null })
    await montar({ session: sessao, perfil })
    await act(async () => { h.listener('SIGNED_OUT', null) })
    await waitFor(() => expect(estado().trocar).toBe(false))
  })
})


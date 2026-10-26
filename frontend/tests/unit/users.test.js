import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  insert: vi.fn(),
  maybeSingle: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signUp: h.signUp } }) }))
vi.mock('../../src/services/supabase', () => ({
  supabase: {
    from: () => ({
      insert: h.insert,
      select: () => ({ eq: () => ({ maybeSingle: h.maybeSingle }) }),
    }),
  },
}))

import { criarUsuario, getUserProfile, mensagemErroUsuario } from '../../src/services/users'

beforeEach(() => {
  h.signUp.mockReset()
  h.insert.mockReset().mockResolvedValue({ error: null })
  h.maybeSingle.mockReset()
})

const dados = { nome: 'Ana', email: 'ana@crt08.gov.br', password: 'Senha1234', role: 'fiscal' }

describe('criarUsuario', () => {
  it('cria o login e o perfil com o mesmo id, já ativo', async () => {
    h.signUp.mockResolvedValue({ data: { user: { id: 'u9', identities: [{ id: 'i' }] } }, error: null })
    await expect(criarUsuario(dados)).resolves.toEqual({ uid: 'u9', precisaConfirmar: true })
    expect(h.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@crt08.gov.br', password: 'Senha1234' }))
    expect(h.insert).toHaveBeenCalledWith([{ id: 'u9', nome: 'Ana', email: 'ana@crt08.gov.br', role: 'fiscal', ativo: true }])
  })

  it('com a confirmação de e-mail desligada no Supabase, o login já nasce liberado', async () => {
    h.signUp.mockResolvedValue({ data: { user: { id: 'u8', identities: [{ id: 'i' }] }, session: { access_token: 't' } }, error: null })
    await expect(criarUsuario(dados)).resolves.toEqual({ uid: 'u8', precisaConfirmar: false })
    expect(h.insert).toHaveBeenCalledOnce()
  })

  // O Supabase não acusa e-mail repetido: devolve um usuário "fantasma" sem identidades.
  it('e-mail já cadastrado não grava perfil órfão', async () => {
    h.signUp.mockResolvedValue({ data: { user: { id: 'fantasma', identities: [] } }, error: null })
    await expect(criarUsuario(dados)).rejects.toThrow('Este e-mail já está cadastrado.')
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('erro do Auth é repassado', async () => {
    h.signUp.mockResolvedValue({ data: {}, error: new Error('Password should be at least 6 characters') })
    await expect(criarUsuario(dados)).rejects.toThrow(/Password/)
  })
})

describe('getUserProfile', () => {
  it('devolve o perfil, ou null quando não existe', async () => {
    h.maybeSingle.mockResolvedValueOnce({ data: { id: 'u1', role: 'gestor' }, error: null })
    await expect(getUserProfile('u1')).resolves.toEqual({ id: 'u1', role: 'gestor' })
    h.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(getUserProfile('u2')).resolves.toBeNull()
  })

  it('falha de consulta é lançada (não vira "sem perfil")', async () => {
    h.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    await expect(getUserProfile('u1')).rejects.toMatchObject({ message: 'Failed to fetch' })
  })
})

describe('mensagemErroUsuario', () => {
  it.each([
    [{ message: 'User already registered' }, 'Este e-mail já está cadastrado.'],
    [new Error('Este e-mail já está cadastrado.'), 'Este e-mail já está cadastrado.'],
    [{ code: 'weak_password', message: 'x' }, 'Senha fraca: use pelo menos 8 caracteres, misturando letras e números.'],
    [{ message: 'Unable to validate email address: invalid format' }, 'E-mail inválido.'],
    [{ message: 'email rate limit exceeded' }, 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'],
    [{ code: '42501', message: 'denied' }, 'Seu perfil não tem permissão para esta ação.'],
    [{ message: 'Você não pode remover o seu próprio acesso de administrador.' }, 'Você não pode remover o seu próprio acesso de administrador.'],
    [{}, 'Ocorreu um erro.'],
  ])('%j → %s', (err, msg) => {
    expect(mensagemErroUsuario(err)).toBe(msg)
  })
})

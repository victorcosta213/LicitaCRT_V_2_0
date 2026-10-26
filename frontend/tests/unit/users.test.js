import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  insert: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  updateUser: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signUp: h.signUp } }) }))
vi.mock('../../src/services/supabase', () => ({
  supabase: {
    rpc: h.rpc,
    functions: { invoke: h.invoke },
    auth: { updateUser: h.updateUser },
    from: () => ({
      insert: h.insert,
      select: () => ({ eq: () => ({ maybeSingle: h.maybeSingle }) }),
    }),
  },
}))

import { criarUsuario, getUserProfile, mensagemErroUsuario, resetarSenha, trocarSenhaPrimeiroAcesso } from '../../src/services/users'

beforeEach(() => {
  h.signUp.mockReset()
  h.insert.mockReset().mockResolvedValue({ error: null })
  h.maybeSingle.mockReset()
  h.rpc.mockReset().mockResolvedValue({ error: null })
  h.invoke.mockReset()
  h.updateUser.mockReset().mockResolvedValue({ error: null })
})

const dados = { nome: 'Ana', email: 'ana@crt08.gov.br', password: 'Senha1234', role: 'fiscal' }

describe('criarUsuario', () => {
  it('cria o login e o perfil com o mesmo id, já ativo', async () => {
    h.signUp.mockResolvedValue({ data: { user: { id: 'u9', identities: [{ id: 'i' }] } }, error: null })
    await expect(criarUsuario(dados)).resolves.toEqual({ uid: 'u9', precisaConfirmar: true, trocaObrigatoria: true })
    expect(h.rpc).toHaveBeenCalledWith('gc_marcar_senha_provisoria', { p_uid: 'u9' })
    expect(h.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@crt08.gov.br', password: 'Senha1234' }))
    expect(h.insert).toHaveBeenCalledWith([{ id: 'u9', nome: 'Ana', email: 'ana@crt08.gov.br', role: 'fiscal', ativo: true }])
  })

  it('com a confirmação de e-mail desligada no Supabase, o login já nasce liberado', async () => {
    h.signUp.mockResolvedValue({ data: { user: { id: 'u8', identities: [{ id: 'i' }] }, session: { access_token: 't' } }, error: null })
    await expect(criarUsuario(dados)).resolves.toEqual({ uid: 'u8', precisaConfirmar: false, trocaObrigatoria: true })
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

describe('senha provisória', () => {
  it('se não der para exigir a troca (migration ausente), o usuário é criado e o aviso sobe', async () => {
    h.signUp.mockResolvedValue({ data: { user: { id: 'u7', identities: [{ id: 'i' }] } }, error: null })
    h.rpc.mockResolvedValue({ error: { message: 'function does not exist' } })
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(criarUsuario(dados)).resolves.toMatchObject({ uid: 'u7', trocaObrigatoria: false })
    expect(h.insert).toHaveBeenCalledOnce()
    erro.mockRestore()
  })

  it('resetarSenha chama a função de servidor só com o id do usuário', async () => {
    h.invoke.mockResolvedValue({ data: { ok: true }, error: null })
    await resetarSenha('u1')
    expect(h.invoke).toHaveBeenCalledWith('resetar-senha', { body: { uid: 'u1' } })
  })

  it('resetarSenha mostra a mensagem que a função devolveu', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { context: { status: 403, json: async () => ({ erro: 'Somente o administrador pode redefinir senhas.' }) } } })
    await expect(resetarSenha('u1')).rejects.toThrow('Somente o administrador pode redefinir senhas.')
  })

  it('resetarSenha avisa quando a função ainda não foi publicada (404)', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { context: { status: 404, json: async () => ({}) } } })
    await expect(resetarSenha('u1')).rejects.toThrow(/ainda não foi publicada/)
  })

  it('resetarSenha com falha de rede dá uma mensagem útil', async () => {
    h.invoke.mockResolvedValue({ data: null, error: new Error('Failed to send a request') })
    await expect(resetarSenha('u1')).rejects.toThrow(/Verifique a conexão/)
  })

  it('a troca do primeiro acesso grava a senha e depois avisa o banco, nesta ordem', async () => {
    await trocarSenhaPrimeiroAcesso('NovaSenha123')
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'NovaSenha123' })
    expect(h.rpc).toHaveBeenCalledWith('gc_senha_trocada')
    expect(h.updateUser.mock.invocationCallOrder[0]).toBeLessThan(h.rpc.mock.invocationCallOrder[0])
  })

  it('se a senha não foi gravada, o banco não é avisado', async () => {
    h.updateUser.mockResolvedValue({ error: { code: 'same_password', message: 'New password should be different from the old password.' } })
    await expect(trocarSenhaPrimeiroAcesso('igual')).rejects.toMatchObject({ code: 'same_password' })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('traduz o erro de senha igual à anterior', () => {
    expect(mensagemErroUsuario({ code: 'same_password', message: 'x' })).toBe('A nova senha precisa ser diferente da atual.')
  })
})


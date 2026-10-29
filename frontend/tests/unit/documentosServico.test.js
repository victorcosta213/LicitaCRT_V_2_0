import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), rpcSecundario: vi.fn(), opcoes: [] }))
vi.mock('../../src/services/supabase', () => ({ supabase: { rpc: h.rpc, from: h.from } }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => {
    h.opcoes.push(args)
    return { auth: { signInWithPassword: h.signIn, signOut: h.signOut }, rpc: h.rpcSecundario }
  },
}))

import {
  EVENTO_DOCUMENTO, assinarDocumento, cancelarDocumento, criarDocumento, definirContratacao, enviarParaAssinatura, listarAssinaturas, listarDocumentos,
  listarMinhasAssinaturasPendentes, listarPessoasParaAssinar, mensagemErroDocumento, obterDocumento, recusarAssinatura, salvarDocumento, verificarDocumento,
} from '../../src/services/documentos'

// consulta encadeável que termina (await) com o resultado dado
const consulta = (resultado) => {
  const q = { select: vi.fn(() => q), order: vi.fn(() => q), limit: vi.fn(() => q), eq: vi.fn(() => q), in: vi.fn(() => q), maybeSingle: vi.fn(() => q),
    then: (ok, ko) => Promise.resolve(resultado).then(ok, ko) }
  return q
}
const MODELO = { codigo: 'oficio', sigla: 'OF', versao: 1 }

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ data: null, error: null })
  h.rpcSecundario.mockReset().mockResolvedValue({ data: null, error: null })
  h.signIn.mockReset().mockResolvedValue({ error: null })
  h.signOut.mockReset().mockResolvedValue({})
  h.from.mockReset()
  h.opcoes.length = 0
})

describe('funções do banco', () => {
  it('criar manda o modelo, o processo e o conteúdo, e devolve o id', async () => {
    h.rpc.mockResolvedValue({ data: 'novo-id', error: null })
    await expect(criarDocumento({ modelo: MODELO, titulo: 'Ofício', processoId: 'p1', conteudo: { a: 1 }, corpo: [] })).resolves.toBe('novo-id')
    expect(h.rpc).toHaveBeenCalledWith('doc_criar', { p_sigla: 'OF', p_modelo: 'oficio', p_modelo_versao: 1, p_titulo: 'Ofício', p_processo: 'p1', p_conteudo: { a: 1 }, p_corpo: [] })
    await criarDocumento({ modelo: MODELO, titulo: 'x' })
    expect(h.rpc).toHaveBeenLastCalledWith('doc_criar', expect.objectContaining({ p_processo: null, p_conteudo: {}, p_corpo: [] }))
  })

  it('salvar, enviar, recusar e cancelar usam o id do documento', async () => {
    await salvarDocumento('d1', { titulo: 'T', conteudo: { a: 1 }, corpo: [{ t: 'p', x: 'oi' }] })
    expect(h.rpc).toHaveBeenLastCalledWith('doc_salvar', { p_id: 'd1', p_titulo: 'T', p_conteudo: { a: 1 }, p_corpo: [{ t: 'p', x: 'oi' }] })
    await enviarParaAssinatura('d1', [{ usuario_id: 'u1', papel: 'Presidente' }])
    expect(h.rpc).toHaveBeenLastCalledWith('doc_enviar_assinatura', { p_id: 'd1', p_signatarios: [{ usuario_id: 'u1', papel: 'Presidente' }] })
    await recusarAssinatura('d1', 'Faltou anexo')
    expect(h.rpc).toHaveBeenLastCalledWith('doc_recusar', { p_id: 'd1', p_motivo: 'Faltou anexo' })
    await cancelarDocumento('d1', 'Engano')
    expect(h.rpc).toHaveBeenLastCalledWith('doc_cancelar', { p_id: 'd1', p_motivo: 'Engano' })
  })

  it('cada operação avisa as telas desta aba; erro não avisa', async () => {
    const aviso = vi.fn()
    window.addEventListener(EVENTO_DOCUMENTO, aviso)
    await salvarDocumento('d1', { titulo: 'T', conteudo: {}, corpo: [] })
    await cancelarDocumento('d1', 'x')
    expect(aviso).toHaveBeenCalledTimes(2)
    h.rpc.mockResolvedValue({ data: null, error: new Error('falhou') })
    await expect(cancelarDocumento('d1', 'y')).rejects.toThrow('falhou')
    expect(aviso).toHaveBeenCalledTimes(2)
    window.removeEventListener(EVENTO_DOCUMENTO, aviso)
  })

  it('a conferência e a lista de pessoas chamam as funções certas', async () => {
    h.rpc.mockResolvedValue({ data: { encontrado: true }, error: null })
    await expect(verificarDocumento('ABCD')).resolves.toEqual({ encontrado: true })
    expect(h.rpc).toHaveBeenLastCalledWith('doc_verificar', { p_codigo: 'ABCD' })
    h.rpc.mockResolvedValue({ data: [{ id: 'u1', nome: 'Ana' }], error: null })
    await expect(listarPessoasParaAssinar()).resolves.toEqual([{ id: 'u1', nome: 'Ana' }])
    h.rpc.mockResolvedValue({ data: null, error: null })
    await expect(listarPessoasParaAssinar()).resolves.toEqual([])
  })

  it('definir a contratação limpa os valores vazios e avisa processos e documentos', async () => {
    const aviso = vi.fn()
    window.addEventListener('tramitacao:mudou', aviso)
    await definirContratacao('p1', { modalidade: 'pregao', objeto: '' })
    expect(h.rpc).toHaveBeenLastCalledWith('tr_definir_contratacao', { p_id: 'p1', p_modalidade: 'pregao', p_objeto: null })
    expect(aviso).toHaveBeenCalledOnce()
    window.removeEventListener('tramitacao:mudou', aviso)
  })
})

describe('leituras', () => {
  it('a lista não traz o texto do documento (só as colunas leves), do mais recente ao mais antigo', async () => {
    const q = consulta({ data: [{ id: 1 }], error: null })
    h.from.mockReturnValue(q)
    await expect(listarDocumentos()).resolves.toEqual([{ id: 1 }])
    expect(h.from).toHaveBeenCalledWith('doc_documentos')
    expect(q.select.mock.calls[0][0]).not.toContain('corpo')
    expect(q.select.mock.calls[0][0]).not.toContain('conteudo')
    expect(q.order).toHaveBeenCalledWith('atualizado_em', { ascending: false })
  })

  it('assinaturas e documento completo (com texto)', async () => {
    h.from.mockReturnValue(consulta({ data: [{ id: 5 }], error: null }))
    await expect(listarAssinaturas()).resolves.toEqual([{ id: 5 }])
    const doc = consulta({ data: { id: 'd1', corpo: [] }, error: null })
    const ass = consulta({ data: [{ id: 9 }], error: null })
    h.from.mockImplementation((t) => (t === 'doc_documentos' ? doc : ass))
    await expect(obterDocumento('d1')).resolves.toEqual({ documento: { id: 'd1', corpo: [] }, assinaturas: [{ id: 9 }] })
    expect(doc.select).toHaveBeenCalledWith('*')
    expect(doc.eq).toHaveBeenCalledWith('id', 'd1')
    expect(ass.eq).toHaveBeenCalledWith('documento_id', 'd1')
  })

  it('as pendências da pessoa trazem o documento junto e descartam versão antiga', async () => {
    const ass = consulta({ data: [{ id: 1, documento_id: 'a', versao: 2 }, { id: 2, documento_id: 'b', versao: 1 }], error: null })
    const docs = consulta({ data: [{ id: 'a', versao: 2, status: 'aguardando_assinatura' }, { id: 'b', versao: 3, status: 'aguardando_assinatura' }], error: null })
    h.from.mockImplementation((t) => (t === 'doc_assinaturas' ? ass : docs))
    const r = await listarMinhasAssinaturasPendentes('eu')
    expect(r).toHaveLength(1)
    expect(r[0].documento.id).toBe('a')
    expect(ass.eq).toHaveBeenCalledWith('usuario_id', 'eu')
    expect(ass.eq).toHaveBeenCalledWith('status', 'pendente')
    expect(docs.in).toHaveBeenCalledWith('id', ['a', 'b'])
  })

  it('sem pendências, nem consulta os documentos', async () => {
    h.from.mockReturnValue(consulta({ data: [], error: null }))
    await expect(listarMinhasAssinaturasPendentes('eu')).resolves.toEqual([])
    expect(h.from).toHaveBeenCalledTimes(1)
  })

  it('falha de leitura é repassada', async () => {
    h.from.mockReturnValue(consulta({ data: null, error: { code: '42P01', message: 'relation does not exist' } }))
    await expect(listarDocumentos()).rejects.toMatchObject({ code: '42P01' })
  })
})

describe('assinatura com senha reconfirmada', () => {
  it('entra com a senha num cliente à parte, assina com o token novo e sai só localmente', async () => {
    await assinarDocumento('d1', { email: 'ana@crt08.gov.br', senha: 'Segredo123' })
    expect(h.opcoes[0][2].auth).toMatchObject({ persistSession: false, autoRefreshToken: false })
    expect(h.signIn).toHaveBeenCalledWith({ email: 'ana@crt08.gov.br', password: 'Segredo123' })
    expect(h.rpcSecundario).toHaveBeenCalledWith('doc_assinar', { p_id: 'd1' })
    expect(h.rpc).not.toHaveBeenCalled() // a chamada de assinatura não passa pelo cliente da sessão normal
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(h.signIn.mock.invocationCallOrder[0]).toBeLessThan(h.rpcSecundario.mock.invocationCallOrder[0])
  })

  it('senha errada: não assina, a mensagem é clara e o cliente à parte ainda sai', async () => {
    h.signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    await expect(assinarDocumento('d1', { email: 'a@b.c', senha: 'errada' })).rejects.toMatchObject({ message: 'Invalid login credentials' })
    expect(h.rpcSecundario).not.toHaveBeenCalled()
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mensagemErroDocumento({ message: 'Invalid login credentials' })).toBe('Senha incorreta. Confira a senha e tente de novo.')
  })

  it('se o banco recusar a assinatura, o erro chega à tela', async () => {
    h.rpcSecundario.mockResolvedValue({ data: null, error: new Error('Confirme a sua senha para assinar.') })
    await expect(assinarDocumento('d1', { email: 'a@b.c', senha: 'x' })).rejects.toThrow('Confirme a sua senha para assinar.')
    expect(h.signOut).toHaveBeenCalledOnce()
  })

  it('falha ao sair não esconde o resultado da assinatura', async () => {
    h.signOut.mockRejectedValue(new Error('rede'))
    await expect(assinarDocumento('d1', { email: 'a@b.c', senha: 'x' })).resolves.toBeNull()
  })

  it('avisa as telas quando a assinatura dá certo', async () => {
    const aviso = vi.fn()
    window.addEventListener(EVENTO_DOCUMENTO, aviso)
    await assinarDocumento('d1', { email: 'a@b.c', senha: 'x' })
    expect(aviso).toHaveBeenCalledOnce()
    window.removeEventListener(EVENTO_DOCUMENTO, aviso)
  })
})

describe('mensagens de erro', () => {
  it.each([
    [{ message: 'Invalid login credentials' }, 'Senha incorreta. Confira a senha e tente de novo.'],
    [{ message: 'Email rate limit exceeded' }, 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'],
    [{ message: 'Failed to fetch' }, 'Sem conexão com o servidor. Verifique a internet e tente de novo.'],
    [{ code: '42501', message: 'permission denied for table doc_documentos' }, 'Seu perfil não tem permissão para esta ação.'],
    [{ code: '42501', message: 'Seu perfil não pode criar documentos.' }, 'Seu perfil não pode criar documentos.'],
    [new Error('Informe o título do documento.'), 'Informe o título do documento.'],
    [{}, 'Não foi possível concluir a operação.'],
  ])('%j', (erro, esperado) => expect(mensagemErroDocumento(erro)).toBe(esperado))
})

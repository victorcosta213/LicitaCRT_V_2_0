import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../src/services/supabase', () => ({ supabase: { rpc: h.rpc, from: h.from } }))

import {
  EVENTO_MUDANCA, abrirProcessoAdm, atualizarDadosProcessoAdm, atualizarUnidade, concluirProcessoAdm, criarUnidade, listarPessoasDaUnidade,
  listarMovimentacoesRecentes, listarProcessosAdm, listarUnidades, mensagemErroTramitacao, obterProcessoAdm, reabrirProcessoAdm, receberProcessoAdm,
  tramitarProcessoAdm,
} from '../../src/services/tramitacao'

// consulta encadeável que termina (await) com o resultado dado
const consulta = (resultado) => {
  const q = { select: vi.fn(() => q), order: vi.fn(() => q), limit: vi.fn(() => q), eq: vi.fn(() => q), maybeSingle: vi.fn(() => q),
    insert: vi.fn(() => Promise.resolve(resultado)), update: vi.fn(() => q), then: (ok, ko) => Promise.resolve(resultado).then(ok, ko) }
  return q
}

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ data: null, error: null })
  h.from.mockReset()
})

describe('funções do banco', () => {
  it('abrir processo manda os campos vazios como nulos e a prioridade normal por padrão', async () => {
    h.rpc.mockResolvedValue({ data: 'novo-id', error: null })
    const id = await abrirProcessoAdm({ tipo: 'Requerimento', assunto: 'Compra', interessado: '', descricao: undefined, prazo: '', unidade_destino: 'u1', despacho: '' })
    expect(id).toBe('novo-id')
    expect(h.rpc).toHaveBeenCalledWith('tr_abrir_processo', {
      p_tipo: 'Requerimento', p_assunto: 'Compra', p_interessado: null, p_descricao: null,
      p_prioridade: 'normal', p_prazo: null, p_unidade_destino: 'u1', p_despacho: null,
    })
  })

  it('tramitar, receber, alterar, concluir e reabrir usam o id do processo', async () => {
    await tramitarProcessoAdm('p1', { unidade_destino: 'u2', usuario_destino: '', despacho: 'Analisar', prazo: '2026-12-01' })
    expect(h.rpc).toHaveBeenLastCalledWith('tr_tramitar', { p_id: 'p1', p_unidade_destino: 'u2', p_usuario_destino: null, p_despacho: 'Analisar', p_prazo: '2026-12-01' })
    await receberProcessoAdm('p1')
    expect(h.rpc).toHaveBeenLastCalledWith('tr_receber', { p_id: 'p1' })
    await atualizarDadosProcessoAdm('p1', { assunto: 'Novo', interessado: '', descricao: 'x', prioridade: 'alta', prazo: '' })
    expect(h.rpc).toHaveBeenLastCalledWith('tr_atualizar_dados', { p_id: 'p1', p_assunto: 'Novo', p_interessado: null, p_descricao: 'x', p_prioridade: 'alta', p_prazo: null })
    await concluirProcessoAdm('p1', 'Resolvido')
    expect(h.rpc).toHaveBeenLastCalledWith('tr_concluir', { p_id: 'p1', p_motivo: 'Resolvido' })
    await reabrirProcessoAdm('p1', 'Faltou peça')
    expect(h.rpc).toHaveBeenLastCalledWith('tr_reabrir', { p_id: 'p1', p_motivo: 'Faltou peça' })
  })

  it('depois de cada operação, avisa as telas desta aba para atualizarem na hora', async () => {
    const aviso = vi.fn()
    window.addEventListener(EVENTO_MUDANCA, aviso)
    await receberProcessoAdm('p1')
    await concluirProcessoAdm('p1', 'ok')
    expect(aviso).toHaveBeenCalledTimes(2)
    h.rpc.mockResolvedValue({ data: null, error: new Error('falhou') })
    await expect(receberProcessoAdm('p1')).rejects.toThrow('falhou')
    expect(aviso).toHaveBeenCalledTimes(2) // erro: nada mudou, ninguém é avisado
    window.removeEventListener(EVENTO_MUDANCA, aviso)
  })

  it('o erro do banco chega à tela com a mensagem original', async () => {
    h.rpc.mockResolvedValue({ data: null, error: new Error('Somente a unidade onde o processo está pode enviá-lo.') })
    await expect(tramitarProcessoAdm('p1', { unidade_destino: 'u2', despacho: 'x' })).rejects.toThrow('Somente a unidade')
  })

  it('pessoas da unidade: devolve a lista, ou vazio', async () => {
    h.rpc.mockResolvedValue({ data: [{ id: 'a', nome: 'Ana' }], error: null })
    await expect(listarPessoasDaUnidade('u1')).resolves.toEqual([{ id: 'a', nome: 'Ana' }])
    expect(h.rpc).toHaveBeenLastCalledWith('tr_pessoas_da_unidade', { p_unidade: 'u1' })
    h.rpc.mockResolvedValue({ data: null, error: null })
    await expect(listarPessoasDaUnidade('u1')).resolves.toEqual([])
  })
})

describe('leituras e unidades', () => {
  it('lista os processos do mais novo para o mais antigo, com limite', async () => {
    const q = consulta({ data: [{ id: 1 }], error: null })
    h.from.mockReturnValue(q)
    await expect(listarProcessosAdm()).resolves.toEqual([{ id: 1 }])
    expect(h.from).toHaveBeenCalledWith('tr_processos')
    expect(q.order).toHaveBeenCalledWith('aberto_em', { ascending: false })
    expect(q.limit).toHaveBeenCalledWith(2000)
  })

  it('o processo vem junto com o histórico em ordem cronológica', async () => {
    const proc = consulta({ data: { id: 'p1' }, error: null })
    const hist = consulta({ data: [{ id: 1 }, { id: 2 }], error: null })
    h.from.mockImplementation((t) => (t === 'tr_processos' ? proc : hist))
    await expect(obterProcessoAdm('p1')).resolves.toEqual({ processo: { id: 'p1' }, tramitacoes: [{ id: 1 }, { id: 2 }] })
    expect(proc.eq).toHaveBeenCalledWith('id', 'p1')
    expect(hist.eq).toHaveBeenCalledWith('processo_id', 'p1')
    expect(hist.order).toHaveBeenCalledWith('criada_em', { ascending: true })
  })

  it('as movimentações recentes vêm da mais nova para a mais antiga, no limite pedido', async () => {
    const q = consulta({ data: [{ id: 9 }, { id: 8 }], error: null })
    h.from.mockReturnValue(q)
    await expect(listarMovimentacoesRecentes(5)).resolves.toEqual([{ id: 9 }, { id: 8 }])
    expect(h.from).toHaveBeenCalledWith('tr_tramitacoes')
    expect(q.order).toHaveBeenNthCalledWith(1, 'criada_em', { ascending: false })
    expect(q.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
    expect(q.limit).toHaveBeenCalledWith(5)
  })

  it('sem movimentações devolve lista vazia', async () => {
    h.from.mockReturnValue(consulta({ data: null, error: null }))
    await expect(listarMovimentacoesRecentes()).resolves.toEqual([])
  })

  it('falha de leitura é repassada', async () => {
    h.from.mockReturnValue(consulta({ data: null, error: { code: '42P01', message: 'relation does not exist' } }))
    await expect(listarUnidades()).rejects.toMatchObject({ code: '42P01' })
  })

  it('cria unidade com a sigla em maiúsculas e sem espaços sobrando', async () => {
    const q = consulta({ error: null })
    h.from.mockReturnValue(q)
    await criarUnidade({ sigla: ' ouv ', nome: ' Ouvidoria ' })
    expect(q.insert).toHaveBeenCalledWith([{ sigla: 'OUV', nome: 'Ouvidoria' }])
  })

  it('atualiza a unidade pelo id', async () => {
    const q = consulta({ error: null })
    h.from.mockReturnValue(q)
    await atualizarUnidade('u1', { ativa: false })
    expect(q.update).toHaveBeenCalledWith({ ativa: false })
    expect(q.eq).toHaveBeenCalledWith('id', 'u1')
  })
})

describe('mensagens de erro', () => {
  it.each([
    [{ code: '23505', message: 'duplicate key', details: 'Key (sigla)=(X) already exists.' }, 'Já existe uma unidade com esta sigla.'],
    [{ code: '42501', message: 'permission denied for table tr_unidades' }, 'Seu perfil não tem permissão para esta ação.'],
    [{ code: '42501', message: 'Somente a unidade onde o processo está pode enviá-lo.' }, 'Somente a unidade onde o processo está pode enviá-lo.'],
    [new Error('Informe o assunto do processo.'), 'Informe o assunto do processo.'],
    [{}, 'Não foi possível concluir a operação.'],
  ])('%j', (erro, esperado) => expect(mensagemErroTramitacao(erro)).toBe(esperado))
})

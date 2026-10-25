// Dados da gestão contratual: leitura inicial, atualização automática e descarte de
// leituras que chegam depois de a pessoa sair.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  auth: { user: { id: 'u1' }, acesso: 'liberado' },
  carregarTudo: vi.fn(),
  atualizar: null,
  opcoes: null,
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/services/gc', () => ({
  carregarTudo: (...a) => h.carregarTudo(...a),
  tabelaAusente: () => false,
  TABELAS: { contratos: 'gc_contratos', ordens: 'gc_ordens_servico' },
}))
vi.mock('../../src/components/useAtualizacao', () => ({
  useAtualizacaoAutomatica: (tabelas, ler, opcoes) => { h.atualizar = ler; h.opcoes = { tabelas, ...opcoes } },
}))

import { GcProvider, useGc } from '../../src/context/GcContext'

const vazio = (extra = {}) => ({
  raw: { contratos: [], responsaveis: [], ordens: [], competencias: [], empenhos: [], movs: [], execucoes: [], eventos: [], ocorrencias: [], documentos: [], pendencias: [], ...extra },
  params: {},
})
const contrato = (id, numero) => ({ id, numero, contratada: 'X', objeto: 'Y', situacao: 'ativo', valor_inicial: 1 })

function Mostra() {
  const { consolidados, loading } = useGc()
  return <div>{loading ? 'carregando' : consolidados.map((k) => k.c.numero).join(',') || 'nenhum'}</div>
}
const tela = () => render(<GcProvider><Mostra /></GcProvider>)

beforeEach(() => {
  h.auth = { user: { id: 'u1' }, acesso: 'liberado' }
  h.carregarTudo.mockReset().mockResolvedValue(vazio({ contratos: [contrato('c1', '001/2026')] }))
  h.atualizar = null
  h.opcoes = null
})

describe('GcProvider', () => {
  it('lê os dados ao entrar e liga a atualização automática em todas as tabelas', async () => {
    tela()
    expect(await screen.findByText('001/2026')).toBeInTheDocument()
    expect(h.opcoes).toMatchObject({ ativo: true, tabelas: ['gc_contratos', 'gc_ordens_servico', 'gc_parametros'] })
  })

  it('o aviso de mudança traz o dado novo sem recarregar a página (e sem piscar a tela)', async () => {
    tela()
    await screen.findByText('001/2026')
    h.carregarTudo.mockResolvedValue(vazio({ contratos: [contrato('c1', '001/2026'), contrato('c2', '002/2026')] }))
    await act(async () => { await h.atualizar() })
    expect(await screen.findByText('001/2026,002/2026')).toBeInTheDocument()
    expect(screen.queryByText('carregando')).not.toBeInTheDocument()
  })

  it('falha numa atualização não apaga o que já está na tela', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    tela()
    await screen.findByText('001/2026')
    h.carregarTudo.mockRejectedValue(new Error('rede caiu'))
    await act(async () => { await h.atualizar() })
    expect(screen.getByText('001/2026')).toBeInTheDocument()
    erro.mockRestore()
  })

  it('sem acesso liberado não lê nada e a atualização fica desligada', async () => {
    h.auth = { user: { id: 'u1' }, acesso: 'sem_perfil' }
    tela()
    await waitFor(() => expect(h.opcoes).toMatchObject({ ativo: false }))
    expect(h.carregarTudo).not.toHaveBeenCalled()
  })

  it('leitura que termina depois de a pessoa sair é descartada (dados de um usuário não aparecem para outro)', async () => {
    let terminar
    h.carregarTudo.mockImplementationOnce(() => new Promise((ok) => { terminar = () => ok(vazio({ contratos: [contrato('c9', 'SECRETO')] })) }))
    const { rerender } = tela()
    h.auth = { user: null, acesso: null }          // saiu antes de a leitura terminar
    rerender(<GcProvider><Mostra /></GcProvider>)
    await act(async () => { terminar() })
    expect(screen.queryByText('SECRETO')).not.toBeInTheDocument()
  })
})

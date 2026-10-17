import { beforeEach, describe, expect, it, vi } from 'vitest'
import { colunasInexistentes } from '../fixtures/schemaProcessos'

// Cliente Supabase falso (encadeável) para db.js e files.js
const h = vi.hoisted(() => {
  const state = { calls: [], responder: () => ({ data: [], error: null }), storage: {} }
  const builder = (tabela) => {
    const chain = { tabela, ops: [] }
    const api = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') {
          const res = state.responder(chain)
          return (ok, fail) => Promise.resolve(res).then(ok, fail)
        }
        return (...args) => { chain.ops.push([prop, ...args]); return api }
      },
    })
    state.calls.push(chain)
    return api
  }
  const storage = { from: (bucket) => ({ bucket, ...state.storage }) }
  return { state, supabase: { from: (t) => builder(t), storage } }
})
vi.mock('../../src/services/supabase', () => ({ supabase: h.supabase }))

import { listAll } from '../../src/services/db'
import { paraBanco, doBanco, numeroEmUso, COLUNAS } from '../../src/services/processos'
import { nomeSeguro, buildPath, uploadFile, abrirAnexo } from '../../src/services/files'

beforeEach(() => {
  h.state.calls.length = 0
  h.state.responder = () => ({ data: [], error: null })
  h.state.storage = {}
})

describe('db.listAll', () => {
  it('lê em páginas de 1000 até acabar (o Supabase corta em 1000 linhas por consulta)', async () => {
    const linhas = Array.from({ length: 2300 }, (_, i) => ({ id: i }))
    h.state.responder = (chain) => {
      const [, de, ate] = chain.ops.find((o) => o[0] === 'range')
      return { data: linhas.slice(de, ate + 1), error: null }
    }
    expect(await listAll('processos')).toHaveLength(2300)
    expect(h.state.calls).toHaveLength(3)
    expect(h.state.calls[0].ops).toContainEqual(['order', 'created_at', { ascending: false }])
  })

  it('propaga erro do banco', async () => {
    h.state.responder = () => ({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(listAll('processos')).rejects.toMatchObject({ code: '42501' })
  })
})

describe('processos: tela ↔ banco', () => {
  it('converte os nomes da tela para as colunas e descarta campos que não existem', () => {
    const p = paraBanco({
      numero: ' 2026/010 ', objeto: 'Cadeiras', etapa: '', prazo: '2026-10-20', faseInicialKey: 'cotacao',
      anexoUrl: '', anexoPath: 'anexos/x.pdf', valorCotado: '1.000,00', valorContratado: '', localDocumentacao: 'DFD',
      _faseDesconhecida: true, fluxo: [{ nome: 'Cotação', data: 'x' }], arquivado: false, statusGeral: 'x',
    })
    expect(colunasInexistentes(p)).toEqual([])
    expect(p).toEqual({
      numero: '2026/010', objeto: 'Cadeiras', etapa: null, prazo: '2026-10-20',
      anexo_url: null, anexo_path: 'anexos/x.pdf', valor_cotado: '1.000,00', valor_contratado: null,
      local_documentacao: 'DFD', fluxo: [{ nome: 'Cotação', data: 'x' }], arquivado: false,
    })
  })

  it('toda coluna gravável existe na tabela', () => {
    expect(colunasInexistentes(Object.fromEntries(COLUNAS.map((c) => [c, 1])))).toEqual([])
  })

  it('linha do banco ganha os nomes usados pelas telas', () => {
    const r = doBanco({ id: 'p1', anexo_path: 'a.pdf', local_documentacao: 'DFD', valor_cotado: '10', created_at: 'ontem' })
    expect(r).toMatchObject({ id: 'p1', anexoPath: 'a.pdf', localDocumentacao: 'DFD', valorCotado: '10', createdAt: 'ontem', anexoUrl: null })
  })

  it('número em uso por outro processo (ignora o próprio ao editar)', async () => {
    h.state.responder = () => ({ data: [{ id: 'p1', numero: '2026/001' }], error: null })
    expect(await numeroEmUso(' 2026/001 ')).toBe(true)
    expect(await numeroEmUso('2026/001', 'p1')).toBe(false)
    expect(h.state.calls[0].ops).toContainEqual(['eq', 'numero', '2026/001'])
  })
})

describe('anexos', () => {
  it.each([
    ['Edital Nº 01 — versão final.pdf', 'Edital_N_01_versao_final.pdf'],
    ['ação.PDF', 'acao.PDF'],
    ['   ', 'arquivo'],
    [null, 'arquivo'],
  ])('nome seguro para o Storage: %j → %j', (entrada, esperado) => {
    expect(nomeSeguro(entrada)).toBe(esperado)
  })

  it('caminho do anexo por processo (o número pode ter barra)', () => {
    expect(buildPath('anexos', '2026/010', 'Termo de Referência.pdf')).toBe('anexos/2026/010/Termo_de_Referencia.pdf')
  })

  it('upload devolve o caminho (o link é gerado só na hora de abrir)', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    h.state.storage = { upload }
    const r = await uploadFile('anexos', new File(['x'], 'a b.pdf', { type: 'application/pdf' }), '2026/1')
    expect(r.path).toBe('anexos/2026/1/a_b.pdf')
    expect(upload).toHaveBeenCalledWith('anexos/2026/1/a_b.pdf', expect.any(File), { upsert: true, contentType: 'application/pdf' })
  })

  it('abrir anexo usa link assinado temporário numa nova aba', async () => {
    const aba = { opener: 'x', location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(aba)
    h.state.storage = { createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://assinado' }, error: null }) }
    await abrirAnexo('anexos/a.pdf')
    expect(h.state.storage.createSignedUrl).toHaveBeenCalledWith('anexos/a.pdf', 300)
    expect(aba.location.href).toBe('https://assinado')
    expect(aba.opener).toBeNull()
    open.mockRestore()
  })

  it('se o link falhar, fecha a aba aberta e avisa', async () => {
    const aba = { location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(aba)
    h.state.storage = { createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: new Error('Object not found') }) }
    await expect(abrirAnexo('x.pdf')).rejects.toThrow('Object not found')
    expect(aba.close).toHaveBeenCalled()
    open.mockRestore()
  })
})

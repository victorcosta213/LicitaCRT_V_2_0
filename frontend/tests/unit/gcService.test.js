import { beforeEach, describe, expect, it, vi } from 'vitest'

// Cliente Supabase falso: registra a cadeia de chamadas e responde por tabela.
const h = vi.hoisted(() => {
  const state = { calls: [], responder: () => ({ data: [], error: null }) }
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
  return { state, supabase: { from: (t) => builder(t) } }
})
vi.mock('../../src/services/supabase', () => ({ supabase: h.supabase }))

import {
  TABELAS, tabelaAusente, mensagemErro, salvar, salvarVarios, cancelar, carregarTudo,
} from '../../src/services/gc'

const op = (chain, nome) => chain.ops.find((o) => o[0] === nome)

beforeEach(() => {
  h.state.calls.length = 0
  h.state.responder = () => ({ data: [], error: null })
})

describe('tabelaAusente', () => {
  it.each([
    [{ code: '42P01' }, true],
    [{ code: 'PGRST205' }, true],
    [{ message: 'relation "public.gc_contratos" does not exist' }, true],
    [{ message: "Could not find the table 'public.gc_x' in the schema cache" }, true],
    [{ code: '42501', message: 'permission denied' }, false],
    [null, false],
  ])('%j → %s', (err, esperado) => {
    expect(tabelaAusente(err)).toBe(esperado)
  })
})

describe('mensagemErro', () => {
  it.each([
    [{ code: '42501' }, 'Seu perfil não tem permissão para esta ação.'],
    [{ message: 'new row violates row-level security policy for table "gc_empenhos"' }, 'Seu perfil não tem permissão para esta ação.'],
    [{ code: '23505' }, 'Já existe um registro com estes dados (número/competência duplicado).'],
    [{ code: '23503' }, 'Registro relacionado não encontrado.'],
    [{ code: '23514' }, 'Algum valor informado é inválido.'],
    [{ code: 'P0001', message: 'A OS já está em tratamento pela gestão.' }, 'A OS já está em tratamento pela gestão.'],
    [{}, 'Erro ao salvar.'],
    [null, 'Erro desconhecido.'],
  ])('%j → %s', (err, msg) => {
    expect(mensagemErro(err)).toBe(msg)
  })
})

describe('salvar / cancelar', () => {
  it('sem id insere e devolve a linha', async () => {
    h.state.responder = () => ({ data: { id: 'novo' }, error: null })
    await expect(salvar('contratos', { numero: '1' })).resolves.toEqual({ id: 'novo' })
    const [c] = h.state.calls
    expect(c.tabela).toBe('gc_contratos')
    expect(op(c, 'insert')).toEqual(['insert', [{ numero: '1' }]])
    expect(op(c, 'single')).toBeTruthy()
  })

  it('com id atualiza somente aquele registro', async () => {
    h.state.responder = () => ({ data: { id: 'x' }, error: null })
    await salvar('competencias', { atestado: true }, 'x')
    const [c] = h.state.calls
    expect(c.tabela).toBe('gc_competencias')
    expect(op(c, 'update')).toEqual(['update', { atestado: true }])
    expect(op(c, 'eq')).toEqual(['eq', 'id', 'x'])
  })

  it('erro do banco vira mensagem amigável', async () => {
    h.state.responder = () => ({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(salvar('empenhos', {})).rejects.toThrow('Seu perfil não tem permissão para esta ação.')
  })

  it('cancelar nunca exclui: marca cancelado', async () => {
    h.state.responder = () => ({ data: { id: 'e' }, error: null })
    await cancelar('eventos', 'e')
    const [c] = h.state.calls
    expect(op(c, 'update')).toEqual(['update', { cancelado: true }])
    expect(op(c, 'delete')).toBeUndefined()
  })

  it('salvarVarios com lista vazia não chama o banco', async () => {
    await expect(salvarVarios('competencias', [])).resolves.toEqual([])
    expect(h.state.calls).toHaveLength(0)
  })
})

describe('carregarTudo', () => {
  it('pagina de 1000 em 1000 e converte parâmetros em objeto', async () => {
    const linhas = Array.from({ length: 1500 }, (_, i) => ({ id: i }))
    h.state.responder = (chain) => {
      if (chain.tabela === 'gc_parametros') return { data: [{ chave: 'atesto_por', valor: 'gestor' }], error: null }
      const range = op(chain, 'range')
      if (chain.tabela !== 'gc_competencias') return { data: [], error: null }
      return { data: linhas.slice(range[1], range[2] + 1), error: null }
    }
    const { raw, params } = await carregarTudo()
    expect(raw.competencias).toHaveLength(1500)
    expect(Object.keys(raw).sort()).toEqual(Object.keys(TABELAS).sort())
    const ranges = h.state.calls.filter((c) => c.tabela === 'gc_competencias').map((c) => op(c, 'range').slice(1))
    expect(ranges).toEqual([[0, 999], [1000, 1999]])
    expect(params).toEqual({ atesto_por: 'gestor' })
  })

  it('propaga erro de tabela ausente (migration não aplicada)', async () => {
    h.state.responder = () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    await expect(carregarTudo()).rejects.toMatchObject({ code: '42P01' })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O setup global desliga a assinatura; aqui queremos a implementação de verdade.
const h = vi.hoisted(() => ({ canal: null, supabase: null }))
vi.mock('../../src/services/supabase', () => {
  h.supabase = {
    channel: vi.fn((nome) => {
      h.canal = { nome, tabelas: [], callbacks: [], on: vi.fn(), subscribe: vi.fn() }
      h.canal.on.mockImplementation((_tipo, filtro, cb) => { h.canal.tabelas.push(filtro.table); h.canal.callbacks.push(cb); return h.canal })
      return h.canal
    }),
    removeChannel: vi.fn(),
  }
  return { supabase: h.supabase }
})
vi.mock('../../src/services/tempoReal', async () => vi.importActual('../../src/services/tempoReal'))

import { assinarMudancas, criarAtualizador } from '../../src/services/tempoReal'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('criarAtualizador', () => {
  it('junta uma rajada de avisos numa única leitura', async () => {
    const ler = vi.fn().mockResolvedValue()
    const a = criarAtualizador(ler, { espera: 400 })
    for (let i = 0; i < 10; i++) a.agendar()
    expect(ler).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(400)
    expect(ler).toHaveBeenCalledTimes(1)
  })

  it('aviso durante a leitura gera mais uma leitura depois (sem duas ao mesmo tempo)', async () => {
    let liberar
    let emAndamento = 0
    let maximo = 0
    const ler = vi.fn(() => new Promise((ok) => {
      emAndamento += 1
      maximo = Math.max(maximo, emAndamento)
      liberar = () => { emAndamento -= 1; ok() }
    }))
    const a = criarAtualizador(ler, { espera: 100 })
    a.agendar()
    await vi.advanceTimersByTimeAsync(100)
    expect(ler).toHaveBeenCalledTimes(1)
    a.agendar() // chega um aviso no meio da leitura
    await vi.advanceTimersByTimeAsync(100)
    expect(ler).toHaveBeenCalledTimes(1)
    liberar()
    await vi.advanceTimersByTimeAsync(200)
    expect(ler).toHaveBeenCalledTimes(2)
    liberar()
    expect(maximo).toBe(1)
  })

  it('uma leitura que falha não derruba as seguintes', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ler = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValue()
    const a = criarAtualizador(ler, { espera: 50 })
    a.agendar()
    await vi.advanceTimersByTimeAsync(50)
    a.agendar()
    await vi.advanceTimersByTimeAsync(50)
    expect(ler).toHaveBeenCalledTimes(2)
    expect(erro).toHaveBeenCalled()
  })

  it('depois de encerrado não lê mais', async () => {
    const ler = vi.fn().mockResolvedValue()
    const a = criarAtualizador(ler, { espera: 50 })
    a.agendar()
    a.encerrar()
    a.agendar()
    await vi.advanceTimersByTimeAsync(500)
    expect(ler).not.toHaveBeenCalled()
  })

  it('agora() lê sem esperar', async () => {
    const ler = vi.fn().mockResolvedValue()
    await criarAtualizador(ler, { espera: 5000 }).agora()
    expect(ler).toHaveBeenCalledTimes(1)
  })
})

describe('assinarMudancas', () => {
  it('assina cada tabela e chama o aviso a cada mudança', () => {
    const aviso = vi.fn()
    assinarMudancas(['gc_contratos', 'processos'], aviso)
    expect(h.canal.tabelas).toEqual(['gc_contratos', 'processos'])
    expect(h.canal.subscribe).toHaveBeenCalledTimes(1)
    h.canal.callbacks[0]({ eventType: 'UPDATE' })
    expect(aviso).toHaveBeenCalledTimes(1)
  })

  it('cancelar remove o canal', () => {
    const cancelar = assinarMudancas(['processos'], () => {})
    cancelar()
    expect(h.supabase.removeChannel).toHaveBeenCalledWith(h.canal)
  })

  it('com erro na assinatura, não quebra', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.supabase.channel.mockImplementationOnce(() => { throw new Error('sem websocket') })
    const cancelar = assinarMudancas(['processos'], () => {})
    expect(() => cancelar()).not.toThrow()
    expect(erro).toHaveBeenCalled()
  })
})

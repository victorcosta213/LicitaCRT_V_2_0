import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { act } from 'react'

const h = vi.hoisted(() => ({ aviso: null, cancelar: vi.fn(), tabelas: null }))
vi.mock('../../src/services/tempoReal', async (importOriginal) => ({
  ...(await importOriginal()),
  assinarMudancas: (tabelas, cb) => { h.tabelas = tabelas; h.aviso = cb; return h.cancelar },
}))

import { useAtualizacaoAutomatica } from '../../src/components/useAtualizacao'

function Tela({ ler, ativo = true, intervalo = 60000 }) {
  useAtualizacaoAutomatica(['processos', 'usuarios'], ler, { ativo, intervaloReserva: intervalo })
  return null
}

beforeEach(() => { vi.useFakeTimers(); h.cancelar.mockClear() })
afterEach(() => { vi.useRealTimers() })

describe('useAtualizacaoAutomatica', () => {
  it('relê quando o banco avisa de uma mudança', async () => {
    const ler = vi.fn().mockResolvedValue()
    render(<Tela ler={ler} />)
    expect(h.tabelas).toEqual(['processos', 'usuarios'])
    await act(async () => { h.aviso(); await vi.advanceTimersByTimeAsync(500) })
    expect(ler).toHaveBeenCalledTimes(1)
  })

  it('usa sempre a versão mais nova da função de leitura', async () => {
    const velha = vi.fn().mockResolvedValue()
    const nova = vi.fn().mockResolvedValue()
    const { rerender } = render(<Tela ler={velha} />)
    rerender(<Tela ler={nova} />)
    await act(async () => { h.aviso(); await vi.advanceTimersByTimeAsync(500) })
    expect(velha).not.toHaveBeenCalled()
    expect(nova).toHaveBeenCalledTimes(1)
  })

  it('reserva: relê sozinho de tempos em tempos, mesmo sem aviso do banco', async () => {
    const ler = vi.fn().mockResolvedValue()
    render(<Tela ler={ler} intervalo={1000} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
    expect(ler).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(ler).toHaveBeenCalledTimes(2)
  })

  it('relê ao voltar para a aba', async () => {
    const ler = vi.fn().mockResolvedValue()
    render(<Tela ler={ler} />)
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(500) })
    expect(ler).toHaveBeenCalledTimes(1)
  })

  it('desligado (ninguém logado) não assina nem relê', async () => {
    const ler = vi.fn().mockResolvedValue()
    h.aviso = null
    render(<Tela ler={ler} ativo={false} intervalo={1000} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(h.aviso).toBeNull()
    expect(ler).not.toHaveBeenCalled()
  })

  it('ao sair da tela cancela a assinatura e para de reler', async () => {
    const ler = vi.fn().mockResolvedValue()
    const { unmount } = render(<Tela ler={ler} intervalo={1000} />)
    unmount()
    expect(h.cancelar).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(ler).not.toHaveBeenCalled()
  })
})

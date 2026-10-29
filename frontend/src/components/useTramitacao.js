import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAtualizacaoAutomatica } from './useAtualizacao'
import { EVENTO_MUDANCA, TABELAS_TRAMITACAO, listarProcessosAdm, listarUnidades } from '../services/tramitacao'
import { tabelaAusente } from '../services/gc'

// Processos e unidades para as telas de tramitação. Recarrega sozinho quando alguém movimenta
// um processo (Realtime, com leitura periódica de reserva), sem piscar a tela.
export function useTramitacao() {
  const [estado, setEstado] = useState({ carregando: true, erro: null, ausente: false, processos: [], unidades: [] })
  const vivo = useRef(true)

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setEstado((s) => ({ ...s, carregando: true, erro: null }))
      const [processos, unidades] = await Promise.all([listarProcessosAdm(), listarUnidades()])
      if (vivo.current) setEstado({ carregando: false, erro: null, ausente: false, processos, unidades })
    } catch (err) {
      console.error('[tramitação]', err)
      if (!vivo.current || silencioso) return
      setEstado((s) => ({ ...s, carregando: false, ausente: tabelaAusente(err), erro: err?.message || 'Não foi possível carregar os processos.' }))
    }
  }, [])

  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(TABELAS_TRAMITACAO, () => carregar({ silencioso: true }))
  // mudança feita nesta aba: atualiza na hora
  useEffect(() => {
    const aoMudar = () => carregar({ silencioso: true })
    window.addEventListener(EVENTO_MUDANCA, aoMudar)
    return () => window.removeEventListener(EVENTO_MUDANCA, aoMudar)
  }, [carregar])

  const unidadesPorId = useMemo(() => new Map(estado.unidades.map((u) => [u.id, u])), [estado.unidades])
  return { ...estado, unidadesPorId, recarregar: carregar }
}

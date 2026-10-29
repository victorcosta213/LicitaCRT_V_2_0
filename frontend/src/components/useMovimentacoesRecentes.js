import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtualizacaoAutomatica } from './useAtualizacao'
import { EVENTO_MUDANCA, listarMovimentacoesRecentes } from '../services/tramitacao'

// Últimas movimentações dos processos ("quem mexeu"), sempre atualizadas sem piscar a tela
export function useMovimentacoesRecentes(limite = 12) {
  const [estado, setEstado] = useState({ carregando: true, movimentos: [] })
  const vivo = useRef(true)

  const carregar = useCallback(async () => {
    try {
      const movimentos = await listarMovimentacoesRecentes(limite)
      if (vivo.current) setEstado({ carregando: false, movimentos })
    } catch (err) {
      console.error('[movimentações]', err)
      if (vivo.current) setEstado((s) => ({ ...s, carregando: false }))
    }
  }, [limite])

  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(['tr_tramitacoes'], carregar)
  useEffect(() => {
    window.addEventListener(EVENTO_MUDANCA, carregar)
    return () => window.removeEventListener(EVENTO_MUDANCA, carregar)
  }, [carregar])

  return estado
}

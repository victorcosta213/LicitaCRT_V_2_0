import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtualizacaoAutomatica } from '../useAtualizacao'
import { EVENTO_ITENS, TABELAS_ITENS, listarItens } from '../../services/itens'
import { tabelaAusente } from '../../services/gc'

// Itens do catálogo, sempre atualizados. Sem a migration, a lista fica vazia e `ausente` avisa.
export function useCatalogoItens() {
  const [estado, setEstado] = useState({ carregando: true, erro: null, ausente: false, itens: [] })
  const vivo = useRef(true)

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setEstado((s) => ({ ...s, carregando: true, erro: null }))
      const itens = await listarItens()
      if (vivo.current) setEstado({ carregando: false, erro: null, ausente: false, itens })
    } catch (err) {
      if (!vivo.current || silencioso) return
      setEstado((s) => ({ ...s, carregando: false, ausente: tabelaAusente(err), erro: err?.message || 'Não foi possível carregar o catálogo.' }))
    }
  }, [])

  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(TABELAS_ITENS, () => carregar({ silencioso: true }))
  useEffect(() => {
    const aoMudar = () => carregar({ silencioso: true })
    window.addEventListener(EVENTO_ITENS, aoMudar)
    return () => window.removeEventListener(EVENTO_ITENS, aoMudar)
  }, [carregar])

  return { ...estado, recarregar: carregar }
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAtualizacaoAutomatica } from './useAtualizacao'
import { EVENTO_SOLICITACAO, TABELAS_SOLICITACOES, listarSolicitacoes } from '../services/solicitacoes'
import { tabelaAusente } from '../services/gc'
import { tarefasDeSolicitacoes } from '../utils/solicitacoes'

// Solicitações visíveis para a pessoa, sempre atualizadas (Realtime, com leitura periódica de reserva)
export function useSolicitacoes() {
  const [estado, setEstado] = useState({ carregando: true, erro: null, ausente: false, solicitacoes: [] })
  const vivo = useRef(true)

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setEstado((s) => ({ ...s, carregando: true, erro: null }))
      const solicitacoes = await listarSolicitacoes()
      if (vivo.current) setEstado({ carregando: false, erro: null, ausente: false, solicitacoes })
    } catch (err) {
      console.error('[solicitacoes]', err)
      if (!vivo.current || silencioso) return
      setEstado((s) => ({ ...s, carregando: false, ausente: tabelaAusente(err), erro: err?.message || 'Não foi possível carregar as solicitações.' }))
    }
  }, [])

  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(TABELAS_SOLICITACOES, () => carregar({ silencioso: true }))
  useEffect(() => {
    const aoMudar = () => carregar({ silencioso: true })
    window.addEventListener(EVENTO_SOLICITACAO, aoMudar)
    return () => window.removeEventListener(EVENTO_SOLICITACAO, aoMudar)
  }, [carregar])

  return { ...estado, recarregar: carregar }
}

// Uma leitura compartilhada por até 1 minuto (menu e mesa pedem ao mesmo tempo), válida só para quem a pediu
let cache = null
function ler(usuarioId, forcar = false) {
  if (forcar || !cache || cache.usuarioId !== usuarioId || Date.now() - cache.em > 60000) {
    const promessa = listarSolicitacoes()
    cache = { usuarioId, em: Date.now(), promessa }
    promessa.catch(() => { if (cache?.promessa === promessa) cache = null })
  }
  return cache.promessa
}

// Tarefas da mesa ligadas às solicitações. Sem a migration, a lista fica vazia (sem erro na tela).
export function useTarefasSolicitacoes({ ativo, ehCompras, usuarioId, unidadeId }) {
  const [lista, setLista] = useState([])
  const vivo = useRef(true)
  const conta = useRef(usuarioId)
  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false }
  }, [])
  useEffect(() => { conta.current = usuarioId }, [usuarioId])

  const atualizar = useCallback((forcar) => ler(usuarioId, forcar)
    .then((rows) => { if (vivo.current && conta.current === usuarioId) setLista(rows) })
    .catch(() => { /* sem a migration, a mesa segue sem esta lista */ }), [usuarioId])

  useEffect(() => {
    setLista([])
    if (ativo && usuarioId) atualizar(false)
  }, [ativo, usuarioId, atualizar])
  useAtualizacaoAutomatica(TABELAS_SOLICITACOES, () => atualizar(true), { ativo: !!ativo && !!usuarioId })
  useEffect(() => {
    if (!ativo || !usuarioId) return undefined
    const aoMudar = () => atualizar(true)
    window.addEventListener(EVENTO_SOLICITACAO, aoMudar)
    return () => window.removeEventListener(EVENTO_SOLICITACAO, aoMudar)
  }, [ativo, usuarioId, atualizar])

  return useMemo(
    () => (ativo && usuarioId ? tarefasDeSolicitacoes(lista, { ehCompras, usuarioId, unidadeId }) : []),
    [ativo, usuarioId, unidadeId, ehCompras, lista],
  )
}

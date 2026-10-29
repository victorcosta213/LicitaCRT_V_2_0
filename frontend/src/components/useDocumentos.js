import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAtualizacaoAutomatica } from './useAtualizacao'
import {
  EVENTO_DOCUMENTO, TABELAS_DOCUMENTOS, listarAssinaturas, listarDocumentos, listarMinhasAssinaturasPendentes,
} from '../services/documentos'
import { tabelaAusente } from '../services/gc'

// Documentos e assinaturas visíveis para a pessoa, sempre atualizados (Realtime, com leitura periódica de reserva)
export function useDocumentos() {
  const [estado, setEstado] = useState({ carregando: true, erro: null, ausente: false, documentos: [], assinaturas: [] })
  const vivo = useRef(true)

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setEstado((s) => ({ ...s, carregando: true, erro: null }))
      const [documentos, assinaturas] = await Promise.all([listarDocumentos(), listarAssinaturas()])
      if (vivo.current) setEstado({ carregando: false, erro: null, ausente: false, documentos, assinaturas })
    } catch (err) {
      console.error('[documentos]', err)
      if (!vivo.current || silencioso) return
      setEstado((s) => ({ ...s, carregando: false, ausente: tabelaAusente(err), erro: err?.message || 'Não foi possível carregar os documentos.' }))
    }
  }, [])

  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(TABELAS_DOCUMENTOS, () => carregar({ silencioso: true }))
  useEffect(() => {
    const aoMudar = () => carregar({ silencioso: true })
    window.addEventListener(EVENTO_DOCUMENTO, aoMudar)
    return () => window.removeEventListener(EVENTO_DOCUMENTO, aoMudar)
  }, [carregar])

  return { ...estado, recarregar: carregar }
}

// Uma leitura compartilhada por até 1 minuto (menu, mesa e painel pedem ao mesmo tempo), válida só para quem a pediu:
// ao trocar de conta no mesmo navegador a leitura é refeita
let cache = null
function ler(usuarioId, forcar = false) {
  if (forcar || !cache || cache.usuarioId !== usuarioId || Date.now() - cache.em > 60000) {
    const promessa = listarMinhasAssinaturasPendentes(usuarioId)
    cache = { usuarioId, em: Date.now(), promessa }
    promessa.catch(() => { if (cache?.promessa === promessa) cache = null })
  }
  return cache.promessa
}

// Documentos que esperam a assinatura da pessoa. Sem a migration, a lista fica vazia (sem erro na tela).
export function useAssinaturasPendentes({ ativo, usuarioId }) {
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
  useAtualizacaoAutomatica(TABELAS_DOCUMENTOS, () => atualizar(true), { ativo: !!ativo && !!usuarioId })
  useEffect(() => {
    if (!ativo || !usuarioId) return undefined
    const aoMudar = () => atualizar(true)
    window.addEventListener(EVENTO_DOCUMENTO, aoMudar)
    return () => window.removeEventListener(EVENTO_DOCUMENTO, aoMudar)
  }, [ativo, usuarioId, atualizar])

  return useMemo(() => (ativo && usuarioId ? lista : []), [ativo, usuarioId, lista])
}

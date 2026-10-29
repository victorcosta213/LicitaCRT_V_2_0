import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAtualizacaoAutomatica } from './useAtualizacao'
import { EVENTO_MUDANCA, TABELAS_TRAMITACAO, listarProcessosAdm } from '../services/tramitacao'
import { DIAS_PARADO_PADRAO, estadoDoProcesso, tarefaDeProcesso } from '../utils/tramitacao'

// Uma leitura compartilhada por até 1 minuto (menu e mesa pedem ao mesmo tempo);
// `forcar` ignora o cache (atualização automática). Cada pessoa vê processos diferentes (RLS), então
// o cache vale só para quem o criou: ao trocar de conta no mesmo navegador, a leitura é refeita.
let cache = null
function carregar(usuarioId, forcar = false) {
  if (forcar || !cache || cache.usuarioId !== usuarioId || Date.now() - cache.em > 60000) {
    const promessa = listarProcessosAdm()
    cache = { usuarioId, em: Date.now(), promessa }
    promessa.catch(() => { if (cache?.promessa === promessa) cache = null })
  }
  return cache.promessa
}

// Tarefas da Minha mesa vindas da tramitação: processos que chegaram à minha unidade e ainda não
// foram recebidos, e os que estão parados ou atrasados com a minha unidade ou comigo.
// `ativo` = o perfil abre e movimenta processos. Sem a migration, a lista fica vazia (sem erro na tela).
export function useTarefasTramitacao({ ativo, unidadeId, usuarioId, diasParado = DIAS_PARADO_PADRAO }) {
  const [lista, setLista] = useState([])
  const vivo = useRef(true)
  const contaAtual = useRef(usuarioId)
  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false }
  }, [])
  useEffect(() => { contaAtual.current = usuarioId }, [usuarioId])

  const ler = useCallback((forcar) => carregar(usuarioId, forcar)
    // uma resposta atrasada de outra conta não vale
    .then((rows) => { if (vivo.current && contaAtual.current === usuarioId) setLista(rows) })
    .catch(() => { /* sem a tramitação, a mesa segue com o resto */ }), [usuarioId])

  useEffect(() => {
    setLista([]) // outra conta: nada da lista da anterior
    if (ativo) ler(false)
  }, [ativo, ler])
  useAtualizacaoAutomatica(TABELAS_TRAMITACAO.slice(0, 2), () => ler(true), { ativo })
  // mudança feita nesta aba (receber, enviar, abrir…): o contador do menu muda na hora
  useEffect(() => {
    if (!ativo) return undefined
    const aoMudar = () => ler(true)
    window.addEventListener(EVENTO_MUDANCA, aoMudar)
    return () => window.removeEventListener(EVENTO_MUDANCA, aoMudar)
  }, [ativo, ler])

  return useMemo(() => {
    if (!ativo || (!unidadeId && !usuarioId)) return []
    return lista
      .filter((p) => p.situacao === 'em_andamento' && ((unidadeId && p.unidade_atual === unidadeId) || (usuarioId && p.responsavel_atual === usuarioId)))
      .map((p) => ({ p, e: estadoDoProcesso(p, { diasParado }) }))
      .filter(({ p, e }) => !p.recebido_em || e.parado || e.atrasado)
      .map(({ p, e }) => tarefaDeProcesso(p, e))
  }, [ativo, lista, unidadeId, usuarioId, diasParado])
}

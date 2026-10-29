import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtualizacaoAutomatica } from '../useAtualizacao'
import { EVENTO_SOLICITACAO, TABELAS_SOLICITACOES, listarMarcas } from '../../services/solicitacoes'

// Marcações do roteiro (documentos juntados ou dispensados) de um processo, ou de todos os visíveis.
// Sem a migration, a lista fica vazia e o roteiro mostra só o que foi feito na plataforma.
export function useMarcas(processoId) {
  const [marcas, setMarcas] = useState([])
  const vivo = useRef(true)

  const carregar = useCallback(() => listarMarcas(processoId)
    .then((rows) => { if (vivo.current) setMarcas(rows) })
    .catch(() => { if (vivo.current) setMarcas([]) }), [processoId])

  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(TABELAS_SOLICITACOES, carregar)
  useEffect(() => {
    window.addEventListener(EVENTO_SOLICITACAO, carregar)
    return () => window.removeEventListener(EVENTO_SOLICITACAO, carregar)
  }, [carregar])

  return { marcas, recarregar: carregar }
}

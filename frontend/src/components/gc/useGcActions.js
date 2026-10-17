import { useCallback } from 'react'
import { useGc } from '../../context/GcContext'
import { useAuth } from '../../context/AuthContext'
import { cancelar as cancelarRow, executar as executarRpc, salvar as salvarRow } from '../../services/gc'
import { pedirTexto, showError, showSuccess } from '../../utils/alerts'
import { can } from '../../utils/permissions'

// Ações de gravação: sempre recarregam os dados e nunca excluem registros.
export function useGcActions() {
  const { reload, params } = useGc()
  const { role, nome, user } = useAuth()

  const salvar = useCallback(async (chave, valores, id) => {
    const r = await salvarRow(chave, valores, id)
    await reload()
    return r
  }, [reload])

  // Ação do fluxo no banco (encaminhar, publicar portaria, assinar OS/OC...)
  const executar = useCallback(async (funcao, args) => {
    await executarRpc(funcao, args)
    await reload()
  }, [reload])

  // Cancelar pede justificativa; o registro permanece no histórico.
  const cancelar = useCallback(async (chave, id, extra = {}, texto = 'O registro permanece no histórico, mas deixa de ser considerado nos cálculos.') => {
    const motivo = await pedirTexto('Cancelar registro', texto, 'Justificativa do cancelamento')
    if (!motivo) return false
    try {
      await cancelarRow(chave, id, motivo, extra)
      await reload()
      showSuccess('Registro cancelado')
      return true
    } catch (err) {
      showError(err.message)
      return false
    }
  }, [reload])

  return { salvar, executar, cancelar, can: (acao) => can(role, acao), role, nome, user, params }
}

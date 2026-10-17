/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { carregarTudo, tabelaAusente } from '../services/gc'
import { consolidar, gerarAlertas, indexar } from '../utils/contrato'

const Ctx = createContext(null)

const PARAMS_PADRAO = {
  alerta_vigencia_dias: [120, 90, 60, 30],
  alerta_garantia_dias: [60, 30],
  alerta_reajuste_dias: [60, 30],
  prazo_competencia_dias: 10,
  prazo_ocorrencia_aviso_dias: 5,
  orgao_nome: '',
  orgao_cidade: '',
  presidente_nome: '',
  diretor_financeiro_nome: '',
  email_gestao_contratos: '',
  atribuicoes_fiscal: '',
  tipos_contrato: ['Serviço continuado', 'Fornecimento', 'Obra / engenharia', 'TIC / software', 'Locação', 'Outros'],
  modalidades: ['Pregão eletrônico', 'Concorrência', 'Dispensa', 'Inexigibilidade', 'Adesão a ata', 'Outra'],
  indices_reajuste: ['IPCA', 'IGP-M', 'INPC', 'ICTI', 'Convenção coletiva', 'Outro'],
}

export function GcProvider({ children }) {
  const { user, acesso } = useAuth()
  const liberado = !!user && acesso === 'liberado'
  const [state, setState] = useState({ loading: true, error: null, schemaMissing: false, raw: null, params: PARAMS_PADRAO })

  const reload = useCallback(async () => {
    try {
      const { raw, params } = await carregarTudo()
      setState({ loading: false, error: null, schemaMissing: false, raw, params: { ...PARAMS_PADRAO, ...params } })
    } catch (err) {
      console.error('[GC] erro ao carregar dados', err)
      setState((s) => ({
        ...s, loading: false, raw: s.raw,
        schemaMissing: tabelaAusente(err),
        error: tabelaAusente(err) ? null : err.message,
      }))
    }
  }, [])

  useEffect(() => {
    if (!liberado) {
      // sem sessão ou sem acesso: descarta os dados em memória
      setState({ loading: true, error: null, schemaMissing: false, raw: null, params: PARAMS_PADRAO })
      return undefined
    }
    reload()
    // atualiza ao voltar para a aba (vários perfis trabalham sobre os mesmos dados)
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [liberado, user?.id, reload])

  const value = useMemo(() => {
    const { raw, params } = state
    const vazio = { contratos: [], consolidados: [], porId: new Map(), alertas: [] }
    if (!raw) return { ...state, ...vazio, reload }

    const idx = indexar(raw)
    const consolidados = raw.contratos
      .filter((c) => !c.cancelado)
      .map((c) => consolidar(c, idx.get(c.id), params))
      .sort((a, b) => String(a.c.numero).localeCompare(String(b.c.numero), 'pt-BR', { numeric: true }))
    const porId = new Map(consolidados.map((k) => [k.id, k]))
    const alertas = gerarAlertas(consolidados, params)
    return { ...state, contratos: raw.contratos, consolidados, porId, alertas, reload }
  }, [state, reload])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useGc = () => useContext(Ctx)

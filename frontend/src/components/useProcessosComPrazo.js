import { useEffect, useMemo, useState } from 'react'
import { listarProcessos } from '../services/processos'
import { computeStatus } from '../utils/status'
import { fmtDate } from '../utils/format'

// Uma leitura compartilhada por até 1 minuto (menu e mesa pedem ao mesmo tempo)
let cache = null
function carregar() {
  if (!cache || Date.now() - cache.em > 60000) {
    const promessa = listarProcessos()
    cache = { em: Date.now(), promessa }
    promessa.catch(() => { cache = null })
  }
  return cache.promessa
}

const fechado = (etapa) => ['concluido', 'concluído', 'suspenso', 'revogado', 'fechado', 'finalizado']
  .includes(String(etapa || '').toLowerCase())

// Processos licitatórios com prazo vencido ou vencendo em até 7 dias, no formato de tarefa.
// `ativo` = o perfil opera o módulo licitatório.
export function useProcessosComPrazo(ativo) {
  const [lista, setLista] = useState([])
  useEffect(() => {
    if (!ativo) return undefined
    let vivo = true
    carregar()
      .then((rows) => { if (vivo) setLista(rows) })
      .catch(() => { /* sem os processos, a mesa segue com as contratações */ })
    return () => { vivo = false }
  }, [ativo])

  return useMemo(() => (ativo ? lista : [])
    .filter((p) => !p.arquivado && !fechado(p.etapa) && p.prazo)
    .map((p) => ({ p, st: computeStatus(p.prazo) }))
    .filter(({ st }) => st.days !== null && st.days <= 7)
    .map(({ p, st }) => ({
      id: `proc:${p.id}`, categoria: 'Processo', severidade: st.days < 0 ? 'danger' : 'warning', dias: st.days,
      titulo: st.days < 0 ? 'Processo com prazo vencido' : st.days === 0 ? 'Prazo do processo vence hoje' : `Prazo do processo em ${st.days} dia(s)`,
      ref: p.numero, sub: `${p.objeto || 'Sem objeto'} — ${p.etapa || 'sem etapa'} · prazo ${fmtDate(p.prazo)}`,
      to: `/controle?pid=${p.id}`,
    })), [lista, ativo])
}

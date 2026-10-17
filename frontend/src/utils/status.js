import { toLocalDate } from './dates'

// Situação do prazo de um processo, em dias de calendário (fuso local):
// vencido ontem = atrasado; vence em até 3 dias = quase vencendo.
export function computeStatus(prazo, ref = new Date()) {
  const d = toLocalDate(prazo)
  if (!d) return { label: '—', kind: 'neutral', days: null, pct: 0 }

  const hoje = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const days = Math.round((d - hoje) / 86400000)

  if (days < 0) return { label: 'Atrasado', kind: 'danger', days, pct: 100 }
  if (days <= 3) return { label: 'Quase vencendo', kind: 'warning', days, pct: 80 }
  return { label: 'Em dia', kind: 'success', days, pct: 30 }
}

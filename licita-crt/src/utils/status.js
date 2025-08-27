// src/utils/status.js
export function computeStatus(prazo) {
  if (!prazo) return { label: '—', kind: 'neutral', days: null, pct: 0 }

  const d = prazo instanceof Date ? prazo : prazo?.toDate?.() ?? new Date(prazo)
  if (!(d instanceof Date) || isNaN(d)) return { label: '—', kind: 'neutral', days: null, pct: 0 }

  const today = new Date()
  const ms = d.setHours(23,59,59,999) - today
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))

  if (days < 0) return { label: 'Atrasado', kind: 'danger', days, pct: 100 }
  if (days <= 3) return { label: 'Quase vencendo', kind: 'warning', days, pct: 80 }
  return { label: 'Em dia', kind: 'success', days, pct: 30 }
}

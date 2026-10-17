import { parseISO, toISO } from './format'

// Valor para <input type="date">. Aceita Date, objeto com toDate()
// e o texto devolvido pelo Supabase: "2026-10-20" (date) ou ISO completo (timestamptz).
export const toInputDate = (d) => {
  if (!d) return ''
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    const dt = new Date(d)
    return Number.isNaN(dt.getTime()) ? '' : toISO(dt)
  }
  const dt = d instanceof Date ? d : d?.toDate?.() ?? null
  if (!dt || Number.isNaN(dt.getTime())) return ''
  return toISO(dt)
}

export const fromInputDate = (v) => (v ? new Date(v + 'T00:00:00') : null)

// Data local (meia-noite) a partir de qualquer formato aceito por toInputDate
export const toLocalDate = (d) => parseISO(toInputDate(d))

export const toInputDate = (d) => {
  if (!d) return ''
  const dt = d instanceof Date ? d : d?.toDate?.() ?? null
  if (!dt) return ''
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export const fromInputDate = (v) => (v ? new Date(v + 'T00:00:00') : null)

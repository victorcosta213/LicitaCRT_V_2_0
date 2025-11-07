export function groupCount(arr, key) {
  const map = {}
  for (const item of arr) {
    const k = item[key] ?? '—'
    map[k] = (map[k] || 0) + 1
  }
  return Object.entries(map).map(([label, value]) => ({ label, value }))
}

export function statusByPrazo(arr) {
  const today = new Date()
  const r = { emDia: 0, quaseVencendo: 0, atrasado: 0 }

  for (const it of arr) {
    const prazo = it.prazo instanceof Date ? it.prazo : it.prazo?.toDate?.() ?? null
    if (!prazo) continue
    const diff = prazo - today // ms
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) r.atrasado++
    else if (days <= 3) r.quaseVencendo++
    else r.emDia++
  }
  return r
}

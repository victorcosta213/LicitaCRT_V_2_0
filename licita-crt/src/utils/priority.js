export const PRIORITY_ORDER = ['Crítico', 'Estratégico', 'Alavancável', 'Não Crítico', '—']

export const PRIORITY_COLOR = {
  'Crítico': '#dc3545',
  'Estratégico': '#0d6efd',
  'Alavancável': '#fd7e14',
  'Não Crítico': '#6c757d',
  '—': '#adb5bd',
}

export function normalizePriority(p) {
  const s = (p || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  if (s.startsWith('crit')) return 'Crítico'
  if (s.includes('estrat')) return 'Estratégico'
  if (s.includes('alavanc')) return 'Alavancável'
  if (s.includes('nao') || s.includes('não') || s.includes('naocrit') || s.includes('nao crit')) return 'Não Crítico'
  return p || '—'
}

export function priorityRank(p) {
  const np = normalizePriority(p)
  const idx = PRIORITY_ORDER.indexOf(np)
  return idx >= 0 ? idx : PRIORITY_ORDER.length - 1
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0)

export const brl = (v) =>
  v === null || v === undefined || v === ''
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// "YYYY-MM-DD" -> "DD/MM/YYYY" (sem passar por Date: evita deslocamento de fuso)
export const fmtDate = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—')

export const fmtDateTime = (s) =>
  s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const toISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export const hojeISO = () => toISO(new Date())

export const parseISO = (s) => {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// dias entre hoje e a data (negativo = já passou)
export const diasAte = (iso, ref = new Date()) => {
  const d = parseISO(iso)
  if (!d) return null
  const h = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  return Math.round((d - h) / 86400000)
}

export const addDias = (iso, n) => {
  const d = parseISO(iso)
  if (!d) return null
  d.setDate(d.getDate() + n)
  return toISO(d)
}

// competência é sempre armazenada como dia 1 do mês
export const competenciaISO = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}-01`

export const mesAtualISO = () => {
  const n = new Date()
  return competenciaISO(n.getFullYear(), n.getMonth() + 1)
}

export const fmtCompetencia = (iso) => {
  if (!iso) return '—'
  const [y, m] = String(iso).split('-')
  return `${MESES[Number(m) - 1]}/${y}`
}

export const fmtCompetenciaCurta = (iso) => {
  if (!iso) return '—'
  const [y, m] = String(iso).split('-')
  return `${m}/${y}`
}

// último dia do mês da competência
export const fimDaCompetencia = (iso) => {
  const d = parseISO(iso)
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export const listaCompetencias = (inicioISO, fimISO) => {
  const out = []
  const i = parseISO(inicioISO)
  const f = parseISO(fimISO)
  if (!i || !f) return out
  let y = i.getFullYear()
  let m = i.getMonth() + 1
  const endKey = f.getFullYear() * 12 + f.getMonth()
  while (y * 12 + (m - 1) <= endKey) {
    out.push(competenciaISO(y, m))
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

export const exercicioDe = (iso) => (iso ? Number(String(iso).slice(0, 4)) : null)

export const soDigitos = (s) => String(s || '').replace(/\D/g, '')

export const fmtCnpj = (s) => {
  const d = soDigitos(s)
  if (d.length !== 14) return s || '—'
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export const codigoInterno = (c) => (c?.id_interno ? `GC-${String(c.id_interno).padStart(4, '0')}` : '—')

export function cnpjValido(s) {
  const d = soDigitos(s)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const r = base.split('').reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = dv(d.slice(0, 12))
  const d2 = dv(d.slice(0, 12) + d1)
  return d1 === Number(d[12]) && d2 === Number(d[13])
}

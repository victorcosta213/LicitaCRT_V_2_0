import { useEffect, useMemo, useState } from 'react'
import { listarProcessos } from '../services/processos'
import { CardKPIs } from './dashboard/_parts'
import {
  Chart as ChartJS,
  ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Doughnut, Bar, Line } from 'react-chartjs-2'
import './dashboard.css'

// --- ChartJS setup
ChartJS.register(
  ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, ChartDataLabels
)

// --- CORES & HELPERS ---
const COLORS = [
  '#0d6efd', '#6f42c1', '#20c997', '#fd7e14', '#0dcaf0',
  '#198754', '#e83e8c', '#6c757d', '#dc3545', '#ffc107',
]
const PRIORITY_COLOR = {
  'Crítico': '#dc3545',
  'Não Crítico': '#6c757d',
  'Estratégico': '#0d6efd',
  'Alavancável': '#fd7e14',
}
const PRAZO_COLOR = {
  'Em dia': '#198754',
  'Quase vencendo': '#ffc107',
  'Atrasado': '#dc3545',
  '—': '#6c757d',
}
const ETAPA_COLOR = {
  'Aberto': '#0d6efd',
  'Em análise': '#0dcaf0',
  'Concluído': '#198754',
  'Suspenso': '#ffc107',
  'Revogado': '#dc3545',
  '—': '#6c757d',
}
const hexToRgb = (hex) => {
  let c = hex.replace('#', '')
  if (c.length === 3) c = c.split('').map(x => x + x).join('')
  const n = parseInt(c, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
const rgba = (hex, a = 0.7) => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
const colorCycle = (labels) => labels.map((_, i) => COLORS[i % COLORS.length])

// === NOVO: extrair ano/mês a partir do número do processo (formato AAAA.MM.xxx) ===
function monthFromNumero(numero) {
  if (!numero) return null
  const s = String(numero).trim()
  // casa padrão "2025.06.062" → year=2025, month=06
  let m = s.match(/^(\d{4})\D+(\d{2})/)
  if (!m) {
    // fallback tolerante: 4 dígitos + separador + 2 dígitos
    m = s.match(/(\d{4})\D+(\d{2})/)
  }
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!year || !month || month < 1 || month > 12) return null
  return new Date(year, month - 1, 1) // sempre dia 1
}
const ymKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const ymLabel = (key) => {
  const [y, m] = key.split('-'); return `${m}/${y}`
}
function rangeMonthsKeys(start, end) {
  // start/end são strings "YYYY-MM" ou null
  let a, b
  try { a = start ? new Date(Number(start.slice(0,4)), Number(start.slice(5,7))-1, 1) : null } catch {}
  try { b = end   ? new Date(Number(end.slice(0,4)), Number(end.slice(5,7))-1, 1)   : null } catch {}
  if (!a || !b) return null
  const out = []
  const cur = new Date(a.getFullYear(), a.getMonth(), 1)
  while (cur <= b) {
    out.push(ymKey(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

export default function Dashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  // === NOVO: filtro por período (mês/ano) ===
  const [periodo, setPeriodo] = useState(() => {
    try {
      const raw = localStorage.getItem('dashboard.periodo')
      return raw ? JSON.parse(raw) : { de: '', ate: '' } // strings YYYY-MM (input type="month")
    } catch {
      return { de: '', ate: '' }
    }
  })
  useEffect(() => {
    localStorage.setItem('dashboard.periodo', JSON.stringify(periodo))
  }, [periodo])

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const data = await listarProcessos()
        setRows(data)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // --- Helpers já existentes
  const toDate = (d) => {
    if (!d) return null
    const dt = d?.toDate?.() ?? new Date(d)
    return (dt instanceof Date && !isNaN(dt)) ? dt : null
  }
  const etapaOf = (p) => (p.etapa || p.statusGeral || '').trim()
  const isClosed = (p) => {
    const e = etapaOf(p)?.toLowerCase()
    return ['concluído', 'concluido', 'suspenso', 'revogado', 'fechado'].includes(e)
  }
  const isOpen = (p) => !isClosed(p)
  const norm = (s) => (s || '').toString().trim()

  // --- Base de data para o período: prioriza número do processo
  function baseMonthDate(p) {
    // 1) extrai de numero (AAAA.MM.xxx)
    const fromNum = monthFromNumero(p?.numero)
    if (fromNum) return fromNum
    // 2) fallback: campos de data caso existam
    return toDate(p.dataInicioProcesso) || toDate(p.createdAt) || null
  }
  function baseMonthKey(p) {
    const d = baseMonthDate(p)
    return d ? ymKey(d) : null
  }

  // === APLICAR FILTRO DE PERÍODO ===
  const filtered = useMemo(() => {
    if (!periodo.de && !periodo.ate) return rows
    const deKey = periodo.de || null
    const ateKey = periodo.ate || null
    return rows.filter(p => {
      const key = baseMonthKey(p)
      if (!key) return false
      if (deKey && key < deKey) return false
      if (ateKey && key > ateKey) return false
      return true
    })
  }, [rows, periodo])

  // --- KPIs (no período)
  const kpis = useMemo(() => {
    const total = filtered.length
    const abertos = filtered.filter(isOpen).length
    const fechados = filtered.filter(isClosed).length
    return { total, solicitados: total, abertos, fechados }
  }, [filtered])

  // --- Distribuições (no período)
  const countBy = (arr, pick) => {
    const m = new Map()
    for (const x of arr) {
      const k = pick(x) || '—'
      m.set(k, (m.get(k) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  const prioridadeKey = (s) => {
    const t = norm(s).toLowerCase()
    if (['critico', 'crítico'].includes(t)) return 'Crítico'
    if (['naocritico', 'não crítico', 'nao critico', 'não critico'].includes(t)) return 'Não Crítico'
    if (t.includes('estrat')) return 'Estratégico'
    if (t.includes('alavanc')) return 'Alavancável'
    return s || '—'
  }

  // Status de prazo (lógica resumida)
  function faseBucket(p) {
    const start = toDate(p.dataInicioFase)
    const prazo = Number(p.prazoFase) || null
    if (!start || !prazo) return '—'
    const dias = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (dias > prazo + 2) return 'Atrasado'
    if (dias > prazo) return 'Quase vencendo'
    return 'Em dia'
  }

  const distTipos       = useMemo(() => countBy(filtered, p => norm(p.tipo)), [filtered])
  const distPrioridade  = useMemo(() => countBy(filtered, p => prioridadeKey(p.prioridade)), [filtered])
  const distEtapas      = useMemo(() => {
    const order = ['Aberto', 'Em análise', 'Concluído', 'Suspenso', 'Revogado', '—']
    const counts = new Map(order.map(x => [x, 0]))
    for (const p of filtered) {
      const e = etapaOf(p) || '—'
      counts.set(e, (counts.get(e) ?? 0) + 1)
    }
    return order.map(k => [k, counts.get(k) ?? 0])
  }, [filtered])
  const distPrazo       = useMemo(() => countBy(filtered, faseBucket), [filtered])

  // === Série mensal: "abertos por mês" com base no número do processo ===
  const serieMes = useMemo(() => {
    const map = new Map()
    for (const p of rows) {
      const d = baseMonthDate(p)
      if (!d) continue
      const key = ymKey(d)
      map.set(key, (map.get(key) || 0) + 1)
    }

    // Se houver filtro, restringe aos meses do intervalo
    let keys
    if (periodo.de && periodo.ate) {
      keys = rangeMonthsKeys(periodo.de, periodo.ate) || []
    } else {
      keys = [...map.keys()].sort((a, b) => a.localeCompare(b))
    }
    return keys.map(k => [k, map.get(k) || 0])
  }, [rows, periodo])

  // Labels/values utils
  const labels = (pairs) => pairs.map(([k]) => k)
  const values = (pairs) => pairs.map(([, v]) => v)

  // Chart options
  const optsDonut = (title) => ({
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: !!title, text: title },
      datalabels: {
        formatter: (v, ctx) => {
          const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1
          const pct = Math.round((v / total) * 100)
          return v > 0 ? `${pct}%` : ''
        },
        anchor: 'end', align: 'end', offset: -4, clamp: true
      }
    },
    cutout: '66%'
  })
  const optsBar = (title) => ({
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: !!title, text: title },
      datalabels: { anchor: 'end', align: 'top', formatter: v => (v || v === 0) ? v : '' }
    },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
  })
  const optsLine = (title) => ({
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: !!title, text: title },
      datalabels: { display: false }
    },
    tension: .35
  })

  return (
    <div className="container py-3">
      <div className="row g-3">
        <div className="col-12">
          <h1 className="h5 mb-1">Dashboard</h1>
          <p className="text-secondary mb-2">Visão geral dos processos. O período usa o <b>número do processo</b> (AAAA.MM.xxx) para identificar ano/mês.</p>

          {/* === Filtro de período (mês/ano) === */}
          <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
            <div>
              <label className="form-label mb-1">De (mês/ano)</label>
              <input
                type="month"
                className="form-control"
                value={periodo.de}
                onChange={(e) => setPeriodo(s => ({ ...s, de: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label mb-1">Até (mês/ano)</label>
              <input
                type="month"
                className="form-control"
                value={periodo.ate}
                onChange={(e) => setPeriodo(s => ({ ...s, ate: e.target.value }))}
              />
            </div>
            <div className="ms-auto d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={() => {
                // último 12 meses
                const now = new Date()
                const end = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
                const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
                const start = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}`
                setPeriodo({ de: start, ate: end })
              }}>Últimos 12 meses</button>
              <button className="btn btn-light" onClick={() => setPeriodo({ de: '', ate: '' })}>Limpar</button>
            </div>
          </div>
        </div>

        {/* KPIs (no período) */}
        <div className="col-12">
          <div className="row g-3">
            <CardKPIs title="Solicitados (Período)" value={kpis.solicitados} hint="Total no intervalo" loading={loading}/>
            <CardKPIs title="Abertos" value={kpis.abertos} hint="Aberto / Em análise" loading={loading}/>
            <CardKPIs title="Fechados" value={kpis.fechados} hint="Concluído / Suspenso / Revogado" loading={loading}/>
            <CardKPIs title="Tipos distintos" value={new Set(filtered.map(r=>norm(r.tipo))).size} hint="Categorias no período" loading={loading}/>
          </div>
        </div>

        {/* Linha 1: Tipos + Urgência (no período) */}
        <div className="col-12 col-lg-6">
          <div className="chart-card">
            <Doughnut
              data={{
                labels: labels(distTipos),
                datasets: [{
                  data: values(distTipos),
                  backgroundColor: colorCycle(labels(distTipos)).map(c => rgba(c, 0.85)),
                  borderColor: colorCycle(labels(distTipos)),
                  borderWidth: 1,
                }]
              }}
              options={optsDonut('Distribuição por Tipo (período)')}
            />
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="chart-card">
            <Bar
              data={{
                labels: labels(distPrioridade),
                datasets: [{
                  data: values(distPrioridade),
                  backgroundColor: labels(distPrioridade).map(l => rgba(PRIORITY_COLOR[l] || '#6c757d', 0.75)),
                  borderColor: labels(distPrioridade).map(l => PRIORITY_COLOR[l] || '#6c757d'),
                  borderWidth: 1,
                }]
              }}
              options={optsBar('Urgência (Prioridade) — período')}
            />
          </div>
        </div>

      

        {/* Linha 3: Série mensal (Abertos por mês a partir do número) */}
        <div className="col-12">
          <div className="chart-card">
            <Line
              data={{
                labels: serieMes.map(([k]) => ymLabel(k)),
                datasets: [{
                  label: 'Abertos por mês',
                  data: serieMes.map(([, v]) => v),
                  borderColor: '#0d6efd',
                  backgroundColor: rgba('#0d6efd', 0.15),
                  fill: true,
                  pointRadius: 3,
                  pointHoverRadius: 5,
                  borderWidth: 2,
                }]
              }}
              options={optsLine('Abertos por mês (derivado do número AAAA.MM.xxx)')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

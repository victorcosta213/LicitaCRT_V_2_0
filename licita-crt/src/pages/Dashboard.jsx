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

export default function Dashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

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

  // --- Helpers
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

  // Status por prazo (lógica enxuta)
  function faseBucket(p) {
    const start = toDate(p.dataInicioFase)
    const prazo = Number(p.prazoFase) || null
    if (!start || !prazo) return '—'
    const dias = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (dias > prazo + 2) return 'Atrasado'
    if (dias > prazo) return 'Quase vencendo'
    return 'Em dia'
  }

  const norm = (s) => (s || '').toString().trim()
  const prioridadeKey = (s) => {
    const t = norm(s).toLowerCase()
    if (['critico', 'crítico'].includes(t)) return 'Crítico'
    if (['naocritico', 'não crítico', 'nao critico', 'não critico'].includes(t)) return 'Não Crítico'
    if (t.includes('estrat')) return 'Estratégico'
    if (t.includes('alavanc')) return 'Alavancável'
    return s || '—'
  }

  // --- KPIs
  const kpis = useMemo(() => {
    const total = rows.length
    const abertos = rows.filter(isOpen).length
    const fechados = rows.filter(isClosed).length
    const solicitados = total
    return { total, solicitados, abertos, fechados }
  }, [rows])

  // --- Distribuições
  const countBy = (arr, pick) => {
    const m = new Map()
    for (const x of arr) {
      const k = pick(x) || '—'
      m.set(k, (m.get(k) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  const distTipos = useMemo(() => countBy(rows, p => norm(p.tipo)), [rows])
  const distPrioridade = useMemo(() => countBy(rows, p => prioridadeKey(p.prioridade)), [rows])
  const distEtapas = useMemo(() => {
    const order = ['Aberto', 'Em análise', 'Concluído', 'Suspenso', 'Revogado', '—']
    const counts = new Map(order.map(x => [x, 0]))
    for (const p of rows) {
      const e = etapaOf(p) || '—'
      counts.set(e, (counts.get(e) ?? 0) + 1)
    }
    return order.map(k => [k, counts.get(k) ?? 0])
  }, [rows])
  const distPrazo = useMemo(() => countBy(rows, faseBucket), [rows])

  // Série mensal (novos)
  const serieMes = useMemo(() => {
    const map = new Map()
    for (const p of rows) {
      const d = toDate(p.dataInicioProcesso) || toDate(p.createdAt) || null
      if (!d) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

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
          <h1 className="h5 mb-0">Dashboard</h1>
          <p className="text-secondary">Visão geral dos processos.</p>
        </div>

        {/* KPIs */}
        <div className="col-12">
          <div className="row g-3">
            <CardKPIs title="Solicitados (Total)" value={kpis.solicitados} hint="Total de processos cadastrados" loading={loading}/>
            <CardKPIs title="Abertos" value={kpis.abertos} hint="Etapas: Aberto / Em análise" loading={loading}/>
            <CardKPIs title="Fechados" value={kpis.fechados} hint="Concluído / Suspenso / Revogado" loading={loading}/>
            <CardKPIs title="Tipos distintos" value={new Set(rows.map(r=>norm(r.tipo))).size} hint="Quantidade de categorias de tipo" loading={loading}/>
          </div>
        </div>

        {/* Linha 1: Tipos + Urgência */}
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
              options={optsDonut('Distribuição por Tipo')}
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
              options={optsBar('Urgência (Prioridade)')}
            />
          </div>
        </div>

        {/* Linha 2: Etapas + Prazo */}
        <div className="col-12 col-lg-6">
          <div className="chart-card">
            <Bar
              data={{
                labels: labels(distEtapas),
                datasets: [{
                  data: values(distEtapas),
                  backgroundColor: labels(distEtapas).map(l => rgba(ETAPA_COLOR[l] || '#6c757d', 0.75)),
                  borderColor: labels(distEtapas).map(l => ETAPA_COLOR[l] || '#6c757d'),
                  borderWidth: 1,
                }]
              }}
              options={optsBar('Status / Etapas')}
            />
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="chart-card">
            <Doughnut
              data={{
                labels: labels(distPrazo),
                datasets: [{
                  data: values(distPrazo),
                  backgroundColor: labels(distPrazo).map(l => rgba(PRAZO_COLOR[l] || '#6c757d', 0.85)),
                  borderColor: labels(distPrazo).map(l => PRAZO_COLOR[l] || '#6c757d'),
                  borderWidth: 1,
                }]
              }}
              options={optsDonut('Prazo da Fase (Em dia / Quase / Atrasado)')}
            />
          </div>
        </div>

        {/* Linha 3: Série mensal */}
        <div className="col-12">
          <div className="chart-card">
            <Line
              data={{
                labels: serieMes.map(([k]) => k),
                datasets: [{
                  label: 'Solicitados',
                  data: serieMes.map(([, v]) => v),
                  borderColor: '#0d6efd',
                  backgroundColor: rgba('#0d6efd', 0.15),
                  fill: true,
                  pointRadius: 3,
                  pointHoverRadius: 5,
                  borderWidth: 2,
                }]
              }}
              options={optsLine('Novos processos por mês')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { listarProcessos } from '../services/processos'
import { CardKPIs } from './dashboard/_parts'
import {
  Chart as ChartJS,
  ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Doughnut, Bar, Line } from 'react-chartjs-2'
import './dashboard.css'
import PhaseFilter from '../components/filters/PhaseFilter'
import { phaseNameByKey } from '../utils/phases'

ChartJS.register(
  ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, ChartDataLabels
)

const COLORS = [
  '#0f766e', '#d97706', '#0ea5e9', '#7c3aed', '#ef4444',
  '#14b8a6', '#475569', '#84cc16', '#f97316', '#2563eb',
]

const PRIORITY_COLOR = {
  'Critico': '#dc3545',
  'Nao Critico': '#64748b',
  'Estrategico': '#0f766e',
  'Alavancavel': '#d97706',
}

const hexToRgb = (hex) => {
  let c = hex.replace('#', '')
  if (c.length === 3) c = c.split('').map((x) => x + x).join('')
  const n = parseInt(c, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const rgba = (hex, a = 0.7) => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

const colorCycle = (labels) => labels.map((_, i) => COLORS[i % COLORS.length])

function monthFromNumero(numero) {
  if (!numero) return null
  const s = String(numero).trim()
  let m = s.match(/^(\d{4})\D+(\d{2})/)
  if (!m) m = s.match(/(\d{4})\D+(\d{2})/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!year || !month || month < 1 || month > 12) return null
  return new Date(year, month - 1, 1)
}

const ymKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const ymLabel = (key) => {
  const [y, m] = key.split('-')
  return `${m}/${y}`
}

function rangeMonthsKeys(start, end) {
  let a
  let b
  try { a = start ? new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1) : null } catch {}
  try { b = end ? new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1) : null } catch {}
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
  const [periodo, setPeriodo] = useState(() => {
    try {
      const raw = localStorage.getItem('dashboard.periodo')
      return raw ? JSON.parse(raw) : { de: '', ate: '' }
    } catch {
      return { de: '', ate: '' }
    }
  })
  const [faseKeyFilter, setFaseKeyFilter] = useState('')

  useEffect(() => {
    localStorage.setItem('dashboard.periodo', JSON.stringify(periodo))
  }, [periodo])

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const data = await listarProcessos()
        setRows(data)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toDate = (d) => {
    if (!d) return null
    const dt = d?.toDate?.() ?? new Date(d)
    return (dt instanceof Date && !isNaN(dt)) ? dt : null
  }

  const etapaOf = (p) => (p.etapa || p.statusGeral || '').trim()
  const normalizeStatus = (s) => (s || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

  const isClosed = (p) => {
    const e = normalizeStatus(etapaOf(p))
    return ['concluido', 'suspenso', 'revogado', 'fechado', 'finalizado'].includes(e)
  }

  const isOpen = (p) => {
    const e = normalizeStatus(etapaOf(p))
    return ['aberto', 'em analise'].includes(e)
  }

  const norm = (s) => (s || '').toString().trim()

  function baseMonthDate(p) {
    const fromNum = monthFromNumero(p?.numero)
    if (fromNum) return fromNum
    return toDate(p.dataInicioProcesso) || toDate(p.createdAt) || null
  }

  function baseMonthKey(p) {
    const d = baseMonthDate(p)
    return d ? ymKey(d) : null
  }

  const filteredByPeriod = useMemo(() => {
    if (!periodo.de && !periodo.ate) return rows
    const deKey = periodo.de || null
    const ateKey = periodo.ate || null
    return rows.filter((p) => {
      const key = baseMonthKey(p)
      if (!key) return false
      if (deKey && key < deKey) return false
      if (ateKey && key > ateKey) return false
      return true
    })
  }, [rows, periodo])

  const filtered = useMemo(() => {
    if (!faseKeyFilter) return filteredByPeriod
    const nome = phaseNameByKey(faseKeyFilter)
    return filteredByPeriod.filter((p) => {
      const etapa = p.etapa || ''
      const fluxo = Array.isArray(p.fluxo) ? p.fluxo : []
      return etapa === nome || fluxo.some((f) => (f.nome || '') === nome)
    })
  }, [filteredByPeriod, faseKeyFilter])

  const countBy = (arr, pick) => {
    const map = new Map()
    for (const item of arr) {
      const key = pick(item) || '-'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }

  const prioridadeKey = (s) => {
    const t = norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (t === 'critico') return 'Critico'
    if (['naocritico', 'nao critico'].includes(t)) return 'Nao Critico'
    if (t.includes('estrat')) return 'Estrategico'
    if (t.includes('alavanc')) return 'Alavancavel'
    return s || '-'
  }

  const kpis = useMemo(() => {
    const total = filtered.length
    const abertos = filtered.filter(isOpen).length
    const fechados = filtered.filter(isClosed).length
    return { total, solicitados: total, abertos, fechados }
  }, [filtered])

  const tipos = useMemo(() => countBy(filtered, (p) => norm(p.tipo)), [filtered])
  const prioridades = useMemo(() => countBy(filtered, (p) => prioridadeKey(p.prioridade)), [filtered])

  const serieMes = useMemo(() => {
    const map = new Map()
    for (const p of rows) {
      const d = baseMonthDate(p)
      if (!d) continue
      const key = ymKey(d)
      map.set(key, (map.get(key) || 0) + 1)
    }

    let keys
    if (periodo.de && periodo.ate) {
      keys = rangeMonthsKeys(periodo.de, periodo.ate) || []
    } else {
      keys = [...map.keys()].sort((a, b) => a.localeCompare(b))
    }
    return keys.map((k) => [k, map.get(k) || 0])
  }, [rows, periodo])

  const summary = useMemo(() => {
    const latest = serieMes[serieMes.length - 1]?.[1] || 0
    return [
      { label: 'Recorte atual', value: `${filtered.length} itens`, detail: 'Volume no filtro aplicado' },
      { label: 'Mes mais recente', value: latest, detail: 'Entradas no ultimo mes visivel' },
      { label: 'Tipos distintos', value: new Set(filtered.map((r) => norm(r.tipo))).size, detail: 'Categorias no periodo' },
    ]
  }, [filtered, serieMes])

  const tipoLabels = tipos.map(([key]) => key)
  const tipoValues = tipos.map(([, value]) => value)
  const tipoColors = colorCycle(tipoLabels)

  const prioridadeLabels = prioridades.map(([key]) => key)
  const prioridadeValues = prioridades.map(([, value]) => value)

  const lineLabels = serieMes.map(([key]) => ymLabel(key))
  const lineValues = serieMes.map(([, value]) => value)

  const optsDonut = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: !!title, text: title },
      datalabels: {
        formatter: (v, ctx) => {
          const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1
          const pct = Math.round((v / total) * 100)
          return v > 0 ? `${pct}%` : ''
        },
        anchor: 'end',
        align: 'end',
        offset: -4,
        clamp: true,
      },
    },
    cutout: '66%',
  })

  const optsBar = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: !!title, text: title },
      datalabels: { anchor: 'end', align: 'top', formatter: (v) => (v || v === 0) ? v : '' },
    },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  })

  const optsLine = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: !!title, text: title },
      datalabels: { display: false },
    },
    tension: .35,
  })

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-hero__eyebrow">Indicadores centrais</span>
          <h1>Leitura rápida do fluxo de licitações</h1>
          <p>
            Filtre periodo e fase para identificar gargalos, volume por tipo e
            tendencia mensal de abertura de processos.
          </p>
        </div>

        <div className="dashboard-summary">
          {summary.map((item) => (
            <article key={item.label} className="dashboard-summary__card">
              <span>{item.label}</span>
              <strong>{loading ? '...' : item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-filters">
        <div>
          <label className="form-label mb-1">De (mes/ano)</label>
          <input
            type="month"
            className="form-control"
            value={periodo.de}
            onChange={(e) => setPeriodo((s) => ({ ...s, de: e.target.value }))}
          />
        </div>

        <div>
          <label className="form-label mb-1">Ate (mes/ano)</label>
          <input
            type="month"
            className="form-control"
            value={periodo.ate}
            onChange={(e) => setPeriodo((s) => ({ ...s, ate: e.target.value }))}
          />
        </div>

        <div className="dashboard-filters__phase">
          <PhaseFilter value={faseKeyFilter} onChange={setFaseKeyFilter} />
        </div>

        <div className="dashboard-filters__actions">
          <button
            className="btn btn-outline-secondary"
            onClick={() => {
              const now = new Date()
              const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
              const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`
              setPeriodo({ de: start, ate: end })
            }}
          >
            Ultimos 12 meses
          </button>
          <button className="btn btn-light" onClick={() => setPeriodo({ de: '', ate: '' })}>
            Limpar
          </button>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-12">
          <div className="row g-3">
            <CardKPIs title="Solicitados" value={kpis.solicitados} hint="Total no intervalo" loading={loading} />
            <CardKPIs title="Abertos" value={kpis.abertos} hint="Aberto ou em analise" loading={loading} />
            <CardKPIs title="Fechados" value={kpis.fechados} hint="Concluido, suspenso ou revogado" loading={loading} />
            <CardKPIs title="Tipos distintos" value={new Set(filtered.map((r) => norm(r.tipo))).size} hint="Categorias no periodo" loading={loading} />
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="chart-card">
            <Doughnut
              data={{
                labels: tipoLabels,
                datasets: [{
                  data: tipoValues,
                  backgroundColor: tipoColors.map((c) => rgba(c, 0.85)),
                  borderColor: tipoColors,
                  borderWidth: 1,
                }],
              }}
              options={optsDonut('Distribuicao por tipo')}
            />
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="chart-card">
            <Bar
              data={{
                labels: prioridadeLabels,
                datasets: [{
                  data: prioridadeValues,
                  backgroundColor: prioridadeLabels.map((label) => rgba(PRIORITY_COLOR[label] || '#64748b', 0.75)),
                  borderColor: prioridadeLabels.map((label) => PRIORITY_COLOR[label] || '#64748b'),
                  borderWidth: 1,
                }],
              }}
              options={optsBar('Urgencia por prioridade')}
            />
          </div>
        </div>

        <div className="col-12">
          <div className="chart-card chart-card--wide">
            <Line
              data={{
                labels: lineLabels,
                datasets: [{
                  label: 'Abertos por mes',
                  data: lineValues,
                  borderColor: '#0f766e',
                  backgroundColor: rgba('#0f766e', 0.15),
                  fill: true,
                  pointRadius: 3,
                  pointHoverRadius: 5,
                  borderWidth: 2,
                }],
              }}
              options={optsLine('Abertos por mes')}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

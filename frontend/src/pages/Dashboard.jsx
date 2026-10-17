import { useEffect, useMemo, useState } from 'react'
import { listarProcessos } from '../services/processos'
import { Card, Indicadores, PageHeader } from '../components/gc/ui'
import { normalizePriority } from '../utils/priority'
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

// paleta da marca CRT-08
const COLORS = [
  '#2c6eb5', '#259f58', '#c08418', '#ed3237', '#4b4b4d',
  '#7fa8d6', '#6cc191', '#e2b65c', '#f08a8d', '#9a9b9f',
]

const PRIORITY_COLOR = {
  'Critico': '#ed3237',
  'Nao Critico': '#8a8b8f',
  'Estrategico': '#2c6eb5',
  'Alavancavel': '#c08418',
}

ChartJS.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif"
ChartJS.defaults.color = '#75767a'
ChartJS.defaults.borderColor = 'rgba(28, 31, 35, .08)'

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
  try { a = start ? new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1) : null } catch (e) { console.warn(e) }
  try { b = end ? new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1) : null } catch (e) { console.warn(e) }
  if (!a || !b) return null
  const out = []
  const cur = new Date(a.getFullYear(), a.getMonth(), 1)
  while (cur <= b) {
    out.push(ymKey(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

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

  const ultimoMes = serieMes[serieMes.length - 1] || null

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
    layout: { padding: 18 },
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

  const v = (n) => (loading ? '…' : n)

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Indicadores das licitações"
        subtitle="Volume, tipo, prioridade e entradas por mês. Filtre o período e a fase para achar gargalos."
      />

      <section className="dashboard-filters">
        <div>
          <label className="form-label" htmlFor="dashDe">De (mês/ano)</label>
          <input id="dashDe" type="month" className="form-control" value={periodo.de}
            onChange={(e) => setPeriodo((s) => ({ ...s, de: e.target.value }))} />
        </div>
        <div>
          <label className="form-label" htmlFor="dashAte">Até (mês/ano)</label>
          <input id="dashAte" type="month" className="form-control" value={periodo.ate}
            onChange={(e) => setPeriodo((s) => ({ ...s, ate: e.target.value }))} />
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
            Últimos 12 meses
          </button>
          <button className="btn btn-link" onClick={() => setPeriodo({ de: '', ate: '' })}>Limpar</button>
        </div>
      </section>

      <Indicadores itens={[
        { label: 'Processos no recorte', value: v(kpis.solicitados), hint: 'total no período e fase' },
        { label: 'Abertos', value: v(kpis.abertos), hint: 'aberto ou em análise', kind: kpis.abertos ? 'primary' : undefined },
        { label: 'Fechados', value: v(kpis.fechados), hint: 'concluído, suspenso ou revogado' },
        { label: 'Entradas no último mês', value: v(ultimoMes ? ultimoMes[1] : 0), hint: ultimoMes ? ymLabel(ultimoMes[0]) : 'sem dados' },
      ]} />

      <section className="row g-4">
        <div className="col-12 col-xl-6">
          <Card title="Por tipo de contratação">
            <div className="chart-card">
              <Doughnut
                data={{
                  labels: tipoLabels,
                  datasets: [{
                    data: tipoValues,
                    backgroundColor: tipoColors.map((c) => rgba(c, 0.88)),
                    borderColor: '#ffffff',
                    borderWidth: 2,
                  }],
                }}
                options={optsDonut()}
              />
            </div>
          </Card>
        </div>

        <div className="col-12 col-xl-6">
          <Card title="Por prioridade">
            <div className="chart-card">
              <Bar
                data={{
                  labels: prioridadeLabels.map((l) => normalizePriority(l)),
                  datasets: [{
                    data: prioridadeValues,
                    backgroundColor: prioridadeLabels.map((label) => rgba(PRIORITY_COLOR[label] || '#8a8b8f', 0.85)),
                    borderColor: prioridadeLabels.map((label) => PRIORITY_COLOR[label] || '#8a8b8f'),
                    borderWidth: 1,
                    borderRadius: 3,
                    maxBarThickness: 56,
                  }],
                }}
                options={optsBar()}
              />
            </div>
          </Card>
        </div>

        <div className="col-12">
          <Card title="Entradas por mês" subtitle="Pelo número do processo (ano/mês) ou pela data de cadastro">
            <div className="chart-card chart-card--wide">
              <Line
                data={{
                  labels: lineLabels,
                  datasets: [{
                    label: 'Processos abertos no mês',
                    data: lineValues,
                    borderColor: '#2c6eb5',
                    backgroundColor: rgba('#2c6eb5', 0.12),
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    borderWidth: 2,
                  }],
                }}
                options={optsLine()}
              />
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}

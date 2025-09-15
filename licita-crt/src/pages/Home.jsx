import { useEffect, useMemo, useState } from 'react'
import { listarProcessos } from '../services/processos'
import { PHASES, computePhaseState, monthFromNumero } from '../utils/phases'
import './home.css'


function humanAgo(from, now = new Date()) {
  if (!from) return '—'
  const ms = Math.max(0, now - from)
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function isClosed(etapa) {
  const e = (etapa || '').toString().toLowerCase()
  return ['concluído','concluido','suspenso','revogado','fechado','finalizado'].includes(e)
}

export default function Home() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

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


  const ativos = useMemo(() =>
    rows.filter(p => !isClosed(p?.etapa || p?.statusGeral)), [rows])


  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ativos
    return ativos.filter(p => (
      String(p.numero || '').toLowerCase().includes(q) ||
      String(p.objeto || '').toLowerCase().includes(q)
    ))
  }, [ativos, query])

  return (
    <div className="container py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h1 className="h5 mb-1">Acompanhamento de Processos</h1>
          <p className="text-secondary mb-0">
            Visão consolidada para o Prefeito: etapa atual, setor responsável e tempo na etapa.
          </p>
        </div>
        <div className="home-search input-group">
          <span className="input-group-text">🔎</span>
          <input className="form-control" placeholder="Buscar por nº ou objeto…" value={query} onChange={(e)=>setQuery(e.target.value)} />
        </div>
      </div>

      {loading && <div className="alert alert-info">Carregando…</div>}
      {!loading && view.length === 0 && (
        <div className="alert alert-light">Nenhum processo ativo encontrado.</div>
      )}

      <div className="row g-3">
        {view.map((p) => {
          const inicio = monthFromNumero(p.numero) 
          const { currentIndex, completed, lastChangeAt } = computePhaseState(p.fluxo)
          const curPhase = PHASES[currentIndex] || PHASES[0]
          const progress = Math.round((completed / PHASES.length) * 100)

          return (
            <div key={p.id} className="col-12 col-md-6 col-xl-4">
              <div className="card border-0 shadow-sm h-100 home-card">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="me-2">
                      <div className="text-secondary small">Processo</div>
                      <div className="fw-semibold text-truncate">{p.numero || '—'}</div>
                    </div>
                    <span className="badge round text-bg-primary">{progress}%</span>
                  </div>

                  <div className="text-truncate mb-2" title={p.objeto}>{p.objeto || '—'}</div>

                  <div className="row g-2 small mb-2">
                    <div className="col-6">
                      <div className="text-secondary">Início</div>
                      <div className="fw-semibold">{inicio ? inicio.toLocaleDateString('pt-BR', { month:'2-digit', year:'numeric' }) : '—'}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-secondary">Tempo na etapa</div>
                      <div className="fw-semibold">{humanAgo(lastChangeAt)}</div>
                    </div>
                    <div className="col-12">
                      <div className="text-secondary">Etapa atual</div>
                      <div className="fw-semibold">{curPhase.name}</div>
                      <div className="text-secondary">Responsável: <b>{curPhase.sector}</b></div>
                    </div>
                  </div>

                 
                  <div className="phases-progress mb-3">
                    {PHASES.map((ph, idx) => {
                      const state = idx < completed ? 'done' : (idx === currentIndex ? 'current' : 'todo')
                      return <span key={ph.key} className={`dot dot--${state}`} title={`${idx+1}. ${ph.name}`} />
                    })}
                  </div>

                  <div className="mt-auto d-flex justify-content-end">
                    <a className="btn btn-outline-primary btn-sm" href={`/controle?pid=${p.id}`}>
                      Detalhar no Controle
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

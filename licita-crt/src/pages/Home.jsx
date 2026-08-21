import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarProcessos } from '../services/processos'
import { PHASES, computePhaseState, monthFromNumero } from '../utils/phases'
import './home.css'

function humanAgo(from, now = new Date()) {
  if (!from) return '-'
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
  return ['concluido', 'concluído', 'suspenso', 'revogado', 'fechado', 'finalizado'].includes(e)
}

export default function Home() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

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

  const ativos = useMemo(
    () => rows.filter((p) => !isClosed(p?.etapa || p?.statusGeral)),
    [rows]
  )

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ativos
    return ativos.filter((p) => (
      String(p.numero || '').toLowerCase().includes(q) ||
      String(p.objeto || '').toLowerCase().includes(q)
    ))
  }, [ativos, query])

  const stats = useMemo(() => {
    const total = ativos.length
    const emAnalise = ativos.filter((p) => String(p?.etapa || '').toLowerCase().includes('an')).length
    const concluidosFluxo = ativos.filter((p) => {
      const done = computePhaseState(p.fluxo).completed
      return done >= Math.ceil(PHASES.length * 0.7)
    }).length
    return [
      { label: 'Processos ativos', value: total, detail: 'Carteira atual monitorada' },
      { label: 'Em analise', value: emAnalise, detail: 'Dependem de validacao setorial' },
      { label: 'Fase avancada', value: concluidosFluxo, detail: 'Fluxos acima de 70%' },
    ]
  }, [ativos])

  return (
    <div className="home-page">
      <section className="home-hero">
        <div>
          <span className="home-hero__eyebrow">Visão consolidada</span>
          <h1>Acompanhamento executivo dos processos</h1>
          <p>
            Monitore etapa atual, responsavel e ritmo de tramitação em uma interface
            mais clara para decisão rápida.
          </p>
        </div>

        <div className="home-hero__panel">
          <div className="home-search input-group">
            <span className="input-group-text">
              <i className="bi bi-search" />
            </span>
            <input
              className="form-control"
              placeholder="Buscar por numero ou objeto..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="home-hero__hint">
            {loading ? 'Atualizando processos...' : `${view.length} processos exibidos`}
          </div>
        </div>
      </section>

      <section className="home-stats">
        {stats.map((item) => (
          <article key={item.label} className="home-stat-card">
            <span>{item.label}</span>
            <strong>{loading ? '...' : item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      {loading && <div className="alert alert-info">Carregando...</div>}
      {!loading && view.length === 0 && (
        <div className="alert alert-light">Nenhum processo ativo encontrado.</div>
      )}

      <section className="row g-4">
        {view.map((p) => {
          const inicio = monthFromNumero(p.numero)
          const { currentIndex, completed, lastChangeAt } = computePhaseState(p.fluxo)
          const curPhase = PHASES[currentIndex] || PHASES[0]
          const progress = Math.round((completed / PHASES.length) * 100)

          return (
            <div key={p.id} className="col-12 col-md-6 col-xxl-4">
              <article className="card border-0 h-100 home-card">
                <div className="card-body d-flex flex-column">
                  <div className="home-card__top">
                    <div>
                      <span className="home-card__label">Processo</span>
                      <h2 className="home-card__number">{p.numero || '-'}</h2>
                    </div>
                  </div>

                  <p className="home-card__title" title={p.objeto}>
                    {p.objeto || '-'}
                  </p>

                  <div className="home-card__meta">
                    <div>
                      <span>Início</span>
                      <strong>
                        {inicio
                          ? inicio.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
                          : '-'}
                      </strong>
                    </div>
                    <div className="home-card__phase" style={{ gridColumn: '1 / -1' }}>
                      <span>Etapa atual</span>
                      <strong>{curPhase.name}</strong>
                    </div>
                  </div>

                  <div className="mt-auto d-flex justify-content-end pt-3">
                    <Link
                      className="btn btn-primary btn-sm home-card__cta w-100 d-flex align-items-center justify-content-center fw-semibold rounded-pill py-2"
                      to={`/controle?pid=${p.id}`}
                    >
                      Detalhar no Controle <i className="bi bi-arrow-right ms-2" />
                    </Link>
                  </div>
                </div>
              </article>
            </div>
          )
        })}
      </section>
    </div>
  )
}

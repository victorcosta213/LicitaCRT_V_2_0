import { useMemo } from 'react'
import { PRIORITY_COLOR, normalizePriority, priorityRank } from '../utils/priority'

export default function NotificationList({ items = [], title = 'Notificações', order = 'priority_then_date' }) {
  const list = Array.isArray(items) ? items : []

  const sorted = useMemo(() => {
    const arr = [...list]
    if (order === 'priority_then_date') {
      arr.sort((a, b) => {
        const pa = priorityRank(a?.priority)
        const pb = priorityRank(b?.priority)
        if (pa !== pb) return pa - pb
        const da = a?.createdAt?.toDate?.() ?? (a?.createdAt ? new Date(a.createdAt) : 0)
        const db = b?.createdAt?.toDate?.() ?? (b?.createdAt ? new Date(b.createdAt) : 0)
        return (db - da)
      })
    } else {
      arr.sort((a, b) => {
        const da = a?.createdAt?.toDate?.() ?? (a?.createdAt ? new Date(a.createdAt) : 0)
        const db = b?.createdAt?.toDate?.() ?? (b?.createdAt ? new Date(b.createdAt) : 0)
        return (db - da)
      })
    }
    return arr
  }, [list, order])

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 mb-0">{title}</h2>
        </div>
        {sorted.length === 0 && (
          <div className="alert alert-light mb-0">Nenhuma notificação.</div>
        )}
        <div className="list-group list-group-flush">
          {sorted.map(n => {
            const d = n?.createdAt?.toDate?.() ?? (n?.createdAt ? new Date(n.createdAt) : null)
            const pr = normalizePriority(n?.priority)
            const color = PRIORITY_COLOR[pr] || '#6c757d'
            return (
              <div key={n.id} className="list-group-item d-flex align-items-start">
                <div className="me-3" style={{width:10, height:10, borderRadius:999, marginTop:6, background: color}} />
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="fw-semibold">{n.title || 'Solicitação'}</div>
                    <span className="badge round" style={{background: color, color: '#fff'}}>{pr}</span>
                  </div>
                  {n.message && <div className="text-secondary small mt-1">{n.message}</div>}
                  <div className="small text-secondary mt-1">
                    {d ? d.toLocaleString('pt-BR') : '—'}
                    {n.relatedProcessId && (
                      <>
                        {' • '}
                        <a href={`/controle?pid=${n.relatedProcessId}`} className="link-primary">Abrir processo</a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

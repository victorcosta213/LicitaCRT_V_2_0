import { useEffect, useState } from 'react'
import { listarNotificacoesPorSetor } from '../../services/notifications'
import NotificationList from '../../components/NotificationList'

export default function Juridico() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const data = await listarNotificacoesPorSetor('juridico', { limitN: 100 })
        setItems(data)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-end mb-3">
        <div>
          <h1 className="h5 mb-1">Minha área — Jurídico</h1>
          <p className="text-secondary mb-0">Solicitações e avisos priorizados para o setor.</p>
        </div>
      </div>

      {loading && <div className="alert alert-info">Carregando…</div>}
      {!loading && <NotificationList items={items} title="Pendências do Jurídico" />}
    </div>
  )
}

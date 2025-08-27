export default function StepFlow({ items = [], onRemove }) {
  const steps = [...items].sort((a, b) => new Date(a.data) - new Date(b.data))

  if (!steps.length) return <div className="text-secondary">Nenhum documento registrado.</div>

  return (
    <div className="flow-wrap">
      <div className="flow">
        {steps.map((s, i) => (
          <div className="flow-step" key={`${s.nome}-${s.data}-${i}`}>
            <div className="dot"></div>
            <div className="label">
              <div className="name">{s.nome}</div>
              <div className="date">{formatBR(s.data)}</div>
            </div>
            {typeof onRemove === 'function' && (
              <button
                className="btn btn-link btn-sm text-danger ms-2 p-0"
                title="Remover"
                onClick={() => onRemove(i)}
                type="button"
              >
                🗑️
              </button>
            )}
            {i < steps.length - 1 && <div className="line"></div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatBR(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : (d?.toDate?.() ?? d)
  if (!(dt instanceof Date) || isNaN(dt)) return '—'
  return dt.toLocaleDateString('pt-BR')
}

export function CardKPIs({ title, value, hint, loading }) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <div className="kpi-card shadow-sm">
        <div className="kpi-title">{title}</div>
        <div className="kpi-value">
          {loading ? <span className="placeholder col-6"></span> : value}
        </div>
        {hint && <div className="kpi-hint">{hint}</div>}
      </div>
    </div>
  )
}

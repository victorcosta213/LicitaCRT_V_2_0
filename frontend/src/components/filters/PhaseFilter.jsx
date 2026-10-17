import PhaseSelect from '../PhaseSelect'
export default function PhaseFilter({ value, onChange }) {
  return (
    <div className="d-flex align-items-end gap-2">
      <div>
        <label className="form-label mb-1">Fase</label>
        <PhaseSelect value={value || ''} onChange={onChange} placeholder="Todas as fases" />
      </div>
      {value && (
        <button type="button" className="btn btn-light" onClick={() => onChange('')}>Limpar</button>
      )}
    </div>
  )
}

import { PHASES } from '../utils/phases'
export default function PhaseSelect({ value, onChange, placeholder = 'Selecione uma fase', id }) {
  return (
    <select id={id} className="form-select" value={value || ''} onChange={e => onChange?.(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {PHASES.map(p => (
        <option key={p.key} value={p.key}>{p.name}</option>
      ))}
    </select>
  )
}

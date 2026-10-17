import { useRef, useState } from 'react'
import { showError } from '../../utils/alerts'

// Modal de formulário dirigido por configuração.
// field: { name, label, type, options, col, required, help, readOnly, placeholder,
//          step, show(values) }
// type: text|textarea|number|money|date|select|sn (sim/não)|checkbox|section|email
const norm = (o) => (typeof o === 'string' ? { value: o, label: o } : o)
// "3 · Glosa" -> "Glosa" (a numeração é desenhada pelo formulário)
const semNumero = (label) => String(label).replace(/^\s*\d+\s*·\s*/, '')

function coerce(field, v) {
  switch (field.type) {
    case 'checkbox': return !!v
    case 'sn': return v === 'sim' ? true : v === 'nao' ? false : null
    case 'number':
    case 'money': return v === '' || v === null || v === undefined ? null : Number(v)
    case 'date': return v || null
    default: return v === '' || v === undefined ? null : v
  }
}

export default function FormModal({
  title, fields, initial = {}, onSubmit, onClose, submitLabel = 'Salvar', size = 'lg', children,
}) {
  const [values, setValues] = useState(() => {
    const v = {}
    for (const f of fields) {
      if (f.type === 'section') continue
      const raw = initial[f.name]
      if (f.type === 'sn') v[f.name] = raw === true ? 'sim' : raw === false ? 'nao' : ''
      else v[f.name] = raw === null || raw === undefined ? (f.type === 'checkbox' ? false : '') : raw
    }
    return v
  })
  const [busy, setBusy] = useState(false)
  const corpo = useRef(null)

  const set = (name, val) => setValues((s) => ({ ...s, [name]: val }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const out = {}
      for (const f of fields) {
        if (f.type === 'section' || f.readOnly) continue
        if (f.show && !f.show(values)) continue
        out[f.name] = coerce(f, values[f.name])
      }
      await onSubmit(out)
      onClose()
    } catch (err) {
      showError(err.message || 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }

  // formulários longos ganham seções numeradas e um sumário fixo no topo
  const secoes = fields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type === 'section' && (!f.show || f.show(values)))
  const numerar = secoes.length >= 3
  const numeroDa = new Map(secoes.map(({ i }, n) => [i, String(n + 1).padStart(2, '0')]))
  const irPara = (i) => corpo.current?.querySelector(`[data-secao="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-${size} modal-dialog-centered modal-dialog-scrollable`}>
          <form className="modal-content" onSubmit={submit}>
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body" ref={corpo}>
              {secoes.length >= 4 && (
                <nav className="form-sumario" aria-label="Seções do formulário">
                  {secoes.map(({ f, i }) => (
                    <button key={i} type="button" onClick={() => irPara(i)}>
                      <span className="form-sumario__n">{numeroDa.get(i)}</span>{semNumero(f.label)}
                    </button>
                  ))}
                </nav>
              )}
              {children}
              <div className="row g-3">
                {fields.map((f, i) => {
                  if (f.show && !f.show(values)) return null
                  if (f.type === 'section') {
                    return (
                      <div className="col-12 mt-3 form-secao" key={`s${i}`} data-secao={i}>
                        <h6 className="gc-section-title">
                          {numerar && <span className="form-secao__n">{numeroDa.get(i)}</span>}
                          {numerar ? semNumero(f.label) : f.label}
                        </h6>
                        {f.help && <div className="small text-secondary mt-1">{f.help}</div>}
                      </div>
                    )
                  }
                  const id = `f-${f.name}`
                  const col = f.col || 6
                  if (f.type === 'checkbox') {
                    return (
                      <div className={`col-md-${col} d-flex align-items-end`} key={f.name}>
                        <div className="form-check mb-2">
                          <input
                            id={id} type="checkbox" className="form-check-input"
                            checked={!!values[f.name]} disabled={f.readOnly}
                            onChange={(e) => set(f.name, e.target.checked)}
                          />
                          <label htmlFor={id} className="form-check-label fw-semibold">{f.label}</label>
                          {f.help && <div className="form-text mt-0">{f.help}</div>}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div className={`col-md-${col}`} key={f.name}>
                      <label htmlFor={id} className="form-label fw-semibold">
                        {f.label}{f.required && ' *'}
                      </label>
                      {f.type === 'textarea' ? (
                        <textarea
                          id={id} className="form-control" rows={f.rows || 3} required={f.required}
                          value={values[f.name]} readOnly={f.readOnly} placeholder={f.placeholder}
                          onChange={(e) => set(f.name, e.target.value)}
                        />
                      ) : f.type === 'select' || f.type === 'sn' ? (
                        <select
                          id={id} className="form-select" required={f.required} disabled={f.readOnly}
                          value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}
                        >
                          <option value="">{f.placeholder || 'Selecione…'}</option>
                          {(f.type === 'sn' ? [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }] : (f.options || [])).map(norm).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={id}
                          className="form-control"
                          type={f.type === 'money' || f.type === 'number' ? 'number' : (f.type || 'text')}
                          step={f.type === 'money' ? '0.01' : f.step}
                          min={f.type === 'money' ? '0' : f.min}
                          required={f.required}
                          readOnly={f.readOnly}
                          placeholder={f.placeholder}
                          value={values[f.name]}
                          onChange={(e) => set(f.name, e.target.value)}
                        />
                      )}
                      {f.help && <div className="form-text">{f.help}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="btn btn-primary px-4" disabled={busy}>
                {busy ? 'Salvando…' : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

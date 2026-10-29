import { useState } from 'react'
import { ROLES } from '../../utils/permissions'
import { showError } from '../../utils/alerts'

// Escolha de quem assina e em que papel; depois do envio o texto fica congelado.
export default function EnviarAssinaturaModal({ modelo, pessoas, onSubmit, onClose }) {
  const sugeridos = modelo?.papeisSugeridos || []
  const [linhas, setLinhas] = useState([{ usuario_id: '', papel: sugeridos[0] || '' }])
  const [busy, setBusy] = useState(false)

  const alterar = (i, campo, v) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)))
  const adicionar = () => setLinhas((ls) => [...ls, { usuario_id: '', papel: sugeridos[ls.length] || '' }])
  const remover = (i) => setLinhas((ls) => ls.filter((_, j) => j !== i))

  async function enviar(e) {
    e.preventDefault()
    const escolhidas = linhas.map((l) => ({ usuario_id: l.usuario_id, papel: l.papel.trim() }))
    if (escolhidas.some((l) => !l.usuario_id || !l.papel)) { showError('Escolha a pessoa e o papel de cada assinante.'); return }
    if (new Set(escolhidas.map((l) => l.usuario_id)).size !== escolhidas.length) { showError('A mesma pessoa foi escolhida mais de uma vez.'); return }
    setBusy(true)
    try {
      await onSubmit(escolhidas)
      onClose()
    } catch (err) {
      showError(err.message || 'Não foi possível enviar o documento.')
      setBusy(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-enviar-ass">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <form className="modal-content" onSubmit={enviar}>
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="titulo-enviar-ass"><i className="bi bi-send-check me-2" aria-hidden="true" />Enviar para assinatura</h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <div className="alert alert-warning py-2 small">
                <strong>Atenção:</strong> ao enviar, o texto fica <strong>congelado</strong>. Para mudar, será preciso que um signatário recuse a assinatura e o documento volte a rascunho.
              </div>
              <p className="small text-secondary">Escolha quem vai assinar. Todos precisam assinar para o documento ficar válido.</p>
              <datalist id="papeis-sugeridos">{sugeridos.map((p) => <option key={p} value={p} />)}</datalist>
              {linhas.map((l, i) => (
                <div className="row g-2 align-items-end mb-2" key={i}>
                  <div className="col-md-6">
                    <label htmlFor={`ass-pessoa-${i}`} className="form-label small fw-semibold mb-1">Pessoa {linhas.length > 1 ? i + 1 : ''}</label>
                    <select id={`ass-pessoa-${i}`} className="form-select" value={l.usuario_id} onChange={(e) => alterar(i, 'usuario_id', e.target.value)} required>
                      <option value="">Selecione…</option>
                      {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}{ROLES[p.role] ? ` — ${ROLES[p.role].label}` : ''}</option>)}
                    </select>
                  </div>
                  <div className="col-md-5">
                    <label htmlFor={`ass-papel-${i}`} className="form-label small fw-semibold mb-1">Papel na assinatura</label>
                    <input id={`ass-papel-${i}`} className="form-control" list="papeis-sugeridos" value={l.papel} onChange={(e) => alterar(i, 'papel', e.target.value)}
                      placeholder="Ex.: Presidente, Parecerista" required />
                  </div>
                  <div className="col-md-1 text-end">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => remover(i)} disabled={linhas.length === 1} aria-label={`Remover assinante ${i + 1}`}>
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline-primary mt-1" onClick={adicionar} disabled={linhas.length >= 10}>
                <i className="bi bi-plus-lg me-1" />Adicionar assinante
              </button>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="btn btn-primary px-4" disabled={busy}>{busy ? 'Enviando…' : 'Enviar para assinatura'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

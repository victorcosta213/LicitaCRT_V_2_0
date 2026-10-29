import { useEffect, useState } from 'react'
import { listarPessoasDaUnidade } from '../../services/tramitacao'
import { showError } from '../../utils/alerts'

// Enviar o processo para outra unidade, com despacho e, se quiser, uma pessoa específica.
export default function EnviarProcessoModal({ unidades, unidadeAtual, onSubmit, onClose }) {
  const [unidade, setUnidade] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [pessoas, setPessoas] = useState([])
  const [despacho, setDespacho] = useState('')
  const [prazo, setPrazo] = useState('')
  const [busy, setBusy] = useState(false)

  // as pessoas oferecidas são as da unidade escolhida
  useEffect(() => {
    let vivo = true
    setPessoa('')
    if (!unidade) { setPessoas([]); return undefined }
    listarPessoasDaUnidade(unidade)
      .then((p) => { if (vivo) setPessoas(p) })
      .catch(() => { if (vivo) setPessoas([]) })
    return () => { vivo = false }
  }, [unidade])

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ unidade_destino: unidade, usuario_destino: pessoa, despacho, prazo })
      onClose()
    } catch (err) {
      showError(err.message || 'Não foi possível enviar o processo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-enviar-processo">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <form className="modal-content" onSubmit={enviar}>
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="titulo-enviar-processo">Enviar para outra unidade</h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="env-unidade" className="form-label fw-semibold">Enviar para *</label>
                  <select id="env-unidade" className="form-select" required value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                    <option value="">Selecione a unidade…</option>
                    {unidades.filter((u) => u.ativa).map((u) => (
                      <option key={u.id} value={u.id}>{u.sigla} — {u.nome}{u.id === unidadeAtual ? ' (atual)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label htmlFor="env-pessoa" className="form-label fw-semibold">Pessoa (opcional)</label>
                  <select id="env-pessoa" className="form-select" value={pessoa} onChange={(e) => setPessoa(e.target.value)} disabled={!unidade}>
                    <option value="">Qualquer pessoa da unidade</option>
                    {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label htmlFor="env-despacho" className="form-label fw-semibold">Despacho *</label>
                  <textarea id="env-despacho" className="form-control" rows={3} required minLength={3} value={despacho}
                    onChange={(e) => setDespacho(e.target.value)} placeholder="O que a próxima unidade deve fazer com este processo." />
                </div>
                <div className="col-md-6">
                  <label htmlFor="env-prazo" className="form-label fw-semibold">Novo prazo final (opcional)</label>
                  <input id="env-prazo" type="date" className="form-control" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="btn btn-primary px-4" disabled={busy}>
                <i className="bi bi-send me-2" />{busy ? 'Enviando…' : 'Enviar processo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

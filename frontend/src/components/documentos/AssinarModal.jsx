import { useState } from 'react'
import { mensagemErroDocumento } from '../../services/documentos'

// Assinatura eletrônica: a pessoa confirma que leu e digita a senha de novo. Se a senha estiver errada, o modal fica aberto.
export default function AssinarModal({ documento, papel, onSubmit, onClose }) {
  const [senha, setSenha] = useState('')
  const [li, setLi] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')

  async function assinar(e) {
    e.preventDefault()
    setBusy(true)
    setErro('')
    try {
      await onSubmit(senha)
      onClose()
    } catch (err) {
      setErro(mensagemErroDocumento(err))
      setBusy(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-assinar">
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content" onSubmit={assinar}>
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="titulo-assinar"><i className="bi bi-pen me-2" aria-hidden="true" />Assinar documento</h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <p className="mb-2"><strong className="mono">{documento.numero}</strong> · {documento.titulo}</p>
              <p className="small text-secondary">Você assina como <strong>{papel}</strong>. Para confirmar a sua identidade, digite a sua senha de acesso.</p>
              {erro && <div className="alert alert-danger py-2" role="alert">{erro}</div>}
              <div className="mb-3">
                <label htmlFor="assinar-senha" className="form-label fw-semibold">Sua senha</label>
                <input id="assinar-senha" type="password" className="form-control" autoComplete="current-password" autoFocus required
                  value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <div className="form-check mb-3">
                <input id="assinar-li" type="checkbox" className="form-check-input" checked={li} onChange={(e) => setLi(e.target.checked)} />
                <label htmlFor="assinar-li" className="form-check-label">Li o documento e concordo com o seu conteúdo.</label>
              </div>
              <p className="small text-secondary mb-0">
                É uma assinatura eletrônica: o sistema registra a data e a hora, o seu IP, o seu navegador e o código (SHA-256) do texto que você assinou.
                Depois de assinado, o documento não pode mais ser alterado.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="btn btn-primary px-4" disabled={busy || !li || !senha}>
                {busy ? 'Assinando…' : 'Assinar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

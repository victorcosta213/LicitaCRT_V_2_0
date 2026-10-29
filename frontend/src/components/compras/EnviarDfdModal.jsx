import { useState } from 'react'
import { OBJETOS, rotuloDo } from '../../modelos/variantes'
import { dinheiro } from '../../modelos/base'
import { PRIORIDADES } from '../../utils/tramitacao'
import { dadosDoDfd } from '../../utils/solicitacoes'
import { showError } from '../../utils/alerts'

// Envia a DFD assinada ao Compras. Tudo sai da própria DFD (nada é redigitado); se houver pedido da
// secretaria devolvido para ajuste, a DFD pode responder a ele em vez de abrir um pedido novo.
export default function EnviarDfdModal({ documento, devolvidas = [], onSubmit, onClose }) {
  const dados = dadosDoDfd(documento)
  const [alvo, setAlvo] = useState(devolvidas.length === 1 ? devolvidas[0].id : '')
  const [resposta, setResposta] = useState('')
  const [busy, setBusy] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ tipo: 'dfd', documento_id: documento.id, ...dados }, alvo || null, resposta)
      onClose()
    } catch (err) {
      showError(err.message || 'Não foi possível enviar a DFD.')
      setBusy(false)
    }
  }
  const pr = PRIORIDADES[dados.prioridade]

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-enviar-dfd">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <form className="modal-content" onSubmit={enviar}>
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="titulo-enviar-dfd"><i className="bi bi-send me-2" aria-hidden="true" />Enviar a DFD ao Compras</h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <p className="small text-secondary">O Compras recebe a DFD <span className="mono">{documento.numero}</span> com estes dados, tirados dela:</p>
              <dl className="resumo-dfd">
                <div><dt>Objeto</dt><dd>{dados.objeto}</dd></div>
                <div><dt>Itens</dt><dd className="texto-livre">{dados.quantidade || '—'}</dd></div>
                <div><dt>Estimativa preliminar</dt><dd>{dados.valor_estimado ? dinheiro(dados.valor_estimado) : 'Sem valor de referência'}</dd></div>
                <div><dt>Tipo de objeto</dt><dd>{dados.objeto_tipo ? rotuloDo(OBJETOS, dados.objeto_tipo) : '—'}</dd></div>
                <div><dt>Prioridade</dt><dd>{pr?.label || '—'}</dd></div>
              </dl>
              {devolvidas.length > 0 && (
                <fieldset className="mt-3">
                  <legend className="form-label fw-semibold fs-6">Esta DFD corrige um pedido devolvido?</legend>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" name="dfd-alvo" id="dfd-alvo-novo" checked={!alvo} onChange={() => setAlvo('')} />
                    <label className="form-check-label" htmlFor="dfd-alvo-novo">Não, é um pedido novo</label>
                  </div>
                  {devolvidas.map((s) => (
                    <div className="form-check" key={s.id}>
                      <input className="form-check-input" type="radio" name="dfd-alvo" id={`dfd-alvo-${s.id}`} checked={alvo === s.id} onChange={() => setAlvo(s.id)} />
                      <label className="form-check-label" htmlFor={`dfd-alvo-${s.id}`}>
                        Sim, responde a <span className="mono">{s.numero}</span> — {s.objeto}
                        <span className="d-block small text-secondary">O Compras pediu: {s.motivo}</span>
                      </label>
                    </div>
                  ))}
                  {alvo && (
                    <div className="mt-2">
                      <label htmlFor="dfd-resposta" className="form-label fw-semibold">O que foi corrigido</label>
                      <textarea id="dfd-resposta" className="form-control" rows={2} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Conte ao Compras o que mudou." />
                    </div>
                  )}
                </fieldset>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Agora não</button>
              <button type="submit" className="btn btn-primary px-4" disabled={busy}>{busy ? 'Enviando…' : alvo ? 'Reenviar ao Compras' : 'Enviar ao Compras'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

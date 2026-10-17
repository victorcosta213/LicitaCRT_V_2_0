import { useState } from 'react'
import { esc, paraTexto } from '../../utils/documentos'

// Pré-visualiza uma minuta e permite copiá-la para o editor do SEI ou baixá-la para o Word.
// O HTML vem de utils/documentos.js, que escapa todos os dados antes de montá-lo.
export default function DocumentoModal({ doc, onClose }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    const texto = paraTexto(doc.html)
    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([new window.ClipboardItem({
          'text/html': new Blob([doc.html], { type: 'text/html' }),
          'text/plain': new Blob([texto], { type: 'text/plain' }),
        })])
      } else {
        await navigator.clipboard.writeText(texto)
      }
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  function baixar() {
    const conteudo = `<html><head><meta charset="utf-8"><title>${esc(doc.titulo)}</title></head><body>${doc.html}</body></html>`
    const url = URL.createObjectURL(new Blob(['﻿', conteudo], { type: 'application/msword' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${String(doc.arquivo || 'documento').replace(/[^\w.-]+/g, '_')}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-label={doc.titulo}>
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-bold">{doc.titulo}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <div className="alert alert-light border small">
                Minuta gerada pela plataforma. Revise, insira no SEI e, depois de assinada/publicada,
                registre aqui o nº e o link do documento SEI.
              </div>
              <div className="gc-documento border rounded p-4 bg-body" dangerouslySetInnerHTML={{ __html: doc.html }} />
            </div>
            <div className="modal-footer">
              {copiado && <span className="small text-success me-auto"><i className="bi bi-check2 me-1" />Copiado — cole no editor do SEI.</span>}
              <button type="button" className="btn btn-light" onClick={onClose}>Fechar</button>
              <button type="button" className="btn btn-outline-secondary" onClick={baixar}>
                <i className="bi bi-file-earmark-word me-1" />Baixar .doc
              </button>
              <button type="button" className="btn btn-primary" onClick={copiar}>
                <i className="bi bi-clipboard me-1" />Copiar para o SEI
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

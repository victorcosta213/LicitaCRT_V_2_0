import { useState } from 'react'
import { TAMANHO_MAXIMO, TIPOS_ARQUIVO } from '../../services/documentos'
import { showError } from '../../utils/alerts'

const semExtensao = (nome) => String(nome || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

// Envia um arquivo (PDF, imagem, planilha…) para virar documento do sistema e poder ser assinado.
// O SHA-256 do arquivo é calculado aqui e entra no texto assinado.
export default function EnviarArquivoModal({ tituloSugerido = '', onSubmit, onClose }) {
  const [arquivo, setArquivo] = useState(null)
  const [titulo, setTitulo] = useState(tituloSugerido)
  const [descricao, setDescricao] = useState('')
  const [busy, setBusy] = useState(false)

  const escolher = (f) => {
    if (f && f.size > TAMANHO_MAXIMO) { showError('O arquivo deve ter até 20 MB.'); return }
    setArquivo(f || null)
    if (f && !titulo.trim()) setTitulo(semExtensao(f.name))
  }

  async function enviar(e) {
    e.preventDefault()
    if (!arquivo) { showError('Escolha o arquivo.'); return }
    if (titulo.trim().length < 3) { showError('Informe o título do documento.'); return }
    setBusy(true)
    try {
      await onSubmit({ arquivo, titulo: titulo.trim(), descricao: descricao.trim() })
      onClose()
    } catch (err) {
      showError(err.message || 'Não foi possível enviar o arquivo.')
      setBusy(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-enviar-arq">
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content" onSubmit={enviar}>
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="titulo-enviar-arq"><i className="bi bi-upload me-2" aria-hidden="true" />Enviar arquivo</h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label htmlFor="arq-arquivo" className="form-label fw-semibold">Arquivo <span className="text-danger" title="Obrigatório">*</span></label>
                <input id="arq-arquivo" type="file" className="form-control" accept={TIPOS_ARQUIVO} onChange={(e) => escolher(e.target.files?.[0])} />
                <div className="form-text">PDF, imagem, Word ou planilha, até 20 MB. Depois de enviado, o arquivo não muda: pode ser assinado como os demais documentos.</div>
              </div>
              <div className="mb-3">
                <label htmlFor="arq-titulo" className="form-label fw-semibold">Título <span className="text-danger" title="Obrigatório">*</span></label>
                <input id="arq-titulo" className="form-control" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Proposta da empresa X" />
              </div>
              <div>
                <label htmlFor="arq-descricao" className="form-label fw-semibold">Descrição</label>
                <textarea id="arq-descricao" className="form-control" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="btn btn-primary px-4" disabled={busy || !arquivo}>{busy ? 'Enviando…' : 'Enviar'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

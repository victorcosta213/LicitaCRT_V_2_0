import { useMemo, useState } from 'react'
import RoteiroLista from './RoteiroLista'
import { roteiro } from '../../modelos/artefatos'
import { MODALIDADES, OBJETOS } from '../../modelos/variantes'
import { PRIORIDADES_SOL } from '../../utils/solicitacoes'
import { showError } from '../../utils/alerts'

// Abre o processo de contratação. `solicitacao` presente = aceite (os dados vêm dela);
// ausente = registro direto pelo Compras (pede objeto, unidade demandante e justificativa).
export default function AbrirProcessoModal({ solicitacao = null, unidades = [], onSubmit, onClose }) {
  const registrar = !solicitacao
  const [v, setV] = useState({
    objeto: '', unidade_demandante: '', justificativa: '', valor_estimado: '', prazo: '',
    modalidade: '', objeto_tipo: solicitacao?.objeto_tipo || '', prioridade: solicitacao?.prioridade || 'normal', despacho: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const previa = useMemo(() => (v.modalidade ? roteiro(v.modalidade, v.objeto_tipo || null) : null), [v.modalidade, v.objeto_tipo])

  async function enviar(e) {
    e.preventDefault()
    if (!v.modalidade) { showError('Escolha a forma de contratação.'); return }
    if (registrar && (v.objeto.trim().length < 5 || !v.unidade_demandante)) { showError('Informe o objeto e a unidade demandante.'); return }
    setBusy(true)
    try {
      await onSubmit(v)
      onClose()
    } catch (err) {
      showError(err.message || 'Não foi possível abrir o processo.')
      setBusy(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-abrir-proc">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <form className="modal-content" onSubmit={enviar}>
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="titulo-abrir-proc">
                <i className="bi bi-folder-plus me-2" aria-hidden="true" />{registrar ? 'Lançar processo antigo (sem DFD no sistema)' : 'Aceitar a DFD e abrir o processo de contratação'}
              </h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <div className="row g-4">
                <div className="col-lg-5">
                  {registrar ? (
                    <>
                      <p className="small text-secondary">Só para processos que começaram em papel, antes do sistema. Os novos começam pela DFD do secretário.</p>
                      <div className="mb-3">
                        <label htmlFor="ap-objeto" className="form-label fw-semibold">Objeto <span className="text-danger" title="Obrigatório">*</span></label>
                        <textarea id="ap-objeto" className="form-control" rows={2} value={v.objeto} onChange={set('objeto')} required />
                      </div>
                      <div className="mb-3">
                        <label htmlFor="ap-unidade" className="form-label fw-semibold">Unidade demandante <span className="text-danger" title="Obrigatório">*</span></label>
                        <select id="ap-unidade" className="form-select" value={v.unidade_demandante} onChange={set('unidade_demandante')} required>
                          <option value="">Selecione…</option>
                          {unidades.filter((u) => u.ativa !== false).map((u) => <option key={u.id} value={u.id}>{u.sigla} — {u.nome}</option>)}
                        </select>
                      </div>
                      <div className="mb-3">
                        <label htmlFor="ap-just" className="form-label fw-semibold">Justificativa da necessidade</label>
                        <textarea id="ap-just" className="form-control" rows={3} value={v.justificativa} onChange={set('justificativa')} />
                      </div>
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <label htmlFor="ap-valor" className="form-label fw-semibold">Valor estimado (R$)</label>
                          <input id="ap-valor" className="form-control" inputMode="decimal" value={v.valor_estimado} onChange={set('valor_estimado')} placeholder="0,00" />
                        </div>
                        <div className="col-6">
                          <label htmlFor="ap-prazo" className="form-label fw-semibold">Prazo desejado</label>
                          <input id="ap-prazo" type="date" className="form-control" value={v.prazo} onChange={set('prazo')} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="alert alert-light border small">
                      <div className="fw-semibold mono">{solicitacao.numero}</div>
                      <div>{solicitacao.objeto}</div>
                      <div className="text-secondary mt-1">O processo é aberto no Compras com estes dados; a unidade solicitante passa a acompanhá-lo{solicitacao.documento_id ? ' e o DFD é juntado a ele' : ''}.</div>
                    </div>
                  )}
                  <div className="mb-3">
                    <label htmlFor="ap-modalidade" className="form-label fw-semibold">Forma de contratação <span className="text-danger" title="Obrigatório">*</span></label>
                    <select id="ap-modalidade" className="form-select" value={v.modalidade} onChange={set('modalidade')} required>
                      <option value="">Selecione…</option>
                      {MODALIDADES.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="ap-objeto-tipo" className="form-label fw-semibold">Tipo de objeto</label>
                    <select id="ap-objeto-tipo" className="form-select" value={v.objeto_tipo} onChange={set('objeto_tipo')}>
                      <option value="">Não definido</option>
                      {OBJETOS.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="ap-prioridade" className="form-label fw-semibold">Prioridade</label>
                    <select id="ap-prioridade" className="form-select" value={v.prioridade} onChange={set('prioridade')}>
                      {PRIORIDADES_SOL.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
                    </select>
                  </div>
                  <div className="mb-1">
                    <label htmlFor="ap-despacho" className="form-label fw-semibold">Despacho de abertura</label>
                    <textarea id="ap-despacho" className="form-control" rows={2} value={v.despacho} onChange={set('despacho')} placeholder="Ex.: Elaborar o ETP e a pesquisa de preços." />
                  </div>
                </div>
                <div className="col-lg-7">
                  <h3 className="h6 fw-bold">Documentos que este processo vai precisar</h3>
                  {previa
                    ? <><p className="small text-secondary mb-2">{previa.resumo}</p><RoteiroLista roteiro={previa} compacto /></>
                    : <p className="text-secondary small">Escolha a forma de contratação para ver o roteiro de documentos da Lei 14.133/2021.</p>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="btn btn-primary px-4" disabled={busy}>{busy ? 'Abrindo…' : 'Abrir processo'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

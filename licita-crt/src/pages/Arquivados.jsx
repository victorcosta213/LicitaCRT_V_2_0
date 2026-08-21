import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listarProcessos } from '../services/processos'
import { updateById } from '../services/db'
import { exportToExcel, exportToPdf } from '../services/export'
import { showAlert, showConfirm, showError, showSuccess } from '../utils/alerts'
import { toInputDate } from '../utils/dates'
import { computeStatus } from '../utils/status'
import StepFlow from '../components/StepFlow'
import { PHASES, phaseNameByKey } from '../utils/phases'
import './controle.css'

const COL = 'processos'

const OPT_ETAPA = ['Aberto', 'Em analise', 'Concluido', 'Suspenso', 'Revogado']
const OPT_TIPO = ['Inexigibilidade', 'Dispensa', 'Dispensa Eletronica', 'Pregao', 'Concorrencia', 'Pronto Pagamento', 'ARP']
const OPT_PRIOR = ['Critico', 'Nao Critico', 'Estrategico', 'Alavancavel']

function priorityBadgeClass(value) {
  if (value === 'Critico') return 'text-bg-danger'
  if (value === 'Estrategico') return 'text-bg-primary'
  if (value === 'Alavancavel') return 'text-bg-warning'
  return 'text-bg-secondary'
}

export default function Arquivados() {
  const { isAdmin } = useAuth()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState({ etapa: '', prioridade: '', tipo: '' })

  const [selectedIds, setSelectedIds] = useState([])
  const [detail, setDetail] = useState(null)
  const detailCloseRef = useRef(null)

  async function load() {
    try {
      setLoading(true)
      setError('')
      const data = await listarProcessos()
      setRows(data)
    } catch {
      setError('Falha ao carregar processos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const view = useMemo(() => {
    return rows.filter((r) => {
      if (!r.arquivado) return false
      const txt = `${r.numero || ''} ${r.objeto || ''}`
      const okBusca = !busca || txt.toLowerCase().includes(busca.toLowerCase())
      const okEtapa = !filtro.etapa || (r.etapa || r.statusGeral || '') === filtro.etapa
      const okPrior = !filtro.prioridade || (r.prioridade || '') === filtro.prioridade
      const okTipo = !filtro.tipo || (r.tipo || '') === filtro.tipo

      return okBusca && okEtapa && okPrior && okTipo
    })
  }, [rows, busca, filtro])

  const toggleSelection = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const toggleAll = () => {
    if (selectedIds.length === view.length && view.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(view.map((r) => r.id))
    }
  }

  const unarchiveSelected = async () => {
    if (!(await showConfirm('Atenção', `Deseja desarquivar ${selectedIds.length} processo(s)?`))) return
    try {
      setLoading(true)
      for (const id of selectedIds) {
        await updateById(COL, id, { arquivado: false })
      }
      setSelectedIds([])
      await load()
    } catch {
      showError('Falha ao desarquivar.')
      setLoading(false)
    }
  }

  const openModal = (id) => document.getElementById(id)?.click()

  const onRowClick = (row, ev) => {
    if (ev.target.closest('button') || ev.target.closest('a') || ev.target.closest('input')) return
    setDetail(row)
    openModal('btnModalDetalhe')
  }

  const doExportExcel = () => exportToExcel(view, 'processos_arquivados.xlsx')
  const doExportPdf = () =>
    exportToPdf(
      view,
      [
        { header: 'N', dataKey: 'numero' },
        { header: 'Objeto', dataKey: 'objeto' },
        { header: 'Etapa', dataKey: 'etapa' },
        { header: 'Tipo', dataKey: 'tipo' },
        { header: 'Prioridade', dataKey: 'prioridade' },
        { header: 'Resp.', dataKey: 'responsavel' },
      ],
      'Processos Arquivados CRT-03',
      'processos_arquivados.pdf'
    )

  const showValoresInDetail = (p) =>
    ['Dispensa', 'Dispensa Eletronica'].includes(p?.tipo || '') ||
    !!(p?.valorCotado || p?.valorContratado)

  const activeFilters = [
    filtro.etapa ? { key: 'Etapa', value: filtro.etapa } : null,
    filtro.tipo ? { key: 'Tipo', value: filtro.tipo } : null,
    filtro.prioridade ? { key: 'Prioridade', value: filtro.prioridade } : null,
  ].filter(Boolean)

  return (
    <div className="controle-page">
      <section className="controle-hero">
        <div>
          <span className="controle-hero__eyebrow">Operacao central</span>
          <h1>Processos Arquivados</h1>
          <p>Consulte a carteira de processos arquivados do sistema.</p>
        </div>
        <div className="controle-hero__stats">
          <article>
            <span>Total arquivados</span>
            <strong>{loading ? '...' : view.length}</strong>
          </article>
        </div>
      </section>

      <div className="card border-0 shadow-sm controle-surface">
        <div className="card-body">
          <div className="controle-toolbar mb-3">
            <div className="controle-toolbar__search">
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-search" /></span>
                <input
                  className="form-control"
                  placeholder="Buscar numero ou objeto..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div className="controle-toolbar__actions">
              {selectedIds.length > 0 && (
                <button className="btn btn-warning me-2 fw-medium text-dark" onClick={unarchiveSelected}>
                  <i className="bi bi-box-arrow-up me-2" />
                  Desarquivar ({selectedIds.length})
                </button>
              )}
              <button className="btn btn-outline-secondary" data-bs-toggle="offcanvas" data-bs-target="#filtersOffcanvasArquivados">
                <i className="bi bi-sliders me-2" />
                Filtros
              </button>
              <button className="btn btn-outline-success" onClick={doExportExcel}>
                <i className="bi bi-file-earmark-excel me-2" />
                Excel
              </button>
              <button className="btn btn-outline-danger" onClick={doExportPdf}>
                <i className="bi bi-file-earmark-pdf me-2" />
                PDF
              </button>

              <button id="btnModalDetalhe" className="d-none" data-bs-toggle="modal" data-bs-target="#modalDetalheArquivados"></button>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="filter-chips controle-filter-chips">
              {activeFilters.map((chip) => (
                <span key={`${chip.key}-${chip.value}`} className="chip">
                  <span className="chip-key">{chip.key}</span>
                  <span className="chip-val">{chip.value}</span>
                </span>
              ))}
            </div>
          )}

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {loading && <div className="alert alert-info py-2">Carregando...</div>}

          <div className="process-table-wrap">
            <table className="process-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={view.length > 0 && selectedIds.length === view.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="process-col-numero">N</th>
                  <th className="process-col-objeto">Objeto</th>
                  <th className="process-col-etapa">Etapa</th>
                  <th className="process-col-tipo">Tipo</th>
                  <th className="process-col-prioridade">Prioridade</th>
                  <th className="process-col-prazo">Prazo</th>
                  <th className="process-col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => {
                  const st = computeStatus(r.prazo)
                  const isSelected = selectedIds.includes(r.id)
                  return (
                    <tr key={r.id} onClick={(ev) => onRowClick(r, ev)} className={isSelected ? 'table-active' : ''}>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isSelected}
                          onChange={() => toggleSelection(r.id)}
                        />
                      </td>
                      <td className="process-col-numero">
                        <div className="process-cell-number">{r.numero}</div>
                      </td>
                      <td className="process-col-objeto">
                        <div className="process-cell-title" title={r.objeto}>{r.objeto}</div>
                        <div className="process-cell-subtitle">{r.responsavel || 'Sem responsavel'}</div>
                      </td>
                      <td className="process-col-etapa">
                        <span className="process-pill process-pill--soft">{r.etapa || r.statusGeral || '-'}</span>
                      </td>
                      <td className="process-col-tipo">{r.tipo || '-'}</td>
                      <td className="process-col-prioridade">
                        {r.prioridade ? <span className={`process-pill ${priorityBadgeClass(r.prioridade)}`}>{r.prioridade}</span> : '-'}
                      </td>
                      <td className="process-col-prazo">{toInputDate(r.prazo) || '-'}</td>
                      <td className="process-col-status">
                        <span className={`process-pill text-bg-${st.kind}`}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
                {!loading && view.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center text-secondary py-4">Nenhum registro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="process-mobile-list">
            {view.map((r) => {
              const st = computeStatus(r.prazo)
              const isSelected = selectedIds.includes(r.id)
              return (
                <article key={r.id} className={`process-mobile-card ${isSelected ? 'border-primary' : ''}`} onClick={(ev) => onRowClick(r, ev)}>
                  <div className="process-mobile-card__head">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={isSelected}
                        onChange={() => toggleSelection(r.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <div className="process-mobile-card__eyebrow">Processo</div>
                        <div className="process-mobile-card__number">{r.numero}</div>
                      </div>
                    </div>
                    <span className={`process-pill ${priorityBadgeClass(r.prioridade)}`}>{r.prioridade || 'Sem prioridade'}</span>
                  </div>

                  <div className="process-mobile-card__title">{r.objeto}</div>

                  <div className="process-mobile-card__meta">
                    <div>
                      <span>Etapa</span>
                      <strong>{r.etapa || r.statusGeral || '-'}</strong>
                    </div>
                    <div>
                      <span>Tipo</span>
                      <strong>{r.tipo || '-'}</strong>
                    </div>
                    <div>
                      <span>Prazo</span>
                      <strong>{toInputDate(r.prazo) || '-'}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong><span className={`process-pill text-bg-${st.kind}`}>{st.label}</span></strong>
                    </div>
                  </div>

                  <div className="process-mobile-card__footer">
                    <div className="process-mobile-card__responsavel">
                      <span>Responsavel</span>
                      <strong>{r.responsavel || 'Nao informado'}</strong>
                    </div>
                  </div>
                </article>
              )
            })}
            {!loading && view.length === 0 && (
              <div className="text-center text-secondary py-4">Nenhum registro.</div>
            )}
          </div>
        </div>
      </div>

      <div className="offcanvas offcanvas-end" tabIndex="-1" id="filtersOffcanvasArquivados" aria-labelledby="filtersTitle">
        <div className="offcanvas-header">
          <h5 id="filtersTitle" className="mb-0">Filtros</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          <div className="vstack gap-3">
            <div>
              <label className="form-label">Etapa</label>
              <select className="form-select" value={filtro.etapa} onChange={(e) => setFiltro((s) => ({ ...s, etapa: e.target.value }))}>
                <option value="">Todas</option>
                {OPT_ETAPA.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Tipo de Licitacao</label>
              <select className="form-select" value={filtro.tipo} onChange={(e) => setFiltro((s) => ({ ...s, tipo: e.target.value }))}>
                <option value="">Todos</option>
                {OPT_TIPO.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Prioridade</label>
              <select className="form-select" value={filtro.prioridade} onChange={(e) => setFiltro((s) => ({ ...s, prioridade: e.target.value }))}>
                <option value="">Todas</option>
                {OPT_PRIOR.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={() => setFiltro({ etapa: '', prioridade: '', tipo: '' })}>
                Limpar filtros
              </button>
              <button className="btn btn-light" data-bs-dismiss="offcanvas">
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade modal-tall" id="modalDetalheArquivados" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h1 className="modal-title fs-6 mb-0">Detalhes do processo arquivado</h1>
                <small className="text-secondary">
                  {detail ? `N ${detail.numero} - ${detail.objeto || ''}` : ''}
                </small>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" ref={detailCloseRef}></button>
            </div>
            <div className="modal-body overflow-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {detail ? (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-md-3">
                      <div className="p-3 border rounded-3">
                        <div className="text-secondary small">Etapa</div>
                        <div className="fw-semibold">{detail.etapa || detail.statusGeral || '-'}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded-3">
                        <div className="text-secondary small">Tipo</div>
                        <div className="fw-semibold">{detail.tipo || '-'}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded-3">
                        <div className="text-secondary small">Prioridade</div>
                        <div className="fw-semibold">{detail.prioridade || '-'}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded-3">
                        <div className="text-secondary small">Responsavel</div>
                        <div className="fw-semibold">{detail.responsavel || '-'}</div>
                      </div>
                    </div>
                  </div>

                  {detail.justificativa ? (
                    <div className="mb-3">
                      <h2 className="h6 mb-2">Justificativa</h2>
                      <div className="p-3 border rounded-3 bg-body">
                        <div className="text-wrap">{detail.justificativa}</div>
                      </div>
                    </div>
                  ) : null}

                  {showValoresInDetail(detail) ? (
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <div className="p-3 border rounded-3">
                          <div className="text-secondary small">Valor cotado</div>
                          <div className="fw-semibold">{detail.valorCotado || '-'}</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="p-3 border rounded-3">
                          <div className="text-secondary small">Valor contratado</div>
                          <div className="fw-semibold">{detail.valorContratado || '-'}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mb-2 d-flex align-items-center justify-content-between">
                    <h2 className="h6 mb-0">Fluxograma</h2>
                  </div>
                  <div className="mb-3">
                    <StepFlow items={Array.isArray(detail.fluxo) ? detail.fluxo : []} readonly={true} onRemove={() => {}} />
                  </div>
                </>
              ) : (
                <div className="text-secondary">Selecione um processo.</div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

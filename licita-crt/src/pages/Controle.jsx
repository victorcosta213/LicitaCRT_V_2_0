import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listarProcessos } from '../services/processos'
import { createDoc, updateById, removeById, findBy } from '../services/db'
import { uploadFile, removeFile } from '../services/files'
import { exportToExcel, exportToPdf } from '../services/export'
import { showAlert, showConfirm, showError, showSuccess } from '../utils/alerts'
import { toInputDate, fromInputDate } from '../utils/dates'
import { computeStatus } from '../utils/status'
import StepFlow from '../components/StepFlow'
import PhaseSelect from '../components/PhaseSelect'
import { PHASES, phaseNameByKey } from '../utils/phases'
import './controle.css'

const COL = 'processos'

const emptyForm = {
  numero: '',
  objeto: '',
  etapa: '',
  tipo: '',
  prioridade: '',
  prazo: '',
  responsavel: '',
  anexoUrl: '',
  anexoPath: '',
  faseInicialKey: '',
  justificativa: '',
  valorCotado: '',
  valorContratado: '',
}

const OPT_ETAPA = ['Aberto', 'Em analise', 'Concluido', 'Suspenso', 'Revogado']
const OPT_TIPO = ['Inexigibilidade', 'Dispensa', 'Dispensa Eletronica', 'Pregao', 'Concorrencia', 'Pronto Pagamento', 'ARP']
const OPT_PRIOR = ['Critico', 'Nao Critico', 'Estrategico', 'Alavancavel']
const OPT_STATUS_PRAZO = ['Em dia', 'Quase vencendo', 'Atrasado']

function priorityBadgeClass(value) {
  if (value === 'Critico') return 'text-bg-danger'
  if (value === 'Estrategico') return 'text-bg-primary'
  if (value === 'Alavancavel') return 'text-bg-warning'
  return 'text-bg-secondary'
}

export default function Controle() {
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState(() => {
    try {
      const raw = localStorage.getItem('controle.filters')
      return raw ? JSON.parse(raw) : { etapa: '', prioridade: '', tipo: '', faseAtual: '', statusPrazo: '', de: '', ate: '' }
    } catch {
      return { etapa: '', prioridade: '', tipo: '', faseAtual: '', statusPrazo: '', de: '', ate: '' }
    }
  })

  useEffect(() => {
    localStorage.setItem('controle.filters', JSON.stringify(filtro))
  }, [filtro])

  const [selectedIds, setSelectedIds] = useState([])

  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState(null)
  const closeRef = useRef(null)

  const [detail, setDetail] = useState(null)
  const [novaFaseKey, setNovaFaseKey] = useState('')
  const [novaFaseData, setNovaFaseData] = useState('')
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

  useEffect(() => {
    if (rows.length > 0) {
      const pid = searchParams.get('pid')
      if (pid) {
        const row = rows.find(r => r.id === pid)
        if (row) {
          setDetail(row)
          setNovaFaseKey('')
          setNovaFaseData('')
          setTimeout(() => openModal('btnModalDetalhe'), 100)
          setSearchParams({})
        }
      }
    }
  }, [rows, searchParams, setSearchParams])

  const view = useMemo(() => {
    return rows.filter((r) => {
      if (r.arquivado) return false
      const txt = `${r.numero || ''} ${r.objeto || ''}`
      const okBusca = !busca || txt.toLowerCase().includes(busca.toLowerCase())
      const okEtapa = !filtro.etapa || (r.etapa || r.statusGeral || '') === filtro.etapa
      const okPrior = !filtro.prioridade || (r.prioridade || '') === filtro.prioridade
      const okTipo = !filtro.tipo || (r.tipo || '') === filtro.tipo

      let okFase = true
      if (filtro.faseAtual) {
        const faseNome = phaseNameByKey(filtro.faseAtual)
        const etapa = (r.etapa || '').toString()
        const fluxo = Array.isArray(r.fluxo) ? r.fluxo : []
        okFase = etapa === faseNome || fluxo.some((f) => (f.nome || '') === faseNome)
      }

      const stPrazo = computeStatus(r.prazo).label
      const okPrazo = !filtro.statusPrazo || stPrazo === filtro.statusPrazo

      const toDate = (d) => d?.toDate?.() ?? (d ? new Date(d) : null)
      const baseDate = toDate(r.dataInicioProcesso) || toDate(r.createdAt) || null

      let okPeriodo = true
      if ((filtro.de || filtro.ate) && baseDate) {
        const ymd = (d) => d.toISOString().slice(0, 10)
        if (filtro.de && ymd(baseDate) < filtro.de) okPeriodo = false
        if (filtro.ate && ymd(baseDate) > filtro.ate) okPeriodo = false
      } else if ((filtro.de || filtro.ate) && !baseDate) {
        okPeriodo = false
      }

      return okBusca && okEtapa && okPrior && okTipo && okFase && okPrazo && okPeriodo
    })
  }, [rows, busca, filtro])

  const openModal = (id) => document.getElementById(id)?.click()
  const onChange = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }))

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

  const archiveSelected = async () => {
    if (!(await showConfirm('Atenção', `Deseja arquivar ${selectedIds.length} processo(s)?`))) return
    try {
      setLoading(true)
      for (const id of selectedIds) {
        await updateById(COL, id, { arquivado: true })
      }
      setSelectedIds([])
      await load()
    } catch {
      showError('Falha ao arquivar.')
      setLoading(false)
    }
  }

  const onNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
    openModal('btnModalControle')
  }

  const onEdit = (row) => {
    if (!isAdmin) {
      showError('Voce nao tem permissao para editar.')
      return
    }
    setEditing(row.id)
    setForm({
      numero: row.numero || '',
      objeto: row.objeto || '',
      etapa: row.etapa || '',
      tipo: row.tipo || '',
      prioridade: row.prioridade || '',
      prazo: toInputDate(row.prazo),
      responsavel: row.responsavel || '',
      anexoUrl: row.anexoUrl || '',
      anexoPath: row.anexoPath || '',
      faseInicialKey: '',
      justificativa: row.justificativa || '',
      valorCotado: row.valorCotado || '',
      valorContratado: row.valorContratado || '',
    })
    setFile(null)
    openModal('btnModalControle')
  }

  const onDelete = async (row) => {
    if (!isAdmin) {
      showError('Voce nao tem permissao para excluir.')
      return
    }
    if (!(await showConfirm('Atenção', 'Confirma excluir este registro?'))) return
    try {
      if (row.anexoPath) await removeFile(row.anexoPath)
      await removeById(COL, row.id)
      await load()
    } catch {
      showError('Falha ao excluir.')
    }
  }

  const validate = (f) => {
    if (!f.numero?.trim()) return 'Informe o numero.'
    if (!f.objeto?.trim()) return 'Informe o objeto.'
    return ''
  }

  async function checkDuplicateNumero(numero, currentId) {
    const res = await findBy(COL, 'numero', numero)
    const found = res?.data || []
    return found.some((x) => x.id !== currentId)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const v = validate(form)
    if (v) {
      showError(v)
      return
    }
    try {
      setSaving(true)
      if (await checkDuplicateNumero(form.numero, editing)) {
        showError('Ja existe um processo com esse numero.')
        return
      }

      const payload = {
        ...form,
        prazo: form.prazo ? fromInputDate(form.prazo) : null,
      }

      if (!editing) {
        const faseInicialKey = form.faseInicialKey || null
        const fluxoInicial = faseInicialKey ? [{ nome: phaseNameByKey(faseInicialKey), data: new Date().toISOString() }] : []
        payload.fluxo = fluxoInicial
        if (fluxoInicial.length) payload.etapa = fluxoInicial[0].nome
      }

      if (file) {
        try {
          if (form.anexoPath) {
            try { await removeFile(form.anexoPath) } catch {}
          }
          const up = await uploadFile('anexos', file, form.numero || undefined)
          payload.anexoUrl = up.url
          payload.anexoPath = up.path
        } catch {
          showError('Falha ao enviar o anexo.')
        }
      }

      if (editing) await updateById(COL, editing, payload)
      else await createDoc(COL, payload)

      await load()
      closeRef.current?.click()
    } catch {
      showError('Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const onRowClick = (row, ev) => {
    if (ev.target.closest('button') || ev.target.closest('a')) return
    setDetail(row)
    setNovaFaseKey('')
    setNovaFaseData('')
    openModal('btnModalDetalhe')
  }

  const addStep = async () => {
    if (!detail) return
    const nome = phaseNameByKey(novaFaseKey)
    const data = novaFaseData ? `${novaFaseData}T00:00:00` : ''
    if (!novaFaseKey || !data) {
      showError('Selecione a fase e a data.')
      return
    }

    const fluxo = Array.isArray(detail.fluxo) ? [...detail.fluxo] : []
    fluxo.push({ nome, data })

    try {
      await updateById(COL, detail.id, { fluxo, etapa: nome })
      const newRows = rows.map((r) => r.id === detail.id ? { ...r, fluxo, etapa: nome } : r)
      setRows(newRows)
      setDetail({ ...detail, fluxo, etapa: nome })
      setNovaFaseKey('')
      setNovaFaseData('')
    } catch {
      showError('Falha ao adicionar fase.')
    }
  }

  const removeStep = async (idx) => {
    if (!detail) return
    const fluxo = Array.isArray(detail.fluxo) ? [...detail.fluxo] : []
    fluxo.splice(idx, 1)
    try {
      await updateById(COL, detail.id, { fluxo })
      const newRows = rows.map((r) => r.id === detail.id ? { ...r, fluxo } : r)
      setRows(newRows)
      setDetail({ ...detail, fluxo })
    } catch {
      showError('Falha ao remover fase.')
    }
  }

  const doExportExcel = () => exportToExcel(view, 'processos.xlsx')
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
      'Processos CRT-03',
      'processos.pdf'
    )

  const mostrarJustificativa = ['Revogado', 'Suspenso'].includes(form.etapa || '')
  const mostrarValores = ['Dispensa', 'Dispensa Eletronica'].includes(form.tipo || '')

  const showValoresInDetail = (p) =>
    ['Dispensa', 'Dispensa Eletronica'].includes(p?.tipo || '') ||
    !!(p?.valorCotado || p?.valorContratado)

  const activeFilters = [
    filtro.etapa ? { key: 'Etapa', value: filtro.etapa } : null,
    filtro.tipo ? { key: 'Tipo', value: filtro.tipo } : null,
    filtro.prioridade ? { key: 'Prioridade', value: filtro.prioridade } : null,
    filtro.faseAtual ? { key: 'Fase', value: phaseNameByKey(filtro.faseAtual) } : null,
    filtro.statusPrazo ? { key: 'Prazo', value: filtro.statusPrazo } : null,
    filtro.de ? { key: 'De', value: filtro.de } : null,
    filtro.ate ? { key: 'Ate', value: filtro.ate } : null,
  ].filter(Boolean)

  return (
    <div className="controle-page">
      <section className="controle-hero">
        <div>
          <span className="controle-hero__eyebrow">Operacao central</span>
          <h1>Controle de processos</h1>
          <p>Gerencie a carteira ativa, aplique filtros e acompanhe status e prazo com uma leitura mais direta.</p>
        </div>
        <div className="controle-hero__stats">
          <article>
            <span>Total visivel</span>
            <strong>{loading ? '...' : view.length}</strong>
          </article>
          <article>
            <span>Com filtro</span>
            <strong>{activeFilters.length}</strong>
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
                <button className="btn btn-warning me-2 text-white fw-medium" onClick={archiveSelected}>
                  <i className="bi bi-archive-fill me-2" />
                  Arquivar ({selectedIds.length})
                </button>
              )}
              <button className="btn btn-outline-secondary" data-bs-toggle="offcanvas" data-bs-target="#filtersOffcanvas">
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
              <button className="btn btn-primary" onClick={onNew}>
                <i className="bi bi-plus-lg me-2" />
                Novo
              </button>

              <button id="btnModalControle" className="d-none" data-bs-toggle="modal" data-bs-target="#modalControle"></button>
              <button id="btnModalDetalhe" className="d-none" data-bs-toggle="modal" data-bs-target="#modalDetalhe"></button>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="filter-chips controle-filter-chips">
              {activeFilters.map((chip) => (
                <span key={`${chip.key}-${chip.value}`} className={`chip ${chip.key === 'De' || chip.key === 'Ate' ? 'chip--date' : ''}`}>
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
                  <th className="process-col-acoes">Ações</th>
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
                      <td className="process-col-acoes" onClick={(e) => e.stopPropagation()}>
                        {isAdmin ? (
                          <div className="process-actions">
                            <button className="btn btn-sm btn-light" onClick={() => onEdit(r)} title="Editar">
                              <i className="bi bi-pencil-square" />
                            </button>
                            <button className="btn btn-sm btn-light text-danger" onClick={() => onDelete(r)} title="Excluir">
                              <i className="bi bi-trash3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-secondary tiny">-</span>
                        )}
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
                    <div className="process-mobile-card__actions" onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        <>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(r)}>Editar</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(r)}>Excluir</button>
                        </>
                      ) : (
                        <span className="text-secondary small">Toque para ver detalhes</span>
                      )}
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

      <div className="offcanvas offcanvas-end" tabIndex="-1" id="filtersOffcanvas" aria-labelledby="filtersTitle">
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
            <div>
              <label className="form-label">Fase (fluxo)</label>
              <select className="form-select" value={filtro.faseAtual} onChange={(e) => setFiltro((s) => ({ ...s, faseAtual: e.target.value }))}>
                <option value="">Todas</option>
                {PHASES.map((op) => <option key={op.key} value={op.key}>{op.name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Status de prazo</label>
              <select className="form-select" value={filtro.statusPrazo} onChange={(e) => setFiltro((s) => ({ ...s, statusPrazo: e.target.value }))}>
                <option value="">Todos</option>
                {OPT_STATUS_PRAZO.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <div className="form-text">Calculado a partir de prazo.</div>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label className="form-label">De</label>
                <input className="form-control" type="date" value={filtro.de} onChange={(e) => setFiltro((s) => ({ ...s, de: e.target.value }))} />
              </div>
              <div className="col-6">
                <label className="form-label">Ate</label>
                <input className="form-control" type="date" value={filtro.ate} onChange={(e) => setFiltro((s) => ({ ...s, ate: e.target.value }))} />
              </div>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={() => setFiltro({ etapa: '', prioridade: '', tipo: '', faseAtual: '', statusPrazo: '', de: '', ate: '' })}>
                Limpar filtros
              </button>
              <button className="btn btn-light" data-bs-dismiss="offcanvas">
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade modal-tall" id="modalControle" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-6">{editing ? 'Editar processo' : 'Novo processo'}</h1>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" ref={closeRef}></button>
            </div>
            <form onSubmit={onSubmit}>
              <div className="modal-body overflow-auto pb-5" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Numero *</label>
                    <input className="form-control" name="numero" value={form.numero} onChange={onChange} required />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Objeto *</label>
                    <input className="form-control" name="objeto" value={form.objeto} onChange={onChange} required />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Etapa</label>
                    <select className="form-select" name="etapa" value={form.etapa} onChange={onChange}>
                      <option value="">Selecione</option>
                      {OPT_ETAPA.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" name="tipo" value={form.tipo} onChange={onChange}>
                      <option value="">Selecione</option>
                      {OPT_TIPO.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Prioridade</label>
                    <select className="form-select" name="prioridade" value={form.prioridade} onChange={onChange}>
                      <option value="">Selecione</option>
                      {OPT_PRIOR.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Fase inicial</label>
                    <PhaseSelect value={form.faseInicialKey || ''} onChange={(v) => setForm((s) => ({ ...s, faseInicialKey: v }))} />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Prazo</label>
                    <input className="form-control" type="date" name="prazo" value={form.prazo} onChange={onChange} />
                  </div>

                  <div className="col-md-8">
                    <label className="form-label">Responsavel</label>
                    <input className="form-control" name="responsavel" value={form.responsavel} onChange={onChange} />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Anexo (PDF, imagem...)</label>
                    <input className="form-control" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    {form.anexoUrl && (
                      <div className="form-text">
                        Anexo atual: <a href={form.anexoUrl} target="_blank" rel="noreferrer">abrir</a>
                      </div>
                    )}
                  </div>
                  {mostrarJustificativa && (
                    <div className="col-12">
                      <label className="form-label">Justificativa</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        name="justificativa"
                        value={form.justificativa}
                        onChange={onChange}
                        placeholder="Descreva o motivo da suspensao ou revogacao"
                      />
                    </div>
                  )}

                  {mostrarValores && (
                    <>
                      <div className="col-md-6">
                        <label className="form-label">Valor cotado</label>
                        <input className="form-control" name="valorCotado" value={form.valorCotado} onChange={onChange} placeholder="Ex.: 12.345,67" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Valor contratado</label>
                        <input className="form-control" name="valorContratado" value={form.valorContratado} onChange={onChange} placeholder="Ex.: 10.999,99" />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer sticky-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : (editing ? 'Salvar alterações' : 'Cadastrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade modal-tall" id="modalDetalhe" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h1 className="modal-title fs-6 mb-0">Detalhes do processo</h1>
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
                    <StepFlow items={Array.isArray(detail.fluxo) ? detail.fluxo : []} onRemove={removeStep} />
                  </div>

                  <div className="row g-2 align-items-end">
                    <div className="col-md-6">
                      <label className="form-label">Adicionar fase</label>
                      <PhaseSelect value={novaFaseKey} onChange={setNovaFaseKey} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Data</label>
                      <input className="form-control" type="date" value={novaFaseData} onChange={(e) => setNovaFaseData(e.target.value)} />
                    </div>
                    <div className="col-md-3">
                      <button className="btn btn-primary w-100" type="button" onClick={addStep}>Adicionar ao fluxo</button>
                    </div>
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

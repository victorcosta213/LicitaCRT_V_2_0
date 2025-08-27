// src/pages/Controle.jsx
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listarProcessos } from '../services/processos'
import { createDoc, updateById, removeById, findBy } from '../services/db'
import { uploadFile, removeFile } from '../services/files'
import { exportToExcel, exportToPdf } from '../services/export'
import { toInputDate, fromInputDate } from '../utils/dates'
import { computeStatus } from '../utils/status'
import StepFlow from '../components/StepFlow'

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
  anexoPath: ''
}

export default function Controle() {
  const { isAdmin } = useAuth()

  // dataset
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // filtros/busca
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState({ etapa: '', prioridade: '', tipo: '' })

  // formulário (novo/editar)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null) // id
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState(null)
  const closeRef = useRef(null)

  // detalhes/fluxo
  const [detail, setDetail] = useState(null)
  const [stepName, setStepName] = useState('')
  const [stepDate, setStepDate] = useState('')
  const detailCloseRef = useRef(null)

  // carregar (leitura única, igual fluxo antigo)
  async function load() {
    try {
      setLoading(true); setError('')
      const data = await listarProcessos()
      setRows(data)
    } catch (e) {
      console.error(e)
      setError('Falha ao carregar processos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // view filtrada
  const view = rows.filter(r => {
    const okBusca = !busca ||
      (r.numero || '').toLowerCase().includes(busca.toLowerCase()) ||
      (r.objeto || '').toLowerCase().includes(busca.toLowerCase())
    const okEtapa = !filtro.etapa || r.etapa === filtro.etapa
    const okPrior = !filtro.prioridade || r.prioridade === filtro.prioridade
    const okTipo = !filtro.tipo || r.tipo === filtro.tipo
    return okBusca && okEtapa && okPrior && okTipo
  })

  // helpers
  const openModal = (id) => document.getElementById(id)?.click()
  const onChange = (e) => setForm(s => ({ ...s, [e.target.name]: e.target.value }))

  // novo/editar/excluir
  const onNew = () => { setEditing(null); setForm(emptyForm); setFile(null); openModal('btnModalControle') }

  const onEdit = (row) => {
    if (!isAdmin) { alert('Você não tem permissão para editar.'); return }
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
      anexoPath: row.anexoPath || ''
    })
    setFile(null)
    openModal('btnModalControle')
  }

  const onDelete = async (row) => {
    if (!isAdmin) { alert('Você não tem permissão para excluir.'); return }
    if (!confirm('Confirma excluir este registro?')) return
    try {
      if (row.anexoPath) await removeFile(row.anexoPath)
      await removeById(COL, row.id)
      await load()
    } catch (e) {
      console.error(e)
      alert('Falha ao excluir.')
    }
  }

  const validate = (f) => {
    if (!f.numero?.trim()) return 'Informe o número.'
    if (!f.objeto?.trim()) return 'Informe o objeto.'
    return ''
  }

  async function checkDuplicateNumero(numero, currentId) {
    const res = await findBy(COL, 'numero', numero)
    const found = res?.data || []
    return found.some(x => x.id !== currentId)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const v = validate(form)
    if (v) { alert(v); return }
    try {
      setSaving(true)

      if (await checkDuplicateNumero(form.numero, editing)) {
        alert('Já existe um processo com esse número.')
        return
      }

      const payload = {
        ...form,
        prazo: form.prazo ? fromInputDate(form.prazo) : null,
      }

      // upload de anexo (opcional)
      if (file) {
        if (form.anexoPath) { try { await removeFile(form.anexoPath) } catch {} }
        const up = await uploadFile('anexos', file, form.numero || undefined)
        payload.anexoUrl = up.url
        payload.anexoPath = up.path
      }

      if (editing) await updateById(COL, editing, payload)
      else await createDoc(COL, payload)

      await load()
      closeRef.current?.click()
    } catch (e) {
      console.error(e)
      alert('Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  // detalhe/fluxograma
  const onRowClick = (row, ev) => {
    if (ev.target.closest('button') || ev.target.closest('a')) return
    setDetail(row)
    openModal('btnModalDetalhe')
  }

  const addStep = async () => {
    if (!detail) return
    const nome = stepName.trim()
    const data = stepDate ? `${stepDate}T00:00:00` : ''
    if (!nome || !data) { alert('Informe nome da documentação e a data.'); return }

    const fluxo = Array.isArray(detail.fluxo) ? [...detail.fluxo] : []
    fluxo.push({ nome, data })

    try {
      await updateById(COL, detail.id, { fluxo })
      const newRows = rows.map(r => r.id === detail.id ? { ...r, fluxo } : r)
      setRows(newRows)
      setDetail({ ...detail, fluxo })
      setStepName(''); setStepDate('')
    } catch (e) {
      console.error(e)
      alert('Falha ao adicionar passo.')
    }
  }

  const removeStep = async (idx) => {
    if (!detail) return
    const fluxo = Array.isArray(detail.fluxo) ? [...detail.fluxo] : []
    fluxo.splice(idx, 1)
    try {
      await updateById(COL, detail.id, { fluxo })
      const newRows = rows.map(r => r.id === detail.id ? { ...r, fluxo } : r)
      setRows(newRows)
      setDetail({ ...detail, fluxo })
    } catch (e) {
      console.error(e)
      alert('Falha ao remover passo.')
    }
  }

  // exportações
  const doExportExcel = () => exportToExcel(view, 'processos.xlsx')
  const doExportPdf = () =>
    exportToPdf(
      view,
      [
        { header: 'Nº', dataKey: 'numero' },
        { header: 'Objeto', dataKey: 'objeto' },
        { header: 'Etapa', dataKey: 'etapa' },
        { header: 'Tipo', dataKey: 'tipo' },
        { header: 'Prioridade', dataKey: 'prioridade' },
        { header: 'Resp.', dataKey: 'responsavel' },
      ],
      'Processos CRT-03',
      'processos.pdf'
    )

  return (
    <div className="container py-4">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {/* Toolbar */}
          <div className="d-flex flex-wrap justify-content-between align-items-center toolbar mb-3">
            <h1 className="h5 mb-0">Controle de Processos</h1>

            <div className="d-flex flex-wrap toolbar">
              <div className="input-group">
                <span className="input-group-text">🔎</span>
                <input
                  className="form-control"
                  placeholder="Buscar número / objeto…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>

              <button className="btn btn-outline-secondary" data-bs-toggle="offcanvas" data-bs-target="#filtersOffcanvas">
                Filtros
              </button>

              <button className="btn btn-outline-success" onClick={doExportExcel}>Excel</button>
              <button className="btn btn-outline-danger" onClick={doExportPdf}>PDF</button>
              <button className="btn btn-primary" onClick={onNew}>Novo</button>

              {/* triggers invisíveis dos modais */}
              <button id="btnModalControle" className="d-none" data-bs-toggle="modal" data-bs-target="#modalControle"></button>
              <button id="btnModalDetalhe" className="d-none" data-bs-toggle="modal" data-bs-target="#modalDetalhe"></button>
            </div>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {loading && <div className="alert alert-info py-2">Carregando…</div>}

          {/* Tabela */}
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{width:110}}>Nº</th>
                  <th>Objeto</th>
                  <th style={{width:140}}>Etapa</th>
                  <th style={{width:140}}>Tipo</th>
                  <th style={{width:130}}>Prioridade</th>
                  <th style={{width:180}}>Prazo / Status</th>
                  <th style={{width:140}}></th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => {
                  const st = computeStatus(r.prazo)
                  return (
                    <tr key={r.id} onClick={(ev)=>onRowClick(r, ev)} style={{cursor:'pointer'}}>
                      <td>{r.numero}</td>
                      <td className="text-truncate" style={{maxWidth:420}} title={r.objeto}>{r.objeto}</td>
                      <td>{r.etapa || '—'}</td>
                      <td>{r.tipo || '—'}</td>
                      <td>
                        {r.prioridade
                          ? <span className={`badge round text-bg-${r.prioridade === 'Critico' ? 'danger' : 'secondary'}`}>{r.prioridade}</span>
                          : '—'}
                      </td>
                      <td>
                        <div className="d-flex flex-column">
                          <small className="text-secondary">{toInputDate(r.prazo) || '—'}</small>
                          <div>
                            <span className={`badge round text-bg-${st.kind}`}>{st.label}</span>
                            {st.days !== null && (<small className="ms-2 text-secondary">{st.days} dia(s)</small>)}
                          </div>
                        </div>
                      </td>
                      <td className="text-end" onClick={e => e.stopPropagation()}>
                        {isAdmin ? (
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary" onClick={() => onEdit(r)}>Editar</button>
                            <button className="btn btn-outline-danger" onClick={() => onDelete(r)}>Excluir</button>
                          </div>
                        ) : (
                          <span className="text-secondary small">Sem permissão</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!loading && view.length === 0 && (
                  <tr><td colSpan="7" className="text-center text-secondary py-4">Nenhum registro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OFFCANVAS FILTROS */}
      <div className="offcanvas offcanvas-end" tabIndex="-1" id="filtersOffcanvas" aria-labelledby="filtersTitle">
        <div className="offcanvas-header">
          <h5 id="filtersTitle" className="mb-0">Filtros</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          <div className="vstack gap-3">
            <div>
              <label className="form-label">Etapa</label>
              <select className="form-select" value={filtro.etapa} onChange={(e)=>setFiltro(s=>({...s, etapa: e.target.value}))}>
                <option value="">Todas</option>
                <option value="Planejamento">Planejamento</option>
                <option value="Analise">Análise</option>
                <option value="Contratacao">Contratação</option>
              </select>
            </div>
            <div>
              <label className="form-label">Prioridade</label>
              <select className="form-select" value={filtro.prioridade} onChange={(e)=>setFiltro(s=>({...s, prioridade: e.target.value}))}>
                <option value="">Todas</option>
                <option value="Critico">Crítico</option>
                <option value="NaoCritico">Não crítico</option>
              </select>
            </div>
            <div>
              <label className="form-label">Tipo</label>
              <input className="form-control" placeholder="Ex.: Pregão, Dispensa…" value={filtro.tipo} onChange={(e)=>setFiltro(s=>({...s, tipo: e.target.value}))}/>
            </div>
            <button className="btn btn-outline-secondary" onClick={()=>setFiltro({etapa:'', prioridade:'', tipo:''})}>
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      {/* MODAL NOVO/EDITAR */}
      <div className="modal fade" id="modalControle" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-6">{editing ? 'Editar processo' : 'Novo processo'}</h1>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" ref={closeRef}></button>
            </div>
            <form onSubmit={onSubmit}>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Número *</label>
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
                      <option value="Planejamento">Planejamento</option>
                      <option value="Analise">Análise</option>
                      <option value="Contratacao">Contratação</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Tipo</label>
                    <input className="form-control" name="tipo" value={form.tipo} onChange={onChange} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Prioridade</label>
                    <select className="form-select" name="prioridade" value={form.prioridade} onChange={onChange}>
                      <option value="">Selecione</option>
                      <option value="Critico">Crítico</option>
                      <option value="NaoCritico">Não crítico</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Prazo</label>
                    <input className="form-control" type="date" name="prazo" value={form.prazo} onChange={onChange} />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Responsável</label>
                    <input className="form-control" name="responsavel" value={form.responsavel} onChange={onChange} />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Anexo (PDF, imagem…)</label>
                    <input className="form-control" type="file" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
                    {form.anexoUrl && (
                      <div className="form-text">
                        Anexo atual: <a href={form.anexoUrl} target="_blank" rel="noreferrer">abrir</a>
                      </div>
                    )}
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : (editing ? 'Salvar alterações' : 'Cadastrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL DETALHES + FLUXOGRAMA */}
      <div className="modal fade" id="modalDetalhe" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h1 className="modal-title fs-6 mb-0">Detalhes do Processo</h1>
                <small className="text-secondary">
                  {detail ? `Nº ${detail.numero} — ${detail.objeto || ''}` : ''}
                </small>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" ref={detailCloseRef}></button>
            </div>
            <div className="modal-body">
              {detail ? (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-md-3">
                      <div className="p-3 border rounded-3">
                        <div className="text-secondary small">Etapa</div>
                        <div className="fw-semibold">{detail.etapa || '—'}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded-3">
                        <div className="text-secondary small">Tipo</div>
                        <div className="fw-semibold">{detail.tipo || '—'}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded-3">
                        <div className="text-secondary small">Prioridade</div>
                        <div className="fw-semibold">{detail.prioridade || '—'}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 border rounded-3">
                        <div className="text-secondary small">Responsável</div>
                        <div className="fw-semibold">{detail.responsavel || '—'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-2 d-flex align-items-center justify-content-between">
                    <h2 className="h6 mb-0">Fluxograma (documentação por data)</h2>
                  </div>

                  <div className="mb-3">
                    <StepFlow items={Array.isArray(detail.fluxo) ? detail.fluxo : []} onRemove={removeStep} />
                  </div>

                  <div className="row g-2 align-items-end">
                    <div className="col-md-6">
                      <label className="form-label">Nome da documentação</label>
                      <input className="form-control" value={stepName} onChange={e=>setStepName(e.target.value)} placeholder="Ex.: ETP, TR, DFD, Edital..." />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Data</label>
                      <input className="form-control" type="date" value={stepDate} onChange={e=>setStepDate(e.target.value)} />
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

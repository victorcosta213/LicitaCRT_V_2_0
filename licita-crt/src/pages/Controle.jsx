import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listarProcessos } from '../services/processos'
import { createDoc, updateById, removeById, findBy } from '../services/db'
import { uploadFile, removeFile } from '../services/files'
import { exportToExcel, exportToPdf } from '../services/export'
import { toInputDate, fromInputDate } from '../utils/dates'
import { computeStatus } from '../utils/status'
import StepFlow from '../components/StepFlow'
import PhaseSelect from '../components/PhaseSelect'
import { PHASES, phaseNameByKey } from '../utils/phases'

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
  valorContratado: ''
}

const OPT_ETAPA = ['Aberto', 'Em análise', 'Concluído', 'Suspenso', 'Revogado']
const OPT_TIPO  = ['Inexigibilidade', 'Dispensa', 'Dispensa Eletrônica', 'Pregão', 'Concorrência', 'Pronto Pagamento','ARP']
const OPT_PRIOR = ['Crítico', 'Não Crítico', 'Estratégico', 'Alavancável']
const OPT_STATUS_PRAZO = ['Em dia', 'Quase vencendo', 'Atrasado']

export default function Controle() {
  const { isAdmin } = useAuth()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState(() => {
    try {
      const raw = localStorage.getItem('controle.filters')
      return raw ? JSON.parse(raw) : { etapa:'', prioridade:'', tipo:'', faseAtual:'', statusPrazo:'', de:'', ate:'' }
    } catch {
      return { etapa:'', prioridade:'', tipo:'', faseAtual:'', statusPrazo:'', de:'', ate:'' }
    }
  })
  useEffect(() => {
    localStorage.setItem('controle.filters', JSON.stringify(filtro))
  }, [filtro])

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
      setLoading(true); setError('')
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
    return rows.filter(r => {
      const txt = (r.numero || '') + ' ' + (r.objeto || '')
      const okBusca = !busca || txt.toLowerCase().includes(busca.toLowerCase())
      const okEtapa = !filtro.etapa || (r.etapa || r.statusGeral || '') === filtro.etapa
      const okPrior = !filtro.prioridade || (r.prioridade || '') === filtro.prioridade
      const okTipo  = !filtro.tipo || (r.tipo || '') === filtro.tipo

      let okFase = true
      if (filtro.faseAtual) {
        const faseNome = phaseNameByKey(filtro.faseAtual)
        const etapa = (r.etapa || '').toString()
        const fluxo = Array.isArray(r.fluxo) ? r.fluxo : []
        okFase = etapa === faseNome || fluxo.some(f => (f.nome || '') === faseNome)
      }

      const stPrazo = computeStatus(r.prazo).label
      const okPrazo = !filtro.statusPrazo || stPrazo === filtro.statusPrazo

      const toDate = (d) => d?.toDate?.() ?? (d ? new Date(d) : null)
      const baseDate = toDate(r.dataInicioProcesso) || toDate(r.createdAt) || null

      let okPeriodo = true
      if ((filtro.de || filtro.ate) && baseDate) {
        const ymd = (d) => d.toISOString().slice(0,10)
        if (filtro.de  && ymd(baseDate) < filtro.de) okPeriodo = false
        if (filtro.ate && ymd(baseDate) > filtro.ate) okPeriodo = false
      } else if ((filtro.de || filtro.ate) && !baseDate) {
        okPeriodo = false
      }

      return okBusca && okEtapa && okPrior && okTipo && okFase && okPrazo && okPeriodo
    })
  }, [rows, busca, filtro])

  const openModal = (id) => document.getElementById(id)?.click()
  const onChange = (e) => setForm(s => ({ ...s, [e.target.name]: e.target.value }))

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
      anexoPath: row.anexoPath || '',
      faseInicialKey: '',
      justificativa: row.justificativa || '',
      valorCotado: row.valorCotado || '',
      valorContratado: row.valorContratado || ''
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
    } catch {
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
        prazo: form.prazo ? fromInputDate(form.prazo) : null
      }

      if (!editing) {
        const faseInicialKey = form.faseInicialKey || null
        const fluxoInicial = faseInicialKey ? [{ nome: phaseNameByKey(faseInicialKey), data: new Date().toISOString() }] : []
        payload.fluxo = fluxoInicial
        if (fluxoInicial.length) payload.etapa = fluxoInicial[0].nome
      }

      if (file) {
        try {
          if (form.anexoPath) { try { await removeFile(form.anexoPath) } catch {} }
          const up = await uploadFile('anexos', file, form.numero || undefined)
          payload.anexoUrl = up.url
          payload.anexoPath = up.path
        } catch {
          alert('Falha ao enviar o anexo.')
        }
      }

      if (editing) await updateById(COL, editing, payload)
      else await createDoc(COL, payload)

      await load()
      closeRef.current?.click()
    } catch {
      alert('Falha ao salvar.')
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
    if (!novaFaseKey || !data) { alert('Selecione a fase e a data.'); return }

    const fluxo = Array.isArray(detail.fluxo) ? [...detail.fluxo] : []
    fluxo.push({ nome, data })

    try {
      await updateById(COL, detail.id, { fluxo, etapa: nome })
      const newRows = rows.map(r => r.id === detail.id ? { ...r, fluxo, etapa: nome } : r)
      setRows(newRows)
      setDetail({ ...detail, fluxo, etapa: nome })
      setNovaFaseKey(''); setNovaFaseData('')
    } catch {
      alert('Falha ao adicionar fase.')
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
    } catch {
      alert('Falha ao remover fase.')
    }
  }

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
        { header: 'Resp.', dataKey: 'responsavel' }
      ],
      'Processos CRT-03',
      'processos.pdf'
    )

  const mostrarJustificativa = ['Revogado', 'Suspenso'].includes(form.etapa || '')
  const mostrarValores = ['Dispensa', 'Dispensa Eletrônica'].includes(form.tipo || '')

  const showValoresInDetail = (p) =>
    ['Dispensa', 'Dispensa Eletrônica'].includes(p?.tipo || '') ||
    !!(p?.valorCotado || p?.valorContratado)

  return (
    <div className="container py-4">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center toolbar mb-3">
            <h1 className="h5 mb-0">Controle de Processos</h1>

            <div className="d-flex flex-wrap toolbar gap-2">
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

              <button id="btnModalControle" className="d-none" data-bs-toggle="modal" data-bs-target="#modalControle"></button>
              <button id="btnModalDetalhe" className="d-none" data-bs-toggle="modal" data-bs-target="#modalDetalhe"></button>
            </div>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {loading && <div className="alert alert-info py-2">Carregando…</div>}

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
                      <td className="text-truncate w-420" title={r.objeto}>{r.objeto}</td>
                      <td>{r.etapa || r.statusGeral || '—'}</td>
                      <td>{r.tipo || '—'}</td>
                      <td>
                        {r.prioridade
                          ? <span className={`badge round text-bg-${r.prioridade === 'Crítico' || r.prioridade === 'Critico' ? 'danger' : 'secondary'}`}>{r.prioridade}</span>
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

      <div className="offcanvas offcanvas-end" tabIndex="-1" id="filtersOffcanvas" aria-labelledby="filtersTitle">
        <div className="offcanvas-header">
          <h5 id="filtersTitle" className="mb-0">Filtros</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          <div className="vstack gap-3">
            <div>
              <label className="form-label">Etapa</label>
              <select className="form-select"
                value={filtro.etapa}
                onChange={(e)=>setFiltro(s=>({...s, etapa: e.target.value}))}>
                <option value="">Todas</option>
                {OPT_ETAPA.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Tipo de Licitação</label>
              <select className="form-select"
                value={filtro.tipo}
                onChange={(e)=>setFiltro(s=>({...s, tipo: e.target.value}))}>
                <option value="">Todos</option>
                {OPT_TIPO.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Prioridade</label>
              <select className="form-select"
                value={filtro.prioridade}
                onChange={(e)=>setFiltro(s=>({...s, prioridade: e.target.value}))}>
                <option value="">Todas</option>
                {OPT_PRIOR.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Fase (fluxo)</label>
              <select className="form-select"
                value={filtro.faseAtual}
                onChange={(e)=>setFiltro(s=>({...s, faseAtual: e.target.value}))}>
                <option value="">Todas</option>
                {PHASES.map(op => <option key={op.key} value={op.key}>{op.name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Status de Prazo</label>
              <select className="form-select"
                value={filtro.statusPrazo}
                onChange={(e)=>setFiltro(s=>({...s, statusPrazo: e.target.value}))}>
                <option value="">Todos</option>
                {OPT_STATUS_PRAZO.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <div className="form-text">
                Calculado a partir de prazo (Em dia / Quase vencendo / Atrasado)
              </div>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label className="form-label">De</label>
                <input className="form-control" type="date"
                  value={filtro.de}
                  onChange={(e)=>setFiltro(s=>({...s, de: e.target.value}))}/>
              </div>
              <div className="col-6">
                <label className="form-label">Até</label>
                <input className="form-control" type="date"
                  value={filtro.ate}
                  onChange={(e)=>setFiltro(s=>({...s, ate: e.target.value}))}/>
              </div>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary"
                onClick={()=>setFiltro({ etapa:'', prioridade:'', tipo:'', faseAtual:'', statusPrazo:'', de:'', ate:'' })}>
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
                      {OPT_ETAPA.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" name="tipo" value={form.tipo} onChange={onChange}>
                      <option value="">Selecione</option>
                      {OPT_TIPO.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Prioridade</label>
                    <select className="form-select" name="prioridade" value={form.prioridade} onChange={onChange}>
                      <option value="">Selecione</option>
                      {OPT_PRIOR.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Fase inicial</label>
                    <PhaseSelect value={form.faseInicialKey || ''} onChange={(v)=>setForm(s=>({...s, faseInicialKey:v}))} />
                  </div>

                  <div className="col-md-6">
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

                  {mostrarJustificativa && (
                    <div className="col-12">
                      <label className="form-label">Justificativa</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        name="justificativa"
                        value={form.justificativa}
                        onChange={onChange}
                        placeholder="Descreva o motivo da suspensão/revogação"
                      />
                    </div>
                  )}

                  {mostrarValores && (
                    <>
                      <div className="col-md-6">
                        <label className="form-label">Valor cotado</label>
                        <input
                          className="form-control"
                          name="valorCotado"
                          value={form.valorCotado}
                          onChange={onChange}
                          placeholder="Ex.: 12.345,67"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Valor contratado</label>
                        <input
                          className="form-control"
                          name="valorContratado"
                          value={form.valorContratado}
                          onChange={onChange}
                          placeholder="Ex.: 10.999,99"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer sticky-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : (editing ? 'Salvar alterações' : 'Cadastrar')}
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
                <h1 className="modal-title fs-6 mb-0">Detalhes do Processo</h1>
                <small className="text-secondary">
                  {detail ? `Nº ${detail.numero} — ${detail.objeto || ''}` : ''}
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
                        <div className="fw-semibold">{detail.etapa || detail.statusGeral || '—'}</div>
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
                          <div className="fw-semibold">{detail.valorCotado || '—'}</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="p-3 border rounded-3">
                          <div className="text-secondary small">Valor contratado</div>
                          <div className="fw-semibold">{detail.valorContratado || '—'}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mb-2 d-flex align-items-center justify-content-between">
                    <h2 className="h6 mb-0">Fluxograma (documentação por data)</h2>
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
                      <input className="form-control" type="date" value={novaFaseData} onChange={e=>setNovaFaseData(e.target.value)} />
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

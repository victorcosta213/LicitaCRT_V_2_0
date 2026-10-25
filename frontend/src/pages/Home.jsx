import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAtualizacaoAutomatica } from '../components/useAtualizacao'
import { Link } from 'react-router-dom'
import { listarProcessos, atualizarProcesso } from '../services/processos'
import { useAuth } from '../context/AuthContext'
import { can } from '../utils/permissions'
import { DOC_STEPS, getDocDegree } from '../utils/phases'
import { normalizePriority } from '../utils/priority'
import Swal from 'sweetalert2'
import './home.css'

function isClosed(etapa) {
  const e = (etapa || '').toString().toLowerCase()
  return ['concluido', 'concluído', 'suspenso', 'revogado', 'fechado', 'finalizado'].includes(e)
}

export default function Home() {
  const { role } = useAuth()
  const podeEditar = can(role, 'processo.editar')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedProcess, setSelectedProcess] = useState(null)
  const [localDoc, setLocalDoc] = useState('')
  const [savingDoc, setSavingDoc] = useState(false)

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setLoading(true)
      setRows(await listarProcessos())
    } catch (err) {
      console.error(err)
      if (!silencioso) Swal.fire('Erro', 'Não foi possível carregar os processos.', 'error')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useAtualizacaoAutomatica(['processos'], () => carregar({ silencioso: true }))

  const ativos = useMemo(
    () => rows.filter((p) => !isClosed(p?.etapa || p?.statusGeral)),
    [rows]
  )

  const view = ativos

  const handleOpen = (p) => {
    setSelectedProcess(p)
    setLocalDoc(p.localDocumentacao || '')
  }

  const handleClose = () => {
    setSelectedProcess(null)
    setLocalDoc('')
  }

  const handleSaveDoc = async () => {
    if (!selectedProcess) return
    setSavingDoc(true)
    try {
      await atualizarProcesso(selectedProcess.id, { localDocumentacao: localDoc })
      setRows(rows.map(r => r.id === selectedProcess.id ? { ...r, localDocumentacao: localDoc } : r))
      Swal.fire({ title: 'Salvo!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 })
    } catch (err) {
      console.error(err)
      Swal.fire('Erro', 'Não foi possível salvar', 'error')
    } finally {
      setSavingDoc(false)
    }
  }

  const handleConcluir = async () => {
    if (!selectedProcess) return
    const res = await Swal.fire({
      title: 'Concluir Processo?',
      text: `Deseja marcar o processo ${selectedProcess.numero || 'sem número'} como concluído? Ele sairá da tela principal.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, concluir',
      cancelButtonText: 'Cancelar'
    })
    
    if (res.isConfirmed) {
      try {
        await atualizarProcesso(selectedProcess.id, { etapa: 'Concluido' })
        setRows(rows.map(r => r.id === selectedProcess.id ? { ...r, etapa: 'Concluido' } : r))
        Swal.fire({ title: 'Concluído!', text: 'O processo foi finalizado.', icon: 'success', timer: 2000, showConfirmButton: false })
        handleClose()
      } catch (err) {
        console.error(err)
        Swal.fire('Erro', 'Não foi possível concluir', 'error')
      }
    }
  }

  return (
    <div className="home-page">

      <header className="cabecalho mb-0">
        <div className="cabecalho__texto">
          <h1 className="cabecalho__titulo">Quadro de prioridades</h1>
          <p className="cabecalho__sub">Processos ativos por criticidade. Em cada coluna, os que estão mais no início da documentação aparecem primeiro.</p>
        </div>
        <div className="home-total">
          <span className="rotulo">Processos ativos</span>
          <strong>{loading ? '…' : ativos.length}</strong>
        </div>
      </header>

      {loading && <div className="alert alert-info">Carregando…</div>}
      {!loading && view.length === 0 && (
        <div className="alert alert-light">Nenhum processo ativo encontrado.</div>
      )}

      <section className="home-kanban-board">
        {['Critico', 'Estrategico', 'Alavancavel', 'Nao Critico', 'Sem Prioridade'].map(col => {
          let colProcs = view.filter(p => {
            const pr = p.prioridade || 'Sem Prioridade'
            return pr === col
          })

          colProcs.sort((a, b) => getDocDegree(a.localDocumentacao) - getDocDegree(b.localDocumentacao))

          return (
            <div key={col} className="kanban-column" data-priority={col}>
              <div className="kanban-column__header">
                <span className="kanban-column__titulo"><i aria-hidden="true" />{col === 'Nao Critico' ? 'Não crítico' : col === 'Critico' ? 'Crítico' : col === 'Estrategico' ? 'Estratégico' : col === 'Alavancavel' ? 'Alavancável' : 'Sem prioridade'}</span>
                <span className="kanban-column__n">{colProcs.length}</span>
              </div>
              <div className="kanban-column__body">
                {colProcs.map(p => {
                  const docText = p.localDocumentacao 
                    ? DOC_STEPS.find(d => d.value === p.localDocumentacao)?.label || String(p.localDocumentacao)
                    : 'Não informado'
                  return (
                    <article
                      key={p.id}
                      className="kanban-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpen(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(p) } }}
                      aria-label={`Processo ${p.numero || ''}: ${p.objeto || ''}`}
                    >
                      <div className="kcard-top">
                        <span className="kcard-number">{p.numero || '—'}</span>
                        <i className="bi bi-chevron-right kcard-seta" aria-hidden="true" />
                      </div>
                      <h3 className="kcard-title" title={p.objeto}>{p.objeto || '—'}</h3>
                      <div className="kcard-meta">
                        <span className="kcard-phase text-truncate" title={`Documentação: ${docText}`}>{docText}</span>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      {selectedProcess && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title">Processo <span className="mono">{selectedProcess.numero || '—'}</span></h5>
                <button type="button" className="btn-close" onClick={handleClose}></button>
              </div>
              <div className="modal-body">
                <p className="fw-semibold mb-2">{selectedProcess.objeto || 'Objeto não informado'}</p>
                <div className="d-flex flex-wrap gap-2 mb-4">
                  <span className="carimbo carimbo--secondary">{selectedProcess.tipo || 'Sem tipo'}</span>
                  <span className="carimbo carimbo--primary">{selectedProcess.etapa || 'Aberta'}</span>
                  <span className="carimbo carimbo--warning">{selectedProcess.prioridade ? normalizePriority(selectedProcess.prioridade) : 'Sem prioridade'}</span>
                </div>

                <div className="mb-4">
                  <label className="form-label">Em qual documentação está?</label>
                  <div className="input-group">
                    <select
                      className="form-select"
                      value={localDoc}
                      onChange={(e) => setLocalDoc(e.target.value)}
                      disabled={!podeEditar}
                    >
                      <option value="">Não informado</option>
                      {DOC_STEPS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                    {podeEditar && (
                      <button className="btn btn-outline-primary" onClick={handleSaveDoc} disabled={savingDoc}>
                        {savingDoc ? 'Salvando…' : 'Salvar'}
                      </button>
                    )}
                  </div>
                  <div className="form-text">Atualize onde o processo está parado no momento.</div>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 justify-content-between">
                <Link className="btn btn-outline-secondary" to={`/controle?pid=${selectedProcess.id}`}>
                  Abrir em Processos <i className="bi bi-box-arrow-up-right ms-2"/>
                </Link>
                {podeEditar && (
                  <button className="btn btn-success" onClick={handleConcluir}>
                    <i className="bi bi-check-circle me-2"/> Marcar como concluído
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

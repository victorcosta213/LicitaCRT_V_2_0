import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Empty, PageHeader, Pill } from '../components/gc/ui'
import AbrirProcessoModal from '../components/compras/AbrirProcessoModal'
import { useMarcas } from '../components/compras/useMarcas'
import { useDocumentos } from '../components/useDocumentos'
import { useTramitacao } from '../components/useTramitacao'
import { checklistDoProcesso, resumoChecklist } from '../modelos/artefatos'
import { MODALIDADES, rotuloDo } from '../modelos/variantes'
import { mensagemErroSolicitacao, registrarProcessoContratacao } from '../services/solicitacoes'
import { can } from '../utils/permissions'
import { fmtDate } from '../utils/format'
import { showSuccess } from '../utils/alerts'
import { PRIORIDADES } from '../utils/tramitacao'
import { AvisoTramitacaoAusente } from './Processos'
import './compras.css'

const VISTAS = [['andamento', 'Em andamento'], ['sem-forma', 'Sem forma definida'], ['concluidos', 'Concluídos'], ['todos', 'Todos']]
const ehContratacao = (p) => p.tipo === 'Contratação' || !!p.contratacao_modalidade
const curto = (m) => rotuloDo(MODALIDADES, m).replace(/\s*\(.*\)$/, '')

// Processos de contratação: forma escolhida, onde está e quanto do roteiro da Lei 14.133/2021 já foi cumprido
export default function ProcessosContratacao() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { carregando, erro, ausente, processos, unidades, unidadesPorId } = useTramitacao()
  const { documentos } = useDocumentos()
  const { marcas } = useMarcas()
  const [busca, setBusca] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const vista = VISTAS.some(([k]) => k === sp.get('vista')) ? sp.get('vista') : 'andamento'

  const linhas = useMemo(() => processos.filter(ehContratacao).map((p) => {
    const ch = checklistDoProcesso(p.contratacao_modalidade, documentos.filter((d) => d.processo_id === p.id),
      { marcas: marcas.filter((m) => m.processo_id === p.id), objeto: p.contratacao_objeto })
    return { p, resumo: ch ? resumoChecklist(ch) : null }
  }), [processos, documentos, marcas])

  const naVista = (l, k) => (k === 'andamento' ? l.p.situacao === 'em_andamento'
    : k === 'sem-forma' ? l.p.situacao === 'em_andamento' && !l.p.contratacao_modalidade
      : k === 'concluidos' ? l.p.situacao === 'concluido' : true)
  const q = busca.trim().toLowerCase()
  const lista = linhas.filter((l) => naVista(l, vista)
    && (!q || [l.p.numero, l.p.assunto, l.p.interessado].some((v) => String(v || '').toLowerCase().includes(q))))
  const podeLancar = can(role, 'compras.registrar')

  async function registrar(v) {
    try {
      const id = await registrarProcessoContratacao(v)
      showSuccess('Processo de contratação aberto.')
      navigate(`/processos/${id}`)
    } catch (err) { throw new Error(mensagemErroSolicitacao(err)) }
  }
  const mudarVista = (k) => {
    const n = new URLSearchParams(sp)
    if (k === 'andamento') n.delete('vista'); else n.set('vista', k)
    setSp(n, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Processos de contratação"
        subtitle="Cada processo com a forma de contratação, onde está agora e quantos documentos obrigatórios da Lei 14.133/2021 já estão prontos."
        actions={(
          <>
            <Link to="/compras/roteiros" className="btn btn-outline-secondary"><i className="bi bi-list-check me-2" />Documentos por tipo de processo</Link>
            {podeLancar && <button type="button" className="btn btn-outline-primary" onClick={() => setRegistrando(true)}><i className="bi bi-folder-plus me-2" />Lançar processo antigo</button>}
          </>
        )}
      />

      {ausente && <AvisoTramitacaoAusente />}
      {!ausente && erro && <div className="alert alert-danger">Não foi possível carregar os processos: {erro}</div>}
      {!ausente && !erro && (
        <div className="card">
          <div className="barra-lista">
            <div className="segmentos" role="tablist" aria-label="Vistas">
              {VISTAS.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={vista === key} className={`segmento ${vista === key ? 'ativo' : ''}`} onClick={() => mudarVista(key)}>
                  {label}<span className="segmento__n">{linhas.filter((l) => naVista(l, key)).length}</span>
                </button>
              ))}
            </div>
            <div className="barra-lista__busca">
              <i className="bi bi-search" aria-hidden="true" />
              <input className="form-control" placeholder="Protocolo, objeto ou setor" aria-label="Buscar processos de contratação" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle gc-table">
              <thead><tr><th>Processo</th><th>Forma</th><th>Onde está</th><th>Documentos obrigatórios</th><th>Prazo</th></tr></thead>
              <tbody>
                {carregando && <tr><td colSpan="5" className="text-center py-4 text-secondary">Carregando processos…</td></tr>}
                {!carregando && lista.length === 0 && (
                  <tr><td colSpan="5">
                    <Empty icon="bi-folder2-open">
                      {linhas.length ? 'Nenhum processo nesta vista.' : (
                        <span className="vazio-acao">
                          <span>Nenhum processo de contratação ainda. Eles nascem das DFDs das secretarias aceitas pelo Compras.</span>
                          <Link to="/solicitacoes" className="btn btn-primary">Ver DFDs recebidas</Link>
                        </span>
                      )}
                    </Empty>
                  </td></tr>
                )}
                {lista.map(({ p, resumo }) => {
                  const u = unidadesPorId.get(p.unidade_atual)
                  const pr = PRIORIDADES[p.prioridade]
                  const pct = resumo?.total ? Math.round((resumo.prontos / resumo.total) * 100) : 0
                  return (
                    <tr key={p.id} className="gc-row-link" onClick={() => navigate(`/processos/${p.id}`)}>
                      <td style={{ maxWidth: 380 }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="mono fw-semibold">{p.numero}</span>
                          {pr && p.prioridade !== 'normal' && <Pill kind={pr.kind}>{pr.label}</Pill>}
                          {p.situacao === 'concluido' && <Pill kind="secondary">Concluído</Pill>}
                        </div>
                        <div className="text-truncate">{p.assunto}</div>
                        <div className="small text-secondary">{p.interessado || '—'}</div>
                      </td>
                      <td className="small">{p.contratacao_modalidade ? curto(p.contratacao_modalidade) : <span className="text-warning-emphasis">A definir</span>}</td>
                      <td className="small" title={u?.nome}>{u?.sigla || '—'}</td>
                      <td style={{ minWidth: 200 }}>
                        {resumo ? (
                          <>
                            <div className="small"><strong>{resumo.prontos}</strong> de {resumo.total}{resumo.proximo ? <span className="text-secondary"> · falta: {resumo.proximo.nome}</span> : <span className="text-success"> · completo</span>}</div>
                            <div className="progress mt-1" style={{ height: 6 }} role="progressbar" aria-label={`Documentos de ${p.numero}`} aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
                              <div className="progress-bar bg-success" style={{ width: `${pct}%` }} />
                            </div>
                          </>
                        ) : <span className="small text-secondary">Defina a forma de contratação</span>}
                      </td>
                      <td className="small">{p.prazo ? fmtDate(p.prazo) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {registrando && <AbrirProcessoModal unidades={unidades} onSubmit={registrar} onClose={() => setRegistrando(false)} />}
    </>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Empty, PageHeader, Pill } from '../components/gc/ui'
import PrimeirosPassos from '../components/gc/PrimeirosPassos'
import AbrirProcessoModal from '../components/compras/AbrirProcessoModal'
import { useSolicitacoes } from '../components/useSolicitacoes'
import { useTramitacao } from '../components/useTramitacao'
import { mensagemErroSolicitacao, registrarProcessoContratacao } from '../services/solicitacoes'
import { can } from '../utils/permissions'
import { fmtDate, fmtDateTime } from '../utils/format'
import { showSuccess } from '../utils/alerts'
import { PRIORIDADES } from '../utils/tramitacao'
import { STATUS_SOL, TIPOS_SOL, combinaBuscaSol, naVistaSol, ordenarSolicitacoes, vistasSol } from '../utils/solicitacoes'
import './documentos.css'
import './compras.css'

export const AvisoSolicitacoesAusente = () => (
  <div className="alert alert-warning">
    <h2 className="h6 fw-bold">As solicitações ao Compras ainda não foram ativadas</h2>
    <p className="mb-0">
      Peça ao administrador para aplicar no banco de dados o arquivo <code>backend/supabase/migrations/20261025_solicitacoes_compras.sql</code> e recarregue a página.
    </p>
  </div>
)

export default function Solicitacoes() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { carregando, erro, ausente, solicitacoes } = useSolicitacoes()
  const { unidades, unidadesPorId } = useTramitacao()
  const [busca, setBusca] = useState('')
  const [registrando, setRegistrando] = useState(false)

  const ehCompras = can(role, 'compras.analisar')
  const podeSolicitar = can(role, 'compras.solicitar')
  const vistas = vistasSol(ehCompras)
  const vista = vistas.some(([k]) => k === sp.get('vista')) ? sp.get('vista') : vistas[0][0]

  const contagem = useMemo(() => Object.fromEntries(vistas.map(([k]) => [k, solicitacoes.filter((s) => naVistaSol(s, k)).length])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solicitacoes, ehCompras])
  const lista = useMemo(() => ordenarSolicitacoes(solicitacoes.filter((s) => naVistaSol(s, vista) && combinaBuscaSol(s, busca, unidadesPorId))),
    [solicitacoes, vista, busca, unidadesPorId])

  const mudarVista = (k) => {
    const n = new URLSearchParams(sp)
    if (k === vistas[0][0]) n.delete('vista'); else n.set('vista', k)
    setSp(n, { replace: true })
  }

  async function registrar(v) {
    try {
      const id = await registrarProcessoContratacao(v)
      showSuccess('Processo de contratação aberto.')
      navigate(`/processos/${id}`)
    } catch (err) { throw new Error(mensagemErroSolicitacao(err)) }
  }

  return (
    <>
      <PageHeader
        title={ehCompras ? 'DFDs recebidas' : 'Pedidos ao Compras'}
        subtitle={ehCompras
          ? 'DFDs enviadas pelas secretarias. Analise, devolva para ajuste ou abra o processo de contratação.'
          : 'As DFDs da sua secretaria enviadas ao Compras e a resposta de cada uma.'}
        actions={(
          <>
            {can(role, 'compras.registrar') && <button type="button" className="btn btn-outline-primary" onClick={() => setRegistrando(true)}><i className="bi bi-folder-plus me-2" />Lançar processo antigo</button>}
            {podeSolicitar && <Link to="/solicitacoes/nova" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-2" />Nova DFD</Link>}
          </>
        )}
      />

      {!carregando && <PrimeirosPassos tipo="solicitacoes" abertoPorPadrao={solicitacoes.length === 0} />}

      {ausente && <AvisoSolicitacoesAusente />}
      {!ausente && erro && <div className="alert alert-danger">Não foi possível carregar as solicitações: {erro}</div>}

      {!ausente && !erro && (
        <div className="card">
          <div className="barra-lista">
            <div className="segmentos" role="tablist" aria-label="Vistas">
              {vistas.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={vista === key}
                  className={`segmento ${vista === key ? 'ativo' : ''}`} onClick={() => mudarVista(key)}>
                  {label}<span className="segmento__n">{contagem[key]}</span>
                </button>
              ))}
            </div>
            <div className="barra-lista__busca">
              <i className="bi bi-search" aria-hidden="true" />
              <input className="form-control" placeholder="Número, objeto, setor ou quem pediu" aria-label="Buscar solicitações"
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle gc-table">
              <thead><tr><th>Solicitação</th><th>Setor</th><th>Prioridade</th><th>Situação</th><th>Enviada</th></tr></thead>
              <tbody>
                {carregando && <tr><td colSpan="5" className="text-center py-4 text-secondary">Carregando solicitações…</td></tr>}
                {!carregando && lista.length === 0 && (
                  <tr><td colSpan="5">
                    <Empty icon={solicitacoes.length ? 'bi-search' : 'bi-send'}>
                      {solicitacoes.length ? 'Nenhuma solicitação nesta vista. Troque a vista ou limpe a busca.' : (
                        <span className="vazio-acao">
                          <span>{ehCompras ? 'Nenhuma DFD recebida ainda.' : 'Sua secretaria ainda não enviou DFDs ao Compras.'}</span>
                          {podeSolicitar && !ehCompras && <Link to="/solicitacoes/nova" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-2" />Fazer a primeira DFD</Link>}
                        </span>
                      )}
                    </Empty>
                  </td></tr>
                )}
                {lista.map((s) => {
                  const st = STATUS_SOL[s.status]
                  const u = unidadesPorId.get(s.unidade_id)
                  const pr = PRIORIDADES[s.prioridade]
                  return (
                    <tr key={s.id} className="gc-row-link" onClick={() => navigate(`/solicitacoes/${s.id}`)}>
                      <td style={{ maxWidth: 420 }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="mono fw-semibold">{s.numero}</span>
                          <span className="small text-secondary">{TIPOS_SOL[s.tipo]}</span>
                        </div>
                        <div className="text-truncate">{s.objeto}</div>
                        <div className="small text-secondary">{s.solicitante_nome}{s.data_pretendida ? ` · para ${fmtDate(s.data_pretendida)}` : ''}</div>
                      </td>
                      <td className="small" title={u?.nome}>{u?.sigla || '—'}</td>
                      <td>{pr ? <Pill kind={pr.kind}>{pr.label}</Pill> : '—'}</td>
                      <td><Pill kind={st.kind}>{st.label}</Pill></td>
                      <td className="small text-secondary">{fmtDateTime(s.enviada_em)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 small text-secondary border-top">{lista.length} de {solicitacoes.length} solicitação(ões)</div>
        </div>
      )}

      {registrando && <AbrirProcessoModal unidades={unidades} onSubmit={registrar} onClose={() => setRegistrando(false)} />}
    </>
  )
}

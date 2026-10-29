import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Empty, PageHeader, Pill } from '../components/gc/ui'
import PrimeirosPassos from '../components/gc/PrimeirosPassos'
import { useDocumentos } from '../components/useDocumentos'
import { useTramitacao } from '../components/useTramitacao'
import { modeloPorCodigo } from '../modelos/catalogo'
import { can } from '../utils/permissions'
import { fmtDateTime } from '../utils/format'
import { STATUS, VISTAS_DOC, combinaBuscaDoc, naVistaDoc, ordenarDocumentos, pendentesDoUsuario } from '../utils/documentosPlataforma'
import './documentos.css'

export const AvisoDocumentosAusente = () => (
  <div className="alert alert-warning">
    <h2 className="h6 fw-bold">Os documentos ainda não foram ativados</h2>
    <p className="mb-0">
      Peça ao administrador para aplicar no banco de dados os arquivos <code>backend/supabase/migrations/20261023_perfis_setoriais.sql</code> e{' '}
      <code>20261024_documentos_assinatura.sql</code> e recarregue a página.
    </p>
  </div>
)

const nomeDoModelo = (codigo) => modeloPorCodigo(codigo)?.nome || codigo

export default function Documentos() {
  const { user, profile, role } = useAuth()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { carregando, erro, ausente, documentos, assinaturas } = useDocumentos()
  const { processos } = useTramitacao()
  const [busca, setBusca] = useState('')

  const vista = VISTAS_DOC.some(([k]) => k === sp.get('vista')) ? sp.get('vista') : 'todos'
  const processosPorId = useMemo(() => new Map(processos.map((p) => [p.id, p])), [processos])
  const pendentes = useMemo(() => pendentesDoUsuario(documentos, assinaturas, user?.id), [documentos, assinaturas, user])
  const idsPendentes = useMemo(() => new Set(pendentes.map((p) => p.documento.id)), [pendentes])
  const ctx = { usuarioId: user?.id, unidadeId: profile?.unidade_id, pendentes: idsPendentes }

  const contagem = useMemo(
    () => Object.fromEntries(VISTAS_DOC.map(([k]) => [k, documentos.filter((d) => naVistaDoc(d, k, ctx)).length])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentos, user, profile, idsPendentes],
  )
  const lista = useMemo(
    () => ordenarDocumentos(documentos.filter((d) => naVistaDoc(d, vista, ctx) && combinaBuscaDoc(d, busca, processosPorId, nomeDoModelo))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentos, vista, busca, processosPorId, user, profile, idsPendentes],
  )

  const mudarVista = (k) => {
    const n = new URLSearchParams(sp)
    if (k === 'todos') n.delete('vista'); else n.set('vista', k)
    setSp(n, { replace: true })
  }
  const podeCriar = can(role, 'documento.criar')

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle="Crie ofícios, despachos, pareceres e os documentos da Lei 14.133/2021, envie para assinatura eletrônica e confira a autenticidade."
        actions={podeCriar && (
          <Link to="/documentos/novo" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-2" />Novo documento</Link>
        )}
      />

      {!carregando && <PrimeirosPassos tipo="documentos" abertoPorPadrao={documentos.length === 0} />}

      {ausente && <AvisoDocumentosAusente />}
      {!ausente && erro && <div className="alert alert-danger">Não foi possível carregar os documentos: {erro}</div>}

      {!ausente && !erro && (
        <div className="card">
          <div className="barra-lista">
            <div className="segmentos" role="tablist" aria-label="Vistas">
              {VISTAS_DOC.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={vista === key}
                  className={`segmento ${vista === key ? 'ativo' : ''}`} onClick={() => mudarVista(key)}>
                  {label}<span className="segmento__n">{contagem[key]}</span>
                </button>
              ))}
            </div>
            <div className="barra-lista__busca">
              <i className="bi bi-search" aria-hidden="true" />
              <input className="form-control" placeholder="Número, título, autor, tipo ou processo" aria-label="Buscar documentos"
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle gc-table">
              <thead><tr><th>Documento</th><th>Tipo</th><th>Processo</th><th>Situação</th><th>Atualizado</th></tr></thead>
              <tbody>
                {carregando && <tr><td colSpan="5" className="text-center py-4 text-secondary">Carregando documentos…</td></tr>}
                {!carregando && lista.length === 0 && (
                  <tr><td colSpan="5">
                    <Empty icon={documentos.length ? 'bi-search' : 'bi-file-earmark-richtext'}>
                      {documentos.length ? 'Nenhum documento nesta vista. Troque a vista ou limpe a busca.' : (
                        <span className="vazio-acao">
                          <span>Ainda não há documentos.{podeCriar ? ' Crie o primeiro a partir de um modelo.' : ''}</span>
                          {podeCriar && <Link to="/documentos/novo" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-2" />Criar o primeiro documento</Link>}
                        </span>
                      )}
                    </Empty>
                  </td></tr>
                )}
                {lista.map((d) => {
                  const st = STATUS[d.status]
                  const proc = processosPorId.get(d.processo_id)
                  return (
                    <tr key={d.id} className="gc-row-link" onClick={() => navigate(`/documentos/${d.id}`)}>
                      <td style={{ maxWidth: 380 }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="mono fw-semibold">{d.numero}</span>
                          {idsPendentes.has(d.id) && <Pill kind="warning">Assine</Pill>}
                        </div>
                        <div className="text-truncate">{d.titulo}</div>
                        <div className="small text-secondary">{d.criado_por_nome}</div>
                      </td>
                      <td className="small">{nomeDoModelo(d.modelo)}</td>
                      <td className="small">{proc ? <span className="mono">{proc.numero}</span> : <span className="text-secondary">—</span>}</td>
                      <td><Pill kind={st.kind}>{st.label}</Pill></td>
                      <td className="small text-secondary">{fmtDateTime(d.atualizado_em)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 small text-secondary border-top">{lista.length} de {documentos.length} documento(s)</div>
        </div>
      )}
    </>
  )
}

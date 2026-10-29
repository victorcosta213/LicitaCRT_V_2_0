import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGc } from '../context/GcContext'
import { Empty, PageHeader, Pill } from '../components/gc/ui'
import { useMarcas } from '../components/compras/useMarcas'
import { useDocumentos } from '../components/useDocumentos'
import { useSolicitacoes } from '../components/useSolicitacoes'
import { useTramitacao } from '../components/useTramitacao'
import { listarTramitacoesDe } from '../services/tramitacao'
import { can } from '../utils/permissions'
import { fmtDateTime } from '../utils/format'
import { DIAS_PARADO_PADRAO, VERBOS_MOVIMENTO, haQuanto } from '../utils/tramitacao'
import { STATUS_SOL } from '../utils/solicitacoes'
import { ETAPAS_PEDIDO, VISTAS_PEDIDOS, naVistaPedido, resumoPedidos, situacaoDoPedido } from '../utils/acompanhamentoPedidos'
import { AvisoSolicitacoesAusente } from './Solicitacoes'
import './compras.css'

const ICONE = { danger: 'bi-exclamation-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-arrow-right-circle', success: 'bi-check-circle-fill' }

function Regua({ etapa, encerrado }) {
  return (
    <ol className="regua-pedido" aria-label="Etapas do pedido">
      {ETAPAS_PEDIDO.map((nome, i) => (
        <li key={nome} className={encerrado ? '' : i < etapa ? 'feita' : i === etapa ? 'atual' : ''} aria-current={!encerrado && i === etapa ? 'step' : undefined}>
          <span>{nome}</span>
        </li>
      ))}
    </ol>
  )
}

// Acompanhamento completo dos pedidos: em que setor cada um está, há quanto tempo e o que está travando
export default function AcompanhamentoPedidos() {
  const { role } = useAuth()
  const { params } = useGc() || {}
  const [sp, setSp] = useSearchParams()
  const { carregando, ausente, solicitacoes } = useSolicitacoes()
  const { processos, unidadesPorId } = useTramitacao()
  const { documentos, assinaturas } = useDocumentos()
  const { marcas } = useMarcas()
  const [tramitacoes, setTramitacoes] = useState([])
  const diasParado = Number(params?.tr_dias_parado) || DIAS_PARADO_PADRAO

  const idsProcessos = useMemo(() => solicitacoes.map((s) => s.processo_id).filter(Boolean).sort().join(','), [solicitacoes])
  useEffect(() => {
    let vivo = true
    listarTramitacoesDe(idsProcessos ? idsProcessos.split(',') : []).then((t) => { if (vivo) setTramitacoes(t) }).catch(() => {})
    return () => { vivo = false }
  }, [idsProcessos, processos])

  const situacoes = useMemo(() => {
    const processosPorId = new Map(processos.map((p) => [p.id, p]))
    const tramitacoesPorProcesso = new Map()
    for (const t of tramitacoes) tramitacoesPorProcesso.set(t.processo_id, [...(tramitacoesPorProcesso.get(t.processo_id) || []), t])
    return solicitacoes.map((s) => ({ s, sit: situacaoDoPedido(s, { processosPorId, tramitacoesPorProcesso, documentos, assinaturas, marcas, unidadesPorId, diasParado }) }))
      // travados primeiro; depois os mais antigos
      .sort((a, b) => (Number(b.sit.travado) - Number(a.sit.travado)) || String(a.s.enviada_em).localeCompare(String(b.s.enviada_em)))
  }, [solicitacoes, processos, tramitacoes, documentos, assinaturas, marcas, unidadesPorId, diasParado])

  const resumo = resumoPedidos(situacoes.map((x) => x.sit))
  const vista = VISTAS_PEDIDOS.some(([k]) => k === sp.get('vista')) ? sp.get('vista') : 'todos'
  const lista = situacoes.filter(({ sit }) => naVistaPedido(sit, vista))
  const mudarVista = (k) => {
    const n = new URLSearchParams(sp)
    if (k === 'todos') n.delete('vista'); else n.set('vista', k)
    setSp(n, { replace: true })
  }
  const ehSecretario = can(role, 'compras.solicitar') && !can(role, 'compras.analisar')

  return (
    <>
      <PageHeader
        title={ehSecretario ? 'Acompanhar meus pedidos' : 'Acompanhamento dos pedidos'}
        subtitle="Cada pedido com a etapa, o setor onde está agora, há quanto tempo e o que está segurando o andamento."
        actions={can(role, 'compras.solicitar') && <Link to="/documentos/novo?modelo=dfd" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-2" />Nova DFD</Link>}
      />
      {ausente ? <AvisoSolicitacoesAusente /> : (
        <>
          <div className="indicadores-pedidos mb-3">
            {[['travados', 'Travados', resumo.travados, 'danger'], ['analise', 'No Compras', resumo.analise, 'warning'], ['ajuste', 'Devolvidos', resumo.ajuste, 'danger'],
              ['andamento', 'Em andamento', resumo.andamento, 'primary'], ['concluido', 'Concluídos', resumo.concluidos, 'success']].map(([k, rotulo, n, cor]) => (
              <button key={k} type="button" className={`indicador-pedido indicador-pedido--${cor} ${vista === k ? 'ativo' : ''}`} onClick={() => mudarVista(vista === k ? 'todos' : k)}>
                <strong>{n}</strong><span>{rotulo}</span>
              </button>
            ))}
          </div>
          <div className="segmentos mb-3" role="tablist" aria-label="Vistas">
            {VISTAS_PEDIDOS.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={vista === k} className={`segmento ${vista === k ? 'ativo' : ''}`} onClick={() => mudarVista(k)}>{l}</button>
            ))}
          </div>

          {carregando && <p className="text-secondary">Carregando…</p>}
          {!carregando && lista.length === 0 && (
            <Empty icon="bi-binoculars">
              {situacoes.length ? 'Nenhum pedido nesta vista.' : (
                <span className="vazio-acao">
                  <span>Nenhum pedido ainda. A secretaria pode fazer a DFD a qualquer momento, com ou sem ofício do Prefeito.</span>
                  {can(role, 'compras.solicitar') && <Link to="/documentos/novo?modelo=dfd" className="btn btn-primary">Fazer uma DFD</Link>}
                </span>
              )}
            </Empty>
          )}

          <div className="pedidos">
            {lista.map(({ s, sit }) => (
              <article key={s.id} className={`pedido card ${sit.travado ? 'pedido--travado' : ''}`} aria-label={`Pedido ${s.numero}`}>
                <header className="pedido__cab">
                  <div className="min-w-0">
                    <div className="d-flex gap-2 align-items-center flex-wrap">
                      <Link to={`/solicitacoes/${s.id}`} className="mono fw-semibold">{s.numero}</Link>
                      {sit.processo && <Link to={`/processos/${sit.processo.id}`} className="mono small">Processo {sit.processo.numero}</Link>}
                      {sit.travado && <Pill kind="danger">Travado</Pill>}
                    </div>
                    <div className="pedido__objeto">{s.objeto}</div>
                  </div>
                  <Pill kind={STATUS_SOL[s.status].kind}>{sit.grupo === 'concluido' ? 'Concluído' : STATUS_SOL[s.status].label}</Pill>
                </header>
                <Regua etapa={sit.etapa} encerrado={sit.grupo === 'encerrado'} />
                <div className="pedido__corpo">
                  {sit.onde?.unidade && (
                    <p className="pedido__onde">
                      <i className="bi bi-geo-alt-fill me-1" aria-hidden="true" />Onde está agora: <strong title={sit.onde.unidade.nome}>{sit.onde.unidade.sigla} — {sit.onde.unidade.nome}</strong>
                      {sit.onde.dias != null && <> há <strong>{sit.onde.dias} dia(s)</strong></>}
                      {sit.onde.responsavel && <>, com {sit.onde.responsavel}</>}
                      {sit.processo && !sit.onde.recebido && <> · <em>ainda não recebido</em></>}
                    </p>
                  )}
                  {sit.passagens?.length > 1 && (
                    <p className="pedido__caminho small">
                      Por onde passou: {sit.passagens.map((x, i) => (
                        <span key={x.id}>{i > 0 && ' → '}<span className={x.atual ? 'fw-semibold' : ''}>{x.unidade?.sigla || '—'} ({x.dias}d)</span></span>
                      ))}
                    </p>
                  )}
                  <ul className="pedido__travas" aria-label="O que está travando">
                    {sit.travas.map((t) => (
                      <li key={t.texto} className={`trava trava--${t.nivel}`}><i className={`bi ${ICONE[t.nivel]} me-2`} aria-hidden="true" />{t.texto}{t.quem && t.nivel !== 'success' ? <span className="text-secondary"> · com: {t.quem}</span> : null}</li>
                    ))}
                  </ul>
                  {sit.ultimo && (
                    <p className="small text-secondary mb-0">
                      Último movimento: {sit.ultimo.criada_por_nome || 'Alguém'} {VERBOS_MOVIMENTO[sit.ultimo.tipo] || sit.ultimo.tipo} o processo
                      {sit.ultimo.tipo === 'envio' && sit.ultimo.para_unidade && <> para {unidadesPorId.get(sit.ultimo.para_unidade)?.sigla}</>}
                      {' '}<span title={fmtDateTime(sit.ultimo.criada_em)}>{haQuanto(sit.ultimo.criada_em)}</span>
                      {sit.ultimo.despacho && <> — “{sit.ultimo.despacho}”</>}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}

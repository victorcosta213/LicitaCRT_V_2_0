import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, DefList, Empty, PageHeader, Pill } from '../components/gc/ui'
import FormModal from '../components/gc/FormModal'
import AbrirProcessoModal from '../components/compras/AbrirProcessoModal'
import { useAtualizacaoAutomatica } from '../components/useAtualizacao'
import { useDocumentos } from '../components/useDocumentos'
import { useTramitacao } from '../components/useTramitacao'
import {
  TABELAS_SOLICITACOES, aceitarSolicitacao, cancelarSolicitacao, devolverSolicitacao, mensagemErroSolicitacao,
  obterSolicitacao, recusarSolicitacao,
} from '../services/solicitacoes'
import { criarDocumento, mensagemErroDocumento, obterDocumento } from '../services/documentos'
import { modeloPorCodigo } from '../modelos/catalogo'
import { tabelaAusente } from '../services/gc'
import { OBJETOS, rotuloDo } from '../modelos/variantes'
import { can, isMaster, normalizeRole } from '../utils/permissions'
import { brl, fmtDate, fmtDateTime } from '../utils/format'
import { showError, showSuccess } from '../utils/alerts'
import { PRIORIDADES } from '../utils/tramitacao'
import { PCA, STATUS_SOL, TIPOS_SOL, podeEditarSol } from '../utils/solicitacoes'
import { AvisoSolicitacoesAusente } from './Solicitacoes'
import './compras.css'

const EVENTOS = {
  envio: { label: 'Enviada ao Compras', icone: 'bi-send' },
  reenvio: { label: 'Corrigida e reenviada', icone: 'bi-arrow-repeat' },
  devolucao: { label: 'Devolvida para ajuste', icone: 'bi-arrow-return-left' },
  aceite: { label: 'Aceita: processo aberto', icone: 'bi-folder-check' },
  recusa: { label: 'Recusada', icone: 'bi-x-circle' },
  cancelamento: { label: 'Cancelada', icone: 'bi-slash-circle' },
}
const campoMotivo = (label, ajuda) => [{ name: 'motivo', label, type: 'textarea', required: true, col: 12, help: ajuda }]

export default function SolicitacaoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, role } = useAuth()
  const [d, setD] = useState({ carregando: true, solicitacao: null, eventos: [], erro: null, ausente: false })
  const [modal, setModal] = useState(null) // 'aceitar' | 'devolver' | 'recusar' | 'cancelar'
  const [refazendo, setRefazendo] = useState(false)
  const vivo = useRef(true)
  const { documentos } = useDocumentos()
  const { unidadesPorId, processos } = useTramitacao()

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setD((s) => ({ ...s, carregando: true, erro: null }))
      const r = await obterSolicitacao(id)
      if (vivo.current) setD({ carregando: false, ...r, erro: null, ausente: false })
    } catch (err) {
      console.error('[solicitação]', err)
      if (vivo.current && !silencioso) setD((s) => ({ ...s, carregando: false, ausente: tabelaAusente(err), erro: err?.message || 'Não foi possível carregar a solicitação.' }))
    }
  }, [id])
  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(TABELAS_SOLICITACOES, () => carregar({ silencioso: true }))

  const s = d.solicitacao
  const dfd = useMemo(() => documentos.find((x) => x.id === s?.documento_id) || null, [documentos, s])
  const processo = processos.find((p) => p.id === s?.processo_id)

  if (d.carregando) return <div className="esqueleto" role="status"><span className="visually-hidden">Carregando…</span><div className="esqueleto__linha" style={{ width: '40%', height: 28 }} /><div className="esqueleto__bloco" /></div>
  if (d.ausente) return <AvisoSolicitacoesAusente />
  if (d.erro) return <div className="alert alert-danger">Não foi possível carregar a solicitação: {d.erro}</div>
  if (!s) {
    return (
      <>
        <PageHeader title="Solicitação não encontrada" back={{ to: '/solicitacoes', label: 'Solicitações' }} />
        <Empty icon="bi-file-earmark-x">Esta solicitação não existe ou você não tem acesso a ela.</Empty>
      </>
    )
  }

  const r = normalizeRole(role)
  const ehCompras = can(role, 'compras.analisar')
  const editavel = r !== 'viewer' && podeEditarSol(s, { usuarioId: user?.id, unidadeId: profile?.unidade_id, master: isMaster(r) })
  const st = STATUS_SOL[s.status]
  const u = unidadesPorId.get(s.unidade_id)
  const pr = PRIORIDADES[s.prioridade]
  const fechar = () => setModal(null)

  async function agir(fn, ok) {
    try {
      await fn()
      showSuccess(ok)
      await carregar({ silencioso: true })
    } catch (err) { throw new Error(mensagemErroSolicitacao(err)) }
  }
  async function aceitar(v) {
    try {
      const proc = await aceitarSolicitacao(id, v)
      showSuccess('Processo de contratação aberto.')
      navigate(`/processos/${proc}`)
    } catch (err) { throw new Error(mensagemErroSolicitacao(err)) }
  }
  // A DFD assinada não muda: a correção é uma DFD nova, que começa como cópia da anterior.
  // Assinada, ela é enviada respondendo a este pedido (o envio oferece essa opção).
  async function refazerDfd() {
    setRefazendo(true)
    try {
      const modelo = modeloPorCodigo('dfd')
      const anterior = s.documento_id ? (await obterDocumento(s.documento_id)).documento : null
      const novo = await criarDocumento({ modelo, titulo: anterior?.titulo || modelo.nome, conteudo: anterior?.conteudo || {}, corpo: [] })
      showSuccess('Nova DFD criada a partir da anterior. Corrija, assine e envie respondendo a este pedido.')
      navigate(`/documentos/${novo}`)
    } catch (err) {
      showError(mensagemErroDocumento(err))
      setRefazendo(false)
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/solicitacoes', label: 'Solicitações' }}
        eyebrow={TIPOS_SOL[s.tipo]}
        title={s.numero}
        subtitle={s.objeto}
        actions={(
          <>
            <Pill kind={st.kind}>{st.label}</Pill>
            {ehCompras && s.status === 'enviada' && (
              <>
                <button className="btn btn-primary" onClick={() => setModal('aceitar')}><i className="bi bi-folder-plus me-2" />Aceitar e abrir processo</button>
                <button className="btn btn-outline-warning" onClick={() => setModal('devolver')}>Devolver para ajuste</button>
                <button className="btn btn-outline-danger" onClick={() => setModal('recusar')}>Recusar</button>
              </>
            )}
            {editavel && s.status === 'devolvida' && can(role, 'compras.solicitar') && (
              <button className="btn btn-primary" onClick={refazerDfd} disabled={refazendo}><i className="bi bi-arrow-repeat me-2" />{refazendo ? 'Criando…' : 'Refazer a DFD'}</button>
            )}
            {editavel && ['enviada', 'devolvida'].includes(s.status) && (
              <button className="btn btn-outline-secondary" onClick={() => setModal('cancelar')}>Cancelar solicitação</button>
            )}
          </>
        )}
      />

      {s.status === 'devolvida' && (
        <div className="alert alert-danger"><strong>O Compras devolveu esta solicitação.</strong> O que ajustar: {s.motivo}</div>
      )}
      {s.status === 'recusada' && <div className="alert alert-secondary"><strong>Solicitação recusada.</strong> Motivo: {s.motivo}</div>}
      {s.status === 'cancelada' && <div className="alert alert-secondary"><strong>Solicitação cancelada.</strong> Motivo: {s.motivo}</div>}
      {s.status === 'aceita' && s.processo_id && (
        <div className="alert alert-success d-flex align-items-center gap-2 flex-wrap">
          <i className="bi bi-folder-check" aria-hidden="true" />
          <span>O Compras abriu o processo de contratação{processo ? <> <span className="mono">{processo.numero}</span></> : ''}.</span>
          <Link className="btn btn-sm btn-success ms-auto" to={`/processos/${s.processo_id}`}>Acompanhar o processo</Link>
        </div>
      )}

      <div className="row g-4">
        <div className="col-xl-8">
            <Card title="O que foi pedido">
              <DefList cols={2} items={[
                ['Objeto', s.objeto],
                ['Quantidade estimada', s.quantidade || '—'],
                ['Tipo de objeto', s.objeto_tipo ? rotuloDo(OBJETOS, s.objeto_tipo) : 'A definir pelo Compras'],
                ['Valor estimado', s.valor_estimado != null ? brl(s.valor_estimado) : 'Não informado'],
                ['Para quando', s.data_pretendida ? fmtDate(s.data_pretendida) : '—'],
                ['Prioridade', pr ? <Pill kind={pr.kind}>{pr.label}</Pill> : '—'],
                ['Plano de contratações anual', PCA.find((p) => p.valor === s.previsto_pca)?.rotulo || 'Não informado'],
              ]} />
              <h3 className="h6 fw-bold mt-3">Por que é necessária</h3>
              <p className="texto-livre mb-0">{s.justificativa}</p>
            </Card>

          <Card title="Histórico">
            <ul className="sol-historico">
              {d.eventos.map((e) => {
                const m = EVENTOS[e.tipo] || { label: e.tipo, icone: 'bi-dot' }
                return (
                  <li key={e.id}>
                    <i className={`bi ${m.icone} me-2`} aria-hidden="true" />
                    <strong>{m.label}</strong> <span className="text-secondary small">por {e.criada_por_nome || '—'} em {fmtDateTime(e.criada_em)}</span>
                    {e.texto && <div className="small texto-livre">{e.texto}</div>}
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
        <div className="col-xl-4">
          <Card title="Quem pediu">
            <DefList cols={1} items={[
              ['Setor', u ? `${u.sigla} — ${u.nome}` : '—'],
              ['Solicitante', s.solicitante_nome || '—'],
              ['Enviada em', fmtDateTime(s.enviada_em)],
              s.analisada_por_nome && ['Analisada por', `${s.analisada_por_nome} em ${fmtDateTime(s.analisada_em)}`],
            ]} />
          </Card>
          <Card title="Documento de formalização da demanda">
            {s.documento_id ? (
              dfd ? (
                <div>
                  <Link to={`/documentos/${dfd.id}`} className="mono fw-semibold">{dfd.numero}</Link>
                  <div className="small">{dfd.titulo}</div>
                  <div className="small text-secondary">{dfd.status === 'assinado' ? `Assinado em ${fmtDateTime(dfd.assinado_em)}` : dfd.status}</div>
                </div>
              ) : <p className="small text-secondary mb-0">DFD anexado (carregando ou sem acesso).</p>
            ) : (
              <p className="small text-secondary mb-0">
                Solicitação sem DFD. {ehCompras ? 'Se for preciso, o DFD pode ser feito no processo depois de aberto.' : 'Se puder, faça o DFD e anexe ao corrigir.'}
              </p>
            )}
          </Card>
        </div>
      </div>

      {modal === 'aceitar' && <AbrirProcessoModal solicitacao={s} onSubmit={aceitar} onClose={fechar} />}
      {modal === 'devolver' && (
        <FormModal title="Devolver para ajuste" submitLabel="Devolver" size="md" onClose={fechar}
          fields={campoMotivo('O que precisa ser ajustado', 'O setor recebe o pedido de volta com este texto, corrige e reenvia.')}
          onSubmit={({ motivo }) => agir(() => devolverSolicitacao(id, motivo), 'Solicitação devolvida ao setor.')} />
      )}
      {modal === 'recusar' && (
        <FormModal title="Recusar solicitação" submitLabel="Recusar" size="md" onClose={fechar}
          fields={campoMotivo('Motivo da recusa', 'A recusa encerra a solicitação. Para pedir uma correção, use "Devolver para ajuste".')}
          onSubmit={({ motivo }) => agir(() => recusarSolicitacao(id, motivo), 'Solicitação recusada.')} />
      )}
      {modal === 'cancelar' && (
        <FormModal title="Cancelar solicitação" submitLabel="Cancelar solicitação" size="md" onClose={fechar}
          fields={campoMotivo('Motivo do cancelamento', 'A solicitação fica registrada como cancelada.')}
          onSubmit={({ motivo }) => agir(() => cancelarSolicitacao(id, motivo), 'Solicitação cancelada.')} />
      )}
    </>
  )
}

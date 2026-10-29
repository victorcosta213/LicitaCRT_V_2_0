import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGc } from '../context/GcContext'
import { Card, Carimbo, DefList, Empty, PageHeader, Pill } from '../components/gc/ui'
import FormModal from '../components/gc/FormModal'
import EnviarProcessoModal from '../components/gc/EnviarProcessoModal'
import { useAtualizacaoAutomatica } from '../components/useAtualizacao'
import ArtefatosDoProcesso from '../components/documentos/ArtefatosDoProcesso'
import DocumentosDoProcesso from '../components/documentos/DocumentosDoProcesso'
import { useDocumentos } from '../components/useDocumentos'
import { useMarcas } from '../components/compras/useMarcas'
import { travasDoProcesso } from '../utils/acompanhamentoPedidos'
import { can } from '../utils/permissions'
import { AvisoTramitacaoAusente } from './Processos'
import {
  TABELAS_TRAMITACAO, atualizarDadosProcessoAdm, concluirProcessoAdm, listarUnidades, mensagemErroTramitacao,
  obterProcessoAdm, reabrirProcessoAdm, receberProcessoAdm, tramitarProcessoAdm,
} from '../services/tramitacao'
import { tabelaAusente } from '../services/gc'
import { isMaster, normalizeRole } from '../utils/permissions'
import { fmtDate, fmtDateTime } from '../utils/format'
import { showError } from '../utils/alerts'
import { DIAS_PARADO_PADRAO, MOVIMENTOS, PRIORIDADES, estadoDoProcesso, permanencias } from '../utils/tramitacao'
import './tramitacao.css'
import './compras.css'

const CAMPOS_DADOS = [
  { name: 'assunto', label: 'Assunto', type: 'text', required: true, col: 12 },
  { name: 'interessado', label: 'Interessado', type: 'text', col: 6 },
  { name: 'prioridade', label: 'Prioridade', type: 'select', required: true, col: 3, options: Object.entries(PRIORIDADES).map(([value, p]) => ({ value, label: p.label })) },
  { name: 'prazo', label: 'Prazo final', type: 'date', col: 3 },
  { name: 'descricao', label: 'Descrição', type: 'textarea', col: 12 },
]
const campoMotivo = (label, ajuda) => [{ name: 'motivo', label, type: 'textarea', required: true, col: 12, help: ajuda }]

export default function ProcessoDetalhe() {
  const { id } = useParams()
  const { user, profile, role } = useAuth()
  const { params } = useGc() || {}
  const [d, setD] = useState({ carregando: true, processo: null, tramitacoes: [], unidades: [], erro: null, ausente: false })
  const [modal, setModal] = useState(null) // 'enviar' | 'dados' | 'concluir' | 'reabrir'
  const [agindo, setAgindo] = useState(false)
  const vivo = useRef(true)
  const { documentos, assinaturas } = useDocumentos()
  const { marcas } = useMarcas(id)

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setD((s) => ({ ...s, carregando: true, erro: null }))
      const [{ processo, tramitacoes }, unidades] = await Promise.all([obterProcessoAdm(id), listarUnidades()])
      if (vivo.current) setD({ carregando: false, processo, tramitacoes, unidades, erro: null, ausente: false })
    } catch (err) {
      console.error('[tramitação]', err)
      if (vivo.current && !silencioso) setD((s) => ({ ...s, carregando: false, ausente: tabelaAusente(err), erro: err?.message || 'Não foi possível carregar o processo.' }))
    }
  }, [id])
  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(TABELAS_TRAMITACAO, () => carregar({ silencioso: true }))

  const { processo: p, tramitacoes, unidades } = d
  const unidadesPorId = useMemo(() => new Map(unidades.map((u) => [u.id, u])), [unidades])
  const diasParado = Number(params?.tr_dias_parado) || DIAS_PARADO_PADRAO

  if (d.carregando) return <div className="esqueleto" role="status"><span className="visually-hidden">Carregando…</span><div className="esqueleto__linha" style={{ width: '40%', height: 28 }} /><div className="esqueleto__bloco" /></div>
  if (d.ausente) return <AvisoTramitacaoAusente />
  if (d.erro) return <div className="alert alert-danger">Não foi possível carregar o processo: {d.erro}</div>
  if (!p) {
    return (
      <>
        <PageHeader title="Processo não encontrado" back={{ to: '/processos', label: 'Processos' }} />
        <Empty icon="bi-folder-x">Este processo não existe ou a sua unidade ainda não teve acesso a ele.</Empty>
      </>
    )
  }

  // mesma regra do banco: administrador, responsável atual ou alguém da unidade onde o processo está
  const r = normalizeRole(role)
  const naUnidade = isMaster(r) || (r !== 'viewer' && (p.responsavel_atual === user?.id || (!!profile?.unidade_id && p.unidade_atual === profile.unidade_id)))
  const podeReabrir = naUnidade || ['gestor', 'gabinete'].includes(r)
  const andamento = p.situacao === 'em_andamento'
  const estado = estadoDoProcesso(p, { diasParado })
  const unidade = unidadesPorId.get(p.unidade_atual)
  const passagens = permanencias(p, tramitacoes, unidadesPorId)
  const maior = Math.max(1, ...passagens.map((x) => x.dias))

  async function agir(fn) {
    setAgindo(true)
    try {
      await fn()
      await carregar({ silencioso: true })
    } catch (err) {
      showError(mensagemErroTramitacao(err))
    } finally {
      setAgindo(false)
    }
  }
  const fechar = () => setModal(null)
  const atualizar = async (fn) => { await fn(); await carregar({ silencioso: true }) }

  return (
    <>
      <PageHeader
        back={{ to: '/processos', label: 'Processos' }}
        eyebrow={p.tipo}
        title={`Processo ${p.numero}`}
        subtitle={p.assunto}
        actions={(
          <>
            {andamento && naUnidade && !p.recebido_em && (
              <button className="btn btn-success" disabled={agindo} onClick={() => agir(() => receberProcessoAdm(p.id))}>
                <i className="bi bi-inbox me-2" />Receber processo
              </button>
            )}
            {andamento && naUnidade && can(role, 'compras.solicitar') && p.tipo !== 'Contratação' && (
              // ofício/despacho do Prefeito pedindo uma contratação: a DFD já nasce citando este processo
              <Link className="btn btn-primary" to={`/documentos/novo?modelo=dfd&origem=${encodeURIComponent(`Processo ${p.numero} — ${p.assunto}`)}`}>
                <i className="bi bi-file-earmark-plus me-2" />Fazer a DFD deste pedido
              </Link>
            )}
            {andamento && naUnidade && (
              <>
                <button className="btn btn-primary" onClick={() => setModal('enviar')}><i className="bi bi-send me-2" />Enviar para outra unidade</button>
                <button className="btn btn-outline-secondary" onClick={() => setModal('dados')}><i className="bi bi-pencil me-2" />Alterar dados</button>
                <button className="btn btn-outline-secondary" onClick={() => setModal('concluir')}><i className="bi bi-check2-circle me-2" />Concluir</button>
              </>
            )}
            {!andamento && podeReabrir && (
              <button className="btn btn-outline-secondary" onClick={() => setModal('reabrir')}><i className="bi bi-arrow-counterclockwise me-2" />Reabrir</button>
            )}
          </>
        )}
      />

      <div className="row g-4">
        <div className="col-lg-8">
          <Card title="Onde está agora">
            {andamento ? (
              <div className="onde-esta">
                <div>
                  <div className="onde-esta__sigla">{unidade?.sigla || '—'}</div>
                  <div className="onde-esta__nome">{unidade?.nome || 'Unidade removida'}</div>
                </div>
                <dl className="onde-esta__dados">
                  <div><dt>Estado</dt><dd><Carimbo kind={estado.kind}>{estado.label}</Carimbo></dd></div>
                  <div><dt>Chegou em</dt><dd>{fmtDateTime(p.desde)} <span className="text-secondary">({estado.diasNaUnidade} {estado.diasNaUnidade === 1 ? 'dia' : 'dias'})</span></dd></div>
                  <div><dt>Responsável</dt><dd>{p.responsavel_nome || <span className="text-secondary">ainda sem responsável</span>}</dd></div>
                  <div><dt>Recebido</dt><dd>{p.recebido_em ? fmtDateTime(p.recebido_em) : <span className="text-warning-emphasis">ainda não recebido pela unidade</span>}</dd></div>
                </dl>
              </div>
            ) : (
              <div className="onde-esta">
                <div>
                  <div className="onde-esta__sigla">{unidade?.sigla || '—'}</div>
                  <div className="onde-esta__nome">{unidade?.nome}</div>
                </div>
                <dl className="onde-esta__dados">
                  <div><dt>Estado</dt><dd><Carimbo kind="secondary">Concluído</Carimbo></dd></div>
                  <div><dt>Concluído em</dt><dd>{fmtDateTime(p.concluido_em)}</dd></div>
                  <div className="onde-esta__motivo"><dt>Como foi resolvido</dt><dd>{p.motivo_conclusao}</dd></div>
                </dl>
              </div>
            )}
          </Card>

          {p.situacao === 'em_andamento' && (
            <Card title="O que está travando" subtitle="O que segura o andamento agora: recebimento, assinaturas pendentes, documento que falta e prazo.">
              <ul className="pedido__travas mb-0" aria-label="O que está travando">
                {travasDoProcesso(p, { documentos, assinaturas, marcas, unidadesPorId: new Map(d.unidades.map((u) => [u.id, u])), diasParado }).map((t) => (
                  <li key={t.texto} className={`trava trava--${t.nivel}`}>
                    <i className={`bi ${{ danger: 'bi-exclamation-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-arrow-right-circle', success: 'bi-check-circle-fill' }[t.nivel]} me-2`} aria-hidden="true" />
                    {t.texto}{t.quem ? <span className="text-secondary"> · com: {t.quem}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <DocumentosDoProcesso processoId={p.id} documentos={documentos} podeCriar={can(role, 'documento.criar')} />

          {['Contratação', 'Solicitação de compra', 'Solicitação de serviço'].includes(p.tipo) || p.contratacao_modalidade ? (
            <ArtefatosDoProcesso processo={p} documentos={documentos} role={role} podeAtuar={andamento && naUnidade} podeCriar={can(role, 'documento.criar')} />
          ) : null}

          <Card title="Por onde passou" subtitle="Quanto tempo o processo ficou em cada unidade.">
            <ul className="permanencias">
              {passagens.map((x) => (
                <li key={x.id} className={x.atual ? 'permanencias__item permanencias__item--atual' : 'permanencias__item'}>
                  <div className="permanencias__rotulo">
                    <strong title={x.unidade?.nome}>{x.unidade?.sigla || '—'}</strong>
                    <span className="small text-secondary">{fmtDate(x.inicio)}{x.ate ? ` → ${fmtDate(x.ate)}` : ' → hoje'}</span>
                  </div>
                  <div className="permanencias__barra"><span style={{ width: `${Math.max(4, (x.dias / maior) * 100)}%` }} /></div>
                  <div className="permanencias__dias num">{x.dias} {x.dias === 1 ? 'dia' : 'dias'}</div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Histórico" subtitle="Tudo o que aconteceu com o processo, do mais antigo ao mais recente.">
            <ol className="linha-tempo">
              {tramitacoes.map((t) => {
                const m = MOVIMENTOS[t.tipo] || { label: t.tipo, icone: 'bi-dot' }
                const de = unidadesPorId.get(t.de_unidade)
                const para = unidadesPorId.get(t.para_unidade)
                return (
                  <li key={t.id} className="linha-tempo__item">
                    <span className="linha-tempo__icone" aria-hidden="true"><i className={`bi ${m.icone}`} /></span>
                    <div className="linha-tempo__corpo">
                      <div className="linha-tempo__titulo">
                        {m.label}
                        {t.tipo === 'envio' && <> · {de?.sigla || '—'} <i className="bi bi-arrow-right mx-1" aria-hidden="true" /> {para?.sigla || '—'}</>}
                        {t.tipo === 'abertura' && para && <> · aberto para {para.sigla}</>}
                        {t.para_usuario_nome && <span className="text-secondary"> ({t.para_usuario_nome})</span>}
                      </div>
                      {t.despacho && <div className="linha-tempo__despacho">{t.despacho}</div>}
                      <div className="linha-tempo__meta">{t.criada_por_nome || '—'} · {fmtDateTime(t.criada_em)}</div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card title="Dados do processo">
            <DefList cols={1} items={[
              ['Protocolo', <span className="mono">{p.numero}</span>],
              ['Tipo', p.tipo],
              ['Interessado', p.interessado],
              ['Prioridade', <Pill kind={PRIORIDADES[p.prioridade]?.kind}>{PRIORIDADES[p.prioridade]?.label || p.prioridade}</Pill>],
              ['Prazo final', p.prazo ? fmtDate(p.prazo) : null],
              ['Aberto por', p.aberto_por_nome],
              ['Aberto em', fmtDateTime(p.aberto_em)],
              ['Descrição', p.descricao],
            ]} />
          </Card>
        </div>
      </div>

      {modal === 'enviar' && (
        <EnviarProcessoModal
          unidades={unidades} unidadeAtual={p.unidade_atual} onClose={fechar}
          onSubmit={(v) => atualizar(() => tramitarProcessoAdm(p.id, v))}
        />
      )}
      {modal === 'dados' && (
        <FormModal title="Alterar dados do processo" fields={CAMPOS_DADOS} initial={p} onClose={fechar}
          onSubmit={(v) => atualizar(() => atualizarDadosProcessoAdm(p.id, v))} />
      )}
      {modal === 'concluir' && (
        <FormModal title="Concluir processo" submitLabel="Concluir" size="md" onClose={fechar}
          fields={campoMotivo('Como o processo foi resolvido', 'Fica registrado no histórico. Um processo concluído pode ser reaberto depois.')}
          onSubmit={({ motivo }) => atualizar(() => concluirProcessoAdm(p.id, motivo))} />
      )}
      {modal === 'reabrir' && (
        <FormModal title="Reabrir processo" submitLabel="Reabrir" size="md" onClose={fechar}
          fields={campoMotivo('Motivo da reabertura', 'O processo volta a andamento na mesma unidade, aguardando recebimento.')}
          onSubmit={({ motivo }) => atualizar(() => reabrirProcessoAdm(p.id, motivo))} />
      )}
    </>
  )
}

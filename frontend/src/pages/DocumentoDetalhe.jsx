import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, DefList, Empty, PageHeader, Pill } from '../components/gc/ui'
import FormModal from '../components/gc/FormModal'
import AssinarModal from '../components/documentos/AssinarModal'
import DocumentoForm from '../components/documentos/DocumentoForm'
import DocumentoView from '../components/documentos/DocumentoView'
import EnviarAssinaturaModal from '../components/documentos/EnviarAssinaturaModal'
import EnviarDfdModal from '../components/compras/EnviarDfdModal'
import { useSolicitacoes } from '../components/useSolicitacoes'
import { useContextoDocumento } from '../components/documentos/useContextoDocumento'
import { useAtualizacaoAutomatica } from '../components/useAtualizacao'
import { camposFaltando, pendenciasNoCorpo, renderizar, trechosPendentes, valoresIniciais } from '../modelos/base'
import { modeloPorCodigo } from '../modelos/catalogo'
import {
  TABELAS_DOCUMENTOS, assinarDocumento, cancelarDocumento, enviarParaAssinatura, listarPessoasParaAssinar,
  encaminharDocumento, mensagemErroDocumento, obterDocumento, recusarAssinatura, salvarDocumento,
} from '../services/documentos'
import { enviarDfdAoCompras, mensagemErroSolicitacao } from '../services/solicitacoes'
import { listarUnidades } from '../services/tramitacao'
import { devolvidasDaUnidade, dfdJaEnviada } from '../utils/solicitacoes'
import { tabelaAusente } from '../services/gc'
import { can, isMaster, normalizeRole } from '../utils/permissions'
import { fmtDateTime } from '../utils/format'
import { showError, showSuccess } from '../utils/alerts'
import { STATUS, codigoFormatado, urlVerificacao } from '../utils/documentosPlataforma'
import { AvisoDocumentosAusente } from './Documentos'
import './documentos.css'

const ESPERA_SALVAR = 1500
const campoMotivo = (rotulo, ajuda) => [{ name: 'motivo', label: rotulo, type: 'textarea', required: true, col: 12, help: ajuda }]
const hora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function DocumentoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, role } = useAuth()
  const { solicitacoes } = useSolicitacoes()
  const [unidades, setUnidades] = useState([])
  const [descricao, setDescricao] = useState('')
  const [d, setD] = useState({ carregando: true, documento: null, assinaturas: [], erro: null, ausente: false })
  const [modal, setModal] = useState(null) // 'enviar' | 'assinar' | 'recusar' | 'cancelar' | 'compras' | 'encaminhar'
  const [pessoas, setPessoas] = useState([])
  const [titulo, setTitulo] = useState('')
  const [valores, setValores] = useState({})
  const [sujo, setSujo] = useState(false)
  const [salvo, setSalvo] = useState({ salvando: false, em: null, erro: '' })
  const vivo = useRef(true)

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setD((s) => ({ ...s, carregando: true, erro: null }))
      const { documento, assinaturas } = await obterDocumento(id)
      if (vivo.current) setD({ carregando: false, documento, assinaturas, erro: null, ausente: false })
    } catch (err) {
      console.error('[documento]', err)
      if (vivo.current && !silencioso) setD((s) => ({ ...s, carregando: false, ausente: tabelaAusente(err), erro: err?.message || 'Não foi possível carregar o documento.' }))
    }
  }, [id])
  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(TABELAS_DOCUMENTOS, () => carregar({ silencioso: true }))

  const { documento, assinaturas } = d
  const modelo = modeloPorCodigo(documento?.modelo)
  const ehArquivo = documento?.modelo === 'arquivo' // arquivo enviado: só título e descrição mudam
  const { ctx } = useContextoDocumento({ processoId: documento?.processo_id, numero: documento?.numero })

  const r = normalizeRole(role)
  const eu = user?.id
  const noRascunho = documento?.status === 'rascunho'
  const podeEditar = !!documento && noRascunho && r !== 'viewer'
    && (isMaster(r) || documento.criado_por === eu || (!!profile?.unidade_id && documento.unidade_id === profile.unidade_id))
  const minhaPendente = assinaturas.find((a) => a.usuario_id === eu && a.status === 'pendente' && a.versao === documento?.versao)
  const podeCancelar = !!documento && documento.status !== 'cancelado' && (isMaster(r) || documento.criado_por === eu)

  // o formulário parte do que foi gravado; recarregar por mudança de outra pessoa não apaga o que se está digitando
  useEffect(() => {
    if (!documento) return
    setTitulo(documento.titulo)
    setDescricao(documento.conteudo?.descricao || '')
    setValores(modelo && Object.keys(documento.conteudo || {}).length ? documento.conteudo : (modelo ? valoresIniciais(modelo, ctx) : {}))
    setSujo(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documento?.id, documento?.versao, noRascunho])

  const corpo = useMemo(() => (podeEditar && modelo ? renderizar(modelo, valores, ctx) : (documento?.corpo || [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [podeEditar, modelo, valores, documento, ctx.orgao, ctx.cidade, ctx.numero, ctx.processo, ctx.unidade, ctx.autor.nome])

  const salvarAgora = useCallback(async () => {
    setSalvo((s) => ({ ...s, salvando: true, erro: '' }))
    try {
      await salvarDocumento(id, ehArquivo
        ? { titulo: titulo.trim() || documento.titulo, conteudo: { descricao }, corpo: documento.corpo }
        : { titulo: titulo.trim() || documento.titulo, conteudo: valores, corpo })
      setSujo(false)
      setSalvo({ salvando: false, em: new Date(), erro: '' })
    } catch (err) {
      setSalvo((s) => ({ ...s, salvando: false, erro: mensagemErroDocumento(err) }))
      throw err
    }
  }, [id, titulo, valores, corpo, documento, ehArquivo, descricao])

  // salvamento automático, um instante depois da última digitação
  useEffect(() => {
    if (!sujo || !podeEditar) return undefined
    const t = setTimeout(() => { salvarAgora().catch(() => {}) }, ESPERA_SALVAR)
    return () => clearTimeout(t)
  }, [sujo, podeEditar, salvarAgora])

  const alterarValores = (v) => { setValores(v); setSujo(true) }
  const alterarTitulo = (t) => { setTitulo(t); setSujo(true) }
  const alterarDescricao = (t) => { setDescricao(t); setSujo(true) }

  if (d.carregando) return <div className="esqueleto" role="status"><span className="visually-hidden">Carregando…</span><div className="esqueleto__linha" style={{ width: '40%', height: 28 }} /><div className="esqueleto__bloco" /></div>
  if (d.ausente) return <AvisoDocumentosAusente />
  if (d.erro) return <div className="alert alert-danger">Não foi possível carregar o documento: {d.erro}</div>
  if (!documento) {
    return (
      <>
        <PageHeader title="Documento não encontrado" back={{ to: '/documentos', label: 'Documentos' }} />
        <Empty icon="bi-file-earmark-x">Este documento não existe ou você ainda não tem acesso a ele.</Empty>
      </>
    )
  }

  const st = STATUS[documento.status]
  const faltando = podeEditar && modelo ? camposFaltando(modelo, valores) : []
  const trechos = podeEditar ? trechosPendentes(corpo) : []
  const nPendencias = podeEditar ? pendenciasNoCorpo(corpo) : 0
  const podeEnviar = podeEditar && (ehArquivo || (faltando.length === 0 && nPendencias === 0 && !!modelo))
  // DFD assinada da secretaria, ainda fora de pedido: segue ao Compras
  const podeMandarAoCompras = documento.modelo === 'dfd' && documento.status === 'assinado' && !documento.processo_id
    && can(role, 'compras.solicitar') && !dfdJaEnviada(solicitacoes, documento.id)
  const devolvidas = devolvidasDaUnidade(solicitacoes, { usuarioId: eu, unidadeId: profile?.unidade_id })
  const podeEncaminhar = documento.status === 'assinado' && r !== 'viewer' && documento.modelo !== 'dfd'

  async function abrirEncaminhar() {
    try {
      setUnidades((await listarUnidades()).filter((u) => u.ativa))
      setModal('encaminhar')
    } catch (err) { showError(mensagemErroDocumento(err)) }
  }

  async function abrirEnvio() {
    try {
      await salvarAgora()
      setPessoas(await listarPessoasParaAssinar())
      setModal('enviar')
    } catch (err) { showError(mensagemErroDocumento(err)) }
  }
  async function agir(fn, ok) {
    try {
      await fn()
      if (ok) showSuccess(ok)
      await carregar({ silencioso: true })
    } catch (err) { showError(mensagemErroDocumento(err)) }
  }
  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(urlVerificacao(documento.codigo_verificacao))
      showSuccess('Link de verificação copiado.')
    } catch { showError('Não foi possível copiar. Selecione o endereço e copie manualmente.') }
  }
  const fechar = () => setModal(null)
  const versaoAtual = assinaturas.filter((a) => a.versao === documento.versao)
  const anteriores = assinaturas.filter((a) => a.versao !== documento.versao && ['recusada', 'assinada'].includes(a.status))

  return (
    <>
      <PageHeader
        back={{ to: '/documentos', label: 'Documentos' }}
        eyebrow={modelo?.nome || documento.modelo}
        title={documento.numero}
        subtitle={documento.titulo}
        actions={(
          <>
            <Pill kind={st.kind}>{st.label}</Pill>
            {podeEditar && <button className="btn btn-outline-secondary" onClick={() => salvarAgora().catch(() => {})} disabled={salvo.salvando}><i className="bi bi-save me-2" />Salvar</button>}
            {podeEditar && <button className="btn btn-primary" onClick={abrirEnvio} disabled={!podeEnviar}><i className="bi bi-send-check me-2" />Enviar para assinatura</button>}
            {minhaPendente && <button className="btn btn-success" onClick={() => setModal('assinar')}><i className="bi bi-pen me-2" />Assinar</button>}
            {minhaPendente && <button className="btn btn-outline-danger" onClick={() => setModal('recusar')}>Recusar assinatura</button>}
            {podeMandarAoCompras && <button className="btn btn-primary" onClick={() => setModal('compras')}><i className="bi bi-send me-2" />Enviar ao Compras</button>}
            {podeEncaminhar && <button className="btn btn-outline-primary" onClick={abrirEncaminhar}><i className="bi bi-forward me-2" />Encaminhar</button>}
            {!podeEditar && <button className="btn btn-outline-secondary" onClick={() => window.print()}><i className="bi bi-printer me-2" />Imprimir</button>}
            {podeCancelar && <button className="btn btn-outline-secondary" onClick={() => setModal('cancelar')}>Cancelar documento</button>}
          </>
        )}
      />

      {documento.status === 'cancelado' && (
        <div className="alert alert-danger"><strong>Documento cancelado</strong> em {fmtDateTime(documento.cancelado_em)}. Motivo: {documento.motivo_cancelamento}</div>
      )}
      {minhaPendente && (
        <div className="alert alert-warning d-flex align-items-center gap-2"><i className="bi bi-pen" aria-hidden="true" />
          Este documento aguarda a sua assinatura como <strong>{minhaPendente.papel}</strong>. Leia o texto antes de assinar.
        </div>
      )}

      {podeEditar && modelo ? (
        <div className="row g-4">
          <div className="col-xl-6 no-print">
            <Card title="Preenchimento" subtitle={modelo.baseLegal}>
              <div className="mb-3">
                <label htmlFor="doc-titulo" className="form-label fw-semibold">Título do documento</label>
                <input id="doc-titulo" className="form-control" value={titulo} onChange={(e) => alterarTitulo(e.target.value)} />
              </div>
              {faltando.length > 0 || nPendencias > 0 ? (
                <div className="alert alert-warning py-2 small" role="status">
                  <strong>Para enviar para assinatura, falta:</strong>
                  <ul className="mb-0">
                    {faltando.map((f) => <li key={f}>{f}</li>)}
                    {trechos.map((t) => <li key={t}>Substituir <span className="mono">{t}</span></li>)}
                  </ul>
                </div>
              ) : <div className="alert alert-success py-2 small" role="status"><i className="bi bi-check2-circle me-1" />Tudo preenchido: o documento pode ser enviado para assinatura.</div>}
              <DocumentoForm modelo={modelo} valores={valores} onChange={alterarValores} />
              <div className="small mt-2 doc-salvo" role="status">
                {salvo.erro ? <span className="text-danger">{salvo.erro}</span>
                  : salvo.salvando ? 'Salvando…'
                    : sujo ? 'Alterações ainda não salvas…'
                      : salvo.em ? `Salvo às ${hora(salvo.em)}` : 'Salvamento automático ligado.'}
              </div>
            </Card>
          </div>
          <div className="col-xl-6">
            <Card title="Como o documento vai ficar" className="doc-previa">
              <DocumentoView documento={documento} corpo={corpo} assinaturas={assinaturas} />
            </Card>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-xl-8"><DocumentoView documento={documento} corpo={documento.corpo} assinaturas={assinaturas} /></div>
          <div className="col-xl-4 no-print">
            {ehArquivo && podeEditar && (
              <Card title="Dados do arquivo" subtitle="O arquivo não muda; ajuste o título e a descrição e envie para assinatura.">
                <div className="mb-2">
                  <label htmlFor="doc-titulo" className="form-label fw-semibold">Título do documento</label>
                  <input id="doc-titulo" className="form-control" value={titulo} onChange={(e) => alterarTitulo(e.target.value)} />
                </div>
                <label htmlFor="doc-descricao" className="form-label fw-semibold">Descrição</label>
                <textarea id="doc-descricao" className="form-control" rows={3} value={descricao} onChange={(e) => alterarDescricao(e.target.value)} />
                <div className="small mt-2 doc-salvo" role="status">{salvo.erro ? <span className="text-danger">{salvo.erro}</span> : salvo.salvando ? 'Salvando…' : sujo ? 'Alterações ainda não salvas…' : salvo.em ? `Salvo às ${hora(salvo.em)}` : ''}</div>
              </Card>
            )}
            <Card title="Assinaturas" subtitle={`Versão ${documento.versao}`}>
              {versaoAtual.length === 0 ? <p className="text-secondary mb-0">Ainda não foi enviado para assinatura.</p> : (
                <ul className="doc-assinaturas">
                  {versaoAtual.map((a) => (
                    <li key={a.id}>
                      <div><strong>{a.nome}</strong> <span className="text-secondary">({a.papel})</span></div>
                      <div className="small">
                        {a.status === 'assinada' && <span className="text-success"><i className="bi bi-check-circle me-1" />Assinou em {fmtDateTime(a.assinada_em)}</span>}
                        {a.status === 'pendente' && <span className="text-warning-emphasis"><i className="bi bi-hourglass-split me-1" />Aguardando</span>}
                        {a.status === 'recusada' && <span className="text-danger"><i className="bi bi-x-circle me-1" />Recusou: {a.motivo_recusa}</span>}
                        {a.status === 'cancelada' && <span className="text-secondary">Cancelada</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {anteriores.length > 0 && (
                <details className="mt-3">
                  <summary className="small fw-semibold">Versões anteriores</summary>
                  <ul className="doc-assinaturas small mt-2">
                    {anteriores.map((a) => <li key={a.id}>v{a.versao} · {a.nome} {a.status === 'recusada' ? `recusou: ${a.motivo_recusa}` : 'assinou'}</li>)}
                  </ul>
                </details>
              )}
            </Card>
            <Card title="Dados do documento">
              <DefList cols={1} items={[
                ['Número', <span className="mono">{documento.numero}</span>],
                ['Modelo', modelo?.nome || documento.modelo],
                documento.processo_id && ['Processo', <Link to={`/processos/${documento.processo_id}`}>Abrir o processo</Link>],
                ['Criado por', documento.criado_por_nome],
                ['Criado em', fmtDateTime(documento.criado_em)],
                documento.assinado_em && ['Assinado em', fmtDateTime(documento.assinado_em)],
                documento.codigo_verificacao && ['Código de verificação', <span className="mono">{codigoFormatado(documento.codigo_verificacao)}</span>],
                documento.hash && ['Código do conteúdo (SHA-256)', <span className="mono doc-hash">{documento.hash}</span>],
              ]} />
              {documento.codigo_verificacao && (
                <div className="d-flex gap-2 flex-wrap mt-2">
                  <button className="btn btn-sm btn-outline-secondary" onClick={copiarLink}><i className="bi bi-link-45deg me-1" />Copiar link de verificação</button>
                  <Link className="btn btn-sm btn-outline-secondary" to={`/documentos/verificar/${documento.codigo_verificacao}`}>Conferir</Link>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {modal === 'enviar' && (modelo || ehArquivo) && (
        <EnviarAssinaturaModal modelo={modelo || { papeisSugeridos: ['Responsável'] }} pessoas={pessoas} onClose={fechar}
          onSubmit={async (signatarios) => { await enviarParaAssinatura(id, signatarios); await carregar({ silencioso: true }); showSuccess('Documento enviado para assinatura.') }} />
      )}
      {modal === 'assinar' && minhaPendente && (
        <AssinarModal documento={documento} papel={minhaPendente.papel} onClose={fechar}
          onSubmit={async (senha) => {
            await assinarDocumento(id, { email: user?.email, senha })
            showSuccess('Documento assinado.')
            const atual = await obterDocumento(id)
            if (vivo.current) setD({ carregando: false, ...atual, erro: null, ausente: false })
            // DFD com todas as assinaturas: já oferece o envio ao Compras
            if (atual.documento?.modelo === 'dfd' && atual.documento.status === 'assinado' && can(role, 'compras.solicitar')) setTimeout(() => setModal('compras'), 0)
          }} />
      )}
      {modal === 'compras' && (
        <EnviarDfdModal documento={documento} devolvidas={devolvidas} onClose={fechar}
          onSubmit={async (dados, devolvidaId, resposta) => {
            try {
              const sol = await enviarDfdAoCompras(dados, devolvidaId, resposta)
              showSuccess(devolvidaId ? 'DFD reenviada ao Compras.' : 'DFD enviada ao Compras.')
              navigate(`/solicitacoes/${sol}`)
            } catch (err) { throw new Error(mensagemErroSolicitacao(err)) }
          }} />
      )}
      {modal === 'encaminhar' && (
        <FormModal title="Encaminhar documento" submitLabel="Encaminhar" size="md" onClose={fechar}
          fields={[
            { name: 'unidade', label: 'Para qual unidade', type: 'select', required: true, col: 12, options: unidades.map((u) => ({ value: u.id, label: `${u.sigla} — ${u.nome}` })) },
            { name: 'despacho', label: 'Despacho', type: 'textarea', required: true, col: 12, help: 'O que a unidade deve fazer (ex.: providenciar a DFD dos computadores).' },
          ]}
          onSubmit={async ({ unidade, despacho }) => {
            try {
              const proc = await encaminharDocumento(id, { unidade, despacho })
              showSuccess('Documento encaminhado.')
              navigate(`/processos/${proc}`)
            } catch (err) { throw new Error(mensagemErroDocumento(err)) }
          }} />
      )}
      {modal === 'recusar' && (
        <FormModal title="Recusar assinatura" submitLabel="Recusar" size="md" onClose={fechar}
          fields={campoMotivo('Motivo da recusa', 'O documento volta a rascunho para ser corrigido; as outras assinaturas pendentes são canceladas.')}
          onSubmit={({ motivo }) => agir(() => recusarAssinatura(id, motivo), 'Assinatura recusada.')} />
      )}
      {modal === 'cancelar' && (
        <FormModal title="Cancelar documento" submitLabel="Cancelar documento" size="md" onClose={fechar}
          fields={campoMotivo('Motivo do cancelamento', 'O documento não é apagado: fica registrado como cancelado, com este motivo.')}
          onSubmit={({ motivo }) => agir(() => cancelarDocumento(id, motivo), 'Documento cancelado.')} />
      )}
    </>
  )
}


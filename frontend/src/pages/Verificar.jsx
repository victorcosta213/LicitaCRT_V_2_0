import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Entrada from '../components/Entrada'
import { Card, PageHeader, Pill } from '../components/gc/ui'
import { mensagemErroDocumento, verificarDocumento } from '../services/documentos'
import { fmtDateTime } from '../utils/format'
import { codigoFormatado } from '../utils/documentosPlataforma'
import './documentos.css'

const SITUACAO = {
  assinado: { texto: 'Documento autêntico e assinado', kind: 'success', icone: 'bi-patch-check-fill' },
  aguardando_assinatura: { texto: 'Documento aguardando assinatura (ainda não vale)', kind: 'warning', icone: 'bi-hourglass-split' },
  rascunho: { texto: 'Documento ainda não foi assinado', kind: 'warning', icone: 'bi-pencil' },
  cancelado: { texto: 'Documento cancelado', kind: 'danger', icone: 'bi-x-octagon-fill' },
}

function Resultado({ r }) {
  if (!r.encontrado) {
    return (
      <div className="alert alert-danger verificacao verificacao--erro" role="alert">
        <i className="bi bi-x-circle-fill me-2" aria-hidden="true" /><strong>Código não encontrado.</strong> Confira se digitou o código exatamente como aparece no documento.
      </div>
    )
  }
  const sit = SITUACAO[r.situacao] || SITUACAO.rascunho
  const valido = r.situacao === 'assinado' && r.integro
  return (
    <div className="verificacao" role="status">
      <div className={`verificacao__selo verificacao__selo--${valido ? 'success' : r.situacao === 'assinado' ? 'danger' : sit.kind}`}>
        <i className={`bi ${valido ? 'bi-patch-check-fill' : r.situacao === 'assinado' ? 'bi-exclamation-octagon-fill' : sit.icone}`} aria-hidden="true" />
        <div>
          <strong>{valido ? sit.texto : r.situacao === 'assinado' ? 'ATENÇÃO: o conteúdo não confere com o que foi assinado' : sit.texto}</strong>
          <div className="small">Documento <span className="mono">{r.numero}</span></div>
        </div>
      </div>
      <dl className="verificacao__dados">
        {r.assinado_em && <div><dt>Assinado em</dt><dd>{fmtDateTime(r.assinado_em)}</dd></div>}
        {r.cancelado_em && <div><dt>Cancelado em</dt><dd>{fmtDateTime(r.cancelado_em)}</dd></div>}
        <div><dt>Integridade do conteúdo</dt><dd>{r.hash ? (r.integro ? <Pill kind="success">Íntegro</Pill> : <Pill kind="danger">Alterado</Pill>) : '—'}</dd></div>
        {r.hash && <div className="verificacao__hash"><dt>Código do conteúdo (SHA-256)</dt><dd className="mono">{r.hash}</dd></div>}
      </dl>
      {r.assinaturas?.length > 0 && (
        <>
          <h2 className="h6 fw-bold mt-3">Assinaturas</h2>
          <ul className="doc-assinaturas">
            {r.assinaturas.map((a, i) => (
              <li key={i}>
                <strong>{a.nome}</strong> <span className="text-secondary">({a.papel})</span>
                <div className="small">{a.situacao === 'assinada' ? `Assinou em ${fmtDateTime(a.assinada_em)}` : 'Assinatura pendente'}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="small text-secondary mt-3 mb-0">
        Esta conferência mostra o número, a situação, as assinaturas e a integridade. O conteúdo do documento não é exibido aqui.
      </p>
    </div>
  )
}

// Conferência de autenticidade pelo código. `publico`: página aberta sem login (/verificar), com a marca do órgão.
export default function Verificar({ publico = false }) {
  const { codigo } = useParams()
  const navigate = useNavigate()
  const base = publico ? '/verificar' : '/documentos/verificar'
  const [texto, setTexto] = useState(codigo ? codigoFormatado(codigo) : '')
  const [estado, setEstado] = useState({ carregando: false, resultado: null, erro: '' })

  useEffect(() => {
    if (!codigo) { setEstado({ carregando: false, resultado: null, erro: '' }); return undefined }
    let vivo = true
    setEstado({ carregando: true, resultado: null, erro: '' })
    verificarDocumento(codigo)
      .then((resultado) => { if (vivo) setEstado({ carregando: false, resultado, erro: '' }) })
      .catch((err) => { if (vivo) setEstado({ carregando: false, resultado: null, erro: mensagemErroDocumento(err) }) })
    return () => { vivo = false }
  }, [codigo])

  const conferir = (e) => {
    e.preventDefault()
    const limpo = texto.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (limpo) navigate(`${base}/${limpo}`)
  }

  const formulario = (
    <form onSubmit={conferir} className="d-flex gap-2 flex-wrap align-items-end mb-3">
      <div className="flex-grow-1">
        <label htmlFor="verificar-codigo" className="form-label fw-semibold">Código de verificação</label>
        <input id="verificar-codigo" className="form-control mono" placeholder="XXXX-XXXX-XXXX" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={estado.carregando}>{estado.carregando ? 'Conferindo…' : 'Conferir'}</button>
    </form>
  )
  const resultado = (
    <>
      {estado.erro && <div className="alert alert-danger" role="alert">{estado.erro}</div>}
      {estado.resultado && <Resultado r={estado.resultado} />}
    </>
  )

  if (publico) {
    return (
      <Entrada>
        <div className="entrada__icone" aria-hidden="true"><i className="bi bi-patch-check" /></div>
        <h1 className="entrada__titulo">Verificar documento</h1>
        <p className="entrada__sub">Digite o código que aparece no rodapé do documento assinado para conferir se ele é autêntico.</p>
        {formulario}
        {resultado}
      </Entrada>
    )
  }
  return (
    <>
      <PageHeader title="Verificar autenticidade" subtitle="Digite o código que aparece no rodapé do documento assinado para conferir se ele é autêntico." />
      <Card>{formulario}{resultado}</Card>
    </>
  )
}

import { useEffect, useState } from 'react'
import { fmtDateTime } from '../../utils/format'
import { conferirArquivo, linkDoArquivo } from '../../services/documentos'
import { codigoFormatado, urlVerificacao } from '../../utils/documentosPlataforma'

// Texto com os trechos "[preencher: …]" em destaque (ainda faltam no documento)
function Texto({ x }) {
  const partes = String(x ?? '').split(/(\[preencher[^\]]*\])/g)
  return partes.map((t, i) => (i % 2 ? <mark key={i} className="doc-pendente">{t}</mark> : t))
}

const tamanho = (n) => (n >= 1048576 ? `${(n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

// Arquivo enviado: nome, tamanho e SHA-256 (que entra no texto assinado). Ao abrir, o arquivo guardado é
// baixado e conferido com o código registrado, para ninguém assinar um arquivo diferente do que foi enviado.
function Arquivo({ b, path }) {
  const [confere, setConfere] = useState(path ? 'conferindo' : null)
  useEffect(() => {
    if (!path) return undefined
    let vivo = true
    conferirArquivo(path, b.sha256).then((ok) => { if (vivo) setConfere(ok ? 'ok' : 'diferente') }).catch(() => { if (vivo) setConfere('erro') })
    return () => { vivo = false }
  }, [path, b.sha256])
  async function abrir() {
    const aba = window.open('', '_blank')
    try {
      const url = await linkDoArquivo(path)
      if (aba) { aba.opener = null; aba.location.href = url } else window.location.href = url
    } catch { aba?.close() }
  }
  return (
    <div className="doc-arquivo">
      <i className="bi bi-file-earmark-arrow-down doc-arquivo__icone" aria-hidden="true" />
      <div className="doc-arquivo__dados">
        <strong>{b.nome}</strong>
        <span>{b.tipo}{b.tamanho ? ` · ${tamanho(Number(b.tamanho))}` : ''}</span>
        <span className="doc-arquivo__hash">SHA-256 do arquivo: {b.sha256}</span>
        {confere === 'conferindo' && <span className="doc-arquivo__conf">Conferindo o arquivo guardado…</span>}
        {confere === 'ok' && <span className="doc-arquivo__conf doc-arquivo__conf--ok">✓ O arquivo guardado confere com o código registrado.</span>}
        {confere === 'diferente' && <span className="doc-arquivo__conf doc-arquivo__conf--erro" role="alert">ATENÇÃO: o arquivo guardado NÃO confere com o código registrado.</span>}
        {confere === 'erro' && <span className="doc-arquivo__conf">Não foi possível conferir o arquivo agora.</span>}
      </div>
      {path && <button type="button" className="btn btn-sm btn-outline-primary no-print" onClick={abrir}>Abrir o arquivo</button>}
    </div>
  )
}

// O documento é desenhado a partir de blocos de TEXTO: nada do que foi digitado vira marcação (HTML).
function Bloco({ b, path }) {
  switch (b.t) {
    case 'cab': return (
      <header className="doc-cab">
        <div className="doc-cab__orgao">{b.orgao}</div>
        {b.numero && <div className="doc-cab__numero">{b.numero}</div>}
      </header>
    )
    case 'titulo': return <h1 className="doc-titulo"><Texto x={b.x} /></h1>
    case 'sub': return <h2 className="doc-sub"><Texto x={b.x} /></h2>
    case 'secao': return <h2 className="doc-secao"><Texto x={b.x} /></h2>
    case 'rotulo': return <h3 className="doc-rotulo"><Texto x={b.x} /></h3>
    case 'p': return <p><Texto x={b.x} /></p>
    case 'campo': return <p className="doc-campo"><strong>{b.r}:</strong> <Texto x={b.x} /></p>
    case 'nota': return <p className="doc-nota"><Texto x={b.x} /></p>
    case 'lista': return <ul>{(b.itens || []).map((x, i) => <li key={i}><Texto x={x} /></li>)}</ul>
    case 'numerada': return <ol>{(b.itens || []).map((x, i) => <li key={i}><Texto x={x} /></li>)}</ol>
    case 'tabela': return (
      <div className="doc-tabela">
        <table>
          <thead><tr>{(b.cab || []).map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{(b.linhas || []).map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j}><Texto x={c} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
    case 'espaco': return <div className="doc-espaco" />
    case 'assina': return (
      <div className="doc-assina">
        <div className="doc-assina__linha" />
        <strong><Texto x={b.nome} /></strong>
        {b.cargo && <span>{b.cargo}</span>}
      </div>
    )
    case 'arquivo': return <Arquivo b={b} path={path} />
    default: return null
  }
}

// Rodapé com as assinaturas e o código de verificação (como nos sistemas de processo eletrônico)
function Rodape({ documento, assinaturas }) {
  const versao = (assinaturas || []).filter((a) => a.versao === documento.versao)
  const feitas = versao.filter((a) => a.status === 'assinada')
  const pendentes = versao.filter((a) => a.status === 'pendente')
  if (!documento.codigo_verificacao && !feitas.length) return null
  return (
    <footer className="doc-rodape" aria-label="Assinaturas e verificação">
      {feitas.map((a) => (
        <p key={a.id}>
          Documento assinado eletronicamente por <strong>{a.nome}</strong> ({a.papel}), em {fmtDateTime(a.assinada_em)}, com confirmação de senha.
        </p>
      ))}
      {documento.status === 'aguardando_assinatura' && pendentes.map((a) => (
        <p key={a.id} className="doc-rodape__pendente">Aguardando a assinatura de <strong>{a.nome}</strong> ({a.papel}).</p>
      ))}
      {documento.codigo_verificacao && (
        <p className="doc-rodape__verificacao">
          A autenticidade deste documento pode ser conferida em <span className="mono">{urlVerificacao(documento.codigo_verificacao)}</span>, com o
          código <strong className="mono">{codigoFormatado(documento.codigo_verificacao)}</strong>.
          {documento.hash && <><br />Código (SHA-256) do conteúdo: <span className="mono doc-hash">{documento.hash}</span></>}
        </p>
      )}
    </footer>
  )
}

// documento: { status, versao, hash, codigo_verificacao, ... }; corpo: blocos
export default function DocumentoView({ documento, corpo, assinaturas = [] }) {
  const blocos = corpo || documento?.corpo || []
  return (
    <article className={`doc doc--${documento?.status || 'rascunho'}`} aria-label="Documento">
      {documento?.status === 'rascunho' && <div className="doc-marca" aria-hidden="true">RASCUNHO</div>}
      {documento?.status === 'cancelado' && <div className="doc-marca doc-marca--cancelado" aria-hidden="true">CANCELADO</div>}
      {blocos.map((b, i) => <Bloco key={i} b={b} path={documento?.arquivo_path} />)}
      {documento && <Rodape documento={documento} assinaturas={assinaturas} />}
    </article>
  )
}

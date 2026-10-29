import { useMemo, useState } from 'react'
import { useGc } from '../context/GcContext'
import { Empty, GcGate, PageHeader, Pill } from '../components/gc/ui'
import PrimeirosPassos from '../components/gc/PrimeirosPassos'
import DocumentoModal from '../components/gc/DocumentoModal'
import AssinaturasPendentes from '../components/documentos/AssinaturasPendentes'
import { useAssinaturasPendentes } from '../components/useDocumentos'
import { useAuth } from '../context/AuthContext'
import { PublicacaoModal } from '../components/gc/Formalizacao'
import { OSAssinaturas } from '../components/gc/OSTable'
import { INSTRUMENTO, TIPO_ORDEM } from '../utils/contrato'
import { minutaOrdem, minutaPortaria } from '../utils/documentos'
import { fmtDate } from '../utils/format'

// Atos encaminhados ao Gabinete: portaria (assinatura/publicação) e OS/OC (assinatura)
export default function Gabinete() {
  const { consolidados, params } = useGc()
  const { user } = useAuth()
  // documentos (assinatura eletrônica) à espera do Gabinete
  const docsParaAssinar = useAssinaturasPendentes({ ativo: true, usuarioId: user?.id })
  const [doc, setDoc] = useState(null)
  const [publicar, setPublicar] = useState(null)
  const [assinar, setAssinar] = useState(null)

  const portarias = useMemo(() => consolidados.filter((k) => k.c.portaria_status === 'aguardando_publicacao'), [consolidados])
  const ordens = useMemo(() => consolidados.flatMap((k) => k.b.os
    .filter((o) => !o.cancelado && o.status === 'aguardando_assinatura').map((os) => ({ k, os }))), [consolidados])

  const titulo = (k) => `${INSTRUMENTO[k.c.instrumento] || 'Contrato'} ${k.c.numero} — ${k.c.contratada}`

  const total = portarias.length + ordens.length

  return (
    <GcGate>
      <PageHeader
        title="Atos para assinatura"
        subtitle={total === 0
          ? 'Nenhum ato aguardando o Gabinete.'
          : <>Há <mark>{total} {total === 1 ? 'ato' : 'atos'}</mark> aguardando o Gabinete: portarias de designação e Ordens de Serviço/Compra.</>}
      />

      {docsParaAssinar.length > 0 && <AssinaturasPendentes itens={docsParaAssinar} />}

      <PrimeirosPassos />

      <h2 className="grupo-titulo">Portarias aguardando assinatura e publicação <span className="mono">{portarias.length}</span></h2>
      <div className="card mb-4">
        {portarias.length === 0 ? <Empty icon="bi-file-earmark-check">Nenhuma portaria aguardando.</Empty> : (
          <ul className="tarefas">
            {portarias.map((k) => (
              <li key={k.id} className="tarefa tarefa--warning ato">
                <span className="tarefa__icone" aria-hidden="true"><i className="bi bi-file-earmark-person" /></span>
                <div className="min-w-0">
                  <div className="tarefa__titulo">Portaria de designação · <span className="mono">{k.c.numero}</span> — {k.c.contratada}</div>
                  <div className="tarefa__ref">
                    Fiscal titular: {k.fiscalTitular?.nome || '—'} · Substituto: {k.fiscalSubstituto?.nome || '—'} · SEI <span className="mono">{k.c.sei_processo || '—'}</span>
                  </div>
                </div>
                <div className="ato__acoes">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setDoc(minutaPortaria(k, params))}>Ver minuta</button>
                  <button className="btn btn-sm btn-success" onClick={() => setPublicar(k)}>Registrar publicação</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="grupo-titulo">OS / OC aguardando assinatura <span className="mono">{ordens.length}</span></h2>
      <div className="card mb-4">
        {ordens.length === 0 ? <Empty icon="bi-clipboard-check">Nenhuma ordem aguardando assinatura.</Empty> : (
          <ul className="tarefas">
            {ordens.map(({ k, os }) => (
              <li key={os.id} className="tarefa tarefa--warning ato">
                <span className="tarefa__icone" aria-hidden="true"><i className="bi bi-clipboard-check" /></span>
                <div className="min-w-0">
                  <div className="tarefa__titulo">{TIPO_ORDEM[os.tipo] || TIPO_ORDEM.os} {os.numero_os || ''} · {titulo(k)}</div>
                  <div className="ato__assinaturas">
                    <span>Presidente {os.assinatura_presidente_em ? <Pill kind="success">assinou {fmtDate(os.assinatura_presidente_em)}</Pill> : <Pill kind="secondary">pendente</Pill>}</span>
                    <span>Diretor Financeiro {os.assinatura_diretor_em ? <Pill kind="success">assinou {fmtDate(os.assinatura_diretor_em)}</Pill> : <Pill kind="secondary">pendente</Pill>}</span>
                  </div>
                </div>
                <div className="ato__acoes">
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setDoc(minutaOrdem(k, os, params))}>Ver documento</button>
                  <button className="btn btn-sm btn-success" onClick={() => setAssinar(os)}>Registrar assinaturas</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {doc && <DocumentoModal doc={doc} onClose={() => setDoc(null)} />}
      {publicar && <PublicacaoModal k={publicar} onClose={() => setPublicar(null)} />}
      {assinar && <OSAssinaturas os={assinar} onClose={() => setAssinar(null)} />}
    </GcGate>
  )
}

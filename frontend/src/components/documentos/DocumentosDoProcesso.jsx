import { Link } from 'react-router-dom'
import { Card, Empty, Pill } from '../gc/ui'
import { modeloPorCodigo } from '../../modelos/catalogo'
import { STATUS, ordenarDocumentos } from '../../utils/documentosPlataforma'
import { fmtDateTime } from '../../utils/format'

// Documentos produzidos para o processo ou enviados como arquivo
export default function DocumentosDoProcesso({ processoId, documentos, podeCriar }) {
  const lista = ordenarDocumentos(documentos.filter((d) => d.processo_id === processoId))
  return (
    <Card title="Documentos do processo" subtitle="Ofícios, despachos, pareceres e arquivos ligados a este processo. Todos podem ser assinados aqui."
      actions={podeCriar && (
        <span className="d-flex gap-2">
          <Link to={`/documentos/novo?processo=${processoId}&arquivo=1`} className="btn btn-sm btn-outline-primary"><i className="bi bi-upload me-1" />Enviar arquivo</Link>
          <Link to={`/documentos/novo?processo=${processoId}`} className="btn btn-sm btn-primary"><i className="bi bi-file-earmark-plus me-1" />Novo documento</Link>
        </span>
      )}>
      {lista.length === 0 ? (
        <Empty icon="bi-file-earmark-richtext">Nenhum documento neste processo ainda.</Empty>
      ) : (
        <ul className="doc-assinaturas">
          {lista.map((d) => (
            <li key={d.id} className="d-flex justify-content-between align-items-start gap-3">
              <div className="min-w-0">
                <Link to={`/documentos/${d.id}`} className="mono fw-semibold">{d.numero}</Link>
                <div className="text-truncate">{d.titulo}</div>
                <div className="small text-secondary">{d.modelo === 'arquivo' ? 'Arquivo enviado' : modeloPorCodigo(d.modelo)?.nome || d.modelo} · {d.criado_por_nome} · {fmtDateTime(d.atualizado_em)}</div>
              </div>
              <Pill kind={STATUS[d.status].kind}>{STATUS[d.status].label}</Pill>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

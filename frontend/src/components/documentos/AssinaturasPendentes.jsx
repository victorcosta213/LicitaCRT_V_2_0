import { Link } from 'react-router-dom'
import { Card, Empty } from '../gc/ui'
import { fmtDateTime } from '../../utils/format'

// Documentos que esperam a assinatura da pessoa (da Minha mesa, da Visão geral e do Gabinete)
export default function AssinaturasPendentes({ itens, titulo = 'Aguardando a sua assinatura' }) {
  return (
    <Card title={titulo} subtitle="Leia o documento e assine com a sua senha." flush>
      {itens.length === 0 ? (
        <div className="p-3"><Empty icon="bi-pen">Nenhum documento aguardando a sua assinatura.</Empty></div>
      ) : (
        <ul className="tarefas">
          {itens.map(({ documento, assinatura }) => (
            <li key={assinatura.id} className="tarefa tarefa--compacta tarefa--warning">
              <Link to={`/documentos/${documento.id}`} className="tarefa__link">
                <span className="tarefa__icone" aria-hidden="true"><i className="bi bi-pen" /></span>
                <div className="min-w-0">
                  <div className="tarefa__titulo text-truncate">{documento.titulo}</div>
                  <div className="tarefa__ref"><span className="mono">{documento.numero}</span> · como {assinatura.papel} · enviado por {documento.criado_por_nome}</div>
                </div>
                <span className="tarefa__prazo small text-secondary">{fmtDateTime(documento.atualizado_em)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

import { Link } from 'react-router-dom'
import { Prazo } from './ui'

const ICONE = {
  'Competência': 'bi-calendar2-check', 'Vigência': 'bi-hourglass-split', 'Garantia': 'bi-shield-check',
  'Reajuste': 'bi-graph-up-arrow', 'Ocorrência': 'bi-exclamation-triangle', 'Pendência': 'bi-flag',
  'OS/OC': 'bi-clipboard-check', 'Fiscalização': 'bi-person-badge', 'Contratação': 'bi-inbox',
  'Cadastro': 'bi-pencil-square', 'Tramitação': 'bi-diagram-3', 'Documento': 'bi-file-earmark-richtext', 'Financeiro': 'bi-cash-coin', 'Processo': 'bi-kanban',
}

// Item de tarefa: { severidade, categoria, titulo, ref, sub, dias, to }
// compacta = a linha inteira é o link (colunas estreitas)
export function Tarefa({ t, acao = 'Abrir', compacta }) {
  if (compacta) {
    return (
      <li className={`tarefa tarefa--compacta tarefa--${t.severidade}`}>
        <Link to={t.to} className="tarefa__link">
          <span className="tarefa__icone" aria-hidden="true"><i className={`bi ${ICONE[t.categoria] || 'bi-dot'}`} /></span>
          <div className="min-w-0">
            <div className="tarefa__titulo">{t.titulo}</div>
            <div className="tarefa__ref">
              {t.ref && <span className="mono">{t.ref}</span>}
              {t.ref && t.sub && ' · '}
              {t.sub}
            </div>
          </div>
          <span className="tarefa__prazo"><Prazo dias={t.dias} /></span>
        </Link>
      </li>
    )
  }
  return (
    <li className={`tarefa tarefa--${t.severidade}`}>
      <span className="tarefa__icone" aria-hidden="true"><i className={`bi ${ICONE[t.categoria] || 'bi-dot'}`} /></span>
      <div className="min-w-0">
        <div className="tarefa__titulo">{t.titulo}</div>
        <div className="tarefa__ref">
          {t.ref && <span className="mono">{t.ref}</span>}
          {t.ref && t.sub && ' · '}
          {t.sub}
        </div>
      </div>
      <span className="tarefa__prazo"><Prazo dias={t.dias} /></span>
      <Link to={t.to} className="btn btn-sm btn-outline-secondary">{acao}</Link>
    </li>
  )
}

export function ListaTarefas({ itens, limite, mais, compacta }) {
  const visiveis = limite ? itens.slice(0, limite) : itens
  return (
    <>
      <ul className="tarefas">
        {visiveis.map((t) => <Tarefa key={t.id} t={t} compacta={compacta} />)}
      </ul>
      {mais && itens.length > visiveis.length && (
        <div className="card-footer py-2 small">
          <Link to={mais.to}>{mais.label(itens.length)}</Link>
        </div>
      )}
    </>
  )
}

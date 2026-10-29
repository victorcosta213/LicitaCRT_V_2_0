import { Link } from 'react-router-dom'
import { Pill } from './ui'
import { fmtDate } from '../../utils/format'

// Processos parados ou atrasados, na forma de { p, e } (ver processosTravados)
export default function ListaTravados({ itens, unidadesPorId, limite }) {
  return (
    <ul className="tarefas">
      {itens.slice(0, limite).map(({ p, e }) => (
        <li key={p.id} className={`tarefa tarefa--compacta tarefa--${e.atrasado ? 'danger' : 'warning'}`}>
          <Link to={`/processos/${p.id}`} className="tarefa__link">
            <span className="tarefa__icone" aria-hidden="true"><i className="bi bi-hourglass-split" /></span>
            <div className="min-w-0">
              <div className="tarefa__titulo text-truncate">{p.assunto}</div>
              <div className="tarefa__ref">
                <span className="mono">{p.numero}</span> · {unidadesPorId.get(p.unidade_atual)?.sigla || '—'}
                {p.prazo && <> · prazo {fmtDate(p.prazo)}</>}
              </div>
            </div>
            <span className="tarefa__prazo"><Pill kind={e.kind}>{e.diasNaUnidade} d</Pill></span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Pill } from './ui'
import CompetenciaModal from './CompetenciaModal'
import ExecucaoModal from './ExecucaoModal'
import { useGcActions } from './useGcActions'
import { brl, fmtCompetencia } from '../../utils/format'
import { minhaVez } from '../../utils/contrato'

// rows: [{ k, comp }]  (comp = competência consolidada, com .status / .execucao)
export default function CompetenciasTable({ rows, mostrarContrato = true, vazio }) {
  const { can, role, user } = useGcActions()
  const [edit, setEdit] = useState(null)
  const [fin, setFin] = useState(null)

  const podeFinanceiro = can('financeiro.execucao')

  if (!rows.length) return <Empty>{vazio || 'Nenhuma competência.'}</Empty>

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 gc-table">
          <thead>
            <tr>
              <th>Competência</th>
              {mostrarContrato && <th>Contratação</th>}
              <th>Situação</th>
              <th>NF</th>
              <th className="text-end">Valor líquido</th>
              <th className="d-none d-xxl-table-cell">Fiscal</th>
              <th className="text-end">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ k, comp }) => {
              const vez = minhaVez(k, comp, role, user?.id)
              const liq = comp.execucao?.valor_liquidado
              const pago = comp.execucao?.valor_pago
              return (
                <tr key={comp.id}>
                  <td className="fw-semibold text-nowrap">{fmtCompetencia(comp.competencia)}</td>
                  {mostrarContrato && (
                    <td style={{ maxWidth: 260 }}>
                      <Link to={`/contratos/${k.id}?aba=competencias`} className="gc-num fw-semibold text-decoration-none">{k.c.numero}</Link>
                      <div className="small text-secondary text-truncate">{k.c.contratada}</div>
                    </td>
                  )}
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <Pill kind={comp.status.kind}>{comp.status.label}</Pill>
                      {comp.status.flags.map((f) => <Pill key={f.label} kind={f.kind}>{f.label}</Pill>)}
                    </div>
                  </td>
                  <td className="small text-nowrap">{comp.nf_numero ? <span className="mono">nº {comp.nf_numero}</span> : '—'}</td>
                  <td className="text-end text-nowrap">
                    <div className="num">{comp.valor_liquido > 0 ? brl(comp.valor_liquido) : '—'}</div>
                    {(liq > 0 || pago > 0) && (
                      <div className="small text-secondary num">
                        {liq > 0 && <>liq. {brl(liq)}</>}{liq > 0 && pago > 0 && ' · '}{pago > 0 && <>pago {brl(pago)}</>}
                      </div>
                    )}
                  </td>
                  <td className="small d-none d-xxl-table-cell">{k.fiscalEmAtuacao?.nome || comp.fiscal_nome || '—'}</td>
                  <td className="text-end text-nowrap">
                    {podeFinanceiro && comp.liberado_financeiro && (
                      <button className="btn btn-sm btn-primary me-1" onClick={() => setFin({ k, comp })}>
                        <i className="bi bi-cash-coin me-1" />Lançar
                      </button>
                    )}
                    <button
                      className={`btn btn-sm ${vez ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setEdit({ k, comp })}
                    >
                      {vez ? 'Tratar' : 'Abrir'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {edit && <CompetenciaModal k={edit.k} comp={edit.comp} onClose={() => setEdit(null)} />}
      {fin && <ExecucaoModal k={fin.k} comp={fin.comp} onClose={() => setFin(null)} />}
    </>
  )
}

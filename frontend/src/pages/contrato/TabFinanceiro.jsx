import { useState } from 'react'
import { Card, Empty, Indicadores, Pill, SeiRef } from '../../components/gc/ui'
import FormModal from '../../components/gc/FormModal'
import ExecucaoModal from '../../components/gc/ExecucaoModal'
import { useGcActions } from '../../components/gc/useGcActions'
import { brl, fmtCompetencia, fmtDate, hojeISO } from '../../utils/format'

// Saldos distintos do contrato (nunca um único "saldo"), na ordem do dinheiro
export function SaldosContrato({ k }) {
  return (
    <Indicadores fluxo itens={[
      { label: 'Contratado', value: brl(k.valorAtualizado), hint: `inicial ${brl(k.valorInicial)} ${k.acrescimos >= 0 ? '+' : '−'} eventos ${brl(Math.abs(k.acrescimos))}` },
      { label: 'Empenhado', value: brl(k.empenhado), hint: `saldo a liquidar ${brl(k.saldoEmpenhos)}`, kind: k.saldoEmpenhos < 0 ? 'danger' : undefined },
      { label: 'Reconhecido', value: brl(k.execucaoReconhecida), hint: `saldo a executar ${brl(k.saldoExecucao)}`, kind: k.saldoExecucao < 0 ? 'danger' : undefined },
      { label: 'Liquidado', value: brl(k.liquidado), hint: `${k.empenhos.length} empenho(s)` },
      {
        label: 'Pago', value: brl(k.pago),
        hint: k.pendentePagamento > 0 ? `${brl(k.pendentePagamento)} aguardando pagamento` : k.retido > 0 ? `retenções ${brl(k.retido)}` : 'nada pendente',
        kind: k.pendentePagamento > 0 ? 'warning' : undefined,
      },
    ]} />
  )
}

export default function TabFinanceiro({ k }) {
  const { salvar, cancelar, can } = useGcActions()
  const podeEmp = can('financeiro.empenho')
  const podeExec = can('financeiro.execucao')
  const [emp, setEmp] = useState(null)   // { row? }
  const [mov, setMov] = useState(null)   // { empenho, tipo, row? }
  const [exec, setExec] = useState(null) // comp

  return (
    <>
      <SaldosContrato k={k} />

      <Card
        title="Empenhos"
        flush
        actions={podeEmp && (
          <button className="btn btn-sm btn-primary" onClick={() => setEmp({})}>
            <i className="bi bi-plus-lg me-1" />Empenho
          </button>
        )}
      >
        {k.empenhos.length === 0 ? <Empty>Nenhum empenho cadastrado.</Empty> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 gc-table">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">Empenho</th><th>Data</th>
                  <th className="text-end">Inicial</th><th className="text-end">Reforços</th>
                  <th className="text-end">Anulações</th><th className="text-end">Atualizado</th>
                  <th className="text-end">Liquidado</th><th className="text-end">Saldo</th>
                  <th>SEI</th><th />
                </tr>
              </thead>
              <tbody>
                {k.empenhos.map((e) => (
                  <tr key={e.id}>
                    <td className="ps-3 fw-semibold">
                      {e.numero}/{e.exercicio}
                      {e.fonte_dotacao && <div className="small text-secondary">{e.fonte_dotacao}</div>}
                    </td>
                    <td>{fmtDate(e.data)}</td>
                    <td className="text-end">{brl(e.valor_inicial)}</td>
                    <td className="text-end text-success">{e.reforcos ? brl(e.reforcos) : '—'}</td>
                    <td className="text-end text-danger">{e.anulacoes ? brl(e.anulacoes) : '—'}</td>
                    <td className="text-end fw-semibold">{brl(e.valorAtual)}</td>
                    <td className="text-end">{brl(e.liquidado)}</td>
                    <td className={`text-end fw-semibold ${e.saldo < 0 ? 'text-danger' : ''}`}>{brl(e.saldo)}</td>
                    <td><SeiRef documento={e.sei_documento} link={e.sei_link} /></td>
                    <td className="text-end pe-3 text-nowrap">
                      {podeEmp && (
                        <>
                          <button className="btn btn-sm btn-light me-1" title="Reforço" onClick={() => setMov({ empenho: e, tipo: 'reforco' })}>
                            <i className="bi bi-plus-circle text-success" />
                          </button>
                          <button className="btn btn-sm btn-light me-1" title="Anulação" onClick={() => setMov({ empenho: e, tipo: 'anulacao' })}>
                            <i className="bi bi-dash-circle text-danger" />
                          </button>
                          <button className="btn btn-sm btn-light me-1" title="Editar" onClick={() => setEmp({ row: e })}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button className="btn btn-sm btn-light text-danger" title="Cancelar empenho" onClick={() => cancelar('empenhos', e.id)}>
                            <i className="bi bi-x-circle" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Execução financeira por competência" flush>
        {k.competencias.length === 0 ? <Empty>Sem competências.</Empty> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 gc-table">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">Competência</th><th className="text-end">Atestado</th>
                  <th>Empenho</th><th className="text-end">Liquidado</th><th className="text-end">Pago</th>
                  <th className="text-end">Pendente</th><th>Situação</th><th />
                </tr>
              </thead>
              <tbody>
                {k.competencias.map((c) => {
                  const e = k.empenhos.find((x) => x.id === c.execucao?.empenho_id)
                  return (
                    <tr key={c.id}>
                      <td className="ps-3 fw-semibold">{fmtCompetencia(c.competencia)}</td>
                      <td className="text-end">{c.atestado ? brl(c.valor_liquido) : '—'}</td>
                      <td>{e ? `${e.numero}/${e.exercicio}` : '—'}</td>
                      <td className="text-end">{c.execucao?.valor_liquidado != null ? brl(c.execucao.valor_liquidado) : '—'}</td>
                      <td className="text-end">{c.execucao?.valor_pago != null ? brl(c.execucao.valor_pago) : '—'}</td>
                      <td className="text-end">{c.situacaoFin.pendente > 0 ? brl(c.situacaoFin.pendente) : '—'}</td>
                      <td>
                        {c.liberado_financeiro
                          ? <Pill kind={c.situacaoFin.kind}>{c.situacaoFin.label}</Pill>
                          : <span className="small text-secondary">aguardando gestão</span>}
                      </td>
                      <td className="text-end pe-3">
                        {podeExec && c.liberado_financeiro && (
                          <button className="btn btn-sm btn-outline-primary" onClick={() => setExec(c)}>Lançar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {emp && (
        <FormModal
          title={emp.row ? `Editar empenho ${emp.row.numero}` : 'Novo empenho'}
          fields={[
            { name: 'numero', label: 'Nº do empenho', col: 4, required: true },
            { name: 'exercicio', label: 'Exercício', type: 'number', col: 4, required: true, step: 1 },
            { name: 'data', label: 'Data', type: 'date', col: 4 },
            { name: 'valor_inicial', label: 'Valor inicial (R$)', type: 'money', col: 4, required: true },
            { name: 'fonte_dotacao', label: 'Fonte / dotação', col: 8 },
            { name: 'sei_documento', label: 'Documento SEI', col: 4 },
            { name: 'sei_link', label: 'Link SEI', col: 8 },
            { name: 'observacao', label: 'Observação', type: 'textarea', col: 12 },
          ]}
          initial={emp.row || { exercicio: new Date().getFullYear(), data: hojeISO() }}
          onSubmit={(v) => salvar('empenhos', emp.row ? v : { ...v, contrato_id: k.id }, emp.row?.id)}
          onClose={() => setEmp(null)}
        />
      )}

      {mov && (
        <FormModal
          title={`${mov.tipo === 'reforco' ? 'Reforço' : 'Anulação'} — empenho ${mov.empenho.numero}/${mov.empenho.exercicio}`}
          size="md"
          fields={[
            { name: 'valor', label: 'Valor (R$)', type: 'money', col: 6, required: true },
            { name: 'data', label: 'Data', type: 'date', col: 6 },
            { name: 'sei_documento', label: 'Documento SEI', col: 12 },
            { name: 'observacao', label: 'Observação', type: 'textarea', col: 12 },
          ]}
          initial={{ data: hojeISO() }}
          onSubmit={async (v) => {
            if (mov.tipo === 'anulacao' && v.valor > mov.empenho.saldo + 0.005) {
              throw new Error(`Anulação superior ao saldo do empenho (${brl(mov.empenho.saldo)}).`)
            }
            await salvar('movs', {
              ...v, tipo: mov.tipo, empenho_id: mov.empenho.id, contrato_id: k.id,
            })
          }}
          onClose={() => setMov(null)}
        />
      )}

      {exec && <ExecucaoModal k={k} comp={exec} onClose={() => setExec(null)} />}
    </>
  )
}

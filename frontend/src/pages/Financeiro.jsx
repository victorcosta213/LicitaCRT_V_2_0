import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useGc } from '../context/GcContext'
import { Card, Empty, GcGate, Indicadores, PageHeader, Pill, Tabs } from '../components/gc/ui'
import CompetenciasTable from '../components/gc/CompetenciasTable'
import FormModal from '../components/gc/FormModal'
import { useGcActions } from '../components/gc/useGcActions'
import { painelFinanceiro } from '../utils/contrato'
import { brl, exercicioDe, fmtCompetencia, fmtDate, hojeISO, num } from '../utils/format'
import { exportarXlsx } from '../utils/exportar'

export default function Financeiro() {
  const { consolidados } = useGc()
  const { can, salvar } = useGcActions()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const aba = sp.get('aba') || 'fila'
  const setAba = (a) => setSp({ aba: a }, { replace: true })
  const [novoEmp, setNovoEmp] = useState(false)

  const p = useMemo(() => painelFinanceiro(consolidados), [consolidados])

  const fila = useMemo(
    () => consolidados.flatMap((k) => k.competencias
      .filter((c) => c.status.dono === 'financeiro')
      .map((comp) => ({ k, comp })))
      .sort((a, b) => String(a.comp.competencia).localeCompare(String(b.comp.competencia))),
    [consolidados],
  )

  const porContrato = useMemo(
    () => consolidados.filter((k) => k.empenhos.length || k.liquidado || k.execucaoReconhecida || k.c.situacao === 'ativo'),
    [consolidados],
  )

  const porCompetencia = useMemo(() => {
    const m = new Map()
    for (const k of consolidados) {
      for (const c of k.competencias) {
        const r = m.get(c.competencia) || { competencia: c.competencia, reconhecido: 0, liquidado: 0, pago: 0, qtd: 0 }
        if (c.atestado && !c.suspensa) r.reconhecido += num(c.valor_liquido)
        r.liquidado += num(c.execucao?.valor_liquidado)
        r.pago += num(c.execucao?.valor_pago)
        r.qtd += 1
        m.set(c.competencia, r)
      }
    }
    return [...m.values()].sort((a, b) => b.competencia.localeCompare(a.competencia))
  }, [consolidados])

  const empenhos = useMemo(
    () => consolidados.flatMap((k) => k.empenhos.map((e) => ({ k, e })))
      .sort((a, b) => (b.e.exercicio - a.e.exercicio) || String(a.e.numero).localeCompare(String(b.e.numero))),
    [consolidados],
  )

  function exportar() {
    exportarXlsx('financeiro-por-contrato', [
      { key: 'numero', label: 'Contrato' }, { key: 'contratada', label: 'Contratada' },
      { key: 'valor', label: 'Valor atualizado' }, { key: 'empenhado', label: 'Empenhado' },
      { key: 'saldoEmp', label: 'Saldo dos empenhos' }, { key: 'exec', label: 'Executado reconhecido' },
      { key: 'liq', label: 'Liquidado' }, { key: 'pago', label: 'Pago' }, { key: 'pend', label: 'Pendente de pagamento' },
    ], porContrato.map((k) => ({
      numero: k.c.numero, contratada: k.c.contratada, valor: k.valorAtualizado, empenhado: k.empenhado,
      saldoEmp: k.saldoEmpenhos, exec: k.execucaoReconhecida, liq: k.liquidado, pago: k.pago, pend: k.pendentePagamento,
    })), 'Financeiro')
  }

  const tabs = [
    { key: 'fila', label: 'Fila de liquidação e pagamento', count: fila.length },
    { key: 'contratos', label: 'Por contrato' },
    { key: 'exercicio', label: 'Por exercício' },
    { key: 'competencia', label: 'Por competência' },
    { key: 'empenhos', label: 'Empenhos', count: empenhos.length },
  ]

  return (
    <GcGate>
      <PageHeader
        title="Painel financeiro"
        subtitle="Valor contratual, empenho, liquidação e pagamento — sempre separados."
        actions={(
          <>
            <button className="btn btn-outline-secondary" onClick={exportar}>
              <i className="bi bi-file-earmark-excel me-2" />Exportar
            </button>
            {can('financeiro.empenho') && (
              <button className="btn btn-primary" onClick={() => setNovoEmp(true)}>
                <i className="bi bi-plus-lg me-2" />Novo empenho
              </button>
            )}
          </>
        )}
      />

      <Indicadores fluxo itens={[
        { label: 'Contratado', value: brl(p.valorContratualAtivo), hint: 'contratações ativas' },
        { label: 'Empenhado', value: brl(p.empenhado), hint: `saldo a liquidar ${brl(p.saldoEmpenhos)}`, kind: p.saldoEmpenhos < 0 ? 'danger' : undefined },
        { label: 'Reconhecido', value: brl(p.reconhecido), hint: 'competências atestadas' },
        { label: 'Liquidado', value: brl(p.liquidado), hint: 'lançado pelo Financeiro' },
        { label: 'Pago', value: brl(p.pago), hint: p.pendente > 0 ? `${brl(p.pendente)} aguardando pagamento` : 'nada aguardando pagamento', kind: p.pendente > 0 ? 'warning' : 'success' },
      ]} />

      <Tabs tabs={tabs} active={aba} onChange={setAba} />

      {aba === 'fila' && (
        <Card flush title="Competências liberadas pela gestão">
          <CompetenciasTable rows={fila} vazio="Nenhuma competência aguardando liquidação ou pagamento." />
        </Card>
      )}

      {aba === 'contratos' && (
        <Card flush title="Execução por contrato — clique para ver a composição">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 gc-table">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">Contrato</th><th className="text-end">Valor atual</th>
                  <th className="text-end">Empenhado</th><th className="text-end">Executado</th>
                  <th className="text-end">Liquidado</th><th className="text-end">Pago</th>
                  <th className="text-end pe-3">Pendente</th>
                </tr>
              </thead>
              <tbody>
                {porContrato.length === 0 && <tr><td colSpan="7"><Empty /></td></tr>}
                {porContrato.map((k) => (
                  <tr key={k.id} className="gc-row-link" onClick={() => navigate(`/contratos/${k.id}?aba=financeiro`)}>
                    <td className="ps-3">
                      <div className="fw-semibold">{k.c.numero}</div>
                      <div className="small text-secondary">{k.c.contratada}</div>
                    </td>
                    <td className="text-end">{brl(k.valorAtualizado)}</td>
                    <td className="text-end">{brl(k.empenhado)}</td>
                    <td className="text-end">{brl(k.execucaoReconhecida)}</td>
                    <td className="text-end">{brl(k.liquidado)}</td>
                    <td className="text-end">{brl(k.pago)}</td>
                    <td className="text-end pe-3">{k.pendentePagamento > 0 ? <Pill kind="warning">{brl(k.pendentePagamento)}</Pill> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {aba === 'exercicio' && (
        <Card flush title="Execução por exercício">
          {p.porExercicio.length === 0 ? <Empty /> : (
            <div className="table-responsive">
              <table className="table align-middle mb-0 gc-table">
                <thead className="table-light">
                  <tr><th className="ps-3">Exercício</th><th className="text-end">Empenhado</th>
                    <th className="text-end">Reconhecido</th><th className="text-end">Liquidado</th><th className="text-end pe-3">Pago</th></tr>
                </thead>
                <tbody>
                  {p.porExercicio.map((r) => (
                    <tr key={r.ano}>
                      <td className="ps-3 fw-semibold">{r.ano}</td>
                      <td className="text-end">{brl(r.empenhado)}</td>
                      <td className="text-end">{brl(r.reconhecido)}</td>
                      <td className="text-end">{brl(r.liquidado)}</td>
                      <td className="text-end pe-3">{brl(r.pago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {aba === 'competencia' && (
        <Card flush title="Execução por competência">
          {porCompetencia.length === 0 ? <Empty /> : (
            <div className="table-responsive">
              <table className="table align-middle mb-0 gc-table">
                <thead className="table-light">
                  <tr><th className="ps-3">Competência</th><th className="text-end">Contratos</th>
                    <th className="text-end">Reconhecido</th><th className="text-end">Liquidado</th><th className="text-end pe-3">Pago</th></tr>
                </thead>
                <tbody>
                  {porCompetencia.map((r) => (
                    <tr key={r.competencia}>
                      <td className="ps-3 fw-semibold">{fmtCompetencia(r.competencia)}</td>
                      <td className="text-end">{r.qtd}</td>
                      <td className="text-end">{brl(r.reconhecido)}</td>
                      <td className="text-end">{brl(r.liquidado)}</td>
                      <td className="text-end pe-3">{brl(r.pago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {aba === 'empenhos' && (
        <Card flush title="Empenhos de todos os contratos">
          {empenhos.length === 0 ? <Empty>Nenhum empenho cadastrado.</Empty> : (
            <div className="table-responsive">
              <table className="table align-middle mb-0 gc-table">
                <thead className="table-light">
                  <tr><th className="ps-3">Empenho</th><th>Contrato</th><th>Data</th>
                    <th className="text-end">Atualizado</th><th className="text-end">Liquidado</th><th className="text-end pe-3">Saldo</th></tr>
                </thead>
                <tbody>
                  {empenhos.map(({ k, e }) => (
                    <tr key={e.id}>
                      <td className="ps-3 fw-semibold">{e.numero}/{e.exercicio}</td>
                      <td><Link to={`/contratos/${k.id}?aba=financeiro`} className="text-decoration-none">{k.c.numero}</Link>
                        <div className="small text-secondary">{k.c.contratada}</div></td>
                      <td>{fmtDate(e.data)}</td>
                      <td className="text-end">{brl(e.valorAtual)}</td>
                      <td className="text-end">{brl(e.liquidado)}</td>
                      <td className={`text-end pe-3 fw-semibold ${e.saldo < 0 ? 'text-danger' : ''}`}>{brl(e.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {novoEmp && (
        <FormModal
          title="Novo empenho"
          fields={[
            {
              name: 'contrato_id', label: 'Contrato', type: 'select', col: 12, required: true,
              options: consolidados.filter((k) => k.c.situacao !== 'encerrado')
                .map((k) => ({ value: k.id, label: `${k.c.numero} — ${k.c.contratada}` })),
            },
            { name: 'numero', label: 'Nº do empenho', col: 4, required: true },
            { name: 'exercicio', label: 'Exercício', type: 'number', col: 4, required: true, step: 1 },
            { name: 'data', label: 'Data', type: 'date', col: 4 },
            { name: 'valor_inicial', label: 'Valor inicial (R$)', type: 'money', col: 4, required: true },
            { name: 'fonte_dotacao', label: 'Fonte / dotação', col: 8 },
            { name: 'sei_documento', label: 'Documento SEI', col: 4 },
            { name: 'sei_link', label: 'Link SEI', col: 8 },
          ]}
          initial={{ exercicio: exercicioDe(hojeISO()), data: hojeISO() }}
          onSubmit={(v) => salvar('empenhos', v)}
          onClose={() => setNovoEmp(false)}
        />
      )}
    </GcGate>
  )
}

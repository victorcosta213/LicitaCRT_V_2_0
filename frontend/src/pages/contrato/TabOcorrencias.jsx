import { useState } from 'react'
import { Card, Empty, Pill } from '../../components/gc/ui'
import FormModal from '../../components/gc/FormModal'
import { useGcActions } from '../../components/gc/useGcActions'
import { OCORRENCIA_ABERTA, STATUS_OCORRENCIA, TIPO_OCORRENCIA } from '../../utils/contrato'
import { diasAte, fmtCompetencia, fmtDate, hojeISO } from '../../utils/format'

export default function TabOcorrencias({ k }) {
  const { salvar, cancelar, can, nome } = useGcActions()
  const [form, setForm] = useState(null)
  const podeEditar = can('ocorrencia.registrar')

  const rows = k.b.ocorrencias.filter((o) => !o.cancelado)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))

  async function gravar(v, row) {
    if (v.status === 'regularizada' && !v.resultado) {
      throw new Error('Informe o resultado/providência final para regularizar a ocorrência.')
    }
    await salvar('ocorrencias', row ? v : { ...v, contrato_id: k.id }, row?.id)
    // reflete na competência (sinalizador "houve ocorrência")
    if (v.competencia_id && !row) {
      const comp = k.competencias.find((c) => c.id === v.competencia_id)
      if (comp && !comp.houve_ocorrencia) {
        await salvar('competencias', { houve_ocorrencia: true }, comp.id)
      }
    }
  }

  return (
    <>
      <Card
        title="Ocorrências"
        flush
        actions={podeEditar && (
          <button className="btn btn-sm btn-primary" onClick={() => setForm({})}>
            <i className="bi bi-plus-lg me-1" />Registrar ocorrência
          </button>
        )}
      >
        {rows.length === 0 ? <Empty>Nenhuma ocorrência registrada.</Empty> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 gc-table">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">Data</th><th>Tipo</th><th>Descrição</th><th>Competência</th>
                  <th>Prazo</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const st = STATUS_OCORRENCIA[o.status]
                  const comp = k.competencias.find((c) => c.id === o.competencia_id)
                  const atraso = OCORRENCIA_ABERTA.includes(o.status) && o.prazo_concedido && diasAte(o.prazo_concedido) < 0
                  return (
                    <tr key={o.id}>
                      <td className="ps-3">{fmtDate(o.data)}</td>
                      <td className="fw-semibold">{TIPO_OCORRENCIA[o.tipo]}</td>
                      <td style={{ maxWidth: 360 }}>
                        <div>{o.descricao}</div>
                        {o.providencia && <div className="small text-secondary">Providência: {o.providencia}</div>}
                        {o.resposta_contratada && <div className="small text-secondary">Resposta: {o.resposta_contratada}</div>}
                      </td>
                      <td>{comp ? fmtCompetencia(comp.competencia) : '—'}</td>
                      <td className={atraso ? 'text-danger fw-semibold' : ''}>{fmtDate(o.prazo_concedido)}</td>
                      <td><Pill kind={st.kind}>{st.label}</Pill></td>
                      <td className="text-end pe-3 text-nowrap">
                        {podeEditar && (
                          <>
                            <button className="btn btn-sm btn-light me-1" onClick={() => setForm({ row: o })}><i className="bi bi-pencil" /></button>
                            <button className="btn btn-sm btn-light text-danger" title="Cancelar" onClick={() => cancelar('ocorrencias', o.id)}>
                              <i className="bi bi-x-circle" />
                            </button>
                          </>
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

      {form && (
        <FormModal
          title={form.row ? 'Editar ocorrência' : 'Registrar ocorrência'}
          size="xl"
          fields={[
            { name: 'data', label: 'Data', type: 'date', col: 3, required: true },
            {
              name: 'tipo', label: 'Tipo', type: 'select', col: 5, required: true,
              options: Object.entries(TIPO_OCORRENCIA).map(([value, label]) => ({ value, label })),
            },
            {
              name: 'competencia_id', label: 'Competência (se aplicável)', type: 'select', col: 4,
              options: k.competencias.map((c) => ({ value: c.id, label: fmtCompetencia(c.competencia) })),
            },
            { name: 'fiscal_nome', label: 'Fiscal responsável pelo registro', col: 6 },
            {
              name: 'status', label: 'Status', type: 'select', col: 6, required: true,
              options: Object.entries(STATUS_OCORRENCIA).map(([value, o]) => ({ value, label: o.label })),
            },
            { name: 'descricao', label: 'Descrição', type: 'textarea', col: 12, required: true },
            { name: 'providencia', label: 'Providência adotada', type: 'textarea', col: 6 },
            { name: 'prazo_concedido', label: 'Prazo concedido à contratada', type: 'date', col: 6 },
            { name: 'resposta_contratada', label: 'Resposta da contratada', type: 'textarea', col: 6 },
            { name: 'resultado', label: 'Resultado', type: 'textarea', col: 6 },
            { name: 'sei_documentos', label: 'Documentos SEI relacionados', col: 12, placeholder: 'Ex.: 12345678, 12345690' },
          ]}
          initial={form.row || { data: hojeISO(), status: 'aberta', fiscal_nome: nome }}
          onSubmit={(v) => gravar(v, form.row)}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}

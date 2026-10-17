import { useMemo, useState } from 'react'
import { Card, Empty } from '../../components/gc/ui'
import FormModal from '../../components/gc/FormModal'
import { useGcActions } from '../../components/gc/useGcActions'
import { TIPOS_DOCUMENTO, documentosReferenciados } from '../../utils/contrato'
import { fmtDate, hojeISO } from '../../utils/format'

function Link({ href }) {
  if (!href) return <span className="text-secondary">—</span>
  return <a href={href} target="_blank" rel="noreferrer"><i className="bi bi-box-arrow-up-right me-1" />abrir</a>
}

export default function TabDocumentos({ k }) {
  const { salvar, cancelar, can } = useGcActions()
  const [form, setForm] = useState(null)
  const indice = useMemo(() => documentosReferenciados(k), [k])
  const avulsos = k.b.documentos.filter((d) => !d.cancelado)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
  const pode = can('documento.registrar')

  return (
    <>
      <Card
        title="Dossiê digital — documentos avulsos"
        flush
        actions={pode && (
          <button className="btn btn-sm btn-primary" onClick={() => setForm({})}>
            <i className="bi bi-plus-lg me-1" />Registrar documento
          </button>
        )}
      >
        {avulsos.length === 0 ? <Empty>Nenhum documento registrado no índice.</Empty> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 gc-table">
              <thead className="table-light">
                <tr><th className="ps-3">Tipo</th><th>Nº SEI</th><th>Data</th><th>Descrição</th><th>Link</th><th /></tr>
              </thead>
              <tbody>
                {avulsos.map((d) => (
                  <tr key={d.id}>
                    <td className="ps-3 fw-semibold">{d.tipo}</td>
                    <td>{d.numero_sei || '—'}</td>
                    <td>{fmtDate(d.data)}</td>
                    <td>{d.descricao || '—'}</td>
                    <td><Link href={d.link} /></td>
                    <td className="text-end pe-3 text-nowrap">
                      {pode && (
                        <>
                          <button className="btn btn-sm btn-light me-1" onClick={() => setForm({ row: d })}><i className="bi bi-pencil" /></button>
                          <button className="btn btn-sm btn-light text-danger" onClick={() => cancelar('documentos', d.id)}><i className="bi bi-x-circle" /></button>
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

      <Card title="Índice automático (documentos SEI citados nos lançamentos)" flush>
        {indice.length === 0 ? <Empty>Nenhum documento SEI informado nos lançamentos do contrato.</Empty> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 gc-table">
              <thead className="table-light">
                <tr><th className="ps-3">Documento</th><th>Nº SEI</th><th>Data</th><th>Origem</th><th>Link</th></tr>
              </thead>
              <tbody>
                {indice.map((d, i) => (
                  <tr key={`${d.tipo}-${d.sei}-${i}`}>
                    <td className="ps-3 fw-semibold">{d.tipo}</td>
                    <td>{d.sei || '—'}</td>
                    <td>{fmtDate(d.data)}</td>
                    <td className="small text-secondary">{d.origem}</td>
                    <td><Link href={d.link} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {form && (
        <FormModal
          title={form.row ? 'Editar documento' : 'Registrar documento no dossiê'}
          fields={[
            { name: 'tipo', label: 'Tipo de documento', type: 'select', col: 6, required: true, options: TIPOS_DOCUMENTO },
            { name: 'numero_sei', label: 'Nº SEI', col: 3 },
            { name: 'data', label: 'Data', type: 'date', col: 3 },
            { name: 'link', label: 'Link', col: 12 },
            { name: 'descricao', label: 'Descrição', type: 'textarea', col: 12 },
          ]}
          initial={form.row || { data: hojeISO() }}
          onSubmit={(v) => salvar('documentos', form.row ? v : { ...v, contrato_id: k.id }, form.row?.id)}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}

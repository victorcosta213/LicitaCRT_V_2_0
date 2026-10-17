import { useState } from 'react'
import { Card, Empty, Pill } from '../../components/gc/ui'
import FormModal from '../../components/gc/FormModal'
import { useGcActions } from '../../components/gc/useGcActions'
import { diasAte, fmtDate } from '../../utils/format'

const PERFIS = [
  { value: 'gestor', label: 'Gestão' },
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'compras', label: 'Compras' },
]

export default function TabPendencias({ k }) {
  const { salvar, cancelar, can } = useGcActions()
  const [form, setForm] = useState(null)
  const pode = can('pendencia.registrar')
  const rows = k.b.pendencias.filter((p) => !p.cancelado)
    .sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')))

  return (
    <>
      <Card
        title="Pendências com prazo individual"
        flush
        actions={pode && (
          <button className="btn btn-sm btn-primary" onClick={() => setForm({})}>
            <i className="bi bi-plus-lg me-1" />Nova pendência
          </button>
        )}
      >
        {rows.length === 0 ? <Empty>Nenhuma pendência cadastrada.</Empty> : (
          <ul className="list-group list-group-flush">
            {rows.map((p) => {
              const d = diasAte(p.prazo)
              const aberta = p.status === 'aberta'
              return (
                <li key={p.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 px-3">
                  <div>
                    <div className={`fw-semibold ${aberta ? '' : 'text-decoration-line-through text-secondary'}`}>{p.descricao}</div>
                    <div className="small text-secondary">
                      Responsável: {PERFIS.find((x) => x.value === p.perfil_responsavel)?.label || '—'} · prazo {fmtDate(p.prazo)}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {aberta && d !== null && d < 0 && <Pill kind="danger">Vencida há {-d} d</Pill>}
                    {aberta && d !== null && d >= 0 && d <= 7 && <Pill kind="warning">{d} d</Pill>}
                    {!aberta && <Pill kind="secondary">{p.status === 'concluida' ? 'Concluída' : 'Cancelada'}</Pill>}
                    {pode && aberta && (
                      <>
                        <button className="btn btn-sm btn-success" onClick={() => salvar('pendencias', { status: 'concluida' }, p.id)}>Concluir</button>
                        <button className="btn btn-sm btn-light" onClick={() => setForm({ row: p })}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-light text-danger" onClick={() => cancelar('pendencias', p.id, { status: 'cancelada' })}>
                          <i className="bi bi-x-circle" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {form && (
        <FormModal
          title={form.row ? 'Editar pendência' : 'Nova pendência'}
          size="md"
          fields={[
            { name: 'descricao', label: 'Descrição', type: 'textarea', col: 12, required: true },
            { name: 'prazo', label: 'Prazo', type: 'date', col: 6, required: true },
            { name: 'perfil_responsavel', label: 'Perfil responsável', type: 'select', col: 6, options: PERFIS },
          ]}
          initial={form.row || { perfil_responsavel: 'gestor' }}
          onSubmit={(v) => salvar('pendencias', form.row ? v : { ...v, contrato_id: k.id }, form.row?.id)}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}

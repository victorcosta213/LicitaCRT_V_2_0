import { useState } from 'react'
import { Card, Empty, Pill, SeiRef } from '../../components/gc/ui'
import FormModal from '../../components/gc/FormModal'
import { useGcActions } from '../../components/gc/useGcActions'
import { SITUACAO_EVENTO, TIPO_EVENTO, situacaoAposEvento } from '../../utils/contrato'
import { brl, fmtDate, hojeISO } from '../../utils/format'
import { showConfirm, showError } from '../../utils/alerts'

export default function TabEventos({ k }) {
  const { salvar, cancelar, can } = useGcActions()
  const [form, setForm] = useState(null) // { row? }
  const podeEditar = can('evento.registrar')
  const c = k.c

  const rows = k.b.eventos.filter((e) => !e.cancelado)
    .sort((a, b) => String(b.data_evento || b.data_solicitacao || b.created_at)
      .localeCompare(String(a.data_evento || a.data_solicitacao || a.created_at)))

  // Grava o evento e, quando aplicável, ajusta a situação do contrato.
  // Valor e vigência vigentes são recalculados a partir dos eventos concluídos.
  async function gravar(v, row) {
    if (v.situacao === 'concluido') {
      if (v.tipo === 'prorrogacao') {
        if (!v.vigencia_posterior) throw new Error('Informe a nova vigência da prorrogação.')
        if (!c.prorrogavel) throw new Error('Este contrato está cadastrado como não prorrogável.')
        if (c.limite_prorrogacao && v.vigencia_posterior > c.limite_prorrogacao) {
          throw new Error(`A nova vigência excede o limite de prorrogação (${fmtDate(c.limite_prorrogacao)}).`)
        }
      }
      if (v.tipo === 'acrescimo' && v.valor_posterior != null && v.valor_posterior < (v.valor_anterior ?? 0)) {
        throw new Error('Acréscimo deve aumentar o valor do contrato.')
      }
      if (v.tipo === 'supressao' && v.valor_posterior != null && v.valor_posterior > (v.valor_anterior ?? Infinity)) {
        throw new Error('Supressão deve reduzir o valor do contrato.')
      }
      if (!v.data_evento) v.data_evento = hojeISO()
    }
    await salvar('eventos', row ? v : { ...v, contrato_id: k.id }, row?.id)
    const nova = situacaoAposEvento(v.tipo, v.situacao, c.situacao)
    if (nova && nova !== c.situacao) await salvar('contratos', { situacao: nova }, c.id)
  }

  async function concluir(e) {
    if (!(await showConfirm('Concluir evento', 'Ao concluir, valor e vigência do contrato são atualizados automaticamente. Confirmar?'))) return
    try {
      await gravar({ ...pick(e), situacao: 'concluido', data_evento: e.data_evento || hojeISO() }, e)
    } catch (err) {
      showError(err.message)
    }
  }

  async function cancelarEvento(e) {
    const ok = await cancelar('eventos', e.id, { situacao: 'cancelado' }, 'O evento permanece no histórico e deixa de produzir efeitos.')
    if (!ok) return
    try {
      const nova = situacaoAposEvento(e.tipo, 'cancelado', c.situacao)
      if (nova) await salvar('contratos', { situacao: nova }, c.id)
    } catch (err) {
      showError(err.message)
    }
  }

  return (
    <>
      <Card
        title="Eventos contratuais"
        flush
        actions={podeEditar && (
          <button className="btn btn-sm btn-primary" onClick={() => setForm({})}>
            <i className="bi bi-plus-lg me-1" />Registrar evento
          </button>
        )}
      >
        {rows.length === 0 ? <Empty>Nenhum evento registrado.</Empty> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 gc-table">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">Tipo</th><th>Situação</th><th>Datas</th><th>Valor</th>
                  <th>Vigência</th><th>SEI</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const st = SITUACAO_EVENTO[e.situacao]
                  return (
                    <tr key={e.id}>
                      <td className="ps-3">
                        <div className="fw-semibold">{TIPO_EVENTO[e.tipo]}</div>
                        {e.observacao && <div className="small text-secondary text-truncate" style={{ maxWidth: 260 }}>{e.observacao}</div>}
                      </td>
                      <td><Pill kind={st.kind}>{st.label}</Pill></td>
                      <td className="small">
                        <div>Solic.: {fmtDate(e.data_solicitacao)}</div>
                        <div>Evento: {fmtDate(e.data_evento)}</div>
                      </td>
                      <td className="small">
                        {e.valor_anterior != null || e.valor_posterior != null ? (
                          <span className="gc-diff"><del>{brl(e.valor_anterior)}</del> → <ins>{brl(e.valor_posterior)}</ins></span>
                        ) : '—'}
                      </td>
                      <td className="small">
                        {e.vigencia_anterior || e.vigencia_posterior ? (
                          <span className="gc-diff"><del>{fmtDate(e.vigencia_anterior)}</del> → <ins>{fmtDate(e.vigencia_posterior)}</ins></span>
                        ) : '—'}
                      </td>
                      <td><SeiRef documento={e.sei_documento} link={e.sei_link} /></td>
                      <td className="text-end pe-3 text-nowrap">
                        {podeEditar && !['concluido'].includes(e.situacao) && (
                          <>
                            <button className="btn btn-sm btn-success me-1" onClick={() => concluir(e)}>Concluir</button>
                            <button className="btn btn-sm btn-light me-1" onClick={() => setForm({ row: e })}><i className="bi bi-pencil" /></button>
                          </>
                        )}
                        {podeEditar && e.situacao !== 'cancelado' && (
                          <button className="btn btn-sm btn-light text-danger" title="Cancelar" onClick={() => cancelarEvento(e)}>
                            <i className="bi bi-x-circle" />
                          </button>
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
          title={form.row ? 'Editar evento' : 'Registrar evento contratual'}
          size="xl"
          fields={[
            {
              name: 'tipo', label: 'Tipo', type: 'select', col: 4, required: true,
              options: Object.entries(TIPO_EVENTO).map(([value, label]) => ({ value, label })),
            },
            {
              name: 'situacao', label: 'Situação', type: 'select', col: 4, required: true,
              options: Object.entries(SITUACAO_EVENTO).filter(([v]) => v !== 'cancelado').map(([value, o]) => ({ value, label: o.label })),
            },
            { name: 'responsavel', label: 'Responsável', col: 4 },
            { name: 'data_solicitacao', label: 'Data da solicitação', type: 'date', col: 4 },
            { name: 'data_evento', label: 'Data do evento/assinatura', type: 'date', col: 4 },
            { name: 'sei_documento', label: 'Documento SEI', col: 4 },
            { type: 'section', label: 'Efeito no contrato', help: 'Ao concluir o evento, valor e vigência vigentes são atualizados automaticamente.' },
            { name: 'valor_anterior', label: 'Valor anterior (R$)', type: 'money', col: 3 },
            { name: 'valor_posterior', label: 'Valor posterior (R$)', type: 'money', col: 3 },
            { name: 'vigencia_anterior', label: 'Vigência anterior', type: 'date', col: 3 },
            { name: 'vigencia_posterior', label: 'Vigência posterior', type: 'date', col: 3 },
            { name: 'sei_link', label: 'Link SEI', col: 12 },
            { name: 'observacao', label: 'Observação', type: 'textarea', col: 12 },
          ]}
          initial={form.row || {
            situacao: 'solicitado',
            data_solicitacao: hojeISO(),
            valor_anterior: k.valorAtualizado,
            vigencia_anterior: k.vigenciaFim,
          }}
          onSubmit={(v) => gravar(v, form.row)}
          onClose={() => setForm(null)}
        >
          <div className="alert alert-light border small">
            Valor atualizado atual: <strong>{brl(k.valorAtualizado)}</strong> · vigência até <strong>{fmtDate(k.vigenciaFim)}</strong>.
          </div>
        </FormModal>
      )}
    </>
  )
}

const pick = (e) => ({
  tipo: e.tipo, responsavel: e.responsavel, data_solicitacao: e.data_solicitacao,
  valor_anterior: e.valor_anterior, valor_posterior: e.valor_posterior,
  vigencia_anterior: e.vigencia_anterior, vigencia_posterior: e.vigencia_posterior,
  sei_documento: e.sei_documento, sei_link: e.sei_link, observacao: e.observacao,
})

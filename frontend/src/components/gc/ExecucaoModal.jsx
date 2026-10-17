import FormModal from './FormModal'
import { useGcActions } from './useGcActions'
import { brl, fmtCompetencia, fmtDate, num } from '../../utils/format'
import { INSTRUMENTO } from '../../utils/contrato'

// Lançamento da Coordenação Financeira sobre uma competência liberada pela gestão.
export default function ExecucaoModal({ k, comp, onClose }) {
  const { salvar } = useGcActions()
  const ex = comp.execucao
  const disponiveis = k.empenhos

  const fields = [
    { type: 'section', label: 'Empenho e valor' },
    {
      name: 'empenho_id', label: 'Empenho utilizado', type: 'select', col: 6, required: true,
      options: disponiveis.map((e) => ({
        value: e.id,
        label: `${e.numero}/${e.exercicio} — saldo ${brl(e.saldoDisponivel)}`,
      })),
      help: disponiveis.length ? null : 'Cadastre um empenho para este contrato na aba Financeiro.',
    },
    { name: 'valor_competencia', label: 'Valor da competência (R$)', type: 'money', col: 3, required: true },
    { name: 'retencao', label: 'Retenções (R$)', type: 'money', col: 3, help: 'Valores retidos (tributos etc.) abatidos do pagamento.' },

    { type: 'section', label: 'Liquidação' },
    { name: 'data_liquidacao', label: 'Data da liquidação', type: 'date', col: 4 },
    { name: 'valor_liquidado', label: 'Valor liquidado (R$)', type: 'money', col: 4 },
    { name: 'sei_documento', label: 'Documento SEI', col: 4 },

    { type: 'section', label: 'Pagamento' },
    { name: 'data_pagamento', label: 'Data do pagamento', type: 'date', col: 4 },
    { name: 'valor_pago', label: 'Valor pago (R$)', type: 'money', col: 4 },
    { name: 'suspenso', label: 'Pagamento suspenso', type: 'checkbox', col: 4 },
    { name: 'sei_link', label: 'Link SEI', col: 12 },
    { name: 'observacoes', label: 'Observações', type: 'textarea', col: 12 },
  ]

  async function onSubmit(v) {
    const emp = k.empenhos.find((e) => e.id === v.empenho_id)
    const liq = num(v.valor_liquidado)
    const pago = num(v.valor_pago)
    const ret = num(v.retencao)
    if (liq > 0 && !v.data_liquidacao) throw new Error('Informe a data da liquidação.')
    if (pago > 0 && !v.data_pagamento) throw new Error('Informe a data do pagamento.')
    if (pago > 0 && liq <= 0) throw new Error('Não há pagamento sem liquidação.')
    if (liq > num(v.valor_competencia) + 0.005) throw new Error('O valor liquidado não pode superar o valor da competência.')
    if (pago + ret > liq + 0.005) throw new Error('Pagamento somado às retenções supera o valor liquidado.')
    if (emp) {
      // o que esta execução já liquidou só conta no empenho em que ela estava
      const proprio = ex?.empenho_id === emp.id ? num(ex.valor_liquidado) : 0
      const jaLiquidadoOutros = emp.liquidado - proprio
      if (jaLiquidadoOutros + liq > emp.valorAtual + 0.005) {
        throw new Error(`Saldo insuficiente no empenho ${emp.numero}/${emp.exercicio}. Solicite reforço antes de liquidar.`)
      }
    }
    await salvar('execucoes', {
      ...v, contrato_id: k.id, competencia_id: comp.id,
    }, ex?.id)
  }

  return (
    <FormModal
      title={`Execução financeira — ${k.c.numero} · ${fmtCompetencia(comp.competencia)}`}
      fields={fields}
      initial={{ valor_competencia: comp.valor_liquido, ...(ex || {}) }}
      onSubmit={onSubmit}
      onClose={onClose}
      size="lg"
    >
      <div className="alert alert-light border small">
        <div><strong>{INSTRUMENTO[k.c.instrumento] || 'Contrato'} {k.c.numero}</strong> · {k.c.contratada}</div>
        <div>
          NF nº <strong>{comp.nf_numero || '—'}</strong> · valor bruto {brl(comp.nf_valor_bruto)}
          {' '}· glosa {comp.houve_glosa ? brl(comp.glosa_valor) : '—'}
          {' '}· <strong>valor devido {brl(comp.valor_liquido)}</strong>
        </div>
        <div className="text-secondary">
          Atestada pelo fiscal{comp.sei_atesto ? ` (SEI ${comp.sei_atesto})` : ''} e liberada pela Gestão
          {comp.liberado_data ? ` em ${fmtDate(comp.liberado_data)}` : ''}{comp.sei_despacho ? ` · despacho SEI ${comp.sei_despacho}` : ''}.
        </div>
      </div>
    </FormModal>
  )
}

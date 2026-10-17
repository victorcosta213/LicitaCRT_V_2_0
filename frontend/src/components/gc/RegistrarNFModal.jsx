import FormModal from './FormModal'
import { useGcActions } from './useGcActions'
import { fmtCompetencia, hojeISO, mesAtualISO } from '../../utils/format'

// §12: o fiscal recebe a NF e registra a competência (abre a competência se ainda não existir).
// `contratacoes`: lista de consolidados para escolher (tela Competências) ou uma só (ficha).
export default function RegistrarNFModal({ contratacoes, onClose }) {
  const { salvar, nome } = useGcActions()
  const unica = contratacoes.length === 1 ? contratacoes[0] : null

  return (
    <FormModal
      title={unica ? `Registrar nota fiscal — ${unica.c.numero}` : 'Registrar nota fiscal'}
      fields={[
        ...(unica ? [] : [{
          name: 'contrato_id', label: 'Contratação', type: 'select', col: 12, required: true,
          options: contratacoes.map((k) => ({ value: k.id, label: `${k.c.numero} — ${k.c.contratada}` })),
        }]),
        { name: 'mes', label: 'Competência (mês de referência)', type: 'month', col: 6, required: true },
        { name: 'nf_recebimento_data', label: 'Data de recebimento da NF', type: 'date', col: 6, required: true },
        { name: 'nf_numero', label: 'Nº da NF', col: 4, required: true },
        { name: 'nf_data', label: 'Data de emissão', type: 'date', col: 4 },
        { name: 'nf_valor_bruto', label: 'Valor bruto (R$)', type: 'money', col: 4, required: true },
      ]}
      initial={{ mes: mesAtualISO().slice(0, 7), nf_recebimento_data: hojeISO(), ...(unica ? { contrato_id: unica.id } : {}) }}
      submitLabel="Registrar NF"
      onSubmit={async (v) => {
        const k = unica || contratacoes.find((x) => x.id === v.contrato_id)
        const competencia = `${v.mes}-01`
        const dadosNF = {
          nf_recebida: true, nf_recebimento_data: v.nf_recebimento_data, nf_numero: v.nf_numero,
          nf_data: v.nf_data, nf_valor_bruto: v.nf_valor_bruto,
        }
        const existente = k.b.competencias.find((c) => c.competencia === competencia && !c.cancelado)
        if (existente?.nf_recebida) {
          throw new Error(`A NF de ${fmtCompetencia(competencia)} já foi registrada. Abra a competência para corrigir.`)
        }
        if (existente) await salvar('competencias', dadosNF, existente.id)
        else await salvar('competencias', { contrato_id: k.id, competencia, fiscal_nome: nome, ...dadosNF })
      }}
      onClose={onClose}
    >
      <div className="alert alert-info small">
        A competência passa a <strong>NF recebida — aguardando fiscalização</strong>. A Gestão acompanha pelo
        painel, sem precisar agir.
      </div>
    </FormModal>
  )
}

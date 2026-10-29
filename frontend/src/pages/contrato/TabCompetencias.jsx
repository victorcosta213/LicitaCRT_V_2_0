import { useMemo, useState } from 'react'
import { Card } from '../../components/gc/ui'
import CompetenciasTable from '../../components/gc/CompetenciasTable'
import FormModal from '../../components/gc/FormModal'
import RegistrarNFModal from '../../components/gc/RegistrarNFModal'
import { useGcActions } from '../../components/gc/useGcActions'
import { useGc } from '../../context/GcContext'
import { salvarVarios } from '../../services/gc'
import { showConfirm, showError, showSuccess } from '../../utils/alerts'
import { competenciasFaltantes, fiscalPodeOperar } from '../../utils/contrato'
import { fmtCompetencia } from '../../utils/format'
import { isMaster } from '../../utils/permissions'

export default function TabCompetencias({ k }) {
  const { can, salvar, role, user } = useGcActions()
  const { reload } = useGc()
  const [nova, setNova] = useState(false)
  const [nf, setNf] = useState(false)
  const faltantes = useMemo(() => competenciasFaltantes(k), [k])
  const rows = k.competencias.map((comp) => ({ k, comp }))

  // §12: a NF é registrada pelo fiscal em atuação; a Gestão pode abrir competências em branco
  const podeRegistrarNF = isMaster(role) || (can('competencia.fiscal') && fiscalPodeOperar(k, user?.id))
  const podeAbrir = can('competencia.liberar')

  async function gerar() {
    const ok = await showConfirm(
      'Abrir competências',
      `Abrir ${faltantes.length} competência(s): ${faltantes.map(fmtCompetencia).join(', ')}?`,
    )
    if (!ok) return
    try {
      await salvarVarios('competencias', faltantes.map((m) => ({
        contrato_id: k.id, competencia: m, fiscal_nome: k.fiscalEmAtuacao?.nome || k.nomeFiscal,
      })))
      await reload()
      showSuccess('Competências abertas')
    } catch (err) {
      showError(err.message)
    }
  }

  return (
    <>
      <Card
        title="Acompanhamento mensal"
        flush
        actions={(
          <>
            {podeRegistrarNF && (
              <button className="btn btn-sm btn-primary" onClick={() => setNf(true)}>
                <i className="bi bi-receipt me-1" />Registrar NF
              </button>
            )}
            {podeAbrir && faltantes.length > 0 && (
              <button className="btn btn-sm btn-outline-primary" onClick={gerar}>
                <i className="bi bi-calendar-plus me-1" />Abrir {faltantes.length} pendente(s)
              </button>
            )}
            {podeAbrir && (
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setNova(true)}>
                <i className="bi bi-plus-lg me-1" />Competência
              </button>
            )}
          </>
        )}
      >
        <CompetenciasTable
          rows={rows}
          mostrarContrato={false}
          vazio={k.osVigente
            ? 'Nenhuma competência. O fiscal registra a NF para abrir a competência.'
            : 'Aguardando a OS/OC entrar em execução para iniciar o acompanhamento mensal.'}
        />
      </Card>
      <div className="small text-secondary">
        Fluxo: <strong>fiscal</strong> registra a NF → fiscaliza → atesta → <strong>Gestão</strong> confere e encaminha →
        <strong> Financeiro</strong> liquida e paga.
      </div>

      {nf && <RegistrarNFModal contratacoes={[k]} onClose={() => setNf(false)} />}
      {nova && (
        <FormModal
          title="Abrir competência"
          size="md"
          fields={[{ name: 'mes', label: 'Mês de referência', type: 'month', col: 12, required: true }]}
          submitLabel="Abrir"
          onSubmit={async (v) => {
            await salvar('competencias', {
              contrato_id: k.id, competencia: `${v.mes}-01`, fiscal_nome: k.fiscalEmAtuacao?.nome || k.nomeFiscal,
            })
          }}
          onClose={() => setNova(false)}
        />
      )}
    </>
  )
}

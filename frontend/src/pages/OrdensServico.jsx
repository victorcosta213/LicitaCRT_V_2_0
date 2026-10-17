import { useMemo, useState } from 'react'
import { useGc } from '../context/GcContext'
import { Card, GcGate, PageHeader, Tabs } from '../components/gc/ui'
import FormModal from '../components/gc/FormModal'
import OSTable, { OSSolicitar } from '../components/gc/OSTable'
import { useGcActions } from '../components/gc/useGcActions'
import { OS_EM_TRATAMENTO } from '../utils/contrato'

export default function OrdensServico() {
  const { consolidados } = useGc()
  const { can } = useGcActions()
  const [aba, setAba] = useState('fila')
  const [escolhendo, setEscolhendo] = useState(false)
  const [contrato, setContrato] = useState(null)

  const todas = useMemo(
    () => consolidados.flatMap((k) => k.b.os.filter((o) => !o.cancelado || o.status === 'cancelada').map((os) => ({ k, os })))
      .sort((a, b) => String(b.os.created_at).localeCompare(String(a.os.created_at))),
    [consolidados],
  )

  const grupos = {
    fila: todas.filter((r) => OS_EM_TRATAMENTO.includes(r.os.status)),
    vigentes: todas.filter((r) => r.os.status === 'vigente'),
    historico: todas.filter((r) => ['concluida', 'cancelada'].includes(r.os.status)),
  }

  const tabs = [
    { key: 'fila', label: 'Em tratamento', count: grupos.fila.length },
    { key: 'vigentes', label: 'Em execução', count: grupos.vigentes.length },
    { key: 'historico', label: 'Concluídas / canceladas' },
  ]

  const elegiveis = consolidados.filter((k) => !['encerrado'].includes(k.c.situacao))

  return (
    <GcGate>
      <PageHeader
        title="Ordens de Serviço / Ordens de Compra"
        subtitle="Solicitação → rascunho → assinatura (Presidente e Diretor Financeiro) → envio à contratada → execução."
        actions={can('os.solicitar') && (
          <button className="btn btn-primary" onClick={() => setEscolhendo(true)}>
            <i className="bi bi-plus-lg me-2" />Solicitar OS/OC
          </button>
        )}
      />
      <Tabs tabs={tabs} active={aba} onChange={setAba} />
      <Card flush>
        <OSTable rows={grupos[aba]} vazio="Nenhuma OS neste grupo." />
      </Card>

      {escolhendo && (
        <FormModal
          title="Solicitar OS/OC — escolha a contratação"
          size="md"
          fields={[{
            name: 'contrato_id', label: 'Contratação', type: 'select', col: 12, required: true,
            options: elegiveis.map((k) => ({
              value: k.id,
              label: `${k.c.numero} — ${k.c.contratada}${k.c.validado_gestao ? '' : ' (em cadastro)'}`,
            })),
          }]}
          submitLabel="Continuar"
          onSubmit={async (v) => { setContrato(consolidados.find((k) => k.id === v.contrato_id)) }}
          onClose={() => setEscolhendo(false)}
        />
      )}
      {contrato && <OSSolicitar k={contrato} onClose={() => setContrato(null)} />}
    </GcGate>
  )
}

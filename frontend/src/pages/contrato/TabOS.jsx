import { useState } from 'react'
import { Card } from '../../components/gc/ui'
import OSTable, { OSSolicitar } from '../../components/gc/OSTable'
import { useGcActions } from '../../components/gc/useGcActions'
import { orientacaoNotaFiscalTexto } from '../../utils/documentos'

export default function TabOS({ k }) {
  const { can, params } = useGcActions()
  const [novo, setNovo] = useState(false)
  const rows = k.b.os.filter((o) => !o.cancelado || o.status === 'cancelada')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((os) => ({ k, os }))

  return (
    <>
      <Card
        title="Ordens de Serviço / Ordens de Compra"
        flush
        actions={can('os.solicitar') && (
          <button className="btn btn-sm btn-primary" onClick={() => setNovo(true)}>
            <i className="bi bi-plus-lg me-1" />Solicitar OS/OC
          </button>
        )}
      >
        <OSTable rows={rows} mostrarContrato={false} vazio="Nenhuma OS/OC solicitada para esta contratação." />
      </Card>
      <div className="small text-secondary mb-2">
        Fluxo: rascunho → <strong>assinatura do Presidente e do Diretor Financeiro</strong> (após a fiscalização
        formalizada) → envio à contratada → recebimento registrado → em execução.
      </div>
      <div className="small text-secondary">
        <strong>Notas fiscais:</strong> {orientacaoNotaFiscalTexto(k, params)}
      </div>
      {novo && <OSSolicitar k={k} onClose={() => setNovo(false)} />}
    </>
  )
}

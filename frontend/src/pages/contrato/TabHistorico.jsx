import { useEffect, useState } from 'react'
import { Card, Empty, Pill } from '../../components/gc/ui'
import { carregarAuditoria } from '../../services/gc'
import { fmtDateTime } from '../../utils/format'
import { useGc } from '../../context/GcContext'

const TABELA = {
  gc_contratos: 'Cadastro do contrato',
  gc_responsaveis: 'Gestor/fiscal',
  gc_ordens_servico: 'Ordem de serviço',
  gc_competencias: 'Competência',
  gc_empenhos: 'Empenho',
  gc_empenho_movs: 'Reforço/anulação',
  gc_execucoes: 'Execução financeira',
  gc_eventos: 'Evento contratual',
  gc_ocorrencias: 'Ocorrência',
  gc_documentos: 'Documento',
  gc_pendencias: 'Pendência',
}

const IGNORAR = new Set(['updated_at', 'updated_by', 'created_at', 'created_by', 'id', 'id_interno', 'contrato_id', 'valor_liquido'])

const mostra = (v) => {
  if (v === null || v === undefined || v === '') return '∅'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function mudancas(a) {
  if (a.acao === 'INSERT') return [{ campo: 'registro', antes: null, depois: 'criado' }]
  const out = []
  const antes = a.antes || {}
  const depois = a.depois || {}
  for (const campo of Object.keys(depois)) {
    if (IGNORAR.has(campo)) continue
    if (JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo])) {
      out.push({ campo, antes: antes[campo], depois: depois[campo] })
    }
  }
  return out
}

export default function TabHistorico({ k }) {
  const { raw } = useGc()
  const [rows, setRows] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let vivo = true
    carregarAuditoria(k.id)
      .then((r) => vivo && setRows(r))
      .catch((e) => vivo && setErro(e.message))
    return () => { vivo = false }
  }, [k.id, raw])

  return (
    <Card title="Histórico e auditoria" flush>
      {erro && <div className="alert alert-danger m-3">{erro}</div>}
      {!erro && rows === null && <Empty>Carregando…</Empty>}
      {rows && rows.length === 0 && <Empty>Sem alterações registradas.</Empty>}
      {rows && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle mb-0 gc-table">
            <thead className="table-light">
              <tr><th className="ps-3">Quando</th><th>Quem</th><th>O quê</th><th>Alteração</th></tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const ch = mudancas(a)
                if (!ch.length) return null
                return (
                  <tr key={a.id}>
                    <td className="ps-3 text-nowrap small">{fmtDateTime(a.em)}</td>
                    <td className="small">{a.usuario_nome || 'sistema'}</td>
                    <td className="small">
                      <Pill kind={a.acao === 'INSERT' ? 'success' : 'secondary'}>{a.acao === 'INSERT' ? 'Inclusão' : 'Alteração'}</Pill>
                      <div className="mt-1">{TABELA[a.tabela] || a.tabela}</div>
                    </td>
                    <td className="gc-diff">
                      {ch.map((c) => (
                        <div key={c.campo}>
                          <strong>{c.campo.replace(/_/g, ' ')}</strong>:{' '}
                          {a.acao === 'INSERT' ? <ins>{c.depois}</ins> : (
                            <><del>{mostra(c.antes)}</del> → <ins>{mostra(c.depois)}</ins></>
                          )}
                        </div>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

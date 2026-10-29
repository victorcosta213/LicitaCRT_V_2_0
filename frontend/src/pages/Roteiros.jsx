import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, PageHeader } from '../components/gc/ui'
import RoteiroLista from '../components/compras/RoteiroLista'
import { roteiro } from '../modelos/artefatos'
import { MODALIDADES, OBJETOS } from '../modelos/variantes'
import { can } from '../utils/permissions'
import './compras.css'

// Consulta: que documentos a Lei 14.133/2021 pede para cada forma de contratação e tipo de objeto
export default function Roteiros() {
  const { role } = useAuth()
  const [sp, setSp] = useSearchParams()
  const modalidade = MODALIDADES.some((m) => m.valor === sp.get('forma')) ? sp.get('forma') : 'pregao'
  const objeto = OBJETOS.some((o) => o.valor === sp.get('objeto')) ? sp.get('objeto') : ''
  const r = useMemo(() => roteiro(modalidade, objeto || null), [modalidade, objeto])
  const total = r.etapas.reduce((n, e) => n + e.itens.filter((i) => i.obrigatorio).length, 0)
  const naPlataforma = r.etapas.reduce((n, e) => n + e.itens.filter((i) => i.modeloDef).length, 0)

  const mudar = (k, v) => {
    const n = new URLSearchParams(sp)
    if (v) n.set(k, v); else n.delete(k)
    setSp(n, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Documentos por tipo de processo"
        subtitle="O que a Lei 14.133/2021 exige em cada forma de contratação, etapa por etapa, com a base legal e quem costuma fazer."
      />
      <Card>
        <div className="row g-3 align-items-end">
          <div className="col-md-6">
            <label htmlFor="rot-forma" className="form-label fw-semibold">Forma de contratação</label>
            <select id="rot-forma" className="form-select" value={modalidade} onChange={(e) => mudar('forma', e.target.value)}>
              {MODALIDADES.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label htmlFor="rot-objeto" className="form-label fw-semibold">Tipo de objeto</label>
            <select id="rot-objeto" className="form-select" value={objeto} onChange={(e) => mudar('objeto', e.target.value)}>
              <option value="">Qualquer (só os documentos comuns)</option>
              {OBJETOS.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card title={r.titulo} subtitle={r.resumo}>
        <p className="small mb-3">
          <strong>{total}</strong> documentos obrigatórios · <strong>{naPlataforma}</strong> podem ser feitos aqui na plataforma, pelos modelos; os demais são juntados ao processo e registrados no roteiro.
        </p>
        <RoteiroLista roteiro={r} podeCriar={can(role, 'documento.criar')} />
        <p className="small text-secondary mt-3 mb-0">
          Roteiro de apoio baseado na Lei 14.133/2021. Regulamentos do órgão podem exigir peças adicionais: confirme com o setor jurídico.
        </p>
      </Card>
    </>
  )
}

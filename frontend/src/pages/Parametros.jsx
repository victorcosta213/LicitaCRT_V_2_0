import { useEffect, useState } from 'react'
import { useGc } from '../context/GcContext'
import { Card, GcGate, PageHeader } from '../components/gc/ui'
import { salvarParametro } from '../services/gc'
import { showError, showSuccess } from '../utils/alerts'

const dias = (s) => String(s).split(/[,\s;]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0)
  .sort((a, b) => b - a)
const linhas = (s) => String(s).split('\n').map((x) => x.trim()).filter(Boolean)

const TEXTOS = [
  ['orgao_nome', 'Nome do órgão (cabeçalho dos documentos)'],
  ['orgao_cidade', 'Cidade/UF (local dos documentos)'],
  ['presidente_nome', 'Presidente (assina portaria e OS/OC)'],
  ['diretor_financeiro_nome', 'Diretor(a) Financeiro(a) (assina OS/OC)'],
  ['email_gestao_contratos', 'E-mail institucional da Gestão de Contratos (cópia das NFs)'],
]

export default function Parametros() {
  const { params, reload } = useGc()
  const [v, setV] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setV({
      alerta_vigencia_dias: params.alerta_vigencia_dias.join(', '),
      alerta_garantia_dias: params.alerta_garantia_dias.join(', '),
      alerta_reajuste_dias: params.alerta_reajuste_dias.join(', '),
      prazo_competencia_dias: String(params.prazo_competencia_dias),
      prazo_ocorrencia_aviso_dias: String(params.prazo_ocorrencia_aviso_dias),
      tipos_contrato: params.tipos_contrato.join('\n'),
      modalidades: params.modalidades.join('\n'),
      indices_reajuste: params.indices_reajuste.join('\n'),
      atribuicoes_fiscal: params.atribuicoes_fiscal || '',
      ...Object.fromEntries(TEXTOS.map(([k]) => [k, params[k] || ''])),
    })
  }, [params])

  if (!v) return null
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }))

  async function salvar(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await salvarParametro('alerta_vigencia_dias', dias(v.alerta_vigencia_dias))
      await salvarParametro('alerta_garantia_dias', dias(v.alerta_garantia_dias))
      await salvarParametro('alerta_reajuste_dias', dias(v.alerta_reajuste_dias))
      await salvarParametro('prazo_competencia_dias', Number(v.prazo_competencia_dias) || 10)
      await salvarParametro('prazo_ocorrencia_aviso_dias', Number(v.prazo_ocorrencia_aviso_dias) || 5)
      await salvarParametro('tipos_contrato', linhas(v.tipos_contrato))
      await salvarParametro('modalidades', linhas(v.modalidades))
      await salvarParametro('indices_reajuste', linhas(v.indices_reajuste))
      await salvarParametro('atribuicoes_fiscal', String(v.atribuicoes_fiscal).trim())
      for (const [k] of TEXTOS) await salvarParametro(k, String(v[k]).trim())
      await reload()
      showSuccess('Parâmetros salvos')
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <GcGate>
      <PageHeader title="Parâmetros" subtitle="Alertas, listas de apoio e dados usados nos documentos gerados." />
      <form onSubmit={salvar}>
        <div className="row g-4">
          <div className="col-lg-6">
            <Card title="Alertas e prazos" className="h-100">
              <div className="mb-3">
                <label className="form-label fw-semibold">Vigência — avisar com (dias antes)</label>
                <input className="form-control" value={v.alerta_vigencia_dias} onChange={(e) => set('alerta_vigencia_dias', e.target.value)} />
                <div className="form-text">Ex.: 120, 90, 60, 30. Contratações vencidas são sempre sinalizadas.</div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Garantia — avisar com (dias antes)</label>
                <input className="form-control" value={v.alerta_garantia_dias} onChange={(e) => set('alerta_garantia_dias', e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Reajuste — avisar com (dias antes da data-base)</label>
                <input className="form-control" value={v.alerta_reajuste_dias} onChange={(e) => set('alerta_reajuste_dias', e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Competência — dias em cada etapa antes de ficar crítica</label>
                <input type="number" min="0" className="form-control" value={v.prazo_competencia_dias}
                  onChange={(e) => set('prazo_competencia_dias', e.target.value)} />
              </div>
              <div>
                <label className="form-label fw-semibold">Ocorrência — avisar quando o prazo vence em até (dias)</label>
                <input type="number" min="0" className="form-control" value={v.prazo_ocorrencia_aviso_dias}
                  onChange={(e) => set('prazo_ocorrencia_aviso_dias', e.target.value)} />
              </div>
            </Card>
          </div>
          <div className="col-lg-6">
            <Card title="Listas de apoio (uma opção por linha)" className="h-100">
              <div className="mb-3">
                <label className="form-label fw-semibold">Tipos de objeto</label>
                <textarea className="form-control" rows={4} value={v.tipos_contrato} onChange={(e) => set('tipos_contrato', e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Modalidades</label>
                <textarea className="form-control" rows={4} value={v.modalidades} onChange={(e) => set('modalidades', e.target.value)} />
              </div>
              <div>
                <label className="form-label fw-semibold">Índices de reajuste</label>
                <textarea className="form-control" rows={4} value={v.indices_reajuste} onChange={(e) => set('indices_reajuste', e.target.value)} />
              </div>
            </Card>
          </div>
          <div className="col-12">
            <Card title="Documentos gerados (portaria, termo de ciência, OS/OC e atesto)">
              <div className="row g-3">
                {TEXTOS.map(([k, label]) => (
                  <div className="col-md-6" key={k}>
                    <label className="form-label fw-semibold" htmlFor={`p-${k}`}>{label}</label>
                    <input id={`p-${k}`} className="form-control" value={v[k]} onChange={(e) => set(k, e.target.value)} />
                  </div>
                ))}
                <div className="col-12">
                  <label className="form-label fw-semibold" htmlFor="p-atrib">Atribuições padronizadas da fiscalização (portaria) — uma por linha</label>
                  <textarea id="p-atrib" className="form-control" rows={7} value={v.atribuicoes_fiscal} onChange={(e) => set('atribuicoes_fiscal', e.target.value)} />
                </div>
              </div>
            </Card>
          </div>
        </div>
        <div className="mt-4">
          <button className="btn btn-primary px-4" disabled={busy}>{busy ? 'Salvando…' : 'Salvar parâmetros'}</button>
        </div>
      </form>
    </GcGate>
  )
}

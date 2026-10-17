import { useMemo, useState } from 'react'
import { useGc } from '../context/GcContext'
import { useAuth } from '../context/AuthContext'
import { Empty, GcGate, PageHeader } from '../components/gc/ui'
import { ListaTarefas } from '../components/gc/Tarefa'
import { alertasDoPerfil, tarefaDoAlerta } from '../utils/contrato'
import { normalizeRole } from '../utils/permissions'

const SEV = [
  ['', 'Todos'],
  ['danger', 'Urgentes'],
  ['warning', 'Atenção'],
  ['info', 'Informativos'],
]

export default function Alertas() {
  const { alertas } = useGc()
  const { role, user } = useAuth()
  const r = normalizeRole(role)
  const temPerfil = ['gestor', 'fiscal', 'financeiro', 'compras', 'gabinete'].includes(r)
  const [meus, setMeus] = useState(temPerfil)
  const [sev, setSev] = useState('')
  const [cat, setCat] = useState('')

  const base = useMemo(() => (meus ? alertasDoPerfil(alertas, role, user?.id) : alertas), [alertas, meus, role, user])
  const categorias = useMemo(() => [...new Set(base.map((a) => a.categoria))].sort(), [base])
  const contagem = useMemo(() => {
    const m = { '': 0 }
    for (const a of base) {
      if (cat && a.categoria !== cat) continue
      m[''] += 1
      m[a.severidade] = (m[a.severidade] || 0) + 1
    }
    return m
  }, [base, cat])

  const lista = useMemo(
    () => base.filter((a) => (!sev || a.severidade === sev) && (!cat || a.categoria === cat)).map((a) => tarefaDoAlerta(a)),
    [base, sev, cat],
  )

  return (
    <GcGate>
      <PageHeader
        title="Alertas e prazos"
        subtitle="Gerados automaticamente: tarefas de cada setor, vigência, reajuste, garantia, ocorrências e pendências."
      />

      <div className="card">
        <div className="barra-lista">
          <div className="segmentos" role="tablist" aria-label="Severidade">
            {SEV.map(([v, label]) => (
              <button key={v} type="button" role="tab" aria-selected={sev === v} className={`segmento ${sev === v ? 'ativo' : ''}`} onClick={() => setSev(v)}>
                {label}<span className="segmento__n">{contagem[v] || 0}</span>
              </button>
            ))}
          </div>
          <select className="form-select w-auto" aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Toda categoria</option>
            {categorias.map((c) => <option key={c}>{c}</option>)}
          </select>
          {temPerfil && (
            <div className="form-check form-switch mb-0 ms-lg-auto">
              <input id="meus" type="checkbox" role="switch" className="form-check-input" checked={meus} onChange={(e) => setMeus(e.target.checked)} />
              <label htmlFor="meus" className="form-check-label small">Só o que compete ao meu perfil</label>
            </div>
          )}
        </div>
        {lista.length === 0
          ? <Empty icon="bi-bell-slash">Nenhum alerta para os filtros selecionados.</Empty>
          : <ListaTarefas itens={lista} />}
      </div>
    </GcGate>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGc } from '../context/GcContext'
import { Empty, PageHeader, Pill, Prazo } from '../components/gc/ui'
import FormModal from '../components/gc/FormModal'
import PrimeirosPassos from '../components/gc/PrimeirosPassos'
import { useTramitacao } from '../components/useTramitacao'
import { abrirProcessoAdm } from '../services/tramitacao'
import { can } from '../utils/permissions'
import { fmtDate } from '../utils/format'
import {
  DIAS_PARADO_PADRAO, PRIORIDADES, TIPOS_PROCESSO, VISTAS, combinaBusca, estadoDoProcesso, naVista, ordenarParaLista,
} from '../utils/tramitacao'

export const AvisoTramitacaoAusente = () => (
  <div className="alert alert-warning">
    <h2 className="h6 fw-bold">A tramitação de processos ainda não foi ativada</h2>
    <p className="mb-0">
      Peça ao administrador para aplicar no banco de dados o arquivo <code>backend/supabase/migrations/20261021_tramitacao.sql</code> e recarregue a página.
    </p>
  </div>
)

const CAMPOS_NOVO = (unidades) => [
  { name: 'tipo', label: 'Tipo do processo', type: 'select', options: TIPOS_PROCESSO, required: true, col: 6 },
  { name: 'prioridade', label: 'Prioridade', type: 'select', options: Object.entries(PRIORIDADES).map(([value, p]) => ({ value, label: p.label })), col: 3 },
  { name: 'prazo', label: 'Prazo final', type: 'date', col: 3, help: 'Opcional. Depois dele, o processo aparece como atrasado.' },
  { name: 'assunto', label: 'Assunto', type: 'text', required: true, col: 12, placeholder: 'Ex.: Compra de cadeiras para a sala de reuniões' },
  { name: 'interessado', label: 'Interessado', type: 'text', col: 6, help: 'Pessoa, empresa ou setor que pediu.' },
  { name: 'unidade_destino', label: 'Enviar para', type: 'select', required: true, col: 6,
    options: unidades.filter((u) => u.ativa).map((u) => ({ value: u.id, label: `${u.sigla} — ${u.nome}` })),
    help: 'A unidade que vai cuidar do processo primeiro.' },
  { name: 'descricao', label: 'Descrição', type: 'textarea', col: 12 },
  { name: 'despacho', label: 'Despacho (o que a unidade deve fazer)', type: 'textarea', col: 12, rows: 2 },
]

export default function Processos() {
  const { user, profile, role } = useAuth()
  const { params } = useGc() || {}
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { carregando, erro, ausente, processos, unidades, unidadesPorId } = useTramitacao()
  const [busca, setBusca] = useState(() => sp.get('busca') || '')
  const [novo, setNovo] = useState(false)

  const diasParado = Number(params?.tr_dias_parado) || DIAS_PARADO_PADRAO
  const ctx = { usuarioId: user?.id, unidadeId: profile?.unidade_id, diasParado }
  const vista = VISTAS.some(([k]) => k === sp.get('vista')) ? sp.get('vista') : 'todos'
  const unidadeFiltro = sp.get('unidade') || ''

  const doFiltroDeUnidade = useMemo(
    () => processos.filter((p) => !unidadeFiltro || p.unidade_atual === unidadeFiltro),
    [processos, unidadeFiltro],
  )
  const contagem = useMemo(() => Object.fromEntries(VISTAS.map(([k]) => [k, doFiltroDeUnidade.filter((p) => naVista(p, k, ctx)).length])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doFiltroDeUnidade, user, profile, diasParado])
  const lista = useMemo(
    () => ordenarParaLista(doFiltroDeUnidade.filter((p) => naVista(p, vista, ctx) && combinaBusca(p, busca, unidadesPorId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doFiltroDeUnidade, vista, busca, unidadesPorId, user, profile, diasParado],
  )

  const mudar = (chave, valor) => {
    const n = new URLSearchParams(sp)
    if (valor && valor !== 'todos') n.set(chave, valor); else n.delete(chave)
    setSp(n, { replace: true })
  }

  async function abrir(v) {
    const id = await abrirProcessoAdm(v)
    navigate(`/processos/${id}`)
  }

  const podeAbrir = can(role, 'tramitacao.abrir')

  return (
    <>
      <PageHeader
        title="Processos"
        subtitle="Cada processo, onde ele está agora e há quanto tempo. Clique numa linha para ver o histórico e movimentar."
        actions={podeAbrir && (
          <button className="btn btn-primary" onClick={() => setNovo(true)}>
            <i className="bi bi-plus-lg me-2" />Novo processo
          </button>
        )}
      />

      {/* aberto para quem ainda não tem processos; depois, recolhido para a lista aparecer logo */}
      {!carregando && <PrimeirosPassos tipo="tramitacao" abertoPorPadrao={processos.length === 0} />}

      {ausente && <AvisoTramitacaoAusente />}
      {!ausente && erro && <div className="alert alert-danger">Não foi possível carregar os processos: {erro}</div>}

      {!ausente && !erro && (
        <div className="card">
          <div className="barra-lista">
            <div className="segmentos" role="tablist" aria-label="Vistas">
              {VISTAS.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={vista === key}
                  className={`segmento ${vista === key ? 'ativo' : ''}`} onClick={() => mudar('vista', key)}>
                  {label}<span className="segmento__n">{contagem[key]}</span>
                </button>
              ))}
            </div>
            <div className="barra-lista__busca">
              <i className="bi bi-search" aria-hidden="true" />
              <input className="form-control" placeholder="Protocolo, assunto, interessado ou unidade"
                aria-label="Buscar processos" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          {unidadeFiltro && (
            <div className="px-3 py-2 border-bottom small">
              Mostrando só a unidade <strong>{unidadesPorId.get(unidadeFiltro)?.sigla || '—'}</strong>{' '}
              <button type="button" className="btn btn-link btn-sm p-0 ms-1" onClick={() => mudar('unidade', '')}>Ver todas</button>
            </div>
          )}

          <div className="table-responsive">
            <table className="table table-hover align-middle gc-table">
              <thead>
                <tr>
                  <th>Processo</th>
                  <th>Onde está</th>
                  <th>Há quanto tempo</th>
                  <th>Estado</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {carregando && <tr><td colSpan="5" className="text-center py-4 text-secondary">Carregando processos…</td></tr>}
                {!carregando && lista.length === 0 && (
                  <tr><td colSpan="5">
                    <Empty icon={processos.length ? 'bi-search' : 'bi-folder2-open'}>
                      {processos.length
                        ? 'Nenhum processo nesta vista. Troque a vista ou limpe a busca para ver outros.'
                        : (
                          <span className="vazio-acao">
                            <span>Ainda não há processos.{podeAbrir ? ' Abra o primeiro e envie para a unidade que vai cuidar dele.' : ' Eles aparecem aqui quando forem abertos para a sua unidade.'}</span>
                            {podeAbrir && <button type="button" className="btn btn-primary" onClick={() => setNovo(true)}><i className="bi bi-plus-lg me-2" />Abrir o primeiro processo</button>}
                          </span>
                        )}
                    </Empty>
                  </td></tr>
                )}
                {lista.map((p) => {
                  const e = estadoDoProcesso(p, { diasParado })
                  const u = unidadesPorId.get(p.unidade_atual)
                  const prio = PRIORIDADES[p.prioridade]
                  return (
                    <tr key={p.id} className="gc-row-link" onClick={() => navigate(`/processos/${p.id}`)}>
                      <td style={{ maxWidth: 380 }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="mono fw-semibold">{p.numero}</span>
                          {p.prioridade && p.prioridade !== 'normal' && p.prioridade !== 'baixa' && <Pill kind={prio.kind}>{prio.label}</Pill>}
                        </div>
                        <div className="text-truncate">{p.assunto}</div>
                        <div className="small text-secondary text-truncate">{p.tipo}{p.interessado ? ` · ${p.interessado}` : ''}</div>
                      </td>
                      <td>
                        {p.situacao === 'concluido' ? <span className="text-secondary">Encerrado em {u?.sigla || '—'}</span> : (
                          <>
                            <div className="fw-semibold" title={u?.nome}>{u?.sigla || '—'}</div>
                            <div className="small text-secondary">{p.responsavel_nome || 'sem responsável ainda'}</div>
                          </>
                        )}
                      </td>
                      <td className="num">
                        {p.situacao === 'concluido' ? <span className="text-secondary">{fmtDate(p.concluido_em)}</span>
                          : <><strong>{e.diasNaUnidade}</strong> {e.diasNaUnidade === 1 ? 'dia' : 'dias'}</>}
                      </td>
                      <td><Pill kind={e.kind}>{e.label}</Pill></td>
                      <td className="num">
                        {p.prazo ? <>{fmtDate(p.prazo)} {p.situacao !== 'concluido' && <Prazo dias={e.diasPrazo} />}</> : <span className="text-secondary">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 small text-secondary border-top">{lista.length} de {processos.length} processo(s)</div>
        </div>
      )}

      {novo && (
        <FormModal
          title="Novo processo"
          submitLabel="Abrir processo"
          fields={CAMPOS_NOVO(unidades)}
          initial={{ prioridade: 'normal', unidade_destino: profile?.unidade_id || '' }}
          onSubmit={abrir}
          onClose={() => setNovo(false)}
        />
      )}
    </>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGc } from '../context/GcContext'
import { useAuth } from '../context/AuthContext'
import { BadgeVigencia, Empty, GcGate, PageHeader, Pill, SituacaoContratacao } from '../components/gc/ui'
import FormModal from '../components/gc/FormModal'
import ImportarContratosModal from '../components/gc/ImportarContratosModal'
import { useGcActions } from '../components/gc/useGcActions'
import { contratoFields, validarContrato } from './contrato/contratoForm'
import { ETAPA_CONTRATACAO, INSTRUMENTO, SITUACAO_CONTRATO } from '../utils/contrato'
import { normalizeRole } from '../utils/permissions'
import { brl, codigoInterno, diasAte, exercicioDe, fmtDate, soDigitos } from '../utils/format'
import { exportarXlsx } from '../utils/exportar'

const FAIXAS_VIGENCIA = [
  ['', 'Qualquer vigência'],
  ['vencido', 'Vencidas'],
  ['30', 'Vencem em até 30 dias'],
  ['60', 'Vencem em até 60 dias'],
  ['90', 'Vencem em até 90 dias'],
  ['120', 'Vencem em até 120 dias'],
]

// Vistas rápidas da lista
const VISTAS = [
  ['todas', 'Todas', () => true],
  ['execucao', 'Em execução', (k) => k.etapa === 'em_execucao' && k.c.situacao !== 'encerrado'],
  ['caminho', 'A caminho', (k) => k.etapa !== 'em_execucao'],
  ['vencendo', 'Vencendo', (k) => !['encerrado', 'em_cadastro'].includes(k.c.situacao) && k.diasVigencia !== null && k.diasVigencia <= 120],
  ['pendencias', 'Com pendências', (k, alertas) => alertas.has(k.id)],
]

// Estado iniciado pela URL (?busca=, ?vista=, ?situacao=) e trocado quando a URL muda
function useParametroDaUrl(nome, padrao = '') {
  const [sp] = useSearchParams()
  const daUrl = sp.get(nome) || padrao
  const [valor, setValor] = useState(daUrl)
  const [anterior, setAnterior] = useState(daUrl)
  if (daUrl !== anterior) {
    setAnterior(daUrl)
    setValor(daUrl)
  }
  return [valor, setValor]
}

export default function Contratos() {
  const navigate = useNavigate()
  const { consolidados, alertas, params } = useGc()
  const { nome, role } = useAuth()
  const { can, salvar } = useGcActions()
  const souFiscal = normalizeRole(role) === 'fiscal'
  const [sp, setSp] = useSearchParams()

  const [busca, setBusca] = useParametroDaUrl('busca')
  const [vista, setVista] = useParametroDaUrl('vista', 'todas')
  const [situacao, setSituacao] = useParametroDaUrl('situacao')
  const [vigencia, setVigencia] = useState('')
  const [gestor, setGestor] = useState('')
  const [fiscal, setFiscal] = useState('')
  const [exercicio, setExercicio] = useState('')
  const [importando, setImportando] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(() => Boolean(sp.get('situacao')))
  const novo = sp.get('nova') === '1'
  const setNovo = (abrir) => setSp((atual) => {
    const p = new URLSearchParams(atual)
    if (abrir) p.set('nova', '1')
    else p.delete('nova')
    return p
  }, { replace: true })

  const alertasPorContrato = useMemo(() => {
    const m = new Map()
    for (const a of alertas) {
      const cur = m.get(a.contratoId) || { danger: 0, warning: 0, info: 0 }
      cur[a.severidade] += 1
      m.set(a.contratoId, cur)
    }
    return m
  }, [alertas])

  const opcoes = useMemo(() => ({
    gestores: [...new Set(consolidados.map((k) => k.nomeGestor).filter(Boolean))].sort(),
    fiscais: [...new Set(consolidados.map((k) => k.nomeFiscal).filter(Boolean))].sort(),
    exercicios: [...new Set(consolidados.flatMap((k) => [
      exercicioDe(k.c.vigencia_inicio), exercicioDe(k.vigenciaFim),
    ]).filter(Boolean))].sort((a, b) => b - a),
  }), [consolidados])

  // filtros da busca/painel (a vista é aplicada depois, para contar cada uma)
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const qd = soDigitos(busca)
    return consolidados.filter((k) => {
      const c = k.c
      if (q) {
        const hay = [c.numero, c.contratada, c.objeto, c.sei_processo, c.numero_licitacao, codigoInterno(c)]
          .join(' ').toLowerCase()
        if (!hay.includes(q) && !(qd.length >= 3 && soDigitos(c.cnpj).includes(qd))) return false
      }
      if (situacao && (situacao.startsWith('etapa:') ? `etapa:${k.etapa}` !== situacao : c.situacao !== situacao)) return false
      if (gestor && k.nomeGestor !== gestor) return false
      if (fiscal && k.nomeFiscal !== fiscal) return false
      if (exercicio) {
        const y = Number(exercicio)
        const ini = exercicioDe(c.vigencia_inicio) ?? y
        const fim = exercicioDe(k.vigenciaFim) ?? y
        if (y < ini || y > fim) return false
      }
      if (vigencia) {
        const d = diasAte(k.vigenciaFim)
        if (d === null || c.situacao === 'encerrado') return false
        if (vigencia === 'vencido' ? d >= 0 : d < 0 || d > Number(vigencia)) return false
      }
      return true
    })
  }, [consolidados, busca, situacao, gestor, fiscal, exercicio, vigencia])

  const contagemVistas = useMemo(
    () => Object.fromEntries(VISTAS.map(([key, , f]) => [key, filtrados.filter((k) => f(k, alertasPorContrato)).length])),
    [filtrados, alertasPorContrato],
  )
  const filtroVista = (VISTAS.find(([key]) => key === vista) || VISTAS[0])[2]
  const lista = filtrados.filter((k) => filtroVista(k, alertasPorContrato))

  const filtrosAtivos = [situacao, vigencia, gestor, fiscal, exercicio].filter(Boolean).length
  const limpar = () => {
    setBusca(''); setSituacao(''); setVigencia(''); setGestor(''); setFiscal(''); setExercicio(''); setVista('todas')
  }

  function exportar() {
    const colunas = [
      { key: 'codigo', label: 'ID' }, { key: 'instrumento', label: 'Instrumento' }, { key: 'numero', label: 'Nº' },
      { key: 'contratada', label: 'Contratada' }, { key: 'cnpj', label: 'CNPJ' },
      { key: 'objeto', label: 'Objeto' }, { key: 'sei', label: 'Processo SEI' },
      { key: 'situacao', label: 'Situação' }, { key: 'gestor', label: 'Gestor' },
      { key: 'fiscal', label: 'Fiscal' }, { key: 'fim', label: 'Fim da vigência' },
      { key: 'valor', label: 'Valor atualizado' }, { key: 'empenhado', label: 'Empenhado' },
      { key: 'liquidado', label: 'Liquidado' }, { key: 'pago', label: 'Pago' },
      { key: 'pendente', label: 'Pendente de pagamento' },
    ]
    exportarXlsx('contratacoes', colunas, lista.map((k) => ({
      codigo: codigoInterno(k.c), instrumento: INSTRUMENTO[k.c.instrumento] || 'Contrato', numero: k.c.numero,
      contratada: k.c.contratada, cnpj: k.c.cnpj, objeto: k.c.objeto, sei: k.c.sei_processo,
      situacao: k.etapa !== 'em_execucao' ? ETAPA_CONTRATACAO[k.etapa]?.label : SITUACAO_CONTRATO[k.c.situacao]?.label,
      gestor: k.nomeGestor, fiscal: k.nomeFiscal, fim: fmtDate(k.vigenciaFim),
      valor: k.valorAtualizado, empenhado: k.empenhado, liquidado: k.liquidado, pago: k.pago,
      pendente: k.pendentePagamento,
    })), 'Contratações')
  }

  async function criar(v) {
    validarContrato(v)
    // Criada pela própria Gestão: já nasce recebida (não passa pelo encaminhamento de Compras)
    const recebida = normalizeRole(role) === 'gestor' ? { encaminhado_em: new Date().toISOString() } : {}
    const r = await salvar('contratos', { ...v, ...recebida, situacao: 'em_cadastro' })
    navigate(`/contratos/${r.id}`)
  }

  return (
    <GcGate>
      <PageHeader
        title={souFiscal ? 'Minhas fiscalizações' : 'Contratações'}
        subtitle={souFiscal
          ? 'As contratações em que você está designado(a) como fiscal titular ou substituto(a).'
          : 'Contratos, notas de empenho e demais instrumentos — do cadastro em Compras ao pagamento.'}
        actions={(
          <>
            <button className="btn btn-outline-secondary" onClick={exportar}>
              <i className="bi bi-download me-2" />Exportar
            </button>
            {can('contrato.criar') && (
              <button className="btn btn-outline-secondary" onClick={() => setImportando(true)}>
                <i className="bi bi-upload me-2" />Importar planilha
              </button>
            )}
            {can('contrato.criar') && (
              <button className="btn btn-primary" onClick={() => setNovo(true)}>
                <i className="bi bi-plus-lg me-2" />Nova contratação
              </button>
            )}
          </>
        )}
      />

      <div className="card">
        <div className="barra-lista">
          <div className="segmentos" role="tablist" aria-label="Vistas">
            {VISTAS.map(([key, label]) => (
              <button
                key={key} type="button" role="tab" aria-selected={vista === key}
                className={`segmento ${vista === key ? 'ativo' : ''}`}
                onClick={() => setVista(key)}
              >
                {label}<span className="segmento__n">{contagemVistas[key]}</span>
              </button>
            ))}
          </div>
          <div className="barra-lista__busca">
            <i className="bi bi-search" aria-hidden="true" />
            <input className="form-control" placeholder="Nº, contratada, CNPJ, objeto ou processo SEI"
              aria-label="Buscar na lista" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <button
            type="button"
            className={`btn ${filtrosAbertos || filtrosAtivos ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
            onClick={() => setFiltrosAbertos((v) => !v)}
            aria-expanded={filtrosAbertos}
          >
            <i className="bi bi-sliders me-2" />Filtros{filtrosAtivos > 0 && ` (${filtrosAtivos})`}
          </button>
        </div>

        {filtrosAbertos && (
          <div className="barra-lista__filtros">
            <select className="form-select" aria-label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              <option value="">Toda situação</option>
              <optgroup label="Até a execução">
                {Object.entries(ETAPA_CONTRATACAO).filter(([v]) => v !== 'em_execucao')
                  .map(([v, o]) => <option key={v} value={`etapa:${v}`}>{o.label}</option>)}
              </optgroup>
              <optgroup label="Situação contratual">
                {Object.entries(SITUACAO_CONTRATO).filter(([v]) => v !== 'em_cadastro')
                  .map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
              </optgroup>
            </select>
            <select className="form-select" aria-label="Vigência" value={vigencia} onChange={(e) => setVigencia(e.target.value)}>
              {FAIXAS_VIGENCIA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="form-select" aria-label="Exercício" value={exercicio} onChange={(e) => setExercicio(e.target.value)}>
              <option value="">Todo exercício</option>
              {opcoes.exercicios.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="form-select" aria-label="Gestor" value={gestor} onChange={(e) => setGestor(e.target.value)}>
              <option value="">Todo gestor</option>
              {opcoes.gestores.map((g) => <option key={g}>{g}</option>)}
            </select>
            <select className="form-select" aria-label="Fiscal" value={fiscal} onChange={(e) => setFiscal(e.target.value)}>
              <option value="">Todo fiscal</option>
              {opcoes.fiscais.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        )}

        <div className="table-responsive">
          <table className="table table-hover align-middle gc-table">
            <thead>
              <tr>
                <th>Contratação</th>
                <th>Situação</th>
                <th>Vigência</th>
                <th className="text-end">Valor atualizado</th>
                <th className="d-none d-xxl-table-cell">Responsáveis</th>
                <th className="text-center">Alertas</th>
                <th aria-label="Abrir" />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr><td colSpan="7"><Empty icon="bi-search">{souFiscal && !consolidados.length ? 'Nenhuma contratação atribuída a você.' : 'Nenhuma contratação encontrada com os filtros atuais.'}</Empty></td></tr>
              )}
              {lista.map((k) => {
                const a = alertasPorContrato.get(k.id)
                const pago = k.valorAtualizado > 0 ? Math.min(100, (k.pago / k.valorAtualizado) * 100) : 0
                return (
                  <tr key={k.id} className="gc-row-link" onClick={() => navigate(`/contratos/${k.id}`)}>
                    <td style={{ maxWidth: 380 }}>
                      <div className="d-flex align-items-baseline gap-2">
                        <span className="gc-num fw-semibold">{k.c.numero}</span>
                        <span className="rotulo">{k.c.instrumento === 'nota_empenho' ? 'NE' : INSTRUMENTO[k.c.instrumento] || 'Contrato'}</span>
                        <span className="fw-semibold text-truncate">{k.c.contratada}</span>
                      </div>
                      <div className="small text-secondary text-truncate" title={k.c.objeto}>{k.c.objeto}</div>
                    </td>
                    <td><SituacaoContratacao k={k} /></td>
                    <td className="text-nowrap">
                      <div className="num">{fmtDate(k.vigenciaFim)}</div>
                      <BadgeVigencia dias={k.diasVigencia} situacao={k.c.situacao} />
                    </td>
                    <td className="text-end text-nowrap">
                      <div className="num fw-semibold">{brl(k.valorAtualizado)}</div>
                      {k.valorAtualizado > 0 && (
                        <div className="execucao-mini" title={`Pago ${brl(k.pago)} (${pago.toFixed(0)}%)`}>
                          <span style={{ width: `${pago}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="small d-none d-xxl-table-cell">
                      <div className="text-truncate" style={{ maxWidth: 180 }} title="Gestão">{k.nomeGestor || '—'}</div>
                      <div className="text-truncate text-secondary" style={{ maxWidth: 180 }} title="Fiscal">{k.nomeFiscal || '—'}</div>
                    </td>
                    <td className="text-center text-nowrap">
                      {!a && <span className="text-secondary">—</span>}
                      {a?.danger > 0 && <Pill kind="danger" title="Críticos">{a.danger}</Pill>}{' '}
                      {a?.warning > 0 && <Pill kind="warning" title="Atenção">{a.warning}</Pill>}
                      {a && !a.danger && !a.warning && <Pill kind="info" title="Informativos">{a.info}</Pill>}
                    </td>
                    <td className="text-end"><i className="bi bi-chevron-right gc-row-link__seta" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="card-footer d-flex justify-content-between align-items-center small">
          <span className="text-secondary">{lista.length} de {consolidados.length} contratação(ões)</span>
          {(busca || filtrosAtivos > 0 || vista !== 'todas') && (
            <button type="button" className="btn btn-link btn-sm p-0" onClick={limpar}>Limpar busca e filtros</button>
          )}
        </div>
      </div>

      {importando && can('contrato.criar') && <ImportarContratosModal onClose={() => setImportando(false)} />}

      {novo && can('contrato.criar') && (
        <FormModal
          title="Nova contratação"
          size="xl"
          fields={contratoFields(params)}
          initial={{ responsavel_contratacao: nome, instrumento: 'contrato' }}
          submitLabel="Criar cadastro"
          onSubmit={criar}
          onClose={() => setNovo(false)}
        >
          <div className="alert alert-info small">
            Cadastre a contratação depois do contrato assinado ou da nota de empenho emitida.
            Na ficha, use <strong>Encaminhar para Gestão</strong>: isso gera a solicitação de designação
            dos fiscais e a de OS/OC. Depois do encaminhamento, Compras mantém apenas a consulta.
          </div>
        </FormModal>
      )}
    </GcGate>
  )
}

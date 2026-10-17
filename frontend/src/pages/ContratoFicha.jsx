import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGc } from '../context/GcContext'
import { useAuth } from '../context/AuthContext'
import { BadgeVigencia, Card, DefList, Empty, GcGate, Pill, Regua, SeiRef, SituacaoContratacao, Tabs } from '../components/gc/ui'
import { ListaTarefas } from '../components/gc/Tarefa'
import FormModal from '../components/gc/FormModal'
import { useGcActions } from '../components/gc/useGcActions'
import { ETAPA_CONTRATACAO, INSTRUMENTO, TIPO_ORDEM, documentosReferenciados, tarefaDoAlerta } from '../utils/contrato'
import { brl, codigoInterno, fmtCnpj, fmtCompetencia, fmtDate, soDigitos } from '../utils/format'
import { showConfirm, showError, showSuccess } from '../utils/alerts'
import TabCadastro from './contrato/TabCadastro'
import TabOS from './contrato/TabOS'
import TabCompetencias from './contrato/TabCompetencias'
import TabFinanceiro from './contrato/TabFinanceiro'
import TabEventos from './contrato/TabEventos'
import TabOcorrencias from './contrato/TabOcorrencias'
import TabDocumentos from './contrato/TabDocumentos'
import TabPendencias from './contrato/TabPendencias'
import TabHistorico from './contrato/TabHistorico'

const pct = (parte, todo) => (todo > 0 ? Math.max(0, Math.min(100, (parte / todo) * 100)) : 0)

// Composição financeira: valores distintos, nunca somados num "saldo" genérico
function Composicao({ k }) {
  const itens = [
    ['Valor atual do contrato', k.valorAtualizado, 'var(--tinta-2)'],
    ['Empenhado', k.empenhado, 'var(--azul)'],
    ['Executado reconhecido', k.execucaoReconhecida, 'color-mix(in srgb, var(--azul) 50%, var(--folha))'],
    ['Liquidado', k.liquidado, 'var(--ocre)'],
    ['Pago', k.pago, 'var(--verde)'],
    ['Pendente de pagamento', k.pendentePagamento, 'var(--vermelho)'],
  ]
  return (
    <div className="composicao">
      {itens.map(([label, valor, cor]) => (
        <div key={label} className="composicao__linha">
          <div className="composicao__cab"><span>{label}</span><strong>{brl(valor)}</strong></div>
          <div className="composicao__barra"><span style={{ width: `${pct(valor, k.valorAtualizado)}%`, '--c': cor }} /></div>
        </div>
      ))}
      <div className="composicao__saldo">
        <span>Saldo a executar</span>
        <strong>{brl(k.saldoExecucao)}</strong>
      </div>
      <div className="composicao__saldo border-0 pt-0">
        <span>Saldo dos empenhos <span className="text-secondary">(a liquidar)</span></span>
        <strong className={k.saldoEmpenhos < 0 ? 'text-danger' : ''}>{brl(k.saldoEmpenhos)}</strong>
      </div>
    </div>
  )
}

// Régua das etapas até a execução (§4–§9)
const PASSOS = [
  ['em_cadastro', 'Cadastro em Compras'],
  ['aguardando_gestao', 'Recebimento pela Gestão'],
  ['designacao', 'Designação dos fiscais'],
  ['portaria', 'Portaria'],
  ['publicacao', 'Publicação'],
  ['termo', 'Termo de ciência'],
  ['ordem', 'OS/OC'],
  ['em_execucao', 'Execução'],
]

export default function ContratoFicha() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { porId, alertas, loading } = useGc()
  const { user } = useAuth()
  const { salvar, executar, can, role } = useGcActions()
  const [sp, setSp] = useSearchParams()
  const [editar, setEditar] = useState(false)
  const [encaminhando, setEncaminhando] = useState(false)

  const k = porId.get(id)
  const meusAlertas = useMemo(() => alertas.filter((a) => a.contratoId === id), [alertas, id])

  if (!k) {
    return (
      <GcGate>
        <div className="alert alert-warning">
          {loading ? 'Carregando…' : 'Contratação não encontrada ou sem permissão de acesso.'}{' '}
          <Link to="/contratos">Voltar às contratações</Link>
        </div>
      </GcGate>
    )
  }

  const c = k.c
  const aba = sp.get('aba') || 'resumo'
  const setAba = (a) => setSp({ aba: a }, { replace: true })

  const emAberto = k.competenciasEmAberto.length
  const osAbertas = k.b.os.filter((o) => !o.cancelado && !['concluida', 'cancelada', 'vigente'].includes(o.status)).length
  const nDocs = k.b.documentos.filter((d) => !d.cancelado).length + documentosReferenciados(k).length

  const tabs = [
    { key: 'resumo', label: 'Visão geral' },
    { key: 'cadastro', label: 'Cadastro' },
    { key: 'os', label: 'OS / OC', count: osAbertas },
    { key: 'competencias', label: 'Competências', count: emAberto },
    { key: 'financeiro', label: 'Financeiro' },
    { key: 'ocorrencias', label: 'Ocorrências', count: k.ocorrenciasAbertas.length },
    { key: 'eventos', label: 'Eventos e aditivos', count: k.b.eventos.filter((e) => !e.cancelado && ['solicitado', 'em_analise'].includes(e.situacao)).length },
    { key: 'documentos', label: 'Documentos', count: nDocs },
    { key: 'pendencias', label: 'Pendências', count: k.pendenciasAbertas.length, mais: true },
    { key: 'historico', label: 'Histórico', mais: true },
  ]

  // §5: a Gestão confere os dados e recebe a contratação; a seguir, designa os fiscais
  async function receber() {
    const faltas = []
    if (!c.sei_processo) faltas.push('processo SEI')
    if (!c.vigencia_fim && !c.prazo_execucao_dias) faltas.push('vigência ou prazo de execução')
    if (c.exige_garantia && !c.garantia_vencimento) faltas.push('vencimento da garantia')
    const texto = faltas.length
      ? `Ainda constam sem preenchimento: ${faltas.join(', ')}. Receber mesmo assim?`
      : 'Confirmar o recebimento da contratação? Em seguida, designe o fiscal titular e o substituto.'
    if (!(await showConfirm('Receber contratação', texto))) return
    try {
      await salvar('contratos', {
        validado_gestao: true,
        validado_em: new Date().toISOString(),
        validado_por: user?.id,
        situacao: c.situacao === 'em_cadastro' ? 'ativo' : c.situacao,
      }, c.id)
      showSuccess('Contratação recebida')
      setAba('cadastro')
    } catch (err) {
      showError(err.message)
    }
  }

  // §4: Compras encaminha; o banco gera a solicitação de fiscais e a de OS/OC
  async function encaminhar(v) {
    await executar('gc_encaminhar_contratacao', { p_contrato: c.id, p_tipo_ordem: v.tipo_ordem })
    showSuccess('Contratação encaminhada à Gestão')
  }

  const dono = ETAPA_CONTRATACAO[k.etapa]?.dono
  const QUEM = { compras: 'Compras', gestor: 'Gestão de contratos', gabinete: 'Gabinete' }
  const instrumento = INSTRUMENTO[c.instrumento] || 'Contrato'

  return (
    <GcGate>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <Link to="/contratos" className="cabecalho__voltar mb-0"><i className="bi bi-arrow-left" />Contratações</Link>
        <div className="cabecalho__acoes">
          {k.etapa === 'em_cadastro' && can('contrato.encaminhar') && (
            <button className="btn btn-success" onClick={() => setEncaminhando(true)}>
              <i className="bi bi-send me-2" />Encaminhar para Gestão
            </button>
          )}
          {can('contrato.validar') && !c.validado_gestao && k.etapa !== 'em_cadastro' && (
            <button className="btn btn-success" onClick={receber}>
              <i className="bi bi-inbox me-2" />Receber contratação
            </button>
          )}
          {k.etapa === 'em_cadastro' && can('contrato.criar') && role !== 'gestor' && (
            <button className="btn btn-outline-primary" onClick={() => { setEditar(true); setAba('cadastro') }}>
              <i className="bi bi-pencil me-2" />Completar cadastro
            </button>
          )}
          <button className="btn btn-outline-secondary" onClick={() => navigate(`/relatorios?tipo=individual&contrato=${c.id}`)}>
            <i className="bi bi-printer me-2" />Relatório completo
          </button>
        </div>
      </div>

      {/* Legenda: o bloco de título da prancha, com o essencial da contratação */}
      <section className="legenda" aria-label="Identificação da contratação">
        <div className="legenda__topo">
          <div className="legenda__id">
            <span className="rotulo">{instrumento}</span>
            <h1 className="legenda__numero">{c.numero}<span className="legenda__codigo">{codigoInterno(c)}</span></h1>
            <div className="legenda__contratada">{c.contratada}</div>
          </div>
          <div className="legenda__carimbos">
            {c.substituto_em_atuacao && <Pill kind="warning">Substituto em atuação</Pill>}
            <SituacaoContratacao k={k} grande />
          </div>
        </div>
        <dl className="legenda__grade">
          <div className="legenda__campo"><dt>CNPJ</dt><dd className="mono">{c.cnpj ? fmtCnpj(soDigitos(c.cnpj)) : '—'}</dd></div>
          <div className="legenda__campo"><dt>Processo SEI</dt><dd><SeiRef processo={c.sei_processo} link={c.sei_link} /></dd></div>
          <div className="legenda__campo"><dt>Vigência</dt><dd className="num">{fmtDate(c.vigencia_inicio)} — {fmtDate(k.vigenciaFim)} <BadgeVigencia dias={k.diasVigencia} situacao={c.situacao} /></dd></div>
          <div className="legenda__campo"><dt>Valor atualizado</dt><dd className="num">{brl(k.valorAtualizado)}</dd></div>
          <div className="legenda__campo"><dt>Gestão</dt><dd>{k.nomeGestor || '—'}</dd></div>
          <div className="legenda__campo"><dt>Fiscal em atuação</dt><dd>{k.fiscalEmAtuacao?.nome || '—'}</dd></div>
          <div className="legenda__campo legenda__campo--objeto"><dt>Objeto</dt><dd>{c.objeto}</dd></div>
        </dl>
      </section>

      {k.etapa !== 'em_execucao' && (
        <Card title="Formalização" subtitle="Etapas até o início da execução">
          <Regua passos={PASSOS} atual={k.etapa} />
          {dono && (
            <div className="proximo-passo">
              <i className="bi bi-arrow-right-circle" aria-hidden="true" />
              <span>Próximo passo: <strong>{ETAPA_CONTRATACAO[k.etapa].label}</strong> — com <strong>{QUEM[dono]}</strong>.</span>
            </div>
          )}
        </Card>
      )}

      <Tabs tabs={tabs} active={aba} onChange={setAba} />

      {aba === 'resumo' && <VisaoGeral k={k} alertas={meusAlertas} irPara={setAba} />}
      {aba === 'cadastro' && <TabCadastro k={k} editarAberto={editar} onFecharEditar={() => setEditar(false)} />}
      {aba === 'os' && <TabOS k={k} />}
      {aba === 'competencias' && <TabCompetencias k={k} />}
      {aba === 'financeiro' && <TabFinanceiro k={k} />}
      {aba === 'eventos' && <TabEventos k={k} />}
      {aba === 'ocorrencias' && <TabOcorrencias k={k} />}
      {aba === 'documentos' && <TabDocumentos k={k} />}
      {aba === 'pendencias' && <TabPendencias k={k} />}
      {aba === 'historico' && <TabHistorico k={k} />}

      {encaminhando && (
        <FormModal
          title="Encaminhar para Gestão contratual"
          size="md"
          fields={[{
            name: 'tipo_ordem', label: 'Solicitar', type: 'select', col: 12, required: true,
            options: Object.entries(TIPO_ORDEM).map(([value, label]) => ({ value, label })),
          }]}
          initial={{ tipo_ordem: c.instrumento === 'nota_empenho' ? 'oc' : 'os' }}
          submitLabel="Encaminhar"
          onSubmit={encaminhar}
          onClose={() => setEncaminhando(false)}
        >
          <div className="alert alert-info small">
            Serão geradas a <strong>solicitação de designação do fiscal titular e do substituto</strong> e a
            {' '}<strong>solicitação da ordem</strong> escolhida abaixo. Depois do encaminhamento, Compras mantém
            apenas a consulta.
          </div>
        </FormModal>
      )}
    </GcGate>
  )
}

// Aba "Visão geral": o que está pendente, prazos, responsáveis e números do contrato
function VisaoGeral({ k, alertas, irPara }) {
  const c = k.c
  const tarefas = alertas.map((a) => tarefaDoAlerta(a, { semContrato: true }))
  const ultimas = k.competencias.slice(0, 4)
  return (
    <div className="row g-4">
      <div className="col-xl-7">
        <Card title="Atenção" subtitle="Alertas desta contratação" flush>
          {tarefas.length === 0
            ? <Empty icon="bi-check2-circle">Nenhum alerta para esta contratação.</Empty>
            : <ListaTarefas compacta itens={tarefas} limite={6} mais={{ to: '/alertas', label: (n) => `Ver todos os alertas (${n})` }} />}
        </Card>

        <Card
          title="Competências recentes"
          flush
          actions={<button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => irPara('competencias')}>Abrir competências</button>}
        >
          {ultimas.length === 0 ? <Empty icon="bi-calendar2">Nenhuma competência aberta.</Empty> : (
            <ul className="lista-simples">
              {ultimas.map((comp) => (
                <li key={comp.id}>
                  <button type="button" className="lista-simples__link lista-simples__link--comp" onClick={() => irPara('competencias')}>
                    <span className="fw-semibold">{fmtCompetencia(comp.competencia)}</span>
                    <span className="lista-simples__texto"><Pill kind={comp.status.kind}>{comp.status.label}</Pill></span>
                    <span className="lista-simples__data">{comp.nf_numero ? `NF ${comp.nf_numero}` : 'sem NF'}</span>
                    <span className="num">{comp.valor_liquido > 0 ? brl(comp.valor_liquido) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="col-xl-5">
        <Card title="Responsáveis">
          <DefList cols={2} items={[
            ['Gestor(a)', k.nomeGestor],
            ['Fiscal em atuação', k.fiscalEmAtuacao?.nome],
            ['Fiscal titular', k.fiscalTitular?.nome],
            ['Fiscal substituto', k.fiscalSubstituto?.nome],
          ]} />
        </Card>
        <Card title="Prazos">
          <DefList cols={2} items={[
            ['Fim da vigência', fmtDate(k.vigenciaFim)],
            ['Iniciar prorrogação', c.prorrogavel ? fmtDate(k.inicioProrrogacao) : 'Não prorrogável'],
            ['Reajuste (data-base)', fmtDate(c.data_base_reajuste)],
            ['Garantia até', c.exige_garantia ? fmtDate(c.garantia_vencimento) : 'Não exigida'],
          ]} />
        </Card>
        <Card title="Quanto vale, empenhou, executou e pagou">
          <Composicao k={k} />
        </Card>
      </div>
    </div>
  )
}

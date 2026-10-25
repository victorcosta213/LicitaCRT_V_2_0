import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGc } from '../context/GcContext'
import { useAuth } from '../context/AuthContext'
import { Card, Empty, GcGate } from '../components/gc/ui'
import { ListaTarefas } from '../components/gc/Tarefa'
import { alertasDoPerfil, minhaVez, painelGestao, painelFinanceiro, tarefaDoAlerta } from '../utils/contrato'
import { ROLES, can, normalizeRole } from '../utils/permissions'
import PrimeirosPassos from '../components/gc/PrimeirosPassos'
import { useProcessosComPrazo } from '../components/useProcessosComPrazo'
import { brl } from '../utils/format'

const GRUPOS = [
  ['danger', 'Urgente'],
  ['warning', 'Atenção'],
  ['info', 'Para acompanhar'],
]
const POR_GRUPO = 8

const saudacao = (h = new Date().getHours()) => (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite')

export default function Mesa() {
  const { alertas, consolidados } = useGc()
  const { role, user, profile, nome } = useAuth()
  const r = normalizeRole(role)
  const processos = useProcessosComPrazo(can(role, 'processo.editar'))

  const tarefas = useMemo(() => [
    ...alertasDoPerfil(alertas, role, user?.id).map((a) => tarefaDoAlerta(a)),
    ...processos,
  ], [alertas, role, user, processos])

  const grupos = GRUPOS.map(([sev, titulo]) => [sev, titulo, tarefas.filter((t) => t.severidade === sev)])
  const pendentes = tarefas.filter((t) => t.severidade !== 'info').length
  const vencidas = tarefas.filter((t) => t.severidade === 'danger').length

  const primeiroNome = String(profile?.nome || nome || '').trim().split(/\s+/)[0] || ''
  const hoje = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <GcGate>
      <header className="cabecalho mesa-cab">
        <div className="cabecalho__texto">
          <div className="rotulo mb-1">{hoje} · {ROLES[r]?.label}</div>
          <h1 className="cabecalho__titulo">{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}.</h1>
          <p className="cabecalho__sub">
            {pendentes === 0
              ? 'Nada aguardando a sua atuação agora.'
              : <>Você tem <mark>{pendentes} {pendentes === 1 ? 'tarefa' : 'tarefas'}</mark> aguardando{vencidas > 0 && <> — {vencidas} {vencidas === 1 ? 'urgente' : 'urgentes'}</>}.</>}
          </p>
        </div>
      </header>

      <PrimeirosPassos />

      <div className="row g-4">
        <div className="col-xl-8">
          {tarefas.length === 0 && (
            <Card><Empty icon="bi-check2-circle">Nenhuma tarefa aguardando você. Quando algo depender de você, aparece aqui, sem precisar atualizar a página.</Empty></Card>
          )}
          {grupos.map(([sev, titulo, itens]) => itens.length > 0 && (
            <section key={sev} className="mb-4">
              <h2 className="grupo-titulo">{titulo} <span className="mono">{itens.length}</span></h2>
              <div className="card">
                <ListaTarefas itens={itens} limite={POR_GRUPO} mais={{ to: '/alertas', label: (n) => `Ver as ${n} em Alertas e prazos` }} />
              </div>
            </section>
          ))}
        </div>

        <div className="col-xl-4">
          <Atalhos r={r} consolidados={consolidados} alertas={alertas} role={role} usuarioId={user?.id} />
        </div>
      </div>
    </GcGate>
  )
}

function Atalhos({ r, consolidados, alertas, role, usuarioId }) {
  const comps = consolidados.flatMap((k) => k.competencias.map((comp) => ({ k, comp })))
  const naVez = comps.filter(({ k, comp }) => minhaVez(k, comp, role, usuarioId)).length
  const etapa = (e) => consolidados.filter((k) => k.etapa === e).length
  const g = painelGestao(consolidados, alertas)
  const f = painelFinanceiro(consolidados)
  const aCaminho = consolidados.filter((k) => k.etapa !== 'em_execucao').length
  const ocorrencias = consolidados.reduce((s, k) => s + k.ocorrenciasAbertas.length, 0)

  const porPerfil = {
    gestor: {
      atalhos: [
        ['bi-inbox', 'Recebidas de Compras', '/contratos?situacao=etapa:aguardando_gestao', g.recebidas.length],
        ['bi-clipboard2-check', 'Competências para conferir', '/competencias?etapa=conferencia_gestao', g.aguardandoGestao.length],
        ['bi-clipboard-check', 'OS / OC em andamento', '/ordens-servico'],
        ['bi-speedometer2', 'Painel da gestão', '/gestao'],
      ],
      numeros: [['Em execução', g.ativos], ['A caminho da execução', aCaminho], ['Vencem em até 120 dias', g.proximosVencimento.length]],
    },
    fiscal: {
      atalhos: [
        ['bi-receipt', 'Registrar nota fiscal', '/competencias?nf=1'],
        ['bi-calendar2-check', 'Competências na minha vez', '/competencias', naVez],
        ['bi-search', 'Minhas fiscalizações', '/contratos', consolidados.length],
      ],
      numeros: [['Contratações designadas', consolidados.length], ['Competências na minha vez', naVez], ['Ocorrências em aberto', ocorrencias]],
    },
    financeiro: {
      atalhos: [
        ['bi-cash-coin', 'Fila de liquidação e pagamento', '/financeiro', g.aguardandoFinanceiro.length],
        ['bi-bank', 'Empenhos', '/financeiro?aba=empenhos'],
        ['bi-file-earmark-bar-graph', 'Relatórios', '/relatorios'],
      ],
      numeros: [['Na fila do Financeiro', g.aguardandoFinanceiro.length], ['Aguardando pagamento', brl(f.pendente)], ['Saldo dos empenhos', brl(f.saldoEmpenhos)]],
    },
    compras: {
      atalhos: [
        ['bi-plus-lg', 'Nova contratação', '/contratos?nova=1'],
        ['bi-pencil-square', 'Contratações em cadastro', '/contratos?situacao=etapa:em_cadastro', etapa('em_cadastro')],
        ['bi-journal-check', 'Processos licitatórios', '/controle'],
        ['bi-kanban', 'Quadro de prioridades', '/home'],
      ],
      numeros: [['Em cadastro', etapa('em_cadastro')], ['Com a Gestão', etapa('aguardando_gestao')], ['Em execução', g.ativos]],
    },
    admin: {
      atalhos: [
        ['bi-people', 'Usuários e perfis', '/usuarios'],
        ['bi-sliders', 'Parâmetros', '/parametros'],
        ['bi-speedometer2', 'Painel da gestão', '/gestao'],
        ['bi-cash-coin', 'Painel financeiro', '/financeiro'],
      ],
      numeros: [['Contratações', consolidados.length], ['Em execução', g.ativos], ['A caminho da execução', aCaminho]],
    },
  }
  const p = porPerfil[r] || porPerfil.admin

  return (
    <>
      <Card title="Atalhos" flush>
        <ul className="atalhos">
          {p.atalhos.map(([icon, label, to, n]) => (
            <li key={label}>
              <Link to={to} className="atalho">
                <i className={`bi ${icon}`} aria-hidden="true" />
                <span>{label}</span>
                {n > 0 && <span className="atalho__n">{n}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Em números">
        <dl className="gc-deflist gc-deflist--1 mb-0">
          {p.numeros.map(([label, valor]) => (
            <div key={label} className="d-flex justify-content-between align-items-baseline gap-3">
              <dt>{label}</dt>
              <dd className="m-0 fs-5 num" style={{ fontFamily: 'var(--fonte-cond)', fontWeight: 600 }}>{valor}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  )
}

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGc } from '../context/GcContext'
import { BadgeVigencia, Card, Distribuicao, Empty, GcGate, Indicadores, PageHeader } from '../components/gc/ui'
import { ListaTarefas } from '../components/gc/Tarefa'
import { alertasDoPerfil, painelGestao, tarefaDoAlerta } from '../utils/contrato'
import { fmtCompetencia, fmtDate, mesAtualISO } from '../utils/format'

// Etapas até a execução: rótulo curto e quem age
const FORMALIZACAO = [
  ['recebidas', 'aguardando_gestao', 'Recebimento', 'Gestão'],
  ['designacao', 'designacao', 'Fiscais', 'Gestão'],
  ['portaria', 'portaria', 'Portaria', 'Gestão'],
  ['publicacao', 'publicacao', 'Publicação', 'Gabinete'],
  ['termo', 'termo', 'Termo de ciência', 'Gestão'],
  ['ordem', 'ordem', 'OS / OC', 'Gestão'],
]

// Competências em andamento, da NF ao pagamento
const ETAPAS_DISTRIBUICAO = [
  ['aguardando_nf', 'Aguardando NF', 'var(--neutro)'],
  ['aguardando_fiscalizacao', 'Em fiscalização', 'color-mix(in srgb, var(--azul) 50%, var(--folha))'],
  ['aguardando_atesto', 'Aguardando atesto', 'var(--azul)'],
  ['conferencia_gestao', 'Conferência da Gestão', 'var(--ocre)'],
  ['em_liquidacao', 'Liquidação', 'color-mix(in srgb, var(--verde) 55%, var(--folha))'],
  ['aguardando_pagamento', 'Pagamento', 'var(--verde)'],
  ['suspensa', 'Suspensas', 'var(--vermelho)'],
]

export default function GestaoPainel() {
  const { consolidados, alertas } = useGc()
  const p = useMemo(() => painelGestao(consolidados, alertas), [consolidados, alertas])

  const porEtapa = useMemo(() => {
    const m = {}
    for (const k of consolidados) {
      for (const c of k.competencias) m[c.status.key] = (m[c.status.key] || 0) + 1
    }
    return m
  }, [consolidados])

  const atencao = useMemo(
    () => alertasDoPerfil(alertas, 'gestor').filter((a) => a.severidade !== 'info').map((a) => tarefaDoAlerta(a)),
    [alertas],
  )

  const aCaminho = FORMALIZACAO.reduce((s, [chave]) => s + p[chave].length, 0)
  const mes = fmtCompetencia(mesAtualISO())

  return (
    <GcGate>
      <PageHeader
        title="Painel da gestão"
        subtitle={`Contratações, formalização e competências · referência ${mes}`}
        actions={(
          <Link to="/relatorios" className="btn btn-outline-secondary">
            <i className="bi bi-file-earmark-bar-graph me-2" />Relatórios
          </Link>
        )}
      />

      <Indicadores itens={[
        { label: 'Em execução', value: p.ativos, hint: `${p.emProrrogacao.length} em prorrogação`, to: '/contratos?vista=execucao' },
        { label: 'A caminho da execução', value: aCaminho, hint: 'da chegada de Compras à OS/OC', kind: aCaminho ? 'primary' : undefined, to: '/contratos?vista=caminho' },
        { label: `Competências de ${mes.split('/')[0]}`, value: <>{p.competenciasMesConcluidas}<small className="text-secondary fs-6"> / {p.competenciasMes.length}</small></>, hint: 'pagas no mês', to: '/competencias' },
        { label: 'Pendências críticas', value: p.criticas.length, hint: p.criticas.length ? 'prazo vencido ou ≤ 30 dias' : 'nada crítico', kind: p.criticas.length ? 'danger' : undefined, to: '/alertas' },
      ]} />

      <Card title="Formalização" subtitle="Contratações a caminho da execução, por etapa — quem age está indicado em cada uma">
        <Indicadores fluxo itens={FORMALIZACAO.map(([chave, etapa, label, quem]) => ({
          label, value: p[chave].length, hint: quem,
          kind: p[chave].length ? (quem === 'Gabinete' ? 'warning' : 'primary') : undefined,
          to: p[chave].length ? `/contratos?situacao=etapa:${etapa}` : undefined,
        }))} />
        {aCaminho === 0 && <div className="small text-secondary">Nenhuma contratação em formalização.</div>}
      </Card>

      <div className="row g-4">
        <div className="col-xl-7">
          <Card title="Competências em andamento" subtitle="Da nota fiscal recebida pelo fiscal ao pagamento">
            <Distribuicao
              vazio="Nenhuma competência em andamento."
              itens={ETAPAS_DISTRIBUICAO
                .filter(([key]) => key !== 'suspensa' || porEtapa[key])
                .map(([key, label, cor]) => ({ key, label, cor, value: porEtapa[key] || 0, to: `/competencias?etapa=${key}` }))}
            />
          </Card>

          <Card title="Vigências nos próximos 120 dias" flush>
            {p.proximosVencimento.length === 0 ? <Empty icon="bi-hourglass">Nenhuma contratação vence nos próximos 120 dias.</Empty> : (
              <ul className="lista-simples">
                {p.proximosVencimento.slice(0, 8).map((k) => (
                  <li key={k.id}>
                    <Link to={`/contratos/${k.id}?aba=eventos`} className="lista-simples__link">
                      <span className="mono lista-simples__num">{k.c.numero}</span>
                      <span className="lista-simples__texto">{k.c.contratada}</span>
                      <span className="lista-simples__data">{fmtDate(k.vigenciaFim)}</span>
                      <BadgeVigencia dias={k.diasVigencia} situacao={k.c.situacao} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="col-xl-5">
          <Card title="Precisa de atenção" subtitle="Tarefas da Gestão com prazo" flush>
            {atencao.length === 0
              ? <Empty icon="bi-check2-circle">Nada pendente com prazo.</Empty>
              : <ListaTarefas compacta itens={atencao} limite={8} mais={{ to: '/alertas', label: (n) => `Ver todas (${n})` }} />}
          </Card>
        </div>
      </div>
    </GcGate>
  )
}

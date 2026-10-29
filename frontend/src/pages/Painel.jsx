import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGc } from '../context/GcContext'
import { Card, Empty, Indicadores, PageHeader, Pill } from '../components/gc/ui'
import ListaTravados from '../components/gc/ListaTravados'
import AssinaturasPendentes from '../components/documentos/AssinaturasPendentes'
import { useAssinaturasPendentes } from '../components/useDocumentos'
import PrimeirosPassos from '../components/gc/PrimeirosPassos'
import { useTramitacao } from '../components/useTramitacao'
import { useMovimentacoesRecentes } from '../components/useMovimentacoesRecentes'
import { AvisoTramitacaoAusente } from './Processos'
import { painelGestao } from '../utils/contrato'
import {
  DIAS_PARADO_PADRAO, MOVIMENTOS, VERBOS_MOVIMENTO, haQuanto, indicadores, plural, processosTravados, resumoPorUnidade,
} from '../utils/tramitacao'
import './tramitacao.css'

const saudacao = (h = new Date().getHours()) => (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite')
const LIMITE_ATENCAO = 5

// Visão geral da autoridade: tudo o que acontece no órgão, de relance e com poucos cliques
export default function Painel() {
  const { user, profile, nome } = useAuth()
  const { params, consolidados = [], alertas = [] } = useGc() || {}
  const navigate = useNavigate()
  const { carregando, erro, ausente, processos, unidades, unidadesPorId } = useTramitacao()
  const { movimentos } = useMovimentacoesRecentes(12)
  const [busca, setBusca] = useState('')
  const assinar = useAssinaturasPendentes({ ativo: true, usuarioId: user?.id })

  const diasParado = Number(params?.tr_dias_parado) || DIAS_PARADO_PADRAO
  const opcoes = useMemo(() => ({ diasParado }), [diasParado])
  const n = useMemo(() => indicadores(processos, opcoes), [processos, opcoes])
  const porSetor = useMemo(() => resumoPorUnidade(processos, unidades, opcoes), [processos, unidades, opcoes])
  const atencao = useMemo(() => processosTravados(processos, opcoes), [processos, opcoes])
  const processoPorId = useMemo(() => new Map(processos.map((p) => [p.id, p])), [processos])
  const g = useMemo(() => painelGestao(consolidados, alertas), [consolidados, alertas])
  const urgentes = alertas.filter((a) => a.severidade === 'danger').length

  const primeiroNome = String(profile?.nome || nome || '').trim().split(/\s+/)[0] || ''
  const hoje = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  const procurar = (e) => {
    e.preventDefault()
    const q = busca.trim()
    navigate(q ? `/processos?busca=${encodeURIComponent(q)}` : '/processos')
  }

  return (
    <>
      <header className="cabecalho mesa-cab">
        <div className="cabecalho__texto">
          <div className="rotulo mb-1">{hoje} · Visão geral</div>
          <h1 className="cabecalho__titulo">{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}.</h1>
          <p className="cabecalho__sub">
            {n.parados + n.atrasados === 0
              ? 'Nenhum processo parado ou atrasado agora.'
              : (
                <>
                  Há{' '}
                  {n.parados > 0 && <mark>{plural(n.parados, 'parado', 'parados')}</mark>}
                  {n.parados > 0 && n.atrasados > 0 && ' e '}
                  {n.atrasados > 0 && <mark>{plural(n.atrasados, 'atrasado', 'atrasados')}</mark>}
                  {' '}entre os processos em andamento.
                </>
              )}
          </p>
        </div>
        <form className="painel-busca" onSubmit={procurar} role="search">
          <i className="bi bi-search" aria-hidden="true" />
          <input className="form-control" placeholder="Achar um processo: protocolo, assunto…" aria-label="Achar um processo"
            value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button type="submit" className="btn btn-primary">Procurar</button>
        </form>
      </header>

      {assinar.length > 0 && <AssinaturasPendentes itens={assinar} />}

      <PrimeirosPassos tipo="tramitacao" abertoPorPadrao={false} />

      {ausente && <AvisoTramitacaoAusente />}
      {!ausente && erro && <div className="alert alert-danger">Não foi possível carregar os processos: {erro}</div>}

      {!ausente && !erro && (
        <>
          <h2 className="grupo-titulo">Processos</h2>
          <Indicadores itens={[
            { label: 'Em andamento', value: n.emAndamento, to: '/processos', hint: 'em todos os setores' },
            { label: 'Parados', value: n.parados, kind: n.parados ? 'warning' : undefined, to: '/processos?vista=atencao', hint: `${diasParado}+ dias sem andar` },
            { label: 'Atrasados', value: n.atrasados, kind: n.atrasados ? 'danger' : undefined, to: '/processos?vista=atencao', hint: 'passaram do prazo' },
            { label: 'Aguardando recebimento', value: n.aguardandoRecebimento, kind: n.aguardandoRecebimento ? 'info' : undefined, to: '/processos?vista=receber', hint: 'ninguém abriu ainda' },
            { label: 'Concluídos no mês', value: n.concluidosNoMes, to: '/processos?vista=concluidos' },
          ]} />

          <div className="row g-4 mt-1">
            <div className="col-xl-8">
              <Card title="Por setor" subtitle="Onde estão os processos agora. Clique num setor para ver os dele.">
                {carregando ? <p className="text-secondary mb-0">Carregando…</p> : porSetor.length === 0 ? (
                  <Empty icon="bi-diagram-3">Nenhum processo em andamento. Quando houver, você vê aqui em que setor cada um está.</Empty>
                ) : (
                  <ul className="setores">
                    {porSetor.map((l) => (
                      <li key={l.unidade.id}>
                        <Link to={`/processos?unidade=${l.unidade.id}`} className={`setor ${l.atrasados ? 'setor--atrasado' : l.parados ? 'setor--parado' : ''}`}
                          aria-label={`${l.unidade.nome}: ${l.total} em andamento, ${l.parados} parados, ${l.atrasados} atrasados`}>
                          <span className="setor__sigla">{l.unidade.sigla}</span>
                          <span className="setor__nome">{l.unidade.nome}</span>
                          <span className="setor__total">{l.total}</span>
                          <span className="setor__chips">
                            {l.parados > 0 && <Pill kind="warning">{plural(l.parados, 'parado', 'parados')}</Pill>}
                            {l.atrasados > 0 && <Pill kind="danger">{plural(l.atrasados, 'atrasado', 'atrasados')}</Pill>}
                            {l.parados === 0 && l.atrasados === 0 && <Pill kind="success">em dia</Pill>}
                          </span>
                          <span className="setor__media">espera média {l.mediaDias} d</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="col-xl-4">
              <Card title="Precisam de atenção" subtitle="Parados ou atrasados, os mais antigos primeiro." flush>
                {atencao.length === 0 ? (
                  <div className="p-3"><Empty icon="bi-check2-circle">Nada travado agora.</Empty></div>
                ) : <ListaTravados itens={atencao} unidadesPorId={unidadesPorId} limite={LIMITE_ATENCAO} />}
                {atencao.length > LIMITE_ATENCAO && (
                  <div className="card-footer py-2 small"><Link to="/processos?vista=atencao">Ver os {atencao.length}</Link></div>
                )}
              </Card>
            </div>
          </div>

          <Card title="Últimas movimentações" subtitle="Quem mexeu em quê, do mais recente para o mais antigo." flush>
            {movimentos.length === 0 ? (
              <div className="p-3"><Empty icon="bi-clock-history">Ainda não há movimentações.</Empty></div>
            ) : (
              <ol className="movimentos">
                {movimentos.map((m) => {
                  const p = processoPorId.get(m.processo_id)
                  const info = MOVIMENTOS[m.tipo] || { icone: 'bi-dot' }
                  const de = unidadesPorId.get(m.de_unidade)
                  const para = unidadesPorId.get(m.para_unidade)
                  return (
                    <li key={m.id} className="movimento">
                      <span className="movimento__icone" aria-hidden="true"><i className={`bi ${info.icone}`} /></span>
                      <div className="movimento__texto">
                        <strong>{m.criada_por_nome || 'Alguém'}</strong> {VERBOS_MOVIMENTO[m.tipo] || m.tipo}{' '}
                        <Link to={`/processos/${m.processo_id}`} className="mono">{p?.numero || 'o processo'}</Link>
                        {p?.assunto && <span className="text-secondary"> · {p.assunto}</span>}
                        {m.tipo === 'envio' && <> de <b>{de?.sigla || '—'}</b> para <b>{para?.sigla || '—'}</b>{m.para_usuario_nome && <> ({m.para_usuario_nome})</>}</>}
                        {m.tipo === 'abertura' && para && <> para <b>{para.sigla}</b></>}
                        {m.despacho && m.tipo !== 'alteracao' && <div className="movimento__despacho">“{m.despacho}”</div>}
                      </div>
                      <time className="movimento__quando" dateTime={m.criada_em} title={new Date(m.criada_em).toLocaleString('pt-BR')}>{haQuanto(m.criada_em)}</time>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>
        </>
      )}

      <h2 className="grupo-titulo mt-4">Contratações</h2>
      <Indicadores itens={[
        { label: 'Em execução', value: g.ativos, to: '/gestao', hint: 'contratações vigentes' },
        { label: 'Vencem em até 120 dias', value: g.proximosVencimento.length, kind: g.proximosVencimento.length ? 'warning' : undefined, to: '/contratos', hint: 'vigência' },
        { label: 'Na fila do Financeiro', value: g.aguardandoFinanceiro.length, to: '/financeiro', hint: 'a liquidar ou pagar' },
        { label: 'Alertas urgentes', value: urgentes, kind: urgentes ? 'danger' : undefined, to: '/alertas' },
      ]} />
    </>
  )
}

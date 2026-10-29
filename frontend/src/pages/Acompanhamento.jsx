import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGc } from '../context/GcContext'
import { Card, Empty, Indicadores, PageHeader } from '../components/gc/ui'
import ListaTravados from '../components/gc/ListaTravados'
import { useTramitacao } from '../components/useTramitacao'
import { AvisoTramitacaoAusente } from './Processos'
import { DIAS_PARADO_PADRAO, indicadores, processosTravados, resumoPorUnidade } from '../utils/tramitacao'
import './tramitacao.css'

const LIMITE_TRAVADOS = 10

// Painel para a gestão e a autoridade: onde estão os processos e o que está travando
export default function Acompanhamento() {
  const { params } = useGc() || {}
  const { carregando, erro, ausente, processos, unidades, unidadesPorId } = useTramitacao()
  const diasParado = Number(params?.tr_dias_parado) || DIAS_PARADO_PADRAO

  const opcoes = useMemo(() => ({ diasParado }), [diasParado])
  const n = useMemo(() => indicadores(processos, opcoes), [processos, opcoes])
  const porUnidade = useMemo(() => resumoPorUnidade(processos, unidades, opcoes), [processos, unidades, opcoes])
  const travados = useMemo(() => processosTravados(processos, opcoes), [processos, opcoes])
  const maiorTotal = Math.max(1, ...porUnidade.map((l) => l.total))

  return (
    <>
      <PageHeader
        title="Acompanhamento"
        subtitle={`Onde estão os processos e o que está travando. Um processo é considerado parado depois de ${diasParado} dias sem movimentação na unidade.`}
      />

      {ausente && <AvisoTramitacaoAusente />}
      {!ausente && erro && <div className="alert alert-danger">Não foi possível carregar o painel: {erro}</div>}

      {!ausente && !erro && (
        <>
          <Indicadores itens={[
            { label: 'Em andamento', value: n.emAndamento, to: '/processos', hint: 'processos abertos' },
            { label: 'Parados', value: n.parados, kind: n.parados ? 'warning' : undefined, to: '/processos?vista=atencao', hint: `há ${diasParado}+ dias na mesma unidade` },
            { label: 'Atrasados', value: n.atrasados, kind: n.atrasados ? 'danger' : undefined, to: '/processos?vista=atencao', hint: 'passaram do prazo final' },
            { label: 'Aguardando recebimento', value: n.aguardandoRecebimento, kind: n.aguardandoRecebimento ? 'info' : undefined, to: '/processos?vista=receber', hint: 'ninguém abriu ainda' },
            { label: 'Concluídos no mês', value: n.concluidosNoMes, to: '/processos?vista=concluidos' },
          ]} />

          <div className="row g-4 mt-1">
            <div className="col-xl-7">
              <Card title="Onde estão os processos" subtitle="Por unidade: quantos estão lá, quantos parados e o tempo médio de espera.">
                {carregando ? <p className="text-secondary mb-0">Carregando…</p> : porUnidade.length === 0 ? (
                  <Empty icon="bi-diagram-3">Nenhum processo em andamento. Quando houver, você vê aqui em que unidade cada um está.</Empty>
                ) : (
                  <div role="table" aria-label="Processos por unidade">
                    <div className="unidade-linha unidade-linha--cab" role="row">
                      <span role="columnheader">Unidade</span><span role="columnheader" />
                      <span role="columnheader">Total</span><span role="columnheader">Parados</span>
                      <span role="columnheader">Atras.</span><span role="columnheader">Média</span>
                    </div>
                    {porUnidade.map((l) => (
                      <div className="unidade-linha" role="row" key={l.unidade.id}>
                        <span role="cell"><Link to={`/processos?unidade=${l.unidade.id}`} title={l.unidade.nome}>{l.unidade.sigla}</Link></span>
                        <span role="cell" className="unidade-linha__barra"><span style={{ width: `${(l.total / maiorTotal) * 100}%` }} /></span>
                        <span role="cell" className="num fw-semibold">{l.total}</span>
                        <span role="cell" className={`num ${l.parados ? 'text-warning-emphasis fw-semibold' : 'text-secondary'}`}>{l.parados}</span>
                        <span role="cell" className={`num ${l.atrasados ? 'text-danger fw-semibold' : 'text-secondary'}`}>{l.atrasados}</span>
                        <span role="cell" className="num text-secondary">{l.mediaDias} d</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="col-xl-5">
              <Card title="O que está travado" subtitle="Os mais antigos na unidade primeiro." flush>
                {travados.length === 0 ? (
                  <div className="p-3"><Empty icon="bi-check2-circle">Nada travado agora. Os processos estão andando dentro do prazo.</Empty></div>
                ) : (
                  <ListaTravados itens={travados} unidadesPorId={unidadesPorId} limite={LIMITE_TRAVADOS} />
                )}
                {travados.length > LIMITE_TRAVADOS && (
                  <div className="card-footer py-2 small">
                    <Link to="/processos?vista=atencao">Ver os {travados.length} que precisam de atenção</Link>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  )
}

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, Empty, PageHeader, Pill } from '../components/gc/ui'
import EnviarDfdModal from '../components/compras/EnviarDfdModal'
import { useDocumentos } from '../components/useDocumentos'
import { useSolicitacoes } from '../components/useSolicitacoes'
import { mensagemErroDocumento, obterDocumento } from '../services/documentos'
import { enviarDfdAoCompras, mensagemErroSolicitacao } from '../services/solicitacoes'
import { fmtDateTime } from '../utils/format'
import { showError, showSuccess } from '../utils/alerts'
import { STATUS } from '../utils/documentosPlataforma'
import { devolvidasDaUnidade, dfdsDisponiveis } from '../utils/solicitacoes'
import { AvisoSolicitacoesAusente } from './Solicitacoes'
import './compras.css'

// Ponto de partida do secretário: fazer a DFD, acompanhar as que estão em assinatura e enviar as assinadas ao Compras
export default function SolicitacaoNova() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { carregando: carregandoDocs, documentos } = useDocumentos()
  const { carregando, ausente, solicitacoes } = useSolicitacoes()
  const [enviando, setEnviando] = useState(null) // documento completo

  const prontas = useMemo(() => dfdsDisponiveis(documentos, solicitacoes), [documentos, solicitacoes])
  const emAndamento = documentos.filter((d) => d.modelo === 'dfd' && ['rascunho', 'aguardando_assinatura'].includes(d.status))
  const devolvidas = devolvidasDaUnidade(solicitacoes, { usuarioId: user?.id, unidadeId: profile?.unidade_id })

  async function abrir(d) {
    try {
      const { documento } = await obterDocumento(d.id) // a lista não traz o conteúdo da DFD
      setEnviando(documento)
    } catch (err) { showError(mensagemErroDocumento(err)) }
  }
  async function enviar(dados, devolvidaId, resposta) {
    try {
      const id = await enviarDfdAoCompras(dados, devolvidaId, resposta)
      showSuccess(devolvidaId ? 'DFD reenviada ao Compras.' : 'DFD enviada ao Compras.')
      navigate(`/solicitacoes/${id}`)
    } catch (err) { throw new Error(mensagemErroSolicitacao(err)) }
  }

  const linha = (d, acao) => (
    <li key={d.id} className="d-flex justify-content-between align-items-center gap-3">
      <div className="min-w-0">
        <Link to={`/documentos/${d.id}`} className="mono fw-semibold">{d.numero}</Link>
        <div className="text-truncate">{d.titulo}</div>
        <div className="small text-secondary">Atualizada em {fmtDateTime(d.atualizado_em)}</div>
      </div>
      {acao}
    </li>
  )

  return (
    <>
      <PageHeader
        back={{ to: '/solicitacoes', label: 'Pedidos ao Compras' }}
        title="Nova DFD"
        subtitle="Formalize a demanda da sua secretaria: escolha os itens do catálogo, informe as quantidades, assine e envie ao Compras."
        actions={<Link to="/documentos/novo?modelo=dfd" className="btn btn-primary"><i className="bi bi-file-earmark-plus me-2" />Fazer nova DFD</Link>}
      />
      {ausente ? <AvisoSolicitacoesAusente /> : (
        <div className="row g-4">
          <div className="col-xl-8">
            {devolvidas.length > 0 && (
              <div className="alert alert-danger">
                <strong>O Compras devolveu {devolvidas.length === 1 ? 'um pedido' : `${devolvidas.length} pedidos`} para ajuste.</strong> Faça uma nova DFD
                corrigida (ou use "Refazer a DFD" no pedido) e, ao enviar, escolha que ela responde ao pedido devolvido.
              </div>
            )}
            <Card title="DFDs assinadas, prontas para enviar">
              {carregando || carregandoDocs ? <p className="text-secondary mb-0">Carregando…</p>
                : prontas.length === 0 ? <Empty icon="bi-send">Nenhuma DFD assinada aguardando envio.</Empty> : (
                  <ul className="doc-assinaturas">
                    {prontas.map((d) => linha(d, <button type="button" className="btn btn-primary btn-sm" onClick={() => abrir(d)}><i className="bi bi-send me-1" />Enviar ao Compras</button>))}
                  </ul>
                )}
            </Card>
            <Card title="DFDs em elaboração ou em assinatura">
              {emAndamento.length === 0 ? <p className="small text-secondary mb-0">Nenhuma.</p> : (
                <ul className="doc-assinaturas">
                  {emAndamento.map((d) => linha(d, <Pill kind={STATUS[d.status].kind}>{STATUS[d.status].label}</Pill>))}
                </ul>
              )}
            </Card>
          </div>
          <div className="col-xl-4">
            <Card title="Como funciona">
              <ol className="passos-curtos small mb-0">
                <li><strong>Faça a DFD:</strong> escolha os itens do catálogo (a especificação já vem pronta) e informe só as quantidades.</li>
                <li><strong>Assine:</strong> com a sua senha. Ao terminar as assinaturas, o sistema já oferece o envio.</li>
                <li><strong>Envie ao Compras:</strong> os dados do pedido saem da própria DFD.</li>
                <li>Aceito, vira um <strong>processo de contratação</strong> que a secretaria acompanha.</li>
              </ol>
              <p className="small text-secondary mt-3 mb-0">Lei 14.133/2021, art. 12, VII, art. 18 e art. 72, I.</p>
            </Card>
          </div>
        </div>
      )}
      {enviando && <EnviarDfdModal documento={enviando} devolvidas={devolvidas} onSubmit={enviar} onClose={() => setEnviando(null)} />}
    </>
  )
}

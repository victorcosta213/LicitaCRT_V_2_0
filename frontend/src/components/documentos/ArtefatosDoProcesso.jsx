import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Pill } from '../gc/ui'
import FormModal from '../gc/FormModal'
import { useMarcas } from '../compras/useMarcas'
import { checklistDoProcesso, resumoChecklist } from '../../modelos/artefatos'
import { podeUsarModelo } from '../../modelos/catalogo'
import { MODALIDADES, OBJETOS } from '../../modelos/variantes'
import { definirContratacao, mensagemErroDocumento } from '../../services/documentos'
import { desmarcarItem, marcarItem, mensagemErroSolicitacao, solicitacaoDoProcesso } from '../../services/solicitacoes'
import { fmtDateTime } from '../../utils/format'
import { showError, showSuccess } from '../../utils/alerts'

const ESTAGIO = {
  assinado: { icone: 'bi-check-circle-fill', cor: 'text-success', rotulo: 'Assinado', kind: 'success' },
  juntado: { icone: 'bi-paperclip', cor: 'text-success', rotulo: 'Juntado', kind: 'success' },
  nao_se_aplica: { icone: 'bi-dash-circle', cor: 'text-secondary', rotulo: 'Não se aplica', kind: 'secondary' },
  aguardando_assinatura: { icone: 'bi-hourglass-split', cor: 'text-warning-emphasis', rotulo: 'Aguardando assinatura', kind: 'warning' },
  rascunho: { icone: 'bi-pencil-square', cor: 'text-primary', rotulo: 'Rascunho', kind: 'warning' },
  nenhum: { icone: 'bi-circle', cor: 'text-secondary', rotulo: 'Pendente', kind: 'secondary' },
}

// Roteiro de documentos que a Lei 14.133/2021 espera para este processo, com o andamento de cada um.
// Os feitos na plataforma acompanham o documento; os de fora são marcados como juntados (com a referência).
export default function ArtefatosDoProcesso({ processo, documentos, role, podeAtuar, podeCriar }) {
  const [modalidade, setModalidade] = useState(processo.contratacao_modalidade || '')
  const [objeto, setObjeto] = useState(processo.contratacao_objeto || '')
  const [editando, setEditando] = useState(false)
  const [busy, setBusy] = useState(false)
  const [marcando, setMarcando] = useState(null) // { item, situacao }
  const [origem, setOrigem] = useState(null)
  const { marcas } = useMarcas(processo.id)

  useEffect(() => {
    let vivo = true
    solicitacaoDoProcesso(processo.id).then((s) => { if (vivo) setOrigem(s) }).catch(() => {})
    return () => { vivo = false }
  }, [processo.id])

  const checklist = checklistDoProcesso(processo.contratacao_modalidade, documentos.filter((d) => d.processo_id === processo.id),
    { marcas, objeto: processo.contratacao_objeto })
  const mostrarEscolha = !checklist || editando
  const aberto = processo.situacao === 'em_andamento'
  const pode = podeAtuar && aberto

  async function definir() {
    setBusy(true)
    try {
      await definirContratacao(processo.id, { modalidade, objeto })
      showSuccess('Tipo de contratação definido.')
      setEditando(false)
    } catch (err) { showError(mensagemErroDocumento(err)) } finally { setBusy(false) }
  }
  async function desfazer(i) {
    try {
      await desmarcarItem(processo.id, i.chave)
      showSuccess('Marcação desfeita.')
    } catch (err) { showError(mensagemErroSolicitacao(err)) }
  }

  const resumo = checklist ? resumoChecklist(checklist) : null

  return (
    <Card title="Roteiro de documentos da contratação (Lei 14.133/2021)"
      subtitle="O que esta forma de contratação exige em cada etapa: crie pelos modelos ou registre o que foi juntado ao processo."
      actions={checklist && podeAtuar && !editando && <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditando(true)}>Alterar tipo</button>}>
      {origem && (
        <p className="small mb-3">
          <i className="bi bi-send me-1" aria-hidden="true" />Aberto a partir da solicitação <Link to={`/solicitacoes/${origem.id}`} className="mono">{origem.numero}</Link>
          {origem.documento_id ? ', com o DFD do setor.' : '.'}
        </p>
      )}
      {mostrarEscolha && (
        <div className="row g-3 align-items-end mb-3">
          <div className="col-md-5">
            <label htmlFor="art-modalidade" className="form-label fw-semibold">Forma de contratação</label>
            <select id="art-modalidade" className="form-select" value={modalidade} onChange={(e) => setModalidade(e.target.value)} disabled={!podeAtuar}>
              <option value="">Selecione…</option>
              {MODALIDADES.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </div>
          <div className="col-md-5">
            <label htmlFor="art-objeto" className="form-label fw-semibold">Tipo de objeto</label>
            <select id="art-objeto" className="form-select" value={objeto} onChange={(e) => setObjeto(e.target.value)} disabled={!podeAtuar}>
              <option value="">Selecione…</option>
              {OBJETOS.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </select>
          </div>
          <div className="col-md-2 d-grid">
            <button className="btn btn-primary" onClick={definir} disabled={!podeAtuar || busy || !modalidade}>{busy ? 'Salvando…' : 'Definir'}</button>
          </div>
          {!podeAtuar && <div className="col-12 small text-secondary">Só a unidade onde o processo está define o tipo de contratação.</div>}
        </div>
      )}

      {checklist && !editando && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <strong>{checklist.titulo}</strong>
            <span className="small text-secondary">{resumo.prontos} de {resumo.total} documentos obrigatórios prontos</span>
          </div>
          <div className="progress mb-2" role="progressbar" aria-label="Documentos obrigatórios prontos" aria-valuenow={resumo.prontos} aria-valuemin="0" aria-valuemax={resumo.total} style={{ height: 8 }}>
            <div className="progress-bar bg-success" style={{ width: `${resumo.total ? (resumo.prontos / resumo.total) * 100 : 0}%` }} />
          </div>
          {resumo.proximo && <p className="small mb-3"><strong>Próximo:</strong> {resumo.proximo.nome} <span className="text-secondary">({resumo.proximo.quem})</span></p>}
          {checklist.avisos.map((a) => <div key={a} className="alert alert-warning py-2 small" role="note">{a}</div>)}
          {checklist.etapas.map((e) => (
            <section key={e.nome} className="mb-3" aria-label={e.nome}>
              <h3 className="grupo-titulo">{e.nome}</h3>
              <ul className="doc-assinaturas">
                {e.itens.map((i) => {
                  const est = ESTAGIO[i.status]
                  const usavel = i.modeloDef && podeUsarModelo(i.modeloDef, role)
                  return (
                    <li key={i.chave} className="d-flex justify-content-between align-items-start gap-3">
                      <div className="min-w-0">
                        <div>
                          <i className={`bi ${est.icone} ${est.cor} me-2`} aria-hidden="true" />
                          <strong>{i.nome}</strong> {!i.obrigatorio && <span className="small text-secondary">(se for o caso)</span>}
                        </div>
                        <div className="small text-secondary">{i.base}{i.quem ? ` · ${i.quem}` : ''}{i.nota ? ` · ${i.nota}` : ''}</div>
                        {i.documentos.length > 0 && (
                          <div className="small">{i.documentos.map((d) => <Link key={d.id} to={`/documentos/${d.id}`} className="me-2 mono">{d.numero}</Link>)}</div>
                        )}
                        {i.marca && (
                          <div className="small">
                            {i.marca.situacao === 'juntado' ? 'Onde está: ' : 'Justificativa: '}<span className="texto-livre">{i.marca.referencia}</span>
                            <span className="text-secondary"> · {i.marca.marcado_por_nome} em {fmtDateTime(i.marca.marcado_em)}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-end roteiro__acoes">
                        <Pill kind={est.kind}>{est.rotulo}</Pill>
                        {i.status === 'nenhum' && podeCriar && usavel && (
                          <div className="mt-1"><Link className="btn btn-sm btn-outline-primary" to={`/documentos/novo?modelo=${i.modelo}&processo=${processo.id}`}>Criar</Link></div>
                        )}
                        {i.status === 'nenhum' && i.modeloDef && !usavel && <div className="small text-secondary mt-1">feito por outro setor</div>}
                        {pode && !i.marca && i.status !== 'assinado' && (
                          <div className="mt-1 d-flex gap-1 justify-content-end flex-wrap">
                            {podeCriar && !i.modeloDef && (
                              <Link className="btn btn-sm btn-outline-primary" to={`/documentos/novo?processo=${processo.id}&arquivo=1&item=${i.chave}`}>Enviar arquivo</Link>
                            )}
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setMarcando({ item: i, situacao: 'juntado' })}>
                              {i.modeloDef ? 'Feito fora' : 'Registrar juntada'}
                            </button>
                            {!i.obrigatorio && (
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setMarcando({ item: i, situacao: 'nao_se_aplica' })}>Não se aplica</button>
                            )}
                          </div>
                        )}
                        {pode && i.marca && (
                          <div className="mt-1"><button type="button" className="btn btn-sm btn-link p-0" onClick={() => desfazer(i)}>Desfazer</button></div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          <p className="small text-secondary mb-0">Os modelos e o roteiro são pontos de partida baseados na Lei 14.133/2021. Revise com o setor jurídico e adapte ao regulamento do órgão.</p>
        </>
      )}

      {marcando && (
        <FormModal
          title={marcando.situacao === 'juntado' ? `Registrar juntada: ${marcando.item.nome}` : `Não se aplica: ${marcando.item.nome}`}
          submitLabel="Registrar" size="md" onClose={() => setMarcando(null)}
          fields={[marcando.situacao === 'juntado'
            ? { name: 'referencia', label: 'Onde o documento está', type: 'text', required: true, col: 12, help: 'Número do documento, folhas do processo ou link (ex.: SEI 0012345, fls. 30 a 42, PNCP nº 12/2026).' }
            : { name: 'referencia', label: 'Por que não se aplica', type: 'textarea', required: true, col: 12, help: 'A justificativa fica registrada no histórico do processo.' }]}
          onSubmit={async ({ referencia }) => {
            try {
              await marcarItem(processo.id, marcando.item.chave, marcando.situacao, referencia)
              showSuccess('Registrado no roteiro do processo.')
            } catch (err) { throw new Error(mensagemErroSolicitacao(err)) }
          }} />
      )}
    </Card>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Pill, SeiRef } from './ui'
import FormModal from './FormModal'
import DocumentoModal from './DocumentoModal'
import { useGcActions } from './useGcActions'
import { SIGLA_ORDEM, STATUS_OS, TIPO_ORDEM } from '../../utils/contrato'
import { minutaOrdem, orientacaoNotaFiscalTexto } from '../../utils/documentos'
import { brl, fmtDate, hojeISO } from '../../utils/format'
import { useAuth } from '../../context/AuthContext'
import { showConfirm, showError, showSuccess } from '../../utils/alerts'

const sigla = (os) => SIGLA_ORDEM[os.tipo] || 'OS'

// Requisitos conferidos pela Gestão ao preparar a OS/OC (pré-preenchidos pelo sistema)
function itensConferencia(k) {
  const c = k.c
  return [
    ['cadastro', 'Contratação recebida pela Gestão', !!c.validado_gestao],
    ['fiscalizacao', 'Fiscalização formalizada (portaria publicada e termo de ciência)', !!k.formalizada],
    ['vigencia', 'Vigência compatível com o início da execução', k.diasVigencia === null || k.diasVigencia >= 0],
    ['garantia', 'Garantia apresentada (quando exigida)', !c.exige_garantia || !!c.garantia_vencimento],
    ['empenho', 'Empenho disponível', k.empenhos.some((e) => e.saldoDisponivel > 0) || !!c.empenho_referencia],
  ]
}

// rows: [{ k, os }]
export default function OSTable({ rows, mostrarContrato = true, vazio }) {
  const { salvar, cancelar, can, params } = useGcActions()
  const [modal, setModal] = useState(null) // { modo, k, os }
  const [doc, setDoc] = useState(null)
  const gestor = can('os.emitir')

  if (!rows.length) return <Empty>{vazio || 'Nenhuma OS/OC.'}</Empty>

  const mudar = async (os, status, extra = {}) => {
    try {
      await salvar('ordens', { status, ...extra }, os.id)
    } catch (err) {
      showError(err.message)
    }
  }

  async function enviarParaAssinatura(k, os) {
    if (!k.formalizada) {
      return showError('A OS/OC só segue para assinatura com a fiscalização formalizada: portaria publicada e termo de ciência registrado.')
    }
    if (!os.numero_os || !os.objeto_autorizado) return showError('Preencha o rascunho (nº e serviço autorizado) antes de enviar.')
    if (await showConfirm('Enviar para assinatura', `Encaminhar a ${sigla(os)} para assinatura do Presidente e do Diretor Financeiro?`)) {
      await mudar(os, 'aguardando_assinatura')
    }
  }
  async function concluir(os) {
    if (await showConfirm(`Concluir ${sigla(os)}`, `Confirmar a conclusão desta ${TIPO_ORDEM[os.tipo] || 'Ordem de Serviço'}?`)) {
      await mudar(os, 'concluida')
    }
  }

  const fechar = () => setModal(null)
  const { modo, k: mk, os: mo } = modal || {}

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 gc-table">
          <thead>
            <tr>
              <th>OS / OC</th>
              {mostrarContrato && <th>Contratação</th>}
              <th>Situação</th>
              <th>Datas</th>
              <th className="d-none d-xxl-table-cell">SEI</th>
              <th className="text-end">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ k, os }) => {
              const st = STATUS_OS[os.status] || STATUS_OS.solicitada
              const podeCancelar = gestor ? !['concluida', 'cancelada'].includes(os.status) : os.status === 'solicitada' && can('os.solicitar')
              return (
                <tr key={os.id}>
                  <td className="text-nowrap">
                    <div className="fw-semibold">
                      <span className="rotulo me-1">{sigla(os)}</span>
                      {os.numero_os ? <span className="gc-num">{os.numero_os}</span> : <span className="text-secondary fw-normal small">sem número</span>}
                    </div>
                    {os.valor != null && <div className="small text-secondary num">{brl(os.valor)}</div>}
                  </td>
                  {mostrarContrato && (
                    <td>
                      <Link to={`/contratos/${k.id}?aba=os`} className="gc-num fw-semibold text-decoration-none">{k.c.numero}</Link>
                      <div className="small text-secondary text-truncate" style={{ maxWidth: 220 }}>{k.c.contratada}</div>
                    </td>
                  )}
                  <td>
                    <Pill kind={st.kind}>{st.label}</Pill>
                    {os.status === 'aguardando_assinatura' && (
                      <div className="small text-secondary mt-1">
                        Presidente {os.assinatura_presidente_em ? '✓' : '—'} · Dir. Financeiro {os.assinatura_diretor_em ? '✓' : '—'}
                      </div>
                    )}
                  </td>
                  <td className="small text-nowrap">
                    <div>Solicitada {fmtDate(os.data_solicitacao)}{os.solicitante_nome && <span className="text-secondary"> · {os.solicitante_nome}</span>}</div>
                    {os.periodo_inicio && <div className="text-secondary">Execução {fmtDate(os.periodo_inicio)} a {fmtDate(os.periodo_fim)}</div>}
                    {!os.periodo_inicio && os.data_efetiva_inicio && <div className="text-secondary">Início {fmtDate(os.data_efetiva_inicio)}</div>}
                  </td>
                  <td className="d-none d-xxl-table-cell"><SeiRef processo={os.sei_processo} documento={os.sei_documento || os.sei_documento_solic} link={os.sei_link} /></td>
                  <td className="text-end text-nowrap">
                    {(gestor || can('os.assinar')) && os.status !== 'solicitada' && (
                      <button className="btn btn-sm btn-outline-secondary me-1" title="Gerar documento" aria-label="Gerar documento" onClick={() => setDoc(minutaOrdem(k, os, params))}>
                        <i className="bi bi-file-earmark-text" />
                      </button>
                    )}
                    {gestor && ['solicitada', 'em_conferencia'].includes(os.status) && (
                      <button className={`btn btn-sm ${os.status === 'solicitada' ? 'btn-primary' : 'btn-outline-primary'} me-1`} onClick={() => setModal({ modo: 'preparar', k, os })}>
                        {os.status === 'solicitada' ? 'Preparar' : 'Editar rascunho'}
                      </button>
                    )}
                    {gestor && os.status === 'em_conferencia' && (
                      <button className="btn btn-sm btn-success me-1" onClick={() => enviarParaAssinatura(k, os)}
                        title={k.formalizada ? undefined : 'Aguardando a fiscalização formalizada'}>
                        Enviar para assinatura
                      </button>
                    )}
                    {can('os.assinar') && os.status === 'aguardando_assinatura' && (
                      <button className="btn btn-sm btn-success me-1" onClick={() => setModal({ modo: 'assinar', k, os })}>
                        Registrar assinaturas
                      </button>
                    )}
                    {gestor && os.status === 'emitida' && (
                      <button className="btn btn-sm btn-primary me-1" onClick={() => setModal({ modo: 'enviar', k, os })}>
                        Registrar envio à contratada
                      </button>
                    )}
                    {gestor && os.status === 'aguardando_ciencia' && (
                      <button className="btn btn-sm btn-success me-1" onClick={() => setModal({ modo: 'recebimento', k, os })}>
                        Registrar recebimento
                      </button>
                    )}
                    {gestor && os.status === 'vigente' && (
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => concluir(os)}>Concluir</button>
                    )}
                    {os.status === 'solicitada' && can('os.solicitar') && !gestor && (
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ modo: 'solicitar', k, os })}>Editar</button>
                    )}
                    {/* Compras só cancela enquanto a Gestão não assumiu (regra também do banco) */}
                    {podeCancelar && (
                      <button className="btn btn-sm btn-outline-danger" title="Cancelar"
                        onClick={() => cancelar('ordens', os.id, { status: 'cancelada' }, 'A ordem permanece no histórico como cancelada.')}>
                        <i className="bi bi-x-circle" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modo === 'solicitar' && <OSSolicitar k={mk} os={mo} onClose={fechar} />}
      {modo === 'preparar' && <OSPreparar k={mk} os={mo} onClose={fechar} />}
      {modo === 'assinar' && <OSAssinaturas os={mo} onClose={fechar} />}
      {modo === 'enviar' && <OSEnvio k={mk} os={mo} onClose={fechar} />}
      {modo === 'recebimento' && <OSRecebimento os={mo} onClose={fechar} />}
      {doc && <DocumentoModal doc={doc} onClose={() => setDoc(null)} />}
    </>
  )
}

/* ---------- Solicitação (Compras ou Gestão) ---------- */
export function OSSolicitar({ k, os, onClose }) {
  const { salvar, nome } = useGcActions()
  const { user } = useAuth()
  return (
    <FormModal
      title={os ? 'Editar solicitação' : `Solicitar OS/OC — ${k.c.numero}`}
      fields={[
        {
          name: 'tipo', label: 'Tipo', type: 'select', col: 4, required: true,
          options: Object.entries(TIPO_ORDEM).map(([value, label]) => ({ value, label })),
        },
        { name: 'data_solicitacao', label: 'Data da solicitação', type: 'date', col: 4, required: true },
        { name: 'sei_processo', label: 'Processo SEI', col: 4 },
        { name: 'sei_documento_solic', label: 'Documento SEI da solicitação', col: 6 },
        { name: 'observacoes', label: 'Observações', type: 'textarea', col: 12 },
      ]}
      initial={os || { tipo: k.c.instrumento === 'nota_empenho' ? 'oc' : 'os', data_solicitacao: hojeISO(), sei_processo: k.c.sei_processo }}
      submitLabel={os ? 'Salvar' : 'Solicitar'}
      onSubmit={(v) => salvar('ordens', os ? v : {
        ...v, contrato_id: k.id, status: 'solicitada',
        solicitante_id: user?.id, solicitante_nome: nome,
      }, os?.id)}
      onClose={onClose}
    >
      <div className="alert alert-info small">
        A solicitação segue para a Gestão, que prepara a ordem e a encaminha para assinatura depois de formalizada a fiscalização.
      </div>
    </FormModal>
  )
}

/* ---------- Rascunho (Gestão): conferência + dados específicos ---------- */
function OSPreparar({ k, os, onClose }) {
  const { salvar, params } = useGcActions()
  const itens = itensConferencia(k)
  const salvo = os.conferencia?.itens || {}
  const nomeOrdem = TIPO_ORDEM[os.tipo] || TIPO_ORDEM.os
  return (
    <FormModal
      title={`${nomeOrdem} — rascunho · ${k.c.numero}`}
      size="xl"
      fields={[
        { type: 'section', label: 'Conferência de requisitos' },
        ...itens.map(([chave, label, auto]) => ({
          name: `chk_${chave}`, label, type: 'checkbox', col: 12,
          help: auto ? 'Verificado automaticamente.' : 'Não identificado — confirme antes de seguir.',
        })),
        { type: 'section', label: `Dados da ${nomeOrdem}`, help: 'Contratada, CNPJ, endereço, empenho, gestão, fiscais e portaria vêm da contratação.' },
        { name: 'numero_os', label: `Nº da ${sigla(os)}`, col: 3, required: true },
        { name: 'data_emissao', label: 'Data', type: 'date', col: 3 },
        { name: 'valor', label: 'Valor específico (R$)', type: 'money', col: 3 },
        { name: 'data_prevista_inicio', label: 'Data de início', type: 'date', col: 3 },
        { name: 'objeto_autorizado', label: 'Serviço/fornecimento autorizado', type: 'textarea', col: 12, required: true },
        { name: 'periodo_inicio', label: 'Período — início', type: 'date', col: 3 },
        { name: 'periodo_fim', label: 'Período — fim', type: 'date', col: 3 },
        { name: 'local_execucao', label: 'Local', col: 6 },
        { name: 'preposto_nome', label: 'Representante/preposto', col: 6 },
        { name: 'observacoes', label: 'Observações', type: 'textarea', col: 12 },
      ]}
      initial={{
        ...Object.fromEntries(itens.map(([c, , auto]) => [`chk_${c}`, salvo[c] ?? auto])),
        data_emissao: hojeISO(),
        objeto_autorizado: k.c.objeto,
        periodo_inicio: k.c.vigencia_inicio,
        periodo_fim: k.vigenciaFim,
        preposto_nome: k.c.contratada_representante,
        ...os,
      }}
      submitLabel="Salvar rascunho"
      onSubmit={(v) => {
        const checks = Object.fromEntries(itens.map(([c]) => [c, !!v[`chk_${c}`]]))
        const dados = Object.fromEntries(Object.entries(v).filter(([n]) => !n.startsWith('chk_')))
        return salvar('ordens', {
          ...dados,
          gestor_nome: k.nomeGestor,
          fiscal_nome: k.fiscalTitular?.nome || k.nomeFiscal,
          status: 'em_conferencia',
          conferencia: { itens: checks, em: new Date().toISOString() },
        }, os.id)
      }}
      onClose={onClose}
    >
      <div className="alert alert-light border small">
        <strong>Notas fiscais:</strong> {orientacaoNotaFiscalTexto(k, params)}
        {!k.formalizada && <div className="text-danger mt-1">A assinatura só será liberada após a fiscalização formalizada.</div>}
      </div>
    </FormModal>
  )
}

/* ---------- Assinaturas (Gabinete ou Gestão) ---------- */
export function OSAssinaturas({ os, onClose }) {
  const { executar } = useGcActions()
  return (
    <FormModal
      title={`Assinaturas — ${TIPO_ORDEM[os.tipo] || 'Ordem de Serviço'} ${os.numero_os || ''}`}
      size="md"
      fields={[
        { name: 'presidente', label: 'Assinatura do Presidente', type: 'date', col: 6 },
        { name: 'diretor', label: 'Assinatura do Diretor Financeiro', type: 'date', col: 6 },
        { name: 'sei', label: 'Nº do documento SEI', col: 6 },
        { name: 'link', label: 'Link SEI', col: 6 },
      ]}
      initial={{ presidente: os.assinatura_presidente_em, diretor: os.assinatura_diretor_em, sei: os.sei_documento, link: os.sei_link }}
      submitLabel="Registrar"
      onSubmit={async (v) => {
        if (!v.presidente && !v.diretor) throw new Error('Informe ao menos uma assinatura.')
        await executar('gc_registrar_assinatura_os', { p_os: os.id, p_presidente: v.presidente, p_diretor: v.diretor, p_sei: v.sei, p_link: v.link })
        showSuccess(v.presidente && v.diretor ? 'Ordem assinada' : 'Assinatura registrada')
      }}
      onClose={onClose}
    />
  )
}

/* ---------- Envio à contratada (§10): a empresa não assina ---------- */
function OSEnvio({ k, os, onClose }) {
  const { salvar } = useGcActions()
  return (
    <FormModal
      title={`Envio à contratada — ${sigla(os)} ${os.numero_os || ''}`}
      size="md"
      fields={[
        { name: 'envio_data', label: 'Data do envio', type: 'date', col: 6, required: true },
        { name: 'envio_meio', label: 'Meio utilizado', col: 6, required: true, placeholder: 'E-mail, SEI, entrega em mãos…' },
        { name: 'preposto_nome', label: 'Preposto destinatário', col: 12 },
      ]}
      initial={{ envio_data: hojeISO(), envio_meio: k.c.contratada_email ? `e-mail (${k.c.contratada_email})` : '', preposto_nome: os.preposto_nome || k.c.contratada_representante }}
      submitLabel="Registrar envio"
      onSubmit={(v) => salvar('ordens', { ...v, status: 'aguardando_ciencia' }, os.id)}
      onClose={onClose}
    />
  )
}

/* ---------- Recebimento pela contratada → em execução ---------- */
function OSRecebimento({ os, onClose }) {
  const { salvar } = useGcActions()
  return (
    <FormModal
      title="Recebimento pela contratada e início da execução"
      size="md"
      fields={[
        { name: 'data_ciencia', label: 'Data do recebimento', type: 'date', col: 6, required: true },
        { name: 'data_efetiva_inicio', label: 'Início da execução', type: 'date', col: 6, required: true },
        { name: 'envio_comprovante', label: 'Comprovação do recebimento', col: 12, placeholder: 'Resposta por e-mail, nº SEI, protocolo…' },
      ]}
      initial={{ data_ciencia: hojeISO(), data_efetiva_inicio: os.data_prevista_inicio || hojeISO(), envio_comprovante: os.envio_comprovante }}
      submitLabel="Registrar e iniciar execução"
      onSubmit={(v) => salvar('ordens', { ...v, status: 'vigente' }, os.id)}
      onClose={onClose}
    />
  )
}

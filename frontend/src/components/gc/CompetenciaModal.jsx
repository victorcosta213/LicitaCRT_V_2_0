import { useState } from 'react'
import FormModal from './FormModal'
import DocumentoModal from './DocumentoModal'
import { useGcActions } from './useGcActions'
import { OCORRENCIA_ABERTA, TIPO_OCORRENCIA, conferenciaGestao, fiscalPodeOperar } from '../../utils/contrato'
import { minutaAtesto } from '../../utils/documentos'
import { brl, fmtCompetencia, fmtDate, hojeISO, num } from '../../utils/format'
import { pedirTexto, showError, showSuccess } from '../../utils/alerts'

// Formulário único da competência. O fiscal registra NF, fiscalização, ocorrência,
// glosa, documentação e atesto; a Gestão confere, devolve ou libera ao Financeiro.
export default function CompetenciaModal({ k, comp, onClose }) {
  const { salvar, can, role, nome, user, params } = useGcActions()
  const [doc, setDoc] = useState(null)

  const admin = role === 'admin'
  const souFiscal = can('competencia.fiscal')
  const podeFiscal = admin || (souFiscal && fiscalPodeOperar(k, user?.id))
  const podeGestao = can('competencia.liberar')
  const ro = (permitido) => !permitido

  const ocorrencias = k.b.ocorrencias.filter((o) => o.competencia_id === comp.id && !o.cancelado)
  const abertas = ocorrencias.filter((o) => OCORRENCIA_ABERTA.includes(o.status)).length
  const sn = { type: 'sn', col: 4 }

  const fields = [
    { type: 'section', label: '1 · Nota fiscal', help: 'Enviada pela contratada ao fiscal titular, com cópia para a Gestão.' },
    { name: 'nf_recebida', label: 'NF recebida', type: 'checkbox', col: 3, readOnly: ro(podeFiscal) },
    { name: 'nf_recebimento_data', label: 'Data de recebimento', type: 'date', col: 3, readOnly: ro(podeFiscal) },
    { name: 'nf_numero', label: 'Nº da NF', col: 2, readOnly: ro(podeFiscal) },
    { name: 'nf_data', label: 'Emissão', type: 'date', col: 2, readOnly: ro(podeFiscal) },
    { name: 'nf_valor_bruto', label: 'Valor bruto (R$)', type: 'money', col: 2, readOnly: ro(podeFiscal) },

    { type: 'section', label: '2 · Fiscalização da execução' },
    { name: 'execucao_realizada', label: 'Execução realizada?', ...sn, readOnly: ro(podeFiscal) },
    { name: 'conforme_contrato', label: 'Conforme contrato/TR/OS?', ...sn, readOnly: ro(podeFiscal) },
    {
      name: 'quantidade_adequada', label: 'Quantidade adequada?', type: 'select', col: 4, readOnly: ro(podeFiscal),
      options: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }, { value: 'na', label: 'Não se aplica' }],
    },
    { name: 'qualidade_adequada', label: 'Qualidade adequada?', ...sn, readOnly: ro(podeFiscal) },
    { name: 'prazo_cumprido', label: 'Prazo cumprido?', ...sn, readOnly: ro(podeFiscal) },
    { name: 'valor_medido', label: 'Valor medido (R$), se houver medição', type: 'money', col: 4, readOnly: ro(podeFiscal) },
    { name: 'obs_fiscal', label: 'Manifestação do fiscal', type: 'textarea', col: 12, readOnly: ro(podeFiscal) },
    { name: 'sei_relatorio', label: 'Relatório — nº SEI', col: 4, readOnly: ro(podeFiscal) },
    { name: 'sei_link_relatorio', label: 'Relatório — link SEI', col: 8, readOnly: ro(podeFiscal) },
    { name: 'relatorio_recebido', label: 'Fiscalização concluída', type: 'checkbox', col: 4, readOnly: ro(podeFiscal) },
    { name: 'relatorio_data', label: 'Data da fiscalização', type: 'date', col: 4, readOnly: ro(podeFiscal) },

    { type: 'section', label: '3 · Ocorrência', help: ocorrencias.length ? `${ocorrencias.length} ocorrência(s) vinculada(s), ${abertas} em aberto — detalhes na aba Ocorrências.` : undefined },
    { name: 'houve_ocorrencia', label: 'Houve ocorrência', type: 'checkbox', col: 12, readOnly: ro(podeFiscal || podeGestao) },
    ...(ocorrencias.length === 0 ? [
      {
        name: 'oc_tipo', label: 'Tipo', type: 'select', col: 4, show: (v) => v.houve_ocorrencia,
        readOnly: ro(podeFiscal || podeGestao),
        options: Object.entries(TIPO_OCORRENCIA).map(([value, label]) => ({ value, label })),
      },
      { name: 'oc_prazo', label: 'Prazo concedido à contratada', type: 'date', col: 4, show: (v) => v.houve_ocorrencia, readOnly: ro(podeFiscal || podeGestao) },
      { name: 'oc_descricao', label: 'Descrição da ocorrência', type: 'textarea', col: 6, show: (v) => v.houve_ocorrencia, readOnly: ro(podeFiscal || podeGestao) },
      { name: 'oc_providencia', label: 'Providência', type: 'textarea', col: 6, show: (v) => v.houve_ocorrencia, readOnly: ro(podeFiscal || podeGestao) },
    ] : []),

    { type: 'section', label: '4 · Glosa' },
    { name: 'houve_glosa', label: 'Houve glosa', type: 'checkbox', col: 3, readOnly: ro(podeFiscal) },
    { name: 'glosa_valor', label: 'Valor da glosa (R$)', type: 'money', col: 3, readOnly: ro(podeFiscal), show: (v) => v.houve_glosa },
    { name: 'glosa_motivo', label: 'Fundamento da glosa', col: 6, readOnly: ro(podeFiscal), show: (v) => v.houve_glosa },
    { name: 'glosa_obs', label: 'Observação', col: 12, readOnly: ro(podeFiscal), show: (v) => v.houve_glosa },

    { type: 'section', label: '5 · Documentação' },
    { name: 'certidoes_verificadas', label: 'Certidões verificadas', type: 'checkbox', col: 4, readOnly: ro(podeFiscal) },
    { name: 'doc_trabalhista_ok', label: 'Doc. trabalhista/previdenciária', type: 'checkbox', col: 4, readOnly: ro(podeFiscal) },
    { name: 'doc_completa', label: 'Documentos necessários conferidos', type: 'checkbox', col: 4, readOnly: ro(podeFiscal) },

    { type: 'section', label: '6 · Atesto (fiscal)', help: 'Gere o texto, insira no SEI, assine e registre aqui o nº e o link.' },
    { name: 'atestado', label: 'Atestado', type: 'checkbox', col: 3, readOnly: ro(podeFiscal) },
    { name: 'atesto_data', label: 'Data do atesto', type: 'date', col: 3, readOnly: ro(podeFiscal) },
    { name: 'sei_atesto', label: 'Atesto — nº SEI', col: 3, readOnly: ro(podeFiscal) },
    { name: 'sei_link_atesto', label: 'Atesto — link SEI', col: 3, readOnly: ro(podeFiscal) },

    { type: 'section', label: '7 · Conferência da Gestão', help: 'A Gestão não refaz a fiscalização: confere o fluxo e encaminha ao Financeiro.' },
    { name: 'liberado_financeiro', label: 'Encaminhar ao Financeiro', type: 'checkbox', col: 3, readOnly: ro(podeGestao) },
    { name: 'liberado_data', label: 'Data', type: 'date', col: 3, readOnly: ro(podeGestao) },
    { name: 'liberado_por', label: 'Responsável', col: 3, readOnly: ro(podeGestao) },
    { name: 'sei_despacho', label: 'Despacho SEI', col: 3, readOnly: ro(podeGestao) },
    { name: 'suspensa', label: 'Competência suspensa', type: 'checkbox', col: 4, readOnly: ro(podeGestao) },
    { name: 'observacoes', label: 'Observações da Gestão', type: 'textarea', col: 12, readOnly: ro(podeGestao) },
  ]

  async function onSubmit(valores) {
    const { oc_tipo: ocTipo, oc_descricao: ocDescricao, oc_providencia: ocProvidencia, oc_prazo: ocPrazo, ...v } = valores
    const base = { ...comp, ...v }

    if (v.nf_recebida && !v.nf_recebimento_data) v.nf_recebimento_data = hojeISO()
    if (v.relatorio_recebido && !v.relatorio_data) v.relatorio_data = hojeISO()
    if (base.relatorio_recebido && !base.nf_recebida) throw new Error('Registre o recebimento da NF antes de concluir a fiscalização.')

    if (v.houve_glosa) {
      if (!num(v.glosa_valor) || !v.glosa_motivo) throw new Error('Informe o valor e o fundamento da glosa.')
      const ref = num(base.nf_valor_bruto) || num(base.valor_medido)
      if (ref && num(v.glosa_valor) > ref) throw new Error('A glosa não pode ser maior que o valor da competência.')
    } else if ('houve_glosa' in v) {
      v.glosa_valor = null
      v.glosa_motivo = null
      v.glosa_obs = null
    }

    // Regras sobre o estado final (inclui desmarcar um pré-requisito já atestado)
    if (base.atestado) {
      if (!base.nf_recebida) throw new Error('Não é possível atestar sem a nota fiscal registrada.')
      if (!base.relatorio_recebido) throw new Error('Não é possível atestar sem concluir a fiscalização.')
      if (!base.doc_completa) throw new Error('Não é possível atestar sem conferir os documentos necessários.')
      if (v.atestado && !comp.atestado) v.atesto_data = v.atesto_data || hojeISO()
    }
    if (base.liberado_financeiro) {
      if (!base.atestado) throw new Error('A competência precisa estar atestada antes de ser liberada ao financeiro.')
      if (v.liberado_financeiro && !comp.liberado_financeiro) {
        if (abertas > 0) throw new Error('Há ocorrência em aberto nesta competência: trate-a antes de liberar ao financeiro.')
        v.liberado_data = v.liberado_data || hojeISO()
        v.liberado_por = v.liberado_por || nome
      }
    }
    // atesto_responsavel acompanha quem atestou (fiscal em atuação)
    if (v.atestado && !comp.atestado) v.atesto_responsavel = nome

    const novaOcorrencia = base.houve_ocorrencia && ocorrencias.length === 0 && (ocTipo || ocDescricao)
    if (novaOcorrencia && (!ocTipo || !ocDescricao)) throw new Error('Informe o tipo e a descrição da ocorrência.')

    await salvar('competencias', v, comp.id)
    if (novaOcorrencia) {
      await salvar('ocorrencias', {
        contrato_id: k.id, competencia_id: comp.id, tipo: ocTipo, descricao: ocDescricao,
        providencia: ocProvidencia || null, prazo_concedido: ocPrazo || null,
        fiscal_nome: nome, status: 'aberta', data: hojeISO(),
      })
    }
  }

  async function devolver() {
    const motivo = await pedirTexto('Devolver ao fiscal', 'Explique o que precisa ser corrigido antes do encaminhamento ao Financeiro.')
    if (!motivo) return
    try {
      await salvar('competencias', { atestado: false, devolucao_motivo: motivo, devolvido_em: new Date().toISOString() }, comp.id)
      showSuccess('Competência devolvida ao fiscal')
      onClose()
    } catch (err) {
      showError(err.message)
    }
  }

  const checklist = conferenciaGestao(comp, abertas)
  const podeGerarAtesto = comp.nf_recebida && comp.relatorio_recebido

  return (
    <>
      <FormModal
        title={`${k.c.numero} — ${fmtCompetencia(comp.competencia)}`}
        fields={fields}
        initial={{ ...comp, fiscal_nome: comp.fiscal_nome || k.fiscalEmAtuacao?.nome }}
        onSubmit={onSubmit}
        onClose={onClose}
        size="xl"
      >
        <div className="alert alert-light border small">
          <strong>{k.c.contratada}</strong> · status: <strong>{comp.status.label}</strong>
          {num(comp.valor_liquido) > 0 && <> · valor líquido: <strong>{brl(comp.valor_liquido)}</strong></>}
          {' '}· fiscal em atuação: <strong>{k.fiscalEmAtuacao?.nome || '—'}</strong>
        </div>
        {souFiscal && !podeFiscal && (
          <div className="alert alert-warning small">
            Somente consulta: {k.c.substituto_em_atuacao ? 'o substituto está em atuação' : 'o fiscal titular está em atuação'} nesta contratação.
          </div>
        )}
        {comp.devolvido_em && !comp.atestado && (
          <div className="alert alert-danger small">
            <strong>Devolvida pela Gestão</strong> em {fmtDate(comp.devolvido_em)}: {comp.devolucao_motivo}
          </div>
        )}
        {(podeGestao || comp.atestado) && (
          <div className="border rounded p-2 mb-3 small">
            <div className="fw-semibold mb-1">Conferência da Gestão</div>
            <div className="d-flex flex-wrap gap-3">
              {checklist.map(([label, ok]) => (
                <span key={label}><i className={`bi ${ok ? 'bi-check-circle-fill text-success' : 'bi-x-circle text-danger'} me-1`} />{label}</span>
              ))}
            </div>
          </div>
        )}
        <div className="d-flex flex-wrap gap-2 mb-3">
          {podeFiscal && (
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!podeGerarAtesto}
              title={podeGerarAtesto ? undefined : 'Registre a NF e conclua a fiscalização (e salve) para gerar o atesto'}
              onClick={() => setDoc(minutaAtesto(k, comp, params))}>
              <i className="bi bi-file-earmark-check me-1" />Gerar atesto
            </button>
          )}
          {podeGestao && comp.atestado && !comp.liberado_financeiro && (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={devolver}>
              <i className="bi bi-arrow-return-left me-1" />Devolver ao fiscal
            </button>
          )}
        </div>
      </FormModal>
      {doc && <DocumentoModal doc={doc} onClose={() => setDoc(null)} />}
    </>
  )
}

import { cnpjValido, soDigitos, fmtCnpj } from '../../utils/format'
import { INSTRUMENTO, SITUACAO_CONTRATO } from '../../utils/contrato'

// Cadastro da CONTRATAÇÃO (§4): Compras preenche e encaminha à Gestão.
// Portaria, fiscais e termo de ciência ficam com a Gestão (aba Cadastro → Fiscalização).
export function contratoFields(params, { gestao = false } = {}) {
  return [
    { type: 'section', label: 'Instrumento' },
    {
      name: 'instrumento', label: 'Instrumento', type: 'select', col: 3, required: true,
      options: Object.entries(INSTRUMENTO).map(([value, label]) => ({ value, label })),
    },
    { name: 'numero', label: 'Nº do instrumento', col: 3, required: true, placeholder: '014/2026' },
    { name: 'sei_processo', label: 'Nº do processo SEI', col: 3, required: true },
    { name: 'sei_link', label: 'Link do processo SEI', col: 3 },
    { name: 'objeto', label: 'Objeto', type: 'textarea', col: 12, required: true },
    {
      name: 'modalidade', label: 'Modalidade da contratação', type: 'select', col: 4,
      options: params.modalidades || [],
    },
    { name: 'numero_licitacao', label: 'Nº da licitação / contratação direta', col: 4 },
    {
      name: 'tipo_contrato', label: 'Tipo de objeto', type: 'select', col: 4,
      options: params.tipos_contrato || [],
    },
    { name: 'unidade_demandante', label: 'Unidade/setor demandante', col: 4 },
    { name: 'fundamento', label: 'Fundamento (quando necessário)', col: 4 },
    { name: 'responsavel_contratacao', label: 'Responsável em Compras', col: 4 },

    { type: 'section', label: 'Contratada' },
    { name: 'contratada', label: 'Contratada', col: 8, required: true },
    { name: 'cnpj', label: 'CNPJ', col: 4, placeholder: '00.000.000/0000-00' },
    { name: 'contratada_endereco', label: 'Endereço', col: 6 },
    { name: 'contratada_representante', label: 'Representante/preposto', col: 3 },
    { name: 'contratada_email', label: 'E-mail da contratada', type: 'email', col: 3 },

    { type: 'section', label: 'Vigência ou prazo de execução', help: 'Informe a vigência ou, na falta dela (ex.: nota de empenho), o prazo de execução.' },
    { name: 'data_assinatura', label: 'Data de assinatura/emissão', type: 'date', col: 3 },
    { name: 'vigencia_inicio', label: 'Início', type: 'date', col: 3, required: true },
    { name: 'vigencia_fim', label: 'Fim da vigência', type: 'date', col: 3 },
    { name: 'prazo_execucao_dias', label: 'Prazo de execução (dias)', type: 'number', col: 3 },
    { name: 'prorrogavel', label: 'Prorrogável', type: 'checkbox', col: 3 },
    { name: 'limite_prorrogacao', label: 'Limite de prorrogação', type: 'date', col: 3, show: (v) => v.prorrogavel },
    ...(gestao
      ? [{
          name: 'situacao', label: 'Situação', type: 'select', col: 3,
          options: Object.entries(SITUACAO_CONTRATO).map(([value, o]) => ({ value, label: o.label })),
        }, {
          name: 'execucao_anterior', label: 'Execução iniciada antes da plataforma', type: 'checkbox', col: 6,
          help: 'Para contratações que já estavam em execução: dispensa refazer portaria, termo e OS/OC aqui.',
        }]
      : []),

    { type: 'section', label: 'Valores e empenho' },
    { name: 'valor_inicial', label: 'Valor (R$)', type: 'money', col: 3, required: true,
      help: 'Alterações posteriores de valor devem ser lançadas como Evento contratual.' },
    { name: 'valor_anual_estimado', label: 'Valor anual estimado (R$)', type: 'money', col: 3 },
    { name: 'empenho_referencia', label: 'Nota de empenho (quando disponível)', col: 3,
      help: 'O Financeiro registra o empenho com valores e saldos.' },
    { name: 'forma_pagamento', label: 'Forma de pagamento', col: 3 },
    { name: 'periodicidade', label: 'Periodicidade', col: 3, placeholder: 'Mensal' },
    {
      name: 'indice_reajuste', label: 'Índice de reajuste', type: 'select', col: 3,
      options: params.indices_reajuste || [],
    },
    { name: 'data_base_reajuste', label: 'Data-base do reajuste', type: 'date', col: 3,
      help: 'Normalmente a data da proposta/orçamento.' },

    { type: 'section', label: 'Garantia' },
    { name: 'exige_garantia', label: 'Exige garantia', type: 'checkbox', col: 3 },
    { name: 'garantia_modalidade', label: 'Modalidade', col: 3, show: (v) => v.exige_garantia,
      placeholder: 'Seguro-garantia, fiança, caução…' },
    { name: 'garantia_valor', label: 'Valor (R$)', type: 'money', col: 3, show: (v) => v.exige_garantia },
    { name: 'garantia_situacao', label: 'Situação', col: 3, show: (v) => v.exige_garantia, placeholder: 'Vigente' },
    { name: 'garantia_inicio', label: 'Início', type: 'date', col: 3, show: (v) => v.exige_garantia },
    { name: 'garantia_vencimento', label: 'Vencimento', type: 'date', col: 3, show: (v) => v.exige_garantia },
  ]
}

export function validarContrato(v) {
  if (v.cnpj) {
    if (!cnpjValido(v.cnpj)) throw new Error('CNPJ inválido.')
    v.cnpj = fmtCnpj(soDigitos(v.cnpj))
  }
  if (v.vigencia_inicio && v.vigencia_fim && v.vigencia_fim < v.vigencia_inicio) {
    throw new Error('O fim da vigência não pode ser anterior ao início.')
  }
  if (!v.vigencia_fim && !v.prazo_execucao_dias) {
    throw new Error('Informe o fim da vigência ou o prazo de execução.')
  }
  if (v.exige_garantia && !v.garantia_vencimento) {
    throw new Error('Informe o vencimento da garantia.')
  }
  if (v.prorrogavel === false) v.limite_prorrogacao = null
  if (!v.exige_garantia) {
    v.garantia_modalidade = null
    v.garantia_valor = null
    v.garantia_inicio = null
    v.garantia_vencimento = null
    v.garantia_situacao = null
  }
  return v
}

// Documentos que a Lei 14.133/2021 espera em cada forma de contratação: o roteiro do processo.
// Cada item é produzido na plataforma (`modelo`) ou juntado ao processo e marcado (`nome`, sem modelo).
// `obrigatorio: false` = "se for o caso" (a lei condiciona) ou recomendado; `objetos` limita o item a
// certos tipos de objeto e `exceto` o tira deles. `quem` diz qual setor costuma produzir.
import { modeloPorCodigo } from './catalogo'

const doc = (modelo, base, o = {}) => ({ chave: modelo, modelo, base, obrigatorio: true, nota: '', ...o })
const ext = (chave, nome, base, o = {}) => ({ chave, nome, base, obrigatorio: true, nota: '', ...o })
const SE = { obrigatorio: false }

const DEMANDANTE = 'Unidade demandante'
const COMPRAS = 'Compras'
const JURIDICO = 'Jurídico'
const FINANCEIRO = 'Financeiro'
const AUTORIDADE = 'Autoridade competente'
const AGENTE = 'Agente de contratação / pregoeiro'
const GESTAO = 'Gestão de contratos'

// Particularidades por tipo de objeto, comuns a todas as formas de contratação
const DO_OBJETO = [
  ext('projeto-basico', 'Projeto básico (ou anteprojeto, na contratação integrada)', 'art. 6º, XXIV e XXV; art. 18, II',
    { objetos: ['obras-engenharia'], quem: 'Engenharia / unidade técnica', nota: 'nas obras e serviços de engenharia substitui o termo de referência' }),
  ext('licenca-ambiental', 'Licença ambiental ou manifestação do órgão ambiental', 'art. 18, §1º, XII; art. 25, §5º',
    { ...SE, objetos: ['obras-engenharia'], quem: 'Engenharia / unidade técnica', nota: 'quando a obra exigir' }),
  ext('planilha-custos', 'Planilha de custos e formação de preços da mão de obra', 'art. 6º, XVI; art. 135',
    { objetos: ['servicos-continuos-demo'], quem: COMPRAS, nota: 'base da proposta e da repactuação pela convenção coletiva' }),
  ext('avaliacao-imovel', 'Avaliação prévia do imóvel, do estado de conservação e dos custos de adaptação', 'art. 51; art. 74, §5º, I',
    { ...SE, objetos: ['locacao'], quem: 'Engenharia / unidade técnica', nota: 'obrigatória na locação de imóvel' }),
]

const PLANEJAMENTO_LICITACAO = [
  doc('dfd', 'art. 18, caput; art. 12, VII (plano de contratações anual)', { quem: DEMANDANTE }),
  doc('etp', 'art. 18, I e §§1º e 2º', { quem: `${DEMANDANTE} e ${COMPRAS}` }),
  doc('riscos', 'art. 18, X; art. 22', { quem: COMPRAS, nota: 'a matriz de riscos é obrigatória em obras e serviços de grande vulto' }),
  doc('pesquisa-precos', 'art. 18, IV; art. 23', { quem: COMPRAS }),
  doc('tr', 'art. 6º, XXIII; art. 18, II; art. 40, §1º', { quem: `${DEMANDANTE} e ${COMPRAS}`, exceto: ['obras-engenharia'] }),
  ...DO_OBJETO,
  doc('adequacao-orcamentaria', 'art. 18, caput (previsão de recursos); art. 150', { quem: FINANCEIRO }),
  doc('autorizacao', 'art. 18; art. 72, VIII (por analogia)', { ...SE, quem: AUTORIDADE, nota: 'autorização para abrir a licitação, conforme o regulamento do órgão' }),
]

const SELECAO_LICITACAO = [
  doc('portaria-agente', 'art. 8º', { quem: AUTORIDADE, nota: 'agente de contratação, pregoeiro ou comissão de contratação' }),
  doc('edital', 'art. 18, V; art. 25', { quem: COMPRAS, nota: 'com a minuta do contrato anexa (art. 18, VI)' }),
  doc('parecer-juridico', 'art. 53', { quem: JURIDICO, nota: 'controle prévio de legalidade do edital e da minuta' }),
  ext('publicacao-edital', 'Divulgação do edital no PNCP e do extrato no diário oficial', 'art. 54, caput e §1º', { quem: COMPRAS }),
  ext('impugnacoes', 'Pedidos de esclarecimento, impugnações e respostas', 'art. 164', { ...SE, quem: AGENTE, nota: 'se houver' }),
  ext('propostas-sessao', 'Propostas, lances e ata da sessão pública', 'art. 17, III a V; arts. 56 a 61', { quem: AGENTE }),
  ext('habilitacao', 'Documentos de habilitação do vencedor', 'art. 17, V; arts. 62 a 70', { quem: AGENTE }),
  ext('recursos', 'Recursos, contrarrazões e decisões', 'art. 165', { ...SE, quem: AGENTE, nota: 'se houver' }),
  doc('homologacao', 'art. 17, VII; art. 71, IV', { quem: AUTORIDADE, nota: 'adjudicação e homologação' }),
  ext('ata-registro-precos', 'Ata de registro de preços', 'arts. 82 a 84', { ...SE, quem: COMPRAS, nota: 'se a licitação for para registro de preços' }),
]

const CONTRATO = (contrato) => [
  contrato,
  ext('garantia', 'Garantia contratual', 'arts. 96 a 102', { ...SE, quem: GESTAO, nota: 'se exigida no edital' }),
  ext('publicacao-contrato', 'Divulgação do contrato no PNCP', 'art. 94', { quem: COMPRAS, nota: 'condição de eficácia do contrato' }),
  ext('designacao-fiscal', 'Designação do gestor e dos fiscais do contrato', 'art. 117', { quem: GESTAO, nota: 'portaria registrada na Gestão de Contratos' }),
  doc('termo-aditivo', 'arts. 124 e 125', { ...SE, quem: GESTAO, nota: 'se houver alteração' }),
  doc('relatorio-fiscalizacao', 'art. 117, §1º', { ...SE, quem: 'Fiscal', nota: 'durante a execução' }),
  doc('termo-recebimento', 'art. 140', { ...SE, quem: 'Fiscal', nota: 'ao receber o objeto' }),
]

const PLANEJAMENTO_DIRETA = [
  doc('dfd', 'art. 72, I', { quem: DEMANDANTE }),
  doc('etp', 'art. 72, I', { ...SE, quem: `${DEMANDANTE} e ${COMPRAS}`, nota: 'se for o caso' }),
  doc('riscos', 'art. 72, I', { ...SE, quem: COMPRAS, nota: 'se for o caso' }),
  doc('tr', 'art. 72, I', { ...SE, quem: `${DEMANDANTE} e ${COMPRAS}`, nota: 'se for o caso', exceto: ['obras-engenharia'] }),
  ...DO_OBJETO,
  doc('pesquisa-precos', 'art. 72, II; art. 23', { quem: COMPRAS, nota: 'estimativa de despesa' }),
  doc('adequacao-orcamentaria', 'art. 72, IV', { quem: FINANCEIRO }),
]

const instrucaoDireta = (especificos) => [
  ...especificos,
  ext('habilitacao-contratado', 'Comprovação de que o contratado preenche os requisitos de habilitação e qualificação mínima', 'art. 72, V', { quem: COMPRAS }),
  doc('justificativa-direta', 'art. 72, VI e VII', { quem: COMPRAS, nota: 'razão da escolha do contratado e justificativa de preço' }),
  doc('parecer-tecnico', 'art. 72, III', { ...SE, quem: 'Unidade técnica', nota: 'se for o caso' }),
  doc('parecer-juridico', 'art. 72, III; art. 53, §4º', { quem: JURIDICO, nota: 'pode ser dispensado nas hipóteses do art. 53, §5º' }),
  doc('autorizacao', 'art. 72, VIII', { quem: AUTORIDADE }),
  ext('publicacao-ato', 'Divulgação do ato que autoriza a contratação direta ou do extrato do contrato (PNCP)', 'art. 72, parágrafo único', { quem: COMPRAS }),
]

const CONTRATO_DIRETA = doc('contrato', 'art. 95', {
  ...SE, quem: COMPRAS, nota: 'obrigatório, salvo dispensa por valor (art. 75, I e II) ou entrega imediata e integral, em que pode ser substituído por nota de empenho',
})

export const ARTEFATOS = {
  pregao: {
    titulo: 'Licitação — Pregão',
    resumo: 'Para bens e serviços comuns (art. 6º, XLI; art. 29). Julgamento por menor preço ou maior desconto.',
    etapas: [
      { nome: 'Fase preparatória (planejamento)', itens: PLANEJAMENTO_LICITACAO },
      { nome: 'Seleção do fornecedor', itens: SELECAO_LICITACAO },
      { nome: 'Contrato', itens: CONTRATO(doc('contrato', 'arts. 89 a 92; art. 95', { quem: COMPRAS })) },
    ],
  },
  concorrencia: {
    titulo: 'Licitação — Concorrência',
    resumo: 'Para obras, serviços especiais e serviços comuns de engenharia, e bens e serviços especiais (art. 6º, XXXVIII; art. 29).',
    etapas: [
      { nome: 'Fase preparatória (planejamento)', itens: PLANEJAMENTO_LICITACAO },
      { nome: 'Seleção do fornecedor', itens: SELECAO_LICITACAO },
      { nome: 'Contrato', itens: CONTRATO(doc('contrato', 'arts. 89 a 92; art. 95', { quem: COMPRAS })) },
    ],
  },
  dispensa: {
    titulo: 'Contratação direta — Dispensa de licitação',
    resumo: 'Hipóteses do art. 75 (por valor, emergência, entre outras). A instrução segue o art. 72.',
    etapas: [
      { nome: 'Planejamento', itens: PLANEJAMENTO_DIRETA },
      { nome: 'Instrução da contratação direta', itens: instrucaoDireta([
        ext('aviso-dispensa', 'Aviso de dispensa eletrônica e propostas recebidas', 'art. 75, §3º',
          { ...SE, quem: COMPRAS, nota: 'nas dispensas por valor, preferencialmente, com prazo mínimo de 3 dias úteis' }),
      ]) },
      { nome: 'Contrato', itens: CONTRATO(CONTRATO_DIRETA) },
    ],
  },
  inexigibilidade: {
    titulo: 'Contratação direta — Inexigibilidade de licitação',
    resumo: 'Quando a competição é inviável (art. 74: fornecedor exclusivo, artista consagrado, notória especialização, credenciamento, imóvel).',
    etapas: [
      { nome: 'Planejamento', itens: PLANEJAMENTO_DIRETA },
      { nome: 'Instrução da contratação direta', itens: instrucaoDireta([
        ext('comprovacao-inexigibilidade', 'Comprovação da inviabilidade de competição (exclusividade, notória especialização ou credenciamento)', 'art. 74, §§1º a 3º',
          { quem: COMPRAS }),
        ext('imoveis-vagos', 'Certificação de que não há imóvel público vago e disponível que atenda', 'art. 74, §5º, II',
          { objetos: ['locacao'], quem: 'Administrativo', nota: 'na locação ou aquisição de imóvel (art. 74, V)' }),
      ]) },
      { nome: 'Contrato', itens: CONTRATO(CONTRATO_DIRETA) },
    ],
  },
  'adesao-ata': {
    titulo: 'Adesão a ata de registro de preços (carona)',
    resumo: 'Aproveita a ata de outro órgão: exige vantagem demonstrada e aceite do gerenciador e do fornecedor (art. 86, §2º).',
    etapas: [
      { nome: 'Planejamento', itens: [
        doc('dfd', 'art. 72, I', { quem: DEMANDANTE }),
        doc('etp', 'art. 18', { ...SE, quem: COMPRAS, nota: 'se for o caso' }),
        doc('pesquisa-precos', 'art. 86, §2º, II; art. 23', { quem: COMPRAS, nota: 'compatibilidade dos preços da ata com o mercado' }),
        doc('adequacao-orcamentaria', 'art. 150; art. 72, IV', { quem: FINANCEIRO }),
      ] },
      { nome: 'Adesão', itens: [
        doc('justificativa-adesao-ata', 'art. 86, §2º, I a III', { quem: COMPRAS }),
        ext('aceite-gerenciador', 'Consulta e aceite do órgão gerenciador e do fornecedor', 'art. 86, §2º, III', { quem: COMPRAS }),
        doc('parecer-juridico', 'art. 53', { quem: JURIDICO, nota: 'pode ser dispensado nas hipóteses do art. 53, §5º' }),
        doc('autorizacao', 'art. 72, VIII', { quem: AUTORIDADE }),
      ] },
      { nome: 'Contrato', itens: CONTRATO(doc('contrato', 'art. 95', { ...SE, quem: COMPRAS, nota: 'ou instrumento equivalente, conforme a ata' })) },
    ],
  },
}

const vale = (i, objeto) => (!i.objetos || (objeto && i.objetos.includes(objeto))) && !(objeto && i.exceto?.includes(objeto))

// Alertas da lei para a combinação escolhida (não impedem: orientam)
export function avisosDoRoteiro(modalidade, objeto) {
  const avisos = []
  if (modalidade === 'pregao' && objeto === 'obras-engenharia') {
    avisos.push('O pregão não se aplica a obras nem a serviços especiais de engenharia (art. 29, parágrafo único). Use a concorrência, salvo se for serviço comum de engenharia.')
  }
  if (modalidade === 'dispensa') {
    avisos.push('Na dispensa por valor (art. 75, I e II), confira os limites vigentes, atualizados todo ano por decreto (art. 182), e some as despesas da mesma natureza no exercício para não fracionar (art. 75, §1º).')
  }
  if (!objeto) avisos.push('Escolha o tipo de objeto para ver os documentos próprios dele (projeto básico em obras, planilha de custos em mão de obra exclusiva, avaliação em locação de imóvel).')
  return avisos
}

// Roteiro de uma forma de contratação, só com os itens que valem para o tipo de objeto
export function roteiro(modalidade, objeto) {
  const r = ARTEFATOS[modalidade]
  if (!r) return null
  return {
    titulo: r.titulo,
    resumo: r.resumo,
    avisos: avisosDoRoteiro(modalidade, objeto),
    etapas: r.etapas.map((e) => ({
      nome: e.nome,
      itens: e.itens.filter((i) => vale(i, objeto)).map((i) => {
        const modeloDef = i.modelo ? modeloPorCodigo(i.modelo) : null
        return { ...i, modeloDef, nome: i.nome || modeloDef?.nome || i.chave }
      }),
    })),
  }
}

const ORDEM_STATUS = { assinado: 3, aguardando_assinatura: 2, rascunho: 1 }

// Item pronto: assinado na plataforma ou juntado; o opcional também quando "não se aplica"
export const itemPronto = (i) => i.status === 'assinado' || i.status === 'juntado' || (!i.obrigatorio && i.status === 'nao_se_aplica')

// Para cada item: os documentos do processo que o atendem, a marcação feita e a situação
export function checklistDoProcesso(modalidade, documentos, { marcas = [], objeto = null } = {}) {
  const base = roteiro(modalidade, objeto)
  if (!base) return null
  const vivos = (documentos || []).filter((d) => d.status !== 'cancelado')
  const marcaDe = new Map(marcas.map((m) => [m.item, m]))
  return {
    ...base,
    etapas: base.etapas.map((e) => ({
      nome: e.nome,
      itens: e.itens.map((i) => {
        const docs = i.modelo
          ? vivos.filter((d) => d.modelo === i.modelo).sort((a, b) => ORDEM_STATUS[b.status] - ORDEM_STATUS[a.status])
          : []
        const marca = marcaDe.get(i.chave) || null
        const status = docs[0]?.status === 'assinado' ? 'assinado' : marca?.situacao || docs[0]?.status || 'nenhum'
        return { ...i, documentos: docs, marca, status }
      }),
    })),
  }
}

// Resumo do andamento: obrigatórios prontos / total de obrigatórios, e o próximo que falta
export function resumoChecklist(checklist) {
  const itens = checklist.etapas.flatMap((e) => e.itens).filter((i) => i.obrigatorio)
  const faltam = itens.filter((i) => !itemPronto(i))
  return { total: itens.length, prontos: itens.length - faltam.length, proximo: faltam[0] || null }
}

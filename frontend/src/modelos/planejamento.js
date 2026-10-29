// Planejamento da contratação (Lei 14.133/2021): DFD, ETP, mapa de riscos, pesquisa de preços, TR,
// autorização e adequação orçamentária. Textos-padrão e ajudas são ponto de partida: revise com o jurídico.
import { B, D, I, L, M, R, S, T, dinheiro, itensValidos, paragrafos } from './base'
import { TODOS } from './comuns'
import { MODALIDADES, OBJETOS, PARTICULARIDADES_ETP, PARTICULARIDADES_TR, rotuloDo } from './variantes'

export const CAT_PLAN = 'Planejamento da contratação (Lei 14.133/2021)'
const PLANEJADORES = ['compras', 'gestor', 'administrativo', 'ti', 'juridico']

const assina = (v) => [B.espaco(), B.assina(v.assinante, v.cargo_assinante)]
const ASSINANTE = [
  T('assinante', 'Responsável pela elaboração', { obrigatorio: true, padrao: (c) => c.autor?.nome || '' }),
  T('cargo_assinante', 'Cargo / função', { obrigatorio: true }),
]
const SIM_NAO = [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]

const PRIORIDADE = [{ valor: 'alta', rotulo: 'Alta' }, { valor: 'media', rotulo: 'Média' }, { valor: 'baixa', rotulo: 'Baixa' }]

// DFD: conteúdo mínimo para a formalização da demanda (Lei 14.133/2021, art. 12, VII; art. 18, caput e §1º, I, II e IV;
// art. 72, I), no padrão usado pelos regulamentos (ex.: Decreto federal 10.947/2022, art. 8º). Só o secretário cria.
export const DFD = {
  codigo: 'dfd', sigla: 'DFD', versao: 2, nome: 'Documento de Formalização da Demanda (DFD)', categoria: CAT_PLAN, perfis: ['secretario'],
  descricao: 'A secretaria formaliza o que precisa: escolhe os itens do catálogo, informa as quantidades e justifica. Assinada, segue ao Compras.',
  baseLegal: 'Lei 14.133/2021, art. 12, VII; art. 18, caput e §1º, I, II e IV; art. 72, I.',
  numerar: true, papeisSugeridos: ['Secretário(a) requisitante'],
  titulo: (v, ctx) => `DOCUMENTO DE FORMALIZAÇÃO DA DEMANDA — DFD Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'req', titulo: 'Unidade requisitante', campos: [
      T('unidade', 'Secretaria / unidade requisitante', { obrigatorio: true, padrao: (c) => c.unidade?.nome || '' }),
      T('responsavel', 'Responsável pela demanda', { obrigatorio: true, padrao: (c) => c.autor?.nome || '' }),
      T('contato', 'Telefone / e-mail para contato', {}),
      T('origem', 'Documento de origem', { padrao: (c) => c.origem || '', ajuda: 'Opcional: a secretaria pode pedir por iniciativa própria. Se veio de ofício ou despacho do Prefeito, cite aqui.' }),
    ] },
    { id: 'objeto', titulo: 'Objeto', campos: [
      L('objeto', 'Descrição sucinta do objeto', { obrigatorio: true, linhas: 2, ajuda: 'O que se quer contratar, sem indicar marca (art. 18, §1º, I e art. 40, §1º).' }),
      S('objeto_tipo', 'Tipo de objeto', OBJETOS, { obrigatorio: true, ajuda: 'Orienta o Compras na forma de contratação e nos documentos do processo.' }),
    ] },
    { id: 'itens', titulo: 'Itens, quantidades e estimativa preliminar do valor', campos: [
      I('itens', 'Itens', { obrigatorio: true, ajuda: 'Escolha os itens do catálogo: a especificação vem pronta; informe só a quantidade.' }),
      L('memoria_calculo', 'Como as quantidades foram estimadas', { obrigatorio: true, ajuda: 'Memória de cálculo: consumo histórico, número de servidores, salas atendidas etc. (art. 18, §1º, IV).' }),
    ] },
    { id: 'justificativa', titulo: 'Justificativa da necessidade', campos: [
      L('necessidade', 'Por que a contratação é necessária', { obrigatorio: true, linhas: 6, ajuda: 'O problema a resolver e o interesse público envolvido (art. 18, §1º, I).' }),
      L('resultados', 'Resultados pretendidos', { ajuda: 'Ganhos esperados para o serviço público (economia, eficiência, atendimento).' }),
    ] },
    { id: 'planejamento', titulo: 'Planejamento', campos: [
      S('previsto_pca', 'Está prevista no Plano de Contratações Anual?', [...SIM_NAO, { valor: 'nao-elaborado', rotulo: 'O órgão não elaborou plano' }], { obrigatorio: true, ajuda: 'Art. 12, VII e art. 18, §1º, II.' }),
      T('item_pca', 'Item do plano', { obrigatorio: true, mostrar: (v) => v.previsto_pca === 'sim' }),
      L('justificativa_pca', 'Por que não está no plano', { obrigatorio: true, mostrar: (v) => v.previsto_pca === 'nao' }),
      D('data_pretendida', 'Data pretendida para a entrega ou o início', { obrigatorio: true }),
      S('prioridade', 'Grau de prioridade', PRIORIDADE, { obrigatorio: true, padrao: 'media' }),
      L('justificativa_prioridade', 'Por que a prioridade é alta', { obrigatorio: true, mostrar: (v) => v.prioridade === 'alta' }),
      L('correlatas', 'Vinculação ou dependência com outra contratação', { ajuda: 'Outra DFD ou contrato do qual esta demanda depende (ou que depende dela).' }),
    ] },
    { id: 'fiscal', titulo: 'Indicação para a fiscalização', campos: [
      T('fiscal_indicado', 'Servidor(es) indicado(s) para fiscal do contrato', { ajuda: 'Sugestão da secretaria; a designação é feita depois pela Gestão de Contratos (art. 117).' }),
    ] },
    { id: 'assina', titulo: '', campos: [
      T('assinante', 'Secretário(a) requisitante', { obrigatorio: true, padrao: (c) => c.autor?.nome || '' }),
      T('cargo_assinante', 'Cargo', { obrigatorio: true, padrao: (c) => (c.unidade?.nome ? `Secretário(a) — ${c.unidade.nome}` : '') }),
    ], bloco: assina },
  ],
}

// Itens da DFD do processo, para começar ETP, pesquisa de preços e TR já preenchidos
export const itensDaDfd = (c) => itensValidos(c?.dfd?.conteudo?.itens)
const objetoDaDfd = (c) => c?.dfd?.conteudo?.objeto || c?.processo?.assunto || ''

// ETP: art. 18, §1º, I a XIII (o §2º exige ao menos os incisos I, IV, VI, VIII e XIII, ou a justificativa de omissão)
const etpCampos = {
  ident: [
    T('objeto', 'Objeto da contratação', { obrigatorio: true, padrao: objetoDaDfd }),
    S('objeto_tipo', 'Tipo de objeto', OBJETOS, { obrigatorio: true, padrao: (c) => c.processo?.contratacao_objeto || c.dfd?.conteudo?.objeto_tipo || '', ajuda: 'Escolha o tipo para aparecerem as particularidades dele no final do estudo.' }),
    T('unidade', 'Unidade requisitante', { obrigatorio: true, padrao: (c) => c.unidade?.nome || '' }),
    T('processo', 'Processo administrativo', { padrao: (c) => c.processo?.numero || '' }),
  ],
}

export const ETP = {
  codigo: 'etp', sigla: 'ETP', versao: 1, nome: 'Estudo Técnico Preliminar (ETP)', categoria: CAT_PLAN, perfis: PLANEJADORES,
  descricao: 'Caracteriza o interesse público e a melhor solução. Cobre os 13 elementos do art. 18, §1º; aparecem também as particularidades do tipo de objeto.',
  baseLegal: 'Lei 14.133/2021, art. 6º, XX; art. 18, §1º (incisos I a XIII) e §2º; art. 40 (planejamento de compras).',
  numerar: true, papeisSugeridos: ['Responsável pelo ETP', 'Chefia imediata'],
  titulo: (v, ctx) => `ESTUDO TÉCNICO PRELIMINAR — ETP Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: etpCampos.ident },
    { id: 'necessidade', titulo: 'Descrição da necessidade (art. 18, §1º, I)', campos: [
      L('necessidade', 'Necessidade da contratação', { obrigatorio: true, linhas: 6, ajuda: 'Fundamente o interesse público envolvido e o problema a resolver. É elemento mínimo (art. 18, §2º).' }),
    ] },
    { id: 'pca', titulo: 'Previsão no Plano de Contratações Anual (art. 18, §1º, II)', campos: [
      S('previsto_pca', 'Há previsão no plano anual?', [...SIM_NAO, { valor: 'nao-elaborado', rotulo: 'O órgão não elaborou plano' }], { obrigatorio: true }),
      L('alinhamento', 'Alinhamento com o planejamento', { ajuda: 'Indique o item do plano e como a contratação se alinha às metas do órgão.' }),
    ] },
    { id: 'requisitos', titulo: 'Requisitos da contratação (art. 18, §1º, III)', campos: [
      L('requisitos', 'Requisitos', { obrigatorio: true, linhas: 5, ajuda: 'Requisitos técnicos, de sustentabilidade, de garantia e de qualificação necessários à solução.' }),
    ] },
    { id: 'quantidades', titulo: 'Estimativa das quantidades (art. 18, §1º, IV)', campos: [
      R('itens', 'Quantidades estimadas', [
        { nome: 'item', rotulo: 'Item / descrição' }, { nome: 'unidade', rotulo: 'Unidade' },
        { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'numero' }, { nome: 'memoria', rotulo: 'Memória de cálculo' },
      ], { obrigatorio: true, padrao: (c) => itensDaDfd(c).map((l) => ({ item: l.nome, unidade: l.unidade, quantidade: String(l.quantidade), memoria: c.dfd?.conteudo?.memoria_calculo || '' })) }),
      L('economia_escala', 'Interdependência com outras contratações', { ajuda: 'Veja se agrupar com outra contratação gera economia de escala.' }),
    ] },
    { id: 'mercado', titulo: 'Levantamento de mercado (art. 18, §1º, V)', campos: [
      L('alternativas', 'Alternativas analisadas', { obrigatorio: true, linhas: 5, ajuda: 'Compare as soluções possíveis (comprar, alugar, desenvolver, contratar serviço).' }),
      L('escolha', 'Justificativa técnica e econômica da solução escolhida', { obrigatorio: true }),
    ] },
    { id: 'valor', titulo: 'Estimativa do valor (art. 18, §1º, VI)', campos: [
      M('valor_estimado', 'Valor total estimado', { obrigatorio: true, ajuda: 'É elemento mínimo (art. 18, §2º). Siga os parâmetros do art. 23.' }),
      L('memoria_valor', 'Parâmetros e memória de cálculo', { obrigatorio: true, ajuda: 'Cite as fontes da pesquisa de preços (painel de preços, contratações similares, mídia especializada, pesquisa com fornecedores, notas fiscais).' }),
    ] },
    { id: 'solucao', titulo: 'Descrição da solução como um todo (art. 18, §1º, VII)', campos: [
      L('solucao', 'Solução', { obrigatorio: true, linhas: 5, ajuda: 'Inclua manutenção e assistência técnica, quando houver, considerando todo o ciclo de vida.' }),
    ] },
    { id: 'parcelamento', titulo: 'Parcelamento da contratação (art. 18, §1º, VIII)', campos: [
      S('parcelar', 'A contratação será parcelada?', [{ valor: 'sim', rotulo: 'Sim, em itens ou lotes' }, { valor: 'nao', rotulo: 'Não, em contratação única' }], { obrigatorio: true }),
      L('justificativa_parcelamento', 'Justificativa', { obrigatorio: true, ajuda: 'Elemento mínimo (art. 18, §2º). Justifique tanto o parcelamento quanto a sua ausência.' }),
    ] },
    { id: 'resultados', titulo: 'Resultados pretendidos (art. 18, §1º, IX)', campos: [
      L('resultados', 'Economicidade e melhor aproveitamento de recursos', { ajuda: 'Que ganhos se esperam em economia, pessoal, materiais e tempo.' }),
    ] },
    { id: 'providencias', titulo: 'Providências prévias à contratação (art. 18, §1º, X)', campos: [
      L('providencias', 'Providências', { ajuda: 'Adaptações do ambiente e capacitação de servidores para fiscalizar e gerir o contrato.' }),
    ] },
    { id: 'correlatas', titulo: 'Contratações correlatas ou interdependentes (art. 18, §1º, XI)', campos: [
      L('correlatas', 'Contratações correlatas', {}),
    ] },
    { id: 'ambiental', titulo: 'Impactos ambientais (art. 18, §1º, XII)', campos: [
      L('impactos', 'Impactos e medidas mitigadoras', { ajuda: 'Consumo de energia, logística reversa e descarte, quando aplicável.' }),
    ] },
    { id: 'conclusao', titulo: 'Posicionamento conclusivo (art. 18, §1º, XIII)', campos: [
      S('viabilidade', 'A contratação é adequada?', [{ valor: 'viavel', rotulo: 'Sim, a contratação é viável e adequada' }, { valor: 'inviavel', rotulo: 'Não, a contratação não é viável' }], { obrigatorio: true }),
      L('conclusao', 'Justificativa da conclusão', { obrigatorio: true, ajuda: 'Elemento mínimo (art. 18, §2º).' }),
    ] },
    ...OBJETOS.map((o) => ({
      id: `part-${o.valor}`, titulo: PARTICULARIDADES_ETP[o.valor].titulo, mostrar: (v) => v.objeto_tipo === o.valor,
      campos: PARTICULARIDADES_ETP[o.valor].campos,
    })),
    { id: 'assina', titulo: '', campos: [...ASSINANTE], bloco: assina },
  ],
}

export const RISCOS = {
  codigo: 'riscos', sigla: 'MR', versao: 1, nome: 'Mapa de riscos e matriz de alocação', categoria: CAT_PLAN, perfis: PLANEJADORES,
  descricao: 'Identifica o que pode dar errado na licitação e na execução e quem responde por cada risco.',
  baseLegal: 'Lei 14.133/2021, art. 18, X (análise de riscos); art. 6º, XXVII e art. 22 (matriz de alocação de riscos); art. 72, I.',
  numerar: true, papeisSugeridos: ['Responsável pela análise', 'Chefia imediata'],
  titulo: (v, ctx) => `MAPA DE RISCOS — Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: [
      T('objeto', 'Objeto da contratação', { obrigatorio: true, padrao: objetoDaDfd }),
      T('processo', 'Processo administrativo', { padrao: (c) => c.processo?.numero || '' }),
    ] },
    { id: 'riscos', titulo: 'Riscos identificados', campos: [
      R('riscos', 'Mapa de riscos', [
        { nome: 'risco', rotulo: 'Risco' },
        { nome: 'fase', rotulo: 'Fase', tipo: 'select', opcoes: [{ valor: 'planejamento', rotulo: 'Planejamento' }, { valor: 'selecao', rotulo: 'Seleção do fornecedor' }, { valor: 'execucao', rotulo: 'Execução' }] },
        { nome: 'probabilidade', rotulo: 'Probabilidade', tipo: 'select', opcoes: PRIORIDADE },
        { nome: 'impacto', rotulo: 'Impacto', tipo: 'select', opcoes: PRIORIDADE },
        { nome: 'preventiva', rotulo: 'Medida preventiva' }, { nome: 'contingencia', rotulo: 'Medida de contingência' },
        { nome: 'responsavel', rotulo: 'Responsável' },
      ], { obrigatorio: true }),
    ] },
    { id: 'matriz', titulo: 'Matriz de alocação de riscos', campos: [
      R('matriz', 'Quem responde por cada risco', [
        { nome: 'risco', rotulo: 'Risco' },
        { nome: 'alocacao', rotulo: 'Alocado a', tipo: 'select', opcoes: [{ valor: 'contratante', rotulo: 'Contratante' }, { valor: 'contratada', rotulo: 'Contratada' }, { valor: 'compartilhado', rotulo: 'Compartilhado' }] },
        { nome: 'justificativa', rotulo: 'Justificativa' },
      ]),
      L('observacao', 'Observações', { ajuda: 'A matriz é obrigatória para obras e serviços de grande vulto e para contratação integrada ou semi-integrada (art. 22, §3º). Nos demais casos, avalie se convém.' }),
    ] },
    { id: 'assina', titulo: '', campos: [...ASSINANTE], bloco: assina },
  ],
}

// total = soma(quantidade × valor de referência)
const totalDosItens = (itens) => (itens || []).reduce((s, l) => s + (Number(l.quantidade) || 0) * (Number(l.referencia) || 0), 0)

export const PESQUISA_PRECOS = {
  codigo: 'pesquisa-precos', sigla: 'PP', versao: 1, nome: 'Pesquisa de preços e estimativa de valor', categoria: CAT_PLAN, perfis: PLANEJADORES,
  descricao: 'Registra as fontes consultadas, os preços e o valor de referência da contratação.',
  baseLegal: 'Lei 14.133/2021, art. 23 (valor estimado e parâmetros de pesquisa); art. 72, II (estimativa de despesa).',
  numerar: true, papeisSugeridos: ['Responsável pela pesquisa', 'Chefia imediata'],
  titulo: (v, ctx) => `PESQUISA DE PREÇOS — Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: [
      T('objeto', 'Objeto', { obrigatorio: true, padrao: objetoDaDfd }),
      T('processo', 'Processo administrativo', { padrao: (c) => c.processo?.numero || '' }),
      D('data_pesquisa', 'Data da pesquisa', { obrigatorio: true }),
    ] },
    { id: 'parametros', titulo: 'Parâmetros utilizados (art. 23, §1º)', campos: [
      L('parametros', 'Fontes consultadas', { obrigatorio: true, linhas: 5, padrao: 'Foram utilizados os seguintes parâmetros do art. 23, §1º, da Lei 14.133/2021: [preencher: marque os utilizados — painel de preços; contratações similares da Administração (até 1 ano); mídia especializada, tabelas oficiais ou sítios eletrônicos com data e hora de acesso; pesquisa direta com, no mínimo, 3 fornecedores; base nacional de notas fiscais eletrônicas].', ajuda: 'Indique cada fonte e junte os comprovantes ao processo. Para pesquisa direta, registre as solicitações de cotação enviadas.' }),
      S('metodo', 'Valor de referência adotado', [{ valor: 'mediana', rotulo: 'Mediana dos preços' }, { valor: 'media', rotulo: 'Média dos preços' }, { valor: 'menor', rotulo: 'Menor preço' }], { obrigatorio: true, padrao: 'mediana' }),
    ] },
    { id: 'itens', titulo: 'Preços pesquisados', campos: [
      R('itens', 'Itens', [
        { nome: 'item', rotulo: 'Item' }, { nome: 'unidade', rotulo: 'Unid.' }, { nome: 'quantidade', rotulo: 'Qtde', tipo: 'numero' },
        { nome: 'fonte1', rotulo: 'Preço 1', tipo: 'dinheiro' }, { nome: 'fonte2', rotulo: 'Preço 2', tipo: 'dinheiro' }, { nome: 'fonte3', rotulo: 'Preço 3', tipo: 'dinheiro' },
        { nome: 'referencia', rotulo: 'Valor de referência', tipo: 'dinheiro' },
      ], { obrigatorio: true, padrao: (c) => itensDaDfd(c).map((l) => ({ item: l.nome, unidade: l.unidade, quantidade: String(l.quantidade), fonte1: '', fonte2: '', fonte3: '', referencia: '' })) }),
    ], bloco: (v) => {
      const linhas = (v.itens || []).filter((l) => l.item || l.referencia)
      if (!linhas.length) return [B.p('[preencher: itens pesquisados]')]
      return [
        B.tabela(['Item', 'Unid.', 'Qtde', 'Preço 1', 'Preço 2', 'Preço 3', 'Valor de referência', 'Total'],
          linhas.map((l) => [l.item, l.unidade, l.quantidade, dinheiro(l.fonte1), dinheiro(l.fonte2), dinheiro(l.fonte3), dinheiro(l.referencia),
            dinheiro((Number(l.quantidade) || 0) * (Number(l.referencia) || 0))])),
        B.campo('Valor total estimado', dinheiro(totalDosItens(linhas))),
      ]
    } },
    { id: 'analise', titulo: 'Análise crítica', campos: [
      L('analise', 'Análise dos preços', { obrigatorio: true, ajuda: 'Explique a escolha do valor de referência e justifique preços descartados por inexequíveis ou excessivamente elevados.' }),
    ] },
    { id: 'assina', titulo: '', campos: [...ASSINANTE], bloco: assina },
  ],
}

export const TR = {
  codigo: 'tr', sigla: 'TR', versao: 1, nome: 'Termo de Referência (TR)', categoria: CAT_PLAN, perfis: PLANEJADORES,
  descricao: 'Define o que será contratado e como. Cobre os parâmetros do art. 6º, XXIII (alíneas a a j) e as particularidades do tipo de objeto.',
  baseLegal: 'Lei 14.133/2021, art. 6º, XXIII (alíneas a a j); art. 18, §1º; art. 25; art. 40.',
  numerar: true, papeisSugeridos: ['Elaborador do TR', 'Autoridade requisitante'],
  titulo: (v, ctx) => `TERMO DE REFERÊNCIA — TR Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: [
      T('objeto', 'Objeto', { obrigatorio: true, padrao: objetoDaDfd }),
      S('objeto_tipo', 'Tipo de objeto', OBJETOS, { obrigatorio: true, padrao: (c) => c.processo?.contratacao_objeto || c.dfd?.conteudo?.objeto_tipo || '' }),
      S('modalidade', 'Forma de contratação', MODALIDADES, { obrigatorio: true, padrao: (c) => c.processo?.contratacao_modalidade || '' }),
      T('processo', 'Processo administrativo', { padrao: (c) => c.processo?.numero || '' }),
    ] },
    { id: 'objeto', titulo: 'Definição do objeto (art. 6º, XXIII, a)', campos: [
      L('descricao', 'Descrição do objeto', { obrigatorio: true, linhas: 5, ajuda: 'Natureza do objeto e especificações, sem indicar marca.' }),
      R('itens', 'Itens e quantitativos', [{ nome: 'item', rotulo: 'Item' }, { nome: 'descricao', rotulo: 'Descrição' }, { nome: 'unidade', rotulo: 'Unid.' }, { nome: 'quantidade', rotulo: 'Qtde', tipo: 'numero' }], { obrigatorio: true, padrao: (c) => itensDaDfd(c).map((l) => ({ item: l.nome, descricao: l.especificacao, unidade: l.unidade, quantidade: String(l.quantidade) })) }),
      T('prazo_contrato', 'Prazo do contrato', { obrigatorio: true, ajuda: 'Ex.: 12 meses. Serviços e fornecimentos contínuos admitem até 5 anos (art. 106) e prorrogação até 10 anos (art. 107).' }),
      S('prorrogacao', 'Prevê prorrogação?', SIM_NAO, { obrigatorio: true }),
    ] },
    { id: 'fundamentacao', titulo: 'Fundamentação da contratação (art. 6º, XXIII, b)', campos: [
      L('fundamentacao', 'Fundamentação', { obrigatorio: true, padrao: 'A contratação fundamenta-se no Estudo Técnico Preliminar nº [preencher: número do ETP], que caracteriza o interesse público envolvido e a melhor solução, nos termos do art. 18, §1º, da Lei 14.133/2021.', ajuda: 'Faça referência ao ETP. Se ele não puder ser divulgado, cite o extrato das partes sem informação sigilosa.' }),
    ] },
    { id: 'solucao', titulo: 'Descrição da solução (art. 6º, XXIII, c)', campos: [
      L('solucao', 'Solução como um todo', { obrigatorio: true, ajuda: 'Considere todo o ciclo de vida do objeto, incluindo manutenção e descarte.' }),
    ] },
    { id: 'requisitos', titulo: 'Requisitos da contratação (art. 6º, XXIII, d)', campos: [
      L('requisitos', 'Requisitos', { obrigatorio: true, ajuda: 'Requisitos técnicos, de sustentabilidade, de garantia e de qualificação.' }),
      L('garantia_contratual', 'Garantia da contratação (opcional)', { ajuda: 'Se for exigida garantia de execução, indique a modalidade e o percentual (arts. 96 a 102). Precisa constar do edital.' }),
    ] },
    { id: 'execucao', titulo: 'Modelo de execução do objeto (art. 6º, XXIII, e)', campos: [
      L('execucao', 'Como o objeto será executado', { obrigatorio: true, linhas: 6, padrao: 'O objeto será executado conforme descrito neste Termo, nos prazos e locais indicados abaixo, e será recebido provisória e definitivamente nos termos do art. 140 da Lei 14.133/2021. [preencher: prazo de início, local e condições de execução ou entrega]', ajuda: 'Descreva como o contrato produzirá os resultados desde o início até o encerramento.' }),
    ] },
    { id: 'gestao', titulo: 'Modelo de gestão do contrato (art. 6º, XXIII, f)', campos: [
      L('gestao', 'Gestão e fiscalização', { obrigatorio: true, linhas: 5, padrao: 'A execução do contrato será acompanhada e fiscalizada por fiscal designado, e pelo respectivo substituto, que registrará em registro próprio as ocorrências e determinará as providências para regularizar faltas e defeitos, nos termos do art. 117 da Lei 14.133/2021. As situações que ultrapassem a sua competência serão informadas aos superiores em tempo hábil.', ajuda: 'Como a execução será acompanhada: reuniões, relatórios, registro de ocorrências.' }),
    ] },
    { id: 'pagamento', titulo: 'Critérios de medição e de pagamento (art. 6º, XXIII, g)', campos: [
      L('pagamento', 'Medição e pagamento', { obrigatorio: true, linhas: 5, padrao: 'O pagamento será efetuado após o recebimento do objeto e a liquidação da despesa, mediante apresentação de nota fiscal atestada pelo fiscal, em [preencher: prazo em dias] contados do atesto, observada a ordem cronológica de exigibilidade (art. 141). [preencher: critérios de medição]' }),
    ] },
    { id: 'selecao', titulo: 'Forma e critérios de seleção do fornecedor (art. 6º, XXIII, h)', campos: [
      S('criterio', 'Critério de julgamento (art. 33)', [
        { valor: 'menor-preco', rotulo: 'Menor preço' }, { valor: 'maior-desconto', rotulo: 'Maior desconto' }, { valor: 'tecnica-preco', rotulo: 'Técnica e preço' },
        { valor: 'melhor-tecnica', rotulo: 'Melhor técnica ou conteúdo artístico' }, { valor: 'na', rotulo: 'Não se aplica (contratação direta)' },
      ], { obrigatorio: true }),
      T('regime', 'Regime de execução ou forma de fornecimento', { ajuda: 'Ex.: empreitada por preço global, fornecimento parcelado.' }),
      L('habilitacao', 'Exigências de habilitação', { obrigatorio: true, padrao: 'Habilitação jurídica, fiscal, social e trabalhista, econômico-financeira e técnica, nos termos dos arts. 62 a 70 da Lei 14.133/2021. [preencher: documentos exigidos, indicando as parcelas de maior relevância técnica quando houver qualificação técnica]' }),
    ] },
    { id: 'valor', titulo: 'Estimativa do valor da contratação (art. 6º, XXIII, i)', campos: [
      M('valor', 'Valor total estimado', { obrigatorio: true }),
      L('memoria', 'Memória de cálculo e parâmetros', { obrigatorio: true, padrao: 'A estimativa foi elaborada conforme o art. 23 da Lei 14.133/2021, com base na pesquisa de preços nº [preencher: número], juntada ao processo.' }),
    ] },
    { id: 'orcamento', titulo: 'Adequação orçamentária (art. 6º, XXIII, j)', campos: [
      T('dotacao', 'Dotação orçamentária', { obrigatorio: true, ajuda: 'Programa de trabalho, fonte e natureza da despesa.' }),
      L('orcamento', 'Declaração', { padrao: 'As despesas decorrentes da contratação correrão à conta dos recursos consignados na dotação acima, conforme declaração de adequação orçamentária e financeira juntada ao processo.' }),
    ] },
    { id: 'obrigacoes', titulo: 'Obrigações das partes', campos: [
      L('obrigacoes_contratante', 'Obrigações da contratante', { padrao: 'Fornecer as informações e condições necessárias à execução; acompanhar e fiscalizar o contrato; atestar e pagar as faturas nos prazos; aplicar as sanções cabíveis.' }),
      L('obrigacoes_contratada', 'Obrigações da contratada', { padrao: 'Executar o objeto conforme este Termo e a proposta; manter, durante toda a execução, as condições de habilitação; responder pelos encargos trabalhistas, previdenciários e fiscais; reparar os danos causados; comunicar imediatamente qualquer ocorrência que afete a execução.' }),
    ] },
    { id: 'sancoes', titulo: 'Infrações e sanções', campos: [
      L('sancoes', 'Sanções', { padrao: 'O descumprimento das obrigações sujeitará a contratada às sanções de advertência, multa, impedimento de licitar e contratar e declaração de inidoneidade, nos termos dos arts. 155 a 158 da Lei 14.133/2021, assegurados o contraditório e a ampla defesa. [preencher: percentual das multas]' }),
    ] },
    ...OBJETOS.map((o) => ({
      id: `part-${o.valor}`, titulo: `Particularidades: ${rotuloDo(OBJETOS, o.valor).toLowerCase()}`, mostrar: (v) => v.objeto_tipo === o.valor,
      campos: PARTICULARIDADES_TR[o.valor],
    })),
    { id: 'assina', titulo: '', campos: [...ASSINANTE], bloco: assina },
  ],
}

export const AUTORIZACAO = {
  codigo: 'autorizacao', sigla: 'AUT', versao: 1, nome: 'Autorização da autoridade competente', categoria: CAT_PLAN, perfis: ['compras', 'gestor', 'gabinete', 'administrativo'],
  descricao: 'A autoridade autoriza a contratação ou a abertura do processo. É exigida na contratação direta.',
  baseLegal: 'Lei 14.133/2021, art. 72, VIII (autorização da autoridade competente).',
  numerar: false, papeisSugeridos: ['Autoridade competente'],
  titulo: (v, ctx) => `AUTORIZAÇÃO Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [{
    id: 'aut', titulo: '',
    campos: [
      T('processo', 'Processo', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      L('objeto', 'Objeto', { obrigatorio: true }),
      S('forma', 'O que se autoriza', [
        { valor: 'abertura', rotulo: 'A abertura do processo licitatório' }, { valor: 'direta', rotulo: 'A contratação direta' },
        { valor: 'adesao', rotulo: 'A adesão à ata de registro de preços' }, { valor: 'outro', rotulo: 'Outra providência' },
      ], { obrigatorio: true }),
      M('valor', 'Valor estimado', { obrigatorio: true }),
      T('fundamento', 'Fundamento legal', { obrigatorio: true, ajuda: 'Ex.: art. 75, II, da Lei 14.133/2021.' }),
      T('dotacao', 'Dotação orçamentária', { obrigatorio: true }),
      ...ASSINANTE.map((c) => ({ ...c, rotulo: c.nome === 'assinante' ? 'Autoridade competente' : c.rotulo, padrao: undefined })),
    ],
    bloco: (v) => [
      B.p('A autoridade abaixo identificada, no uso de suas atribuições e considerando que o processo está instruído com os documentos exigidos, AUTORIZA:'),
      B.campo('Processo', v.processo), B.campo('Objeto', v.objeto),
      B.campo('Providência autorizada', { abertura: 'A abertura do processo licitatório', direta: 'A contratação direta', adesao: 'A adesão à ata de registro de preços', outro: 'Outra providência' }[v.forma] || ''),
      B.campo('Valor estimado', dinheiro(v.valor)), B.campo('Fundamento legal', v.fundamento), B.campo('Dotação orçamentária', v.dotacao),
      ...assina(v),
    ],
  }],
}

export const ADEQUACAO = {
  codigo: 'adequacao-orcamentaria', sigla: 'DAO', versao: 1, nome: 'Declaração de adequação orçamentária e financeira', categoria: CAT_PLAN, perfis: ['financeiro', 'gestor'],
  descricao: 'O Financeiro atesta que há crédito orçamentário e que a despesa cabe no orçamento.',
  baseLegal: 'Lei 14.133/2021, art. 72, IV e art. 150; Lei de Responsabilidade Fiscal (LC 101/2000), art. 16.',
  numerar: false, papeisSugeridos: ['Setor financeiro', 'Ordenador de despesa'],
  titulo: (v, ctx) => `DECLARAÇÃO DE ADEQUAÇÃO ORÇAMENTÁRIA E FINANCEIRA Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [{
    id: 'dao', titulo: '',
    campos: [
      T('processo', 'Processo', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      L('objeto', 'Objeto da despesa', { obrigatorio: true }),
      M('valor', 'Valor da despesa', { obrigatorio: true }),
      T('exercicio', 'Exercício', { obrigatorio: true, padrao: () => String(new Date().getFullYear()) }),
      T('programa', 'Programa de trabalho / ação', { obrigatorio: true }),
      T('natureza', 'Natureza da despesa', { obrigatorio: true }),
      T('fonte', 'Fonte de recursos', { obrigatorio: true }),
      M('saldo', 'Saldo disponível na dotação', { obrigatorio: true }),
      L('observacoes', 'Observações', { ajuda: 'Despesa de exercícios futuros, contratos já assumidos, restrições.' }),
      ...ASSINANTE.map((c) => ({ ...c, rotulo: c.nome === 'assinante' ? 'Responsável (ordenador de despesa ou setor financeiro)' : c.rotulo, padrao: undefined })),
    ],
    bloco: (v) => [
      B.p('Declaro, para os fins do art. 72, IV, e do art. 150 da Lei 14.133/2021, e do art. 16 da Lei Complementar 101/2000, que a despesa abaixo possui adequação orçamentária e financeira com a lei orçamentária e compatibilidade com o plano plurianual e com a lei de diretrizes orçamentárias, havendo indicação dos créditos orçamentários para o pagamento das parcelas vincendas no exercício.'),
      B.campo('Processo', v.processo), B.campo('Objeto', v.objeto), B.campo('Valor da despesa', dinheiro(v.valor)),
      B.campo('Exercício', v.exercicio), B.campo('Programa de trabalho / ação', v.programa), B.campo('Natureza da despesa', v.natureza),
      B.campo('Fonte de recursos', v.fonte), B.campo('Saldo disponível', dinheiro(v.saldo)),
      ...(v.observacoes ? [B.rotulo('Observações'), ...paragrafos(v.observacoes)] : []),
      ...assina(v),
    ],
  }],
}

export const MODELOS_PLANEJAMENTO = [DFD, ETP, RISCOS, PESQUISA_PRECOS, TR, AUTORIZACAO, ADEQUACAO]

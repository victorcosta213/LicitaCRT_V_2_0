// Seleção do fornecedor e contrato (Lei 14.133/2021): edital, parecer jurídico, contratação direta,
// adesão a ata, homologação, minuta de contrato e termo aditivo.
import { B, D, L, M, R, S, T, dinheiro, paragrafos } from './base'
import { MODALIDADES, OBJETOS } from './variantes'

export const CAT_CONTR = 'Seleção do fornecedor e contrato (Lei 14.133/2021)'

const assina = (v) => [B.espaco(), B.assina(v.assinante, v.cargo_assinante)]
const ASSINANTE = (rotulo = 'Nome de quem assina') => [
  T('assinante', rotulo, { obrigatorio: true, padrao: (c) => c.autor?.nome || '' }),
  T('cargo_assinante', 'Cargo / função', { obrigatorio: true }),
]
const FECHO = (rotulo) => ({ id: 'assina', titulo: '', campos: ASSINANTE(rotulo), bloco: assina })
const SIM_NAO = [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]
const ORDINAIS = ['PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA', 'DÉCIMA PRIMEIRA',
  'DÉCIMA SEGUNDA', 'DÉCIMA TERCEIRA', 'DÉCIMA QUARTA', 'DÉCIMA QUINTA', 'DÉCIMA SEXTA', 'DÉCIMA SÉTIMA', 'DÉCIMA OITAVA', 'DÉCIMA NONA',
  'VIGÉSIMA', 'VIGÉSIMA PRIMEIRA', 'VIGÉSIMA SEGUNDA', 'VIGÉSIMA TERCEIRA', 'VIGÉSIMA QUARTA', 'VIGÉSIMA QUINTA', 'VIGÉSIMA SEXTA']

// ---------------------------------------------------------------------------------------------
export const EDITAL = {
  codigo: 'edital', sigla: 'EDT', versao: 1, nome: 'Edital de licitação (estrutura base)', categoria: CAT_CONTR, perfis: ['compras', 'juridico', 'gestor'],
  descricao: 'Estrutura mínima de edital para pregão ou concorrência, com cláusulas-padrão a completar. Complemente com os modelos padronizados da AGU/advocacia pública.',
  baseLegal: 'Lei 14.133/2021, art. 25 (conteúdo do edital); arts. 33 (julgamento), 54 e 55 (publicidade e prazos), 62 a 70 (habilitação), 164 e 165 (impugnação e recursos), 155 a 158 (sanções).',
  numerar: true, papeisSugeridos: ['Agente de contratação', 'Autoridade competente'],
  titulo: (v, ctx) => `EDITAL Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'preambulo', titulo: 'Preâmbulo', campos: [
      S('modalidade', 'Modalidade', [MODALIDADES[0], MODALIDADES[1]], { obrigatorio: true }),
      T('licitacao_numero', 'Nº da licitação / processo', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      S('criterio', 'Critério de julgamento (art. 33)', [
        { valor: 'menor-preco', rotulo: 'Menor preço' }, { valor: 'maior-desconto', rotulo: 'Maior desconto' }, { valor: 'tecnica-preco', rotulo: 'Técnica e preço' },
      ], { obrigatorio: true }),
      S('modo', 'Modo de disputa', [{ valor: 'aberto', rotulo: 'Aberto' }, { valor: 'aberto-fechado', rotulo: 'Aberto e fechado' }, { valor: 'fechado-aberto', rotulo: 'Fechado e aberto' }], { obrigatorio: true }),
      D('data_sessao', 'Data da sessão pública', { obrigatorio: true, ajuda: 'Respeite os prazos mínimos entre a publicação do edital e a abertura (art. 55).' }),
      T('plataforma', 'Local ou plataforma da sessão', { obrigatorio: true }),
    ] },
    { id: 'objeto', titulo: 'Objeto', campos: [
      L('objeto', 'Descrição do objeto', { obrigatorio: true, padrao: 'O objeto da presente licitação é [preencher: objeto], conforme condições, quantidades e exigências estabelecidas neste Edital e em seus anexos, em especial o Termo de Referência.' }),
      M('valor_estimado', 'Valor estimado (opcional)', { ajuda: 'O orçamento pode ser mantido em sigilo até a abertura das propostas, com motivação (art. 24).' }),
    ] },
    { id: 'participacao', titulo: 'Participação na licitação', campos: [
      L('participacao', 'Quem pode participar', { padrao: 'Poderão participar da licitação os interessados do ramo pertinente ao objeto, que atenderem às exigências deste Edital. Não poderão participar as pessoas impedidas pelo art. 14 da Lei 14.133/2021. [preencher: tratamento diferenciado para ME/EPP, consórcio, subcontratação, se for o caso]' }),
    ] },
    { id: 'propostas', titulo: 'Proposta e julgamento', campos: [
      L('propostas', 'Apresentação e julgamento', { padrao: 'As propostas serão apresentadas no sistema indicado, até a data e hora da sessão, e conterão o preço e as demais informações exigidas. O julgamento observará o critério indicado no preâmbulo e as regras do art. 33 da Lei 14.133/2021, sendo desclassificadas as propostas que não atenderem ao Edital ou apresentarem preços inexequíveis ou superiores ao orçamento estimado.' }),
    ] },
    { id: 'habilitacao', titulo: 'Habilitação (arts. 62 a 70)', campos: [
      L('habilitacao', 'Documentos de habilitação', { obrigatorio: true, padrao: 'O licitante classificado em primeiro lugar apresentará a documentação relativa à: habilitação jurídica; habilitação fiscal, social e trabalhista; qualificação econômico-financeira; e qualificação técnica, nos termos dos arts. 62 a 70 da Lei 14.133/2021. [preencher: documentos exigidos em cada categoria, justificando as exigências de qualificação técnica e econômico-financeira]' }),
    ] },
    { id: 'recursos', titulo: 'Impugnação e recursos', campos: [
      L('recursos', 'Prazos', { padrao: 'Qualquer pessoa é parte legítima para impugnar este Edital, em até 3 (três) dias úteis antes da data da abertura do certame (art. 164). Caberá recurso no prazo de 3 (três) dias úteis contados da intimação ou da lavratura da ata, nas hipóteses do art. 165 da Lei 14.133/2021.' }),
    ] },
    { id: 'contrato', titulo: 'Contratação e pagamento', campos: [
      L('contrato', 'Contrato e pagamento', { padrao: 'A minuta de contrato integra este Edital como anexo. O adjudicatário será convocado para assinar o contrato no prazo de [preencher: dias úteis]. O pagamento obedecerá às condições previstas no Termo de Referência e na minuta de contrato.' }),
    ] },
    { id: 'sancoes', titulo: 'Infrações e sanções', campos: [
      L('sancoes', 'Sanções', { padrao: 'Aquele que cometer as infrações previstas no art. 155 da Lei 14.133/2021 estará sujeito às sanções do art. 156 (advertência, multa, impedimento de licitar e contratar e declaração de inidoneidade), assegurados o contraditório e a ampla defesa.' }),
    ] },
    { id: 'disposicoes', titulo: 'Disposições gerais e anexos', campos: [
      L('disposicoes', 'Disposições gerais', { padrao: 'Este Edital e seus anexos serão publicados no Portal Nacional de Contratações Públicas (PNCP) (art. 54). Os casos omissos serão resolvidos pelo agente de contratação, com apoio do órgão de assessoramento jurídico. Integram este Edital: Anexo I — Termo de Referência; Anexo II — Minuta de contrato; [preencher: demais anexos].' }),
    ] },
    FECHO('Agente de contratação / autoridade'),
  ],
}

// ---------------------------------------------------------------------------------------------
const VERIFICACAO = ['Documento de formalização da demanda (DFD)', 'Estudo técnico preliminar (ETP)', 'Análise de riscos / matriz de riscos',
  'Estimativa de despesa e pesquisa de preços (art. 23)', 'Termo de referência / projeto básico', 'Adequação orçamentária e financeira',
  'Minuta de edital e de contrato / instrumento de contratação direta', 'Justificativa da escolha do contratado e do preço (contratação direta)', 'Autorização da autoridade competente']
const SITUACOES = [{ valor: 'regular', rotulo: 'Regular' }, { valor: 'pendente', rotulo: 'Pendente' }, { valor: 'na', rotulo: 'Não se aplica' }]

export const PARECER_JURIDICO = {
  codigo: 'parecer-juridico', sigla: 'PJ', versao: 1, nome: 'Parecer jurídico (controle prévio de legalidade)', categoria: CAT_CONTR, perfis: ['juridico'],
  descricao: 'Análise jurídica do processo ao final da fase preparatória: relatório, fundamentação e conclusão.',
  baseLegal: 'Lei 14.133/2021, art. 53 (controle prévio de legalidade), §1º (linguagem simples e clara, exposição dos pressupostos de fato e de direito) e §5º (hipóteses de dispensa da análise por ato da autoridade jurídica); art. 72, III.',
  numerar: true, papeisSugeridos: ['Parecerista'],
  titulo: (v, ctx) => `PARECER JURÍDICO Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: [
      T('processo', 'Processo', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      T('consulente', 'Unidade consulente', { obrigatorio: true }),
      T('assunto', 'Assunto', { obrigatorio: true, padrao: (c) => c.processo?.assunto || '' }),
    ] },
    { id: 'relatorio', titulo: 'Relatório', campos: [
      L('relatorio', 'Resumo do processo', { obrigatorio: true, linhas: 6, ajuda: 'Resuma o que foi consultado e os documentos analisados, com a indicação das folhas ou do nº dos documentos.' }),
    ] },
    { id: 'verificacao', titulo: 'Verificação documental', campos: [
      R('verificacao', 'Documentos que instruem o processo', [
        { nome: 'documento', rotulo: 'Documento' }, { nome: 'situacao', rotulo: 'Situação', tipo: 'select', opcoes: SITUACOES }, { nome: 'observacao', rotulo: 'Observação' },
      ], { padrao: VERIFICACAO.map((documento) => ({ documento, situacao: '', observacao: '' })) }),
    ] },
    { id: 'fundamentacao', titulo: 'Fundamentação', campos: [
      L('fundamentacao', 'Análise jurídica', { obrigatorio: true, linhas: 10, ajuda: 'Exponha os pressupostos de fato e de direito, em linguagem simples, clara e objetiva, apreciando todos os elementos indispensáveis à contratação (art. 53, §1º).' }),
    ] },
    { id: 'conclusao', titulo: 'Conclusão', campos: [
      S('conclusao', 'Conclusão', [
        { valor: 'favoravel', rotulo: 'Favorável' }, { valor: 'ressalvas', rotulo: 'Favorável, com ressalvas' }, { valor: 'desfavoravel', rotulo: 'Desfavorável' },
      ], { obrigatorio: true }),
      L('recomendacoes', 'Ressalvas e recomendações', { ajuda: 'O que precisa ser corrigido ou observado antes de seguir.' }),
    ] },
    FECHO('Parecerista (nome e inscrição na OAB)'),
  ],
}

// ---------------------------------------------------------------------------------------------
const DOCS_ART72 = ['I — DFD e, se for o caso, ETP, análise de riscos e TR / projeto', 'II — Estimativa de despesa (art. 23)', 'III — Parecer jurídico e pareceres técnicos',
  'IV — Compatibilidade da previsão de recursos orçamentários', 'V — Comprovação de habilitação e qualificação mínima do contratado', 'VI — Razão da escolha do contratado',
  'VII — Justificativa de preço', 'VIII — Autorização da autoridade competente']

export const JUSTIFICATIVA_DIRETA = {
  codigo: 'justificativa-direta', sigla: 'JCD', versao: 1, nome: 'Justificativa de contratação direta (dispensa ou inexigibilidade)', categoria: CAT_CONTR, perfis: ['compras', 'gestor', 'juridico'],
  descricao: 'Reúne o enquadramento legal, a razão da escolha do contratado e a justificativa de preço, e confere os documentos do art. 72.',
  baseLegal: 'Lei 14.133/2021, art. 72 (instrução do processo de contratação direta, incisos I a VIII); art. 74 (inexigibilidade); art. 75 (dispensa); art. 73 (responsabilidade por contratação direta indevida).',
  numerar: true, papeisSugeridos: ['Responsável pela instrução', 'Autoridade competente'],
  titulo: (v, ctx) => `JUSTIFICATIVA DE CONTRATAÇÃO DIRETA Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: [
      T('processo', 'Processo', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      L('objeto', 'Objeto', { obrigatorio: true }),
      M('valor', 'Valor da contratação', { obrigatorio: true }),
    ] },
    { id: 'enquadramento', titulo: 'Enquadramento legal', campos: [
      S('tipo', 'Espécie', [{ valor: 'dispensa', rotulo: 'Dispensa de licitação (art. 75)' }, { valor: 'inexigibilidade', rotulo: 'Inexigibilidade (art. 74)' }], { obrigatorio: true }),
      S('hipotese_dispensa', 'Hipótese da dispensa', [
        { valor: 'i', rotulo: 'Art. 75, I — obras, serviços de engenharia e manutenção de veículos, até o limite legal' },
        { valor: 'ii', rotulo: 'Art. 75, II — outros serviços e compras, até o limite legal' },
        { valor: 'iii', rotulo: 'Art. 75, III — licitação deserta ou fracassada há menos de 1 ano' },
        { valor: 'viii', rotulo: 'Art. 75, VIII — emergência ou calamidade pública' },
        { valor: 'outra', rotulo: 'Outro inciso do art. 75 (informar abaixo)' },
      ], { obrigatorio: true, mostrar: (v) => v.tipo === 'dispensa' }),
      S('hipotese_inexigibilidade', 'Hipótese da inexigibilidade', [
        { valor: 'i', rotulo: 'Art. 74, I — fornecedor ou representante exclusivo' },
        { valor: 'ii', rotulo: 'Art. 74, II — profissional do setor artístico consagrado' },
        { valor: 'iii', rotulo: 'Art. 74, III — serviço técnico especializado de natureza predominantemente intelectual, com notória especialização' },
        { valor: 'iv', rotulo: 'Art. 74, IV — credenciamento' },
        { valor: 'v', rotulo: 'Art. 74, V — aquisição ou locação de imóvel cuja escolha é necessária pelas características' },
      ], { obrigatorio: true, mostrar: (v) => v.tipo === 'inexigibilidade' }),
      L('fundamentacao', 'Fundamentação do enquadramento', { obrigatorio: true, linhas: 6, ajuda: 'Explique por que o caso se encaixa na hipótese escolhida. Em dispensa por valor, informe o limite vigente (valores atualizados anualmente — art. 182) e que o fracionamento não foi usado para fugir da licitação.' }),
      L('notoria', 'Notória especialização (inexigibilidade, art. 74, III)', { mostrar: (v) => v.tipo === 'inexigibilidade' && v.hipotese_inexigibilidade === 'iii', ajuda: 'Demonstre o conceito do profissional ou da empresa pelo desempenho anterior, estudos, experiência, publicações, equipe técnica (art. 74, §3º). É vedada a subcontratação ou a atuação de profissionais diferentes dos que justificaram a inexigibilidade (§4º).' }),
      L('exclusividade', 'Comprovação de exclusividade (inexigibilidade, art. 74, I)', { mostrar: (v) => v.tipo === 'inexigibilidade' && v.hipotese_inexigibilidade === 'i', ajuda: 'Junte atestado de exclusividade e verifique que não há outro fornecedor ou representante (art. 74, §1º).' }),
      L('emergencia', 'Caracterização da urgência (art. 75, VIII)', { mostrar: (v) => v.tipo === 'dispensa' && v.hipotese_dispensa === 'viii', ajuda: 'Demonstre o risco concreto e que o contrato se limita às parcelas que podem ser concluídas em até 1 ano. É vedada a prorrogação e a recontratação da mesma empresa com base nesse inciso.' }),
      T('inciso_outro', 'Inciso do art. 75', { obrigatorio: true, mostrar: (v) => v.tipo === 'dispensa' && v.hipotese_dispensa === 'outra' }),
    ] },
    { id: 'contratado', titulo: 'Contratado e razão da escolha (art. 72, V e VI)', campos: [
      T('contratado', 'Contratado', { obrigatorio: true }),
      T('cnpj', 'CNPJ / CPF', { obrigatorio: true }),
      L('razao_escolha', 'Razão da escolha do contratado', { obrigatorio: true, ajuda: 'Por que este fornecedor? Cite a cotação mais vantajosa, a exclusividade ou a especialização.' }),
      L('habilitacao', 'Comprovação de habilitação e qualificação', { obrigatorio: true, padrao: 'O contratado apresentou os documentos de habilitação jurídica, fiscal, social e trabalhista e demais exigidos, juntados ao processo e conferidos pela unidade responsável. [preencher: documentos e data da conferência]' }),
    ] },
    { id: 'preco', titulo: 'Justificativa de preço (art. 72, II e VII)', campos: [
      L('justificativa_preco', 'Por que o preço é adequado', { obrigatorio: true, linhas: 5, ajuda: 'Compare com a pesquisa de preços (art. 23) ou, na inexigibilidade, com contratações do mesmo contratado para objetos semelhantes.' }),
    ] },
    { id: 'documentos', titulo: 'Documentos que instruem o processo (art. 72)', campos: [
      R('instrucao', 'Verificação', [{ nome: 'documento', rotulo: 'Documento' }, { nome: 'situacao', rotulo: 'Situação', tipo: 'select', opcoes: SITUACOES }, { nome: 'referencia', rotulo: 'Nº / referência' }], {
        padrao: DOCS_ART72.map((documento) => ({ documento, situacao: '', referencia: '' })),
      }),
    ] },
    FECHO('Responsável pela instrução'),
  ],
}

// ---------------------------------------------------------------------------------------------
export const JUSTIFICATIVA_ADESAO = {
  codigo: 'justificativa-adesao-ata', sigla: 'JAA', versao: 1, nome: 'Justificativa de adesão a ata de registro de preços', categoria: CAT_CONTR, perfis: ['compras', 'gestor', 'juridico'],
  descricao: 'Reúne os três requisitos para o órgão não participante aderir a uma ata de registro de preços.',
  baseLegal: 'Lei 14.133/2021, art. 86, §2º, I a III (justificativa de vantagem, compatibilidade de preços e consulta ao gerenciador e ao fornecedor) e §§3º e 4º (limites quantitativos).',
  numerar: true, papeisSugeridos: ['Responsável pela instrução', 'Autoridade competente'],
  titulo: (v, ctx) => `JUSTIFICATIVA DE ADESÃO À ATA Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ata', titulo: 'Ata de registro de preços', campos: [
      T('processo', 'Processo', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      T('ata_numero', 'Nº da ata', { obrigatorio: true }),
      T('gerenciador', 'Órgão gerenciador', { obrigatorio: true }),
      T('fornecedor', 'Fornecedor registrado', { obrigatorio: true }),
      T('vigencia_ata', 'Vigência da ata', { obrigatorio: true }),
      L('objeto', 'Objeto e itens pretendidos', { obrigatorio: true }),
      R('itens', 'Quantitativos', [{ nome: 'item', rotulo: 'Item' }, { nome: 'quantidade_ata', rotulo: 'Qtde registrada', tipo: 'numero' }, { nome: 'quantidade_pretendida', rotulo: 'Qtde pretendida', tipo: 'numero' }, { nome: 'valor', rotulo: 'Valor unitário', tipo: 'dinheiro' }], { obrigatorio: true }),
    ] },
    { id: 'vantagem', titulo: 'Vantagem da adesão (art. 86, §2º, I)', campos: [
      L('vantagem', 'Justificativa da vantagem', { obrigatorio: true, linhas: 6, ajuda: 'Explique por que aderir é mais vantajoso que licitar: economia, tempo, aderência da especificação às necessidades.' }),
    ] },
    { id: 'precos', titulo: 'Compatibilidade de preços (art. 86, §2º, II)', campos: [
      L('compatibilidade', 'Demonstração', { obrigatorio: true, linhas: 5, ajuda: 'Compare os valores da ata com os praticados no mercado (pesquisa conforme o art. 23).' }),
    ] },
    { id: 'consulta', titulo: 'Consulta e aceitação (art. 86, §2º, III)', campos: [
      L('consulta', 'Consulta ao gerenciador e ao fornecedor', { obrigatorio: true, padrao: 'Foi realizada consulta prévia ao órgão gerenciador e ao fornecedor, que aceitaram o fornecimento nas condições da ata, conforme documentos juntados ao processo. [preencher: datas e números dos ofícios e das respostas]' }),
    ] },
    { id: 'limites', titulo: 'Limites quantitativos (art. 86, §§3º e 4º)', campos: [
      L('limites', 'Verificação dos limites', { obrigatorio: true, padrao: 'As quantidades pretendidas não excedem, por órgão ou entidade, 50% dos quantitativos dos itens registrados na ata, e o total das adesões não ultrapassa o dobro do quantitativo de cada item registrado. [preencher: confirmação, com a consulta ao gerenciador sobre as adesões já feitas]' }),
    ] },
    FECHO('Responsável pela instrução'),
  ],
}

// ---------------------------------------------------------------------------------------------
export const HOMOLOGACAO = {
  codigo: 'homologacao', sigla: 'HOM', versao: 1, nome: 'Termo de adjudicação e homologação', categoria: CAT_CONTR, perfis: ['compras', 'gabinete', 'gestor'],
  descricao: 'A autoridade superior adjudica o objeto ao vencedor e homologa a licitação.',
  baseLegal: 'Lei 14.133/2021, art. 71, IV (adjudicar o objeto e homologar a licitação), após o julgamento, a habilitação e o exaurimento dos recursos.',
  numerar: false, papeisSugeridos: ['Autoridade superior'],
  titulo: (v, ctx) => `TERMO DE ADJUDICAÇÃO E HOMOLOGAÇÃO Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [{
    id: 'hom', titulo: '',
    campos: [
      T('processo', 'Processo / licitação', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      S('modalidade', 'Modalidade', [MODALIDADES[0], MODALIDADES[1]], { obrigatorio: true }),
      L('objeto', 'Objeto', { obrigatorio: true }),
      D('data_sessao', 'Data da sessão', { obrigatorio: true }),
      R('vencedores', 'Adjudicatários', [{ nome: 'item', rotulo: 'Item / lote' }, { nome: 'fornecedor', rotulo: 'Fornecedor' }, { nome: 'cnpj', rotulo: 'CNPJ' }, { nome: 'valor', rotulo: 'Valor', tipo: 'dinheiro' }], { obrigatorio: true }),
      T('parecer', 'Parecer jurídico (nº)', { ajuda: 'Se houve análise jurídica, indique o número do parecer.' }),
      L('observacoes', 'Observações', {}),
      T('assinante', 'Autoridade superior', { obrigatorio: true }),
      T('cargo_assinante', 'Cargo', { obrigatorio: true }),
    ],
    bloco: (v) => [
      B.p('Encerradas as fases de julgamento e habilitação e exauridos os recursos administrativos, a autoridade superior abaixo identificada, nos termos do art. 71, IV, da Lei 14.133/2021, resolve ADJUDICAR o objeto e HOMOLOGAR a licitação:'),
      B.campo('Processo / licitação', v.processo), B.campo('Objeto', v.objeto), B.campo('Data da sessão', v.data_sessao ? v.data_sessao.split('-').reverse().join('/') : ''),
      B.tabela(['Item / lote', 'Fornecedor', 'CNPJ', 'Valor'], (v.vencedores || []).filter((l) => l.fornecedor).map((l) => [l.item, l.fornecedor, l.cnpj, dinheiro(l.valor)])),
      v.parecer ? B.campo('Parecer jurídico', v.parecer) : null, ...(v.observacoes ? paragrafos(v.observacoes) : []), ...assina(v),
    ],
  }],
}

// ---------------------------------------------------------------------------------------------
// Minuta de contrato: uma seção por cláusula do art. 92 (as variações por objeto aparecem como cláusulas extras)
const clausula = (id, titulo, campos, extra = {}) => ({ id, titulo, campos, ...extra })
const P = (nome, rotulo, padrao, o = {}) => L(nome, rotulo, { padrao, obrigatorio: true, ...o })

export const CONTRATO = {
  codigo: 'contrato', sigla: 'CT', versao: 1, nome: 'Minuta de termo de contrato', categoria: CAT_CONTR, perfis: ['gestor', 'compras', 'juridico'],
  descricao: 'Termo de contrato com as cláusulas necessárias do art. 92 e cláusulas extras conforme o tipo de objeto. Submeta ao parecer jurídico.',
  baseLegal: 'Lei 14.133/2021, arts. 89 a 92 (cláusulas necessárias: art. 92, I a XIX); art. 94 (publicação no PNCP); arts. 105 a 107 (duração); arts. 124 e 125 (alterações); arts. 137 a 139 (extinção); art. 117 (fiscalização).',
  numerar: true,
  formatoSecao: (n, titulo) => `CLÁUSULA ${ORDINAIS[n - 1] || `${n}ª`} — ${titulo.toUpperCase()}`,
  papeisSugeridos: ['Contratante', 'Contratada'],
  titulo: (v, ctx) => `TERMO DE CONTRATO Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'partes', titulo: '', campos: [
      S('objeto_tipo', 'Tipo de objeto', OBJETOS, { obrigatorio: true, ajuda: 'Define as cláusulas extras (dedicação exclusiva de mão de obra, obras, TIC, locação).' }),
      S('origem', 'Origem da contratação', [{ valor: 'licitacao', rotulo: 'Licitação' }, { valor: 'direta', rotulo: 'Contratação direta' }, { valor: 'ata', rotulo: 'Adesão a ata de registro de preços' }], { obrigatorio: true }),
      T('processo', 'Processo (licitação ou contratação direta)', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      T('ato_autorizador', 'Ato que autorizou a contratação', { obrigatorio: true, ajuda: 'Edital, ato de dispensa ou de inexigibilidade, ata etc. (art. 89, §1º).' }),
      T('contratante', 'Contratante (órgão)', { obrigatorio: true, padrao: (c) => c.orgao || '' }),
      T('contratante_cnpj', 'CNPJ do contratante', { obrigatorio: true }),
      T('contratante_representante', 'Representante do contratante (nome e cargo)', { obrigatorio: true }),
      T('contratada', 'Contratada', { obrigatorio: true }),
      T('contratada_cnpj', 'CNPJ da contratada', { obrigatorio: true }),
      T('contratada_endereco', 'Endereço da contratada', { obrigatorio: true }),
      T('contratada_representante', 'Representante da contratada (nome e cargo)', { obrigatorio: true }),
    ], bloco: (v) => [
      B.p(`${v.contratante || '[preencher: contratante]'}, inscrito no CNPJ sob o nº ${v.contratante_cnpj || '[preencher: CNPJ]'}, neste ato representado por ${v.contratante_representante || '[preencher: representante]'}, doravante denominado CONTRATANTE, e ${v.contratada || '[preencher: contratada]'}, inscrita no CNPJ sob o nº ${v.contratada_cnpj || '[preencher: CNPJ]'}, com sede em ${v.contratada_endereco || '[preencher: endereço]'}, neste ato representada por ${v.contratada_representante || '[preencher: representante]'}, doravante denominada CONTRATADA,`),
      B.p(`resolvem celebrar o presente contrato, decorrente do ${v.ato_autorizador || '[preencher: ato autorizador]'} e do Processo nº ${v.processo || '[preencher: processo]'}, que se regerá pela Lei nº 14.133/2021, pelas cláusulas a seguir e pelas normas a que as partes se sujeitam, na forma do art. 89, §1º, da referida Lei.`),
    ] },
    clausula('objeto', 'Do objeto (art. 92, I)', [P('objeto', 'Objeto', 'O presente contrato tem por objeto [preencher: objeto e seus elementos característicos], conforme especificações do Termo de Referência e da proposta da CONTRATADA, que integram este instrumento.')]),
    clausula('vinculacao', 'Da vinculação (art. 92, II)', [P('vinculacao', 'Vinculação', 'Este contrato vincula-se ao ato que autorizou a contratação, ao Termo de Referência e à proposta da CONTRATADA, aos quais se sujeita, independentemente de transcrição.')]),
    clausula('legislacao', 'Da legislação aplicável (art. 92, III)', [P('legislacao', 'Legislação', 'Aplicam-se a este contrato a Lei nº 14.133/2021, os preceitos de direito público e, supletivamente, os princípios da teoria geral dos contratos e as disposições de direito privado (art. 89). Os casos omissos serão resolvidos à luz da legislação aplicável e dos princípios jurídicos.')]),
    clausula('regime', 'Do regime de execução ou forma de fornecimento (art. 92, IV)', [T('regime', 'Regime de execução ou forma de fornecimento', { obrigatorio: true, ajuda: 'Ex.: empreitada por preço global; fornecimento parcelado; execução indireta.' })]),
    clausula('preco', 'Do preço e do pagamento (art. 92, V e VI)', [
      M('valor', 'Valor do contrato', { obrigatorio: true }),
      P('pagamento', 'Condições de pagamento e medição', 'O pagamento será efetuado em até [preencher: dias] dias, contados do atesto da nota fiscal pelo fiscal do contrato e da liquidação da despesa, observada a ordem cronológica das exigibilidades (art. 141). Os critérios e a periodicidade da medição são: [preencher: critérios de medição].'),
      T('indice', 'Índice de reajuste', { obrigatorio: true, ajuda: 'Índice geral ou específico/setorial (art. 25, §7º). Ex.: IPCA.' }),
      T('data_base', 'Data-base do reajuste', { obrigatorio: true, ajuda: 'Vinculada à data do orçamento estimado (art. 25, §7º).' }),
      P('reajuste', 'Reajuste e atualização monetária', 'Os preços serão reajustados após o interregno mínimo de 1 (um) ano, contado da data-base, pelo índice acima, a pedido da CONTRATADA. Os valores pagos em atraso pela CONTRATANTE sofrerão atualização monetária entre a data do adimplemento e a do efetivo pagamento, pelo mesmo índice.'),
    ]),
    clausula('vigencia', 'Da vigência e da prorrogação (arts. 105 a 107)', [
      T('inicio_vigencia', 'Início da vigência', { obrigatorio: true }),
      T('prazo_vigencia', 'Prazo de vigência', { obrigatorio: true, ajuda: 'Serviços e fornecimentos contínuos: até 5 anos (art. 106); prorrogação sucessiva até 10 anos (art. 107).' }),
      P('prorrogacao', 'Prorrogação', 'O prazo poderá ser prorrogado nas hipóteses legais, desde que haja previsão no edital e a autoridade competente ateste que as condições e os preços permanecem vantajosos, permitida a negociação com a CONTRATADA (art. 107).'),
    ]),
    clausula('prazos', 'Dos prazos de execução e do recebimento (art. 92, VII)', [P('prazos', 'Prazos', 'A execução terá início em [preencher: data/prazo], devendo ser concluída em [preencher: prazo]. O objeto será recebido provisoriamente pelo fiscal e definitivamente por servidor ou comissão designada, mediante termo detalhado que comprove o atendimento das exigências contratuais (art. 140).')]),
    clausula('dotacao', 'Da dotação orçamentária (art. 92, VIII)', [
      T('credito', 'Crédito pelo qual correrá a despesa', { obrigatorio: true }),
      T('classificacao', 'Classificação funcional programática e categoria econômica', { obrigatorio: true }),
    ]),
    clausula('riscos', 'Da matriz de riscos (art. 92, IX)', [P('riscos', 'Matriz de riscos', 'Não se aplica.', { ajuda: 'Obrigatória em obras e serviços de grande vulto ou com contratação integrada/semi-integrada (art. 22, §3º). Se houver, indique o anexo.' })]),
    clausula('repactuacao', 'Da repactuação e do reequilíbrio (art. 92, X e XI)', [P('repactuacao', 'Prazos de resposta', 'A CONTRATANTE responderá aos pedidos de repactuação de preços e de restabelecimento do equilíbrio econômico-financeiro no prazo de [preencher: dias úteis], contado da apresentação da documentação completa.')]),
    clausula('garantia_execucao', 'Da garantia de execução (art. 92, XII)', [
      S('exige_garantia', 'Há garantia de execução?', SIM_NAO, { obrigatorio: true }),
      P('garantia_execucao', 'Condições da garantia', 'A CONTRATADA prestará garantia de [preencher: percentual] do valor inicial do contrato, em uma das modalidades do art. 96, §1º, no prazo de [preencher: dias] contados da assinatura. [preencher: demais condições, conforme arts. 96 a 102]', { mostrar: (v) => v.exige_garantia === 'sim' }),
    ]),
    clausula('garantia_objeto', 'Da garantia do objeto e da assistência técnica (art. 92, XIII)', [P('garantia_objeto', 'Garantia mínima e assistência', 'O objeto terá garantia mínima de [preencher: prazo], observados os prazos mínimos legais e as normas técnicas aplicáveis, com assistência técnica nas condições do Termo de Referência. Se não exigida, indicar: não se aplica.')]),
    clausula('responsabilidades', 'Dos direitos, das responsabilidades e das penalidades (art. 92, XIV)', [
      P('responsabilidades', 'Direitos e responsabilidades', 'São obrigações da CONTRATADA: executar o objeto conforme o contrato; responder pelos encargos trabalhistas, previdenciários, fiscais e comerciais; reparar os danos que causar; manter preposto. São obrigações da CONTRATANTE: fornecer as informações necessárias; fiscalizar a execução; atestar e pagar nos prazos.'),
      P('penalidades', 'Penalidades', 'A inexecução total ou parcial sujeitará a CONTRATADA às sanções dos arts. 155 e 156 da Lei 14.133/2021: advertência; multa de [preencher: percentual e base de cálculo — por atraso e por inexecução]; impedimento de licitar e contratar; declaração de inidoneidade. A defesa prévia será de 15 (quinze) dias úteis (arts. 157 e 158).'),
    ]),
    clausula('importacao', 'Das condições de importação (art. 92, XV)', [P('importacao', 'Importação', 'Não se aplica.')]),
    clausula('habilitacao', 'Da manutenção das condições de habilitação (art. 92, XVI)', [P('habilitacao', 'Habilitação', 'A CONTRATADA obriga-se a manter, durante toda a execução do contrato, em compatibilidade com as obrigações assumidas, todas as condições exigidas para a habilitação na licitação ou para a qualificação na contratação direta.')]),
    clausula('reserva_cargos', 'Da reserva de cargos (art. 92, XVII)', [P('reserva_cargos', 'Reserva de cargos', 'A CONTRATADA cumprirá as exigências de reserva de cargos previstas em lei para pessoa com deficiência, para reabilitado da Previdência Social e para aprendiz, bem como em outras normas específicas.')]),
    clausula('gestao', 'Da gestão e da fiscalização (art. 92, XVIII)', [P('gestao', 'Modelo de gestão', 'A execução será acompanhada e fiscalizada por fiscal e substituto designados (art. 117), que registrarão em registro próprio as ocorrências e determinarão as providências para a regularização das faltas ou dos defeitos, informando aos superiores as situações que ultrapassem a sua competência. [preencher: fiscais designados e demais regras do modelo de gestão do Termo de Referência]')]),
    clausula('alteracoes', 'Das alterações (arts. 124 e 125)', [P('alteracoes', 'Alterações', 'Este contrato poderá ser alterado, com as devidas justificativas, nas hipóteses do art. 124 da Lei 14.133/2021. A CONTRATADA é obrigada a aceitar, nas mesmas condições contratuais, acréscimos ou supressões de até 25% (vinte e cinco por cento) do valor inicial atualizado do contrato e, no caso de reforma de edifício ou de equipamento, acréscimos de até 50% (cinquenta por cento) (art. 125).')]),
    clausula('extincao', 'Da extinção (art. 92, XIX; arts. 137 a 139)', [P('extincao', 'Extinção', 'O contrato será extinto nos casos do art. 137 da Lei 14.133/2021, na forma dos arts. 138 e 139, assegurados o contraditório e a ampla defesa, e a CONTRATADA reconhece os direitos da CONTRATANTE nos casos de extinção por ato unilateral.')]),
    clausula('publicacao', 'Da publicação (art. 94)', [P('publicacao', 'Publicação', 'A divulgação deste contrato e de seus aditamentos no Portal Nacional de Contratações Públicas (PNCP) é condição indispensável para a sua eficácia e ocorrerá no prazo de 20 (vinte) dias úteis, contado da assinatura, em caso de licitação, ou de 10 (dez) dias úteis, em contratação direta.')]),
    clausula('dados', 'Da proteção de dados pessoais', [P('dados', 'LGPD', 'As partes observarão a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais) no tratamento de dados pessoais decorrente deste contrato.')]),
    clausula('anticorrupcao', 'Da integridade', [P('anticorrupcao', 'Integridade', 'A CONTRATADA declara conhecer e cumprir a Lei nº 12.846/2013 e se compromete a não praticar atos lesivos à administração pública.')]),

    // cláusulas extras por tipo de objeto
    clausula('extra-demo', 'Dos serviços com dedicação exclusiva de mão de obra e da repactuação', [
      P('extra_demo', 'Condições', 'Os preços serão repactuados após o interregno mínimo de 1 (um) ano, mediante demonstração analítica da variação dos custos (art. 25, §8º, II). A CONTRATANTE poderá adotar as medidas do art. 50 para assegurar o cumprimento das obrigações trabalhistas, tais como exigir garantia com cobertura para verbas rescisórias, condicionar o pagamento à comprovação da quitação trabalhista, efetuar depósito em conta vinculada e pagar diretamente verbas trabalhistas inadimplidas, deduzindo-as do pagamento devido. [preencher: medidas adotadas e planilha de custos]'),
    ], { mostrar: (v) => v.objeto_tipo === 'servicos-continuos-demo' }),
    clausula('extra-obras', 'Do recebimento da obra e da responsabilidade técnica', [
      P('extra_obras', 'Condições', 'A obra ou o serviço de engenharia será recebido provisoriamente pelo responsável por seu acompanhamento e definitivamente por servidor ou comissão designada, mediante termo detalhado (art. 140, I). A CONTRATADA responde pela solidez e segurança do trabalho pelo prazo legal (Código Civil, art. 618) e manterá responsável técnico com ART/RRT. [preencher: cronograma físico-financeiro, medições e garantias]'),
    ], { mostrar: (v) => v.objeto_tipo === 'obras-engenharia' }),
    clausula('extra-tic', 'Da segurança da informação, da propriedade intelectual e do suporte', [
      P('extra_tic', 'Condições', 'A CONTRATADA adotará controles de segurança da informação compatíveis com os requisitos do Termo de Referência, tratará os dados apenas para a execução do contrato e os devolverá ou eliminará ao final. Direitos de propriedade intelectual, licenciamento, níveis de serviço e suporte: [preencher: condições do Termo de Referência].'),
    ], { mostrar: (v) => v.objeto_tipo === 'tic' }),
    clausula('extra-locacao', 'Da locação', [
      P('extra_locacao', 'Condições', 'A locação observará a avaliação prévia do bem, do seu estado de conservação, dos custos de adaptação e do prazo de amortização dos investimentos (art. 51). Conservação, benfeitorias e devolução do bem: [preencher: condições].'),
    ], { mostrar: (v) => v.objeto_tipo === 'locacao' }),

    clausula('foro', 'Do foro', [
      T('foro', 'Foro', { obrigatorio: true, padrao: (c) => c.cidade || '' }),
      P('foro_texto', 'Texto', 'Fica eleito o foro da comarca indicada para dirimir as questões decorrentes deste contrato, que não possam ser resolvidas administrativamente, com renúncia a qualquer outro.'),
    ]),
    { id: 'assina', titulo: '', campos: [
      T('assinante', 'Representante do contratante (assina)', { obrigatorio: true }),
      T('cargo_assinante', 'Cargo', { obrigatorio: true }),
    ], bloco: (v) => [
      B.p('E, por estarem de acordo, as partes assinam este contrato eletronicamente.'), B.espaco(),
      B.assina(v.assinante, v.cargo_assinante), B.assina(v.contratada_representante, `Pela CONTRATADA — ${v.contratada || ''}`),
    ] },
  ],
}

// ---------------------------------------------------------------------------------------------
export const TERMO_ADITIVO = {
  codigo: 'termo-aditivo', sigla: 'TA', versao: 1, nome: 'Termo aditivo ao contrato', categoria: CAT_CONTR, perfis: ['gestor', 'compras', 'juridico'],
  descricao: 'Prorrogação, acréscimo ou supressão, reajuste ou outra alteração do contrato.',
  baseLegal: 'Lei 14.133/2021, art. 107 (prorrogação de serviços e fornecimentos contínuos), arts. 124 e 125 (alterações; limites de 25% e 50%), art. 94 (publicação no PNCP) e art. 132 (formalização do termo aditivo).',
  numerar: true, papeisSugeridos: ['Contratante', 'Contratada'],
  titulo: (v, ctx) => `TERMO ADITIVO Nº ${ctx.numero || '[preencher: número]'} AO CONTRATO Nº ${v.contrato_numero || '[preencher: nº do contrato]'}`,
  secoes: [
    { id: 'contrato', titulo: 'Contrato', campos: [
      T('contrato_numero', 'Nº do contrato', { obrigatorio: true }),
      T('processo', 'Processo', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      T('contratada', 'Contratada', { obrigatorio: true }),
      L('objeto', 'Objeto do contrato', { obrigatorio: true }),
      M('valor_atual', 'Valor atualizado do contrato', { obrigatorio: true }),
    ] },
    { id: 'alteracao', titulo: 'Alteração', campos: [
      S('tipo', 'O que muda', [
        { valor: 'prorrogacao', rotulo: 'Prorrogação do prazo de vigência (art. 107)' }, { valor: 'acrescimo', rotulo: 'Acréscimo quantitativo (art. 125)' },
        { valor: 'supressao', rotulo: 'Supressão quantitativa (art. 125)' }, { valor: 'reajuste', rotulo: 'Reajuste ou repactuação de preços' },
        { valor: 'equilibrio', rotulo: 'Reequilíbrio econômico-financeiro' }, { valor: 'outra', rotulo: 'Outra alteração (art. 124)' },
      ], { obrigatorio: true }),
      L('descricao', 'Descrição da alteração', { obrigatorio: true, linhas: 5 }),
      L('justificativa', 'Justificativa', { obrigatorio: true, linhas: 5, ajuda: 'Na prorrogação de contrato contínuo, atestar que as condições e os preços permanecem vantajosos (art. 107).' }),
      D('nova_vigencia', 'Nova data de término', { mostrar: (v) => v.tipo === 'prorrogacao', obrigatorio: true }),
      M('valor_alteracao', 'Valor da alteração', { mostrar: (v) => ['acrescimo', 'supressao', 'reajuste', 'equilibrio'].includes(v.tipo) }),
      T('percentual', 'Percentual sobre o valor inicial atualizado', { mostrar: (v) => ['acrescimo', 'supressao'].includes(v.tipo), ajuda: 'Acréscimos e supressões ficam limitados a 25% (50% em reforma de edifício ou de equipamento, só para acréscimos) — art. 125.' }),
    ] },
    { id: 'vantajosidade', titulo: 'Vantajosidade e dotação', campos: [
      L('vantajosidade', 'Demonstração de vantajosidade', { ajuda: 'Pesquisa de preços, negociação com a contratada, parecer técnico.' }),
      T('dotacao', 'Dotação orçamentária', { obrigatorio: true }),
    ] },
    { id: 'clausulas', titulo: 'Disposições finais', campos: [
      L('ratificacao', 'Ratificação', { padrao: 'Permanecem inalteradas e ratificadas as demais cláusulas e condições do contrato original. A divulgação deste aditivo no PNCP é condição de sua eficácia (art. 94).' }),
    ] },
    { id: 'assina', titulo: '', campos: [
      T('assinante', 'Representante do contratante (assina)', { obrigatorio: true }),
      T('cargo_assinante', 'Cargo', { obrigatorio: true }),
      T('representante_contratada', 'Representante da contratada', { obrigatorio: true }),
    ], bloco: (v) => [B.espaco(), B.assina(v.assinante, v.cargo_assinante), B.assina(v.representante_contratada, `Pela CONTRATADA — ${v.contratada || ''}`)] },
  ],
}

export const MODELOS_CONTRATACAO = [EDITAL, PARECER_JURIDICO, JUSTIFICATIVA_DIRETA, JUSTIFICATIVA_ADESAO, HOMOLOGACAO, CONTRATO, TERMO_ADITIVO]

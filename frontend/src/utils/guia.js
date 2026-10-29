// Guia de uso por perfil: o que cada pessoa faz, em que ordem, e o que cada termo quer dizer.
// Os passos aparecem na Minha mesa ("Por onde começar") e na página Ajuda.

export const GUIA = {
  secretario: {
    resumo: 'Você pede as contratações da sua secretaria pela DFD, por iniciativa própria ou a partir de um ofício do Prefeito, e acompanha cada pedido até o fim.',
    passos: [
      { titulo: 'Faça a DFD quando precisar', texto: 'Não precisa esperar ofício: escolha os itens do catálogo (a especificação já vem pronta), informe as quantidades e justifique.', to: '/documentos/novo?modelo=dfd', acao: 'Nova DFD' },
      { titulo: 'Receba os ofícios e despachos', texto: 'O que o Prefeito encaminha chega em Processos. Se for uma compra, use "Fazer a DFD deste pedido".', to: '/processos?vista=receber', acao: 'Processos recebidos' },
      { titulo: 'Assine e envie ao Compras', texto: 'Assinada, a DFD vai ao Compras em um clique. Os dados do pedido saem dela.', to: '/solicitacoes/nova', acao: 'DFDs para enviar' },
      { titulo: 'Acompanhe até o fim', texto: 'Veja em que setor cada pedido está, há quanto tempo e o que está travando: análise, assinatura pendente, documento que falta ou prazo vencido.', to: '/solicitacoes/acompanhamento', acao: 'Acompanhar meus pedidos' },
    ],
  },
  compras: {
    resumo: 'Você recebe as DFDs das secretarias, abre o processo de contratação, produz os documentos e entrega a contratação à Gestão de Contratos.',
    passos: [
      { titulo: 'Receba as DFDs', texto: 'As secretarias enviam a DFD assinada. Analise, devolva para ajuste ou aceite escolhendo a forma de contratação.', to: '/solicitacoes', acao: 'DFDs recebidas' },
      { titulo: 'Produza os documentos do processo', texto: 'O roteiro da Lei 14.133/2021 mostra o que falta; ETP, pesquisa de preços e TR já começam com os itens da DFD.', to: '/compras/processos', acao: 'Processos de contratação' },
      { titulo: 'Cadastre a contratação', texto: 'Informe contratada, objeto, valor, vigência e o processo SEI.', to: '/contratos?nova=1', acao: 'Nova contratação' },
      { titulo: 'Confira os dados', texto: 'Depois de encaminhar, você só consulta. Revise antes de enviar.', to: '/contratos?situacao=etapa:em_cadastro', acao: 'Ver em cadastro' },
      { titulo: 'Encaminhe à Gestão', texto: 'Na ficha da contratação, use "Encaminhar para Gestão". Ela passa a ser da Gestão.', to: '/contratos', acao: 'Abrir contratações' },
      { titulo: 'Acompanhe as OS / OC', texto: 'Veja se a ordem de serviço foi assinada e entregue à contratada.', to: '/ordens-servico', acao: 'Ver OS / OC' },
    ],
  },
  gestor: {
    resumo: 'Você recebe as contratações, designa os fiscais, gera os documentos e confere cada mês.',
    passos: [
      { titulo: 'Receba as contratações de Compras', texto: 'Abra a contratação e confirme os dados recebidos.', to: '/contratos?situacao=etapa:aguardando_gestao', acao: 'Ver recebidas' },
      { titulo: 'Designe gestor e fiscais', texto: 'Escolha o fiscal titular e o substituto e gere a portaria para o Gabinete.', to: '/contratos', acao: 'Abrir contratações' },
      { titulo: 'Gere o termo e a ordem de serviço', texto: 'Depois da portaria publicada, registre a ciência e prepare a OS para assinatura.', to: '/ordens-servico', acao: 'Ver OS / OC' },
      { titulo: 'Confira as competências do mês', texto: 'Quando o fiscal atesta, você confere e libera para o Financeiro.', to: '/competencias?etapa=conferencia_gestao', acao: 'Conferir agora' },
    ],
  },
  fiscal: {
    resumo: 'Todo mês você registra a nota fiscal, confere a execução e atesta o serviço.',
    passos: [
      { titulo: 'Veja suas contratações', texto: 'Aqui estão as contratações em que você foi designado.', to: '/contratos', acao: 'Minhas fiscalizações' },
      { titulo: 'Registre a nota fiscal do mês', texto: 'Quando a contratada enviar a NF, lance o número, a data e o valor.', to: '/competencias?nf=1', acao: 'Registrar nota fiscal' },
      { titulo: 'Fiscalize e ateste', texto: 'Confirme que o serviço foi feito. Se houver desconto, registre a glosa.', to: '/competencias', acao: 'Ver competências' },
      { titulo: 'Registre ocorrências', texto: 'Problemas na execução ficam anotados na ficha da contratação.', to: '/contratos', acao: 'Abrir contratações' },
    ],
  },
  financeiro: {
    resumo: 'Você cadastra os empenhos e faz a liquidação e o pagamento do que a Gestão liberou.',
    passos: [
      { titulo: 'Cadastre o empenho', texto: 'Vincule o empenho à contratação para controlar o saldo.', to: '/financeiro?aba=empenhos', acao: 'Ver empenhos' },
      { titulo: 'Veja a fila de liquidação', texto: 'São as competências já atestadas e conferidas, prontas para você.', to: '/financeiro', acao: 'Abrir fila' },
      { titulo: 'Lance liquidação e pagamento', texto: 'Informe os dados e a competência segue até "paga".', to: '/competencias', acao: 'Ver competências' },
    ],
  },
  gabinete: {
    resumo: 'Você publica as portarias e assina as ordens de serviço quando a Gestão envia.',
    passos: [
      { titulo: 'Abra os atos para assinatura', texto: 'Portarias aguardando publicação e OS aguardando assinatura aparecem juntas.', to: '/gabinete', acao: 'Atos para assinatura' },
      { titulo: 'Registre a publicação da portaria', texto: 'Informe número e data da publicação.', to: '/gabinete', acao: 'Abrir' },
      { titulo: 'Assine a ordem de serviço', texto: 'Presidente e Diretor assinam e a ordem volta para a Gestão.', to: '/gabinete', acao: 'Abrir' },
    ],
  },
  viewer: {
    resumo: 'Você acompanha tudo em modo consulta, sem alterar nada.',
    passos: [
      { titulo: 'Veja o panorama', texto: 'O painel resume contratações, prazos e valores.', to: '/gestao', acao: 'Painel da gestão' },
      { titulo: 'Procure uma contratação', texto: 'Use a busca no topo: número, contratada, CNPJ ou processo SEI.', to: '/contratos', acao: 'Contratações' },
      { titulo: 'Confira os alertas', texto: 'Prazos de vigência, garantia e reajuste que merecem atenção.', to: '/alertas', acao: 'Alertas e prazos' },
    ],
  },
  juridico: {
    resumo: 'Você analisa os processos que chegam ao Jurídico e emite os pareceres.',
    passos: [
      { titulo: 'Receba os processos', texto: 'Os processos enviados ao Jurídico aparecem na Minha mesa. Abra e clique em "Receber".', to: '/processos?vista=receber', acao: 'Aguardando recebimento' },
      { titulo: 'Redija o parecer', texto: 'O modelo de parecer já traz a verificação dos documentos exigidos e os campos do art. 53 da Lei 14.133/2021.', to: '/documentos/novo?modelo=parecer-juridico', acao: 'Novo parecer jurídico' },
      { titulo: 'Assine e devolva o processo', texto: 'Envie o parecer para assinatura, assine com a sua senha e encaminhe o processo à unidade seguinte.', to: '/documentos?vista=assinar', acao: 'Para assinar' },
      { titulo: 'Consulte as contratações', texto: 'Você acompanha os contratos em modo leitura, sem alterá-los.', to: '/contratos', acao: 'Contratações' },
    ],
  },
  administrativo: {
    resumo: 'Você cuida do protocolo: abre, recebe e encaminha processos e produz ofícios e memorandos.',
    passos: [
      { titulo: 'Abra e encaminhe processos', texto: 'Cada processo recebe um protocolo e segue para a unidade que vai cuidar dele.', to: '/processos', acao: 'Processos' },
      { titulo: 'Produza ofícios e memorandos', texto: 'Escolha o modelo, preencha e envie para assinatura.', to: '/documentos/novo', acao: 'Novo documento' },
      { titulo: 'Confira o que espera assinatura', texto: 'Documentos seus e dos seus colegas aguardando assinatura.', to: '/documentos', acao: 'Documentos' },
    ],
  },
  rh: {
    resumo: 'Você trata os processos de pessoal e produz os documentos da área.',
    passos: [
      { titulo: 'Receba os processos de pessoal', texto: 'O que chega ao RH aparece na Minha mesa.', to: '/processos?vista=receber', acao: 'Aguardando recebimento' },
      { titulo: 'Produza documentos', texto: 'Ofícios, memorandos, declarações, atas e pareceres técnicos.', to: '/documentos/novo', acao: 'Novo documento' },
      { titulo: 'Acompanhe as assinaturas', texto: 'Veja o que já foi assinado e o que está pendente.', to: '/documentos', acao: 'Documentos' },
    ],
  },
  ti: {
    resumo: 'Você trata os processos de tecnologia e emite os pareceres técnicos de TI.',
    passos: [
      { titulo: 'Receba os processos de TI', texto: 'O que chega à TI aparece na Minha mesa.', to: '/processos?vista=receber', acao: 'Aguardando recebimento' },
      { titulo: 'Emita o parecer técnico', texto: 'Use o modelo de parecer técnico para se manifestar sobre requisitos e soluções de TI.', to: '/documentos/novo?modelo=parecer-tecnico', acao: 'Novo parecer técnico' },
      { titulo: 'Acompanhe as assinaturas', texto: 'Veja o que já foi assinado e o que está pendente.', to: '/documentos', acao: 'Documentos' },
    ],
  },
  presidente: {
    resumo: 'Você acompanha o órgão inteiro e pode agir em qualquer setor. Tudo começa na Visão geral.',
    passos: [
      { titulo: 'Envie ofícios e despachos às secretarias', texto: 'Faça o ofício ou o despacho aqui, assine e use "Encaminhar" para a secretaria. Ela recebe na mesa e pode fazer a DFD a partir dele.', to: '/documentos/novo?modelo=oficio', acao: 'Novo ofício' },
      { titulo: 'Comece pela Visão geral', texto: 'Mostra, de relance, os processos por setor, o que está parado ou atrasado e as últimas movimentações.', to: '/painel', acao: 'Visão geral' },
      { titulo: 'Veja onde os processos estão travando', texto: 'O painel de acompanhamento compara os setores e lista o que está parado há mais tempo.', to: '/acompanhamento', acao: 'Acompanhamento' },
      { titulo: 'Abra um processo para ver o caminho', texto: 'Cada processo mostra por onde passou, quanto tempo ficou em cada setor e quem mexeu.', to: '/processos', acao: 'Processos' },
      { titulo: 'Acompanhe as contratações', texto: 'Contratos em execução, prazos de vigência, pendências e pagamentos.', to: '/gestao', acao: 'Painel da gestão' },
    ],
  },
  admin: {
    resumo: 'Você prepara o sistema e cuida dos acessos. Também enxerga e opera todos os setores.',
    passos: [
      { titulo: 'Preencha os parâmetros', texto: 'Nome do órgão, cidade, Presidente, Diretor Financeiro e e-mail da Gestão.', to: '/parametros', acao: 'Parâmetros' },
      { titulo: 'Cadastre os usuários', texto: 'Crie o acesso de cada pessoa e escolha o perfil (setor) dela.', to: '/usuarios', acao: 'Usuários e perfis' },
      { titulo: 'Importe ou cadastre as contratações', texto: 'Use a planilha modelo para trazer contratos já existentes.', to: '/contratos', acao: 'Contratações' },
      { titulo: 'Acompanhe o painel', texto: 'Veja o andamento geral e os setores com pendências.', to: '/gestao', acao: 'Painel da gestão' },
    ],
  },
}

// Módulo de processos licitatórios (compras e admin operam; consulta só acompanha)
const GUIA_OPERA_LICITACAO = {
  resumo: 'Aqui você acompanha cada processo de licitação, do pedido até a contratação.',
  passos: [
    { titulo: 'Cadastre o processo', texto: 'Em Processos, clique em "Novo" e informe número, objeto, modalidade, prioridade e prazo.', to: '/controle', acao: 'Abrir processos' },
    { titulo: 'Ou importe uma planilha', texto: 'Já tem os processos numa planilha? Use "Importar" na mesma tela.', to: '/controle', acao: 'Abrir processos' },
    { titulo: 'Acompanhe no quadro', texto: 'O quadro separa os processos por prioridade. Clique num cartão para ver os detalhes.', to: '/home', acao: 'Quadro de prioridades' },
    { titulo: 'Registre o andamento', texto: 'Abra o processo, marque em que documento ele está (DFD até o parecer jurídico) e adicione cada etapa ao fluxo.', to: '/controle', acao: 'Abrir processos' },
    { titulo: 'Arquive os concluídos', texto: 'Marque os processos encerrados e clique em "Arquivar". Dá para desarquivar depois.', to: '/arquivados', acao: 'Ver arquivados' },
  ],
}
export const GUIA_LICITACAO = {
  compras: GUIA_OPERA_LICITACAO,
  admin: GUIA_OPERA_LICITACAO,
  presidente: GUIA_OPERA_LICITACAO,
  viewer: {
    resumo: 'Você acompanha os processos de licitação em modo consulta, sem alterar nada.',
    passos: [
      { titulo: 'Veja o quadro de prioridades', texto: 'Os processos ativos agrupados por prioridade.', to: '/home', acao: 'Quadro de prioridades' },
      { titulo: 'Consulte um processo', texto: 'Busque por número ou objeto e abra para ver o fluxo e os documentos.', to: '/controle', acao: 'Processos' },
      { titulo: 'Acompanhe os indicadores', texto: 'Volume, tipo e entradas por mês, para achar gargalos.', to: '/dashboard', acao: 'Indicadores' },
    ],
  },
}

// Tramitação de processos administrativos (todos os perfis; a consulta só acompanha)
const GUIA_OPERA_TRAMITACAO = {
  resumo: 'Cada processo tem um protocolo, está sempre numa unidade e guarda o histórico de por onde passou.',
  passos: [
    { titulo: 'Abra um processo', texto: 'Escolha o tipo, escreva o assunto e envie para a unidade que vai cuidar dele.', to: '/processos', acao: 'Abrir processos' },
    { titulo: 'Receba o que chegar à sua unidade', texto: 'Quando alguém envia um processo para você, ele aparece na Minha mesa. Abra e clique em "Receber".', to: '/processos?vista=receber', acao: 'Aguardando recebimento' },
    { titulo: 'Envie para o próximo setor com um despacho', texto: 'No processo, use "Enviar para outra unidade" e explique o que o próximo setor deve fazer.', to: '/processos?vista=minha', acao: 'Na minha unidade' },
    { titulo: 'Conclua quando estiver resolvido', texto: 'Informe como foi resolvido. Um processo concluído pode ser reaberto depois.', to: '/processos', acao: 'Abrir processos' },
  ],
}
const PASSO_ACOMPANHAR = { titulo: 'Veja onde está travando', texto: 'O painel mostra os processos por unidade, o tempo de espera e o que está parado ou atrasado.', to: '/acompanhamento', acao: 'Acompanhamento' }
export const GUIA_TRAMITACAO = {
  secretario: GUIA_OPERA_TRAMITACAO,
  compras: GUIA_OPERA_TRAMITACAO,
  fiscal: GUIA_OPERA_TRAMITACAO,
  financeiro: GUIA_OPERA_TRAMITACAO,
  juridico: GUIA_OPERA_TRAMITACAO,
  administrativo: GUIA_OPERA_TRAMITACAO,
  rh: GUIA_OPERA_TRAMITACAO,
  ti: GUIA_OPERA_TRAMITACAO,
  gestor: { ...GUIA_OPERA_TRAMITACAO, passos: [...GUIA_OPERA_TRAMITACAO.passos, PASSO_ACOMPANHAR] },
  gabinete: { ...GUIA_OPERA_TRAMITACAO, passos: [...GUIA_OPERA_TRAMITACAO.passos, PASSO_ACOMPANHAR] },
  viewer: {
    resumo: 'Você acompanha os processos em modo consulta, sem alterar nada.',
    passos: [
      PASSO_ACOMPANHAR,
      { titulo: 'Consulte um processo', texto: 'Busque pelo protocolo ou pelo assunto e abra para ver o histórico completo.', to: '/processos', acao: 'Processos' },
    ],
  },
  presidente: {
    resumo: 'Você vê todos os processos e setores e pode movimentar qualquer um.',
    passos: [
      { titulo: 'Veja tudo de relance', texto: 'Na Visão geral: processos por setor, o que está travado e quem mexeu por último.', to: '/painel', acao: 'Visão geral' },
      { titulo: 'Compare os setores', texto: 'Quantos processos cada setor tem, quantos parados e o tempo médio de espera.', to: '/acompanhamento', acao: 'Acompanhamento' },
      { titulo: 'Confira por onde um processo passou', texto: 'Abra o processo: o histórico mostra cada envio, o despacho e quem fez.', to: '/processos', acao: 'Processos' },
      { titulo: 'Aja quando precisar', texto: 'Você pode receber, enviar, alterar, concluir ou reabrir qualquer processo.', to: '/processos?vista=atencao', acao: 'Precisam de atenção' },
    ],
  },
  admin: {
    resumo: 'Você define as unidades e liga cada pessoa à sua. Também pode abrir e movimentar qualquer processo.',
    passos: [
      { titulo: 'Confira as unidades', texto: 'Ajuste os nomes e crie as que faltam. Elas são os setores por onde os processos passam.', to: '/unidades', acao: 'Unidades' },
      { titulo: 'Ligue cada pessoa à sua unidade', texto: 'Em Usuários e perfis, escolha a unidade de cada um. Sem isso a pessoa não abre nem recebe processos.', to: '/usuarios', acao: 'Usuários e perfis' },
      PASSO_ACOMPANHAR,
    ],
  },
}

// Documentos e assinatura eletrônica
const GUIA_OPERA_DOCUMENTOS = {
  resumo: 'Crie documentos oficiais aqui dentro, envie para assinatura e confira a autenticidade depois.',
  passos: [
    { titulo: 'Escolha um modelo', texto: 'Ofícios, despachos, memorandos e, para Compras, os documentos da Lei 14.133/2021 (DFD, ETP, TR, contrato).', to: '/documentos/novo', acao: 'Novo documento' },
    { titulo: 'Preencha e revise', texto: 'O texto aparece ao lado enquanto você digita. Complete tudo o que estiver marcado como "preencher".', to: '/documentos', acao: 'Meus documentos' },
    { titulo: 'Envie para assinatura', texto: 'Escolha quem assina. Depois de enviado, o texto fica congelado: nada muda sem que todos saibam.', to: '/documentos', acao: 'Documentos' },
    { titulo: 'Assine com a sua senha', texto: 'Quem assina confirma a própria senha. A data, o IP e o navegador são registrados pelo sistema.', to: '/documentos?vista=assinar', acao: 'Aguardando a minha assinatura' },
    { titulo: 'Confira a autenticidade', texto: 'Todo documento assinado tem um código de verificação que qualquer pessoa pode conferir.', to: '/documentos/verificar', acao: 'Verificar documento' },
  ],
}
export const GUIA_DOCUMENTOS = {
  secretario: GUIA_OPERA_DOCUMENTOS, compras: GUIA_OPERA_DOCUMENTOS, gestor: GUIA_OPERA_DOCUMENTOS, fiscal: GUIA_OPERA_DOCUMENTOS, financeiro: GUIA_OPERA_DOCUMENTOS,
  gabinete: GUIA_OPERA_DOCUMENTOS, juridico: GUIA_OPERA_DOCUMENTOS, administrativo: GUIA_OPERA_DOCUMENTOS, rh: GUIA_OPERA_DOCUMENTOS,
  ti: GUIA_OPERA_DOCUMENTOS, admin: GUIA_OPERA_DOCUMENTOS, presidente: GUIA_OPERA_DOCUMENTOS,
  viewer: {
    resumo: 'Você consulta os documentos dos processos que acompanha, em modo leitura.',
    passos: [
      { titulo: 'Consulte os documentos', texto: 'Os documentos aparecem junto de cada processo e na lista de Documentos.', to: '/documentos', acao: 'Documentos' },
      { titulo: 'Confira a autenticidade', texto: 'Digite o código de verificação que consta no documento assinado.', to: '/documentos/verificar', acao: 'Verificar documento' },
    ],
  },
}

// Solicitações ao Compras: o setor pede (com o DFD); o Compras analisa e abre o processo de contratação
const GUIA_SOLICITAR = {
  resumo: 'Quando a sua secretaria precisa comprar ou contratar algo, o pedido vai ao Compras pela DFD assinada.',
  passos: [
    { titulo: 'Faça a DFD', texto: 'Escolha os itens do catálogo, informe as quantidades e justifique. Assine com a sua senha.', to: '/documentos/novo?modelo=dfd', acao: 'Nova DFD' },
    { titulo: 'Envie ao Compras', texto: 'Ao terminar as assinaturas, o sistema já oferece o envio. Os dados do pedido saem da própria DFD.', to: '/solicitacoes/nova', acao: 'DFDs para enviar' },
    { titulo: 'Acompanhe a resposta', texto: 'Se o Compras devolver para ajuste, use "Refazer a DFD" e reenvie. Aceita, vira um processo que você acompanha.', to: '/solicitacoes', acao: 'Meus pedidos' },
  ],
}
const GUIA_COMPRAS_SOLICITACOES = {
  resumo: 'Os setores enviam as demandas por aqui. Você analisa e, ao aceitar, o processo de contratação já nasce com o roteiro de documentos da Lei 14.133/2021.',
  passos: [
    { titulo: 'Analise o que chegou', texto: 'Abra o pedido, leia a DFD (itens, quantidades e justificativa). Falta algo? Devolva para ajuste dizendo o quê.', to: '/solicitacoes', acao: 'Aguardando análise' },
    { titulo: 'Abra o processo', texto: 'Aceite escolhendo a forma de contratação e o tipo de objeto. O sistema abre o processo no Compras, junta a DFD e registra no quadro.', to: '/solicitacoes', acao: 'DFDs recebidas' },
    { titulo: 'Produza e encaminhe os documentos', texto: 'Siga o roteiro: ETP, pesquisa de preços e TR já vêm com os itens da DFD. Envie arquivos de fora e encaminhe ao Jurídico e ao Financeiro quando precisar.', to: '/compras/processos', acao: 'Processos de contratação' },
  ],
}
export const GUIA_SOLICITACOES = {
  compras: GUIA_COMPRAS_SOLICITACOES, admin: GUIA_COMPRAS_SOLICITACOES, presidente: GUIA_COMPRAS_SOLICITACOES,
  secretario: GUIA_SOLICITAR,
}

// O caminho de uma contratação, do cadastro ao pagamento (quem faz cada etapa)
export const CAMINHO = [
  { setor: 'Prefeito', texto: 'Envia ofícios e despachos às secretarias', perfis: ['presidente'] },
  { setor: 'Secretário', texto: 'Faz a DFD com os itens do catálogo, assina e envia ao Compras', perfis: ['secretario'] },
  { setor: 'Compras', texto: 'Abre o processo e produz os documentos da Lei 14.133/2021, com o Jurídico e o Financeiro', perfis: ['compras'] },
  { setor: 'Compras', texto: 'Cadastra a contratação e encaminha à Gestão', perfis: ['compras'] },
  { setor: 'Gestão', texto: 'Recebe, designa gestor e fiscais, gera a portaria', perfis: ['gestor'] },
  { setor: 'Prefeito', texto: 'Publica a portaria', perfis: ['presidente', 'gabinete'] },
  { setor: 'Gestão', texto: 'Registra a ciência (termo) e prepara a ordem de serviço', perfis: ['gestor'] },
  { setor: 'Prefeito', texto: 'Assina a ordem de serviço', perfis: ['presidente', 'gabinete'] },
  { setor: 'Todo mês · Fiscal', texto: 'Registra a nota fiscal, fiscaliza e atesta', perfis: ['fiscal'] },
  { setor: 'Todo mês · Gestão', texto: 'Confere e libera para pagamento', perfis: ['gestor'] },
  { setor: 'Todo mês · Financeiro', texto: 'Liquida e paga', perfis: ['financeiro'] },
]

export const GLOSSARIO = [
  ['Contratação', 'Cada contrato, nota de empenho ou ata que o órgão firma. É o registro principal do sistema.'],
  ['Processo SEI', 'Número do processo administrativo no SEI, usado para localizar os documentos.'],
  ['Vigência', 'Período em que o contrato vale. O sistema avisa quando está perto de vencer.'],
  ['Portaria', 'Ato que designa o gestor e os fiscais do contrato. É publicada pelo Gabinete.'],
  ['Termo de ciência', 'Registro de que gestor e fiscais foram avisados da designação.'],
  ['OS / OC', 'Ordem de serviço ou de compra: autoriza a contratada a começar o fornecimento.'],
  ['Competência', 'Cada mês de execução do contrato. É nela que se acompanha a nota fiscal até o pagamento.'],
  ['Atesto', 'Confirmação do fiscal de que o serviço do mês foi entregue como combinado.'],
  ['Glosa', 'Desconto no pagamento quando parte do serviço não foi cumprida.'],
  ['Empenho', 'Reserva de dinheiro no orçamento para pagar a contratação.'],
  ['Liquidação', 'Conferência final de que o valor é devido, feita pelo Financeiro antes de pagar.'],
  ['Saldo do contrato', 'Quanto ainda pode ser usado. Diminui conforme as ordens de serviço ou os valores liquidados.'],
  ['DFD', 'Documento de Formalização da Demanda: o pedido inicial que dá partida ao processo de compra.'],
  ['Estudo técnico preliminar', 'Análise que justifica a necessidade e a melhor solução antes de comprar.'],
  ['Pesquisa de preço', 'Levantamento dos preços de mercado para estimar o valor da contratação.'],
  ['Termo de referência', 'Documento que descreve o que será comprado, as regras e as condições.'],
  ['Prioridade', 'Define a coluna do processo no quadro: Crítico, Estratégico, Alavancável ou Não crítico.'],
  ['Arquivar', 'Tira o processo da lista ativa sem apagar. Ele continua guardado e pode ser desarquivado.'],
  ['Protocolo', 'Número do processo administrativo (ano/sequência), que identifica o processo e nunca se repete.'],
  ['Tramitar', 'Mover o processo de uma unidade para outra. Cada envio fica registrado, com o despacho.'],
  ['Despacho', 'O texto que acompanha o envio: o que a próxima unidade deve fazer.'],
  ['Unidade', 'Setor do órgão por onde o processo passa (Compras, Jurídico, Financeiro etc.).'],
  ['Processo parado', 'Está em andamento há vários dias na mesma unidade sem nenhuma movimentação. O limite é definido em Parâmetros.'],
  ['Assinatura eletrônica', 'Assinatura feita dentro do sistema, com login e senha reconfirmada. Fica registrada com data, IP e o código (hash) do texto assinado.'],
  ['Código de verificação', 'Código impresso em todo documento assinado. Qualquer pessoa o digita na página de verificação para conferir se o documento é autêntico.'],
  ['ETP', 'Estudo Técnico Preliminar: analisa a necessidade e a melhor solução antes de contratar (Lei 14.133/2021, art. 18).'],
  ['TR', 'Termo de Referência: descreve o que será contratado, como será executado, fiscalizado e pago (Lei 14.133/2021, art. 6º, XXIII).'],
  ['Contratação direta', 'Contratar sem licitação, por dispensa (art. 75) ou inexigibilidade (art. 74), com o processo instruído conforme o art. 72.'],
  ['Garantia e reajuste', 'Garantia contratual (seguro, caução) e atualização anual do valor. Ambos geram alertas de prazo.'],
]

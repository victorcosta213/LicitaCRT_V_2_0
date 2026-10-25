// Guia de uso por perfil: o que cada pessoa faz, em que ordem, e o que cada termo quer dizer.
// Os passos aparecem na Minha mesa ("Por onde começar") e na página Ajuda.

export const GUIA = {
  compras: {
    resumo: 'Você abre cada contratação no sistema e a entrega à Gestão de Contratos.',
    passos: [
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

// O caminho de uma contratação, do cadastro ao pagamento (quem faz cada etapa)
export const CAMINHO = [
  { setor: 'Compras', texto: 'Cadastra a contratação e encaminha à Gestão', perfis: ['compras'] },
  { setor: 'Gestão', texto: 'Recebe, designa gestor e fiscais, gera a portaria', perfis: ['gestor'] },
  { setor: 'Gabinete', texto: 'Publica a portaria', perfis: ['gabinete'] },
  { setor: 'Gestão', texto: 'Registra a ciência (termo) e prepara a ordem de serviço', perfis: ['gestor'] },
  { setor: 'Gabinete', texto: 'Assina a ordem de serviço', perfis: ['gabinete'] },
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
  ['Garantia e reajuste', 'Garantia contratual (seguro, caução) e atualização anual do valor. Ambos geram alertas de prazo.'],
]

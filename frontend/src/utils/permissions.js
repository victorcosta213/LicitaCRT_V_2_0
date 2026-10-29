// Perfis e permissões da Plataforma de Gestão Contratual.
// A mesma regra é aplicada no banco (RLS + triggers em backend/supabase/migrations);
// aqui ela serve para esconder/expor ações e montar o fluxo de telas por perfil.

export const ROLES = {
  admin:      { label: 'Administrador',          desc: 'Usuários, perfis, parâmetros e cadastros auxiliares' },
  presidente: { label: 'Presidente / Prefeito',  desc: 'Usuário mestre: emite ofícios e despachos às secretarias, acompanha todos os processos e setores e pode fazer tudo no sistema' },
  secretario: { label: 'Secretário(a)',          desc: 'Recebe ofícios e despachos do Prefeito, faz a DFD da sua secretaria (itens do catálogo), assina e envia ao Compras; acompanha os processos' },
  compras:    { label: 'Compras',                desc: 'Recebe as DFDs das secretarias, abre o processo de contratação, produz os documentos e encaminha ao Jurídico, ao Financeiro e à Gestão' },
  gestor:     { label: 'Gestão de contratos',    desc: 'Designa fiscais, portaria, termo de ciência, OS/OC, confere competências e libera ao Financeiro' },
  fiscal:     { label: 'Fiscal',                 desc: 'Recebe a NF, fiscaliza, registra ocorrência e glosa e atesta — só nas contratações em que é designado' },
  financeiro: { label: 'Financeiro',             desc: 'Empenho, reforço, anulação, liquidação, pagamento e saldos' },
  gabinete:   { label: 'Gabinete',               desc: 'Assinatura/publicação de portarias e assinatura de OS/OC', oculto: true },
  juridico:   { label: 'Jurídico',               desc: 'Recebe processos para análise, emite pareceres jurídicos e acompanha as contratações em consulta' },
  administrativo: { label: 'Administrativo / Protocolo', desc: 'Abre, recebe e encaminha processos e produz ofícios e memorandos; não vê contratações', oculto: true },
  rh:         { label: 'Recursos Humanos',       desc: 'Abre, recebe e encaminha processos e produz documentos da área de pessoal; não vê contratações', oculto: true },
  ti:         { label: 'Tecnologia da Informação', desc: 'Abre, recebe e encaminha processos e emite pareceres técnicos de TI; não vê contratações', oculto: true },
  editor:     { label: 'Editor (legado)',        desc: 'Perfil anterior à gestão contratual — tratado como Compras' },
  viewer:     { label: 'Visualizador',           desc: 'Somente consulta', oculto: true },
}

// Perfis em uso no fluxo atual (Prefeito → Secretários → Compras ↔ Jurídico, Financeiro e Gestão de contratos).
// Os marcados `oculto` ficam em espera: quem já os tem continua funcionando, mas eles não são oferecidos no cadastro.
export const PERFIS_EM_USO = ['admin', 'presidente', 'secretario', 'compras', 'juridico', 'financeiro', 'gestor', 'fiscal']
export const PERFIS_OCULTOS = Object.keys(ROLES).filter((k) => ROLES[k].oculto)

export const normalizeRole = (r) => (r === 'editor' ? 'compras' : r || 'viewer')

// Perfis mestres: veem e fazem tudo (no banco, o presidente vale como administrador: ver gc_role)
export const isMaster = (r) => r === 'admin' || r === 'presidente'

// ação -> perfis autorizados (admin sempre pode)
const MATRIX = {
  'contrato.criar':        ['compras', 'gestor'],
  'contrato.editar':       ['compras', 'gestor'],   // compras: só antes de encaminhar
  'contrato.encaminhar':   ['compras'],             // "Encaminhar para Gestão"
  'contrato.validar':      ['gestor'],              // receber a contratação
  'contrato.situacao':     ['gestor'],
  'responsaveis.editar':   ['gestor'],
  'portaria.gerir':        ['gestor'],
  'portaria.publicar':     ['gestor', 'gabinete'],
  'termo.registrar':       ['gestor'],
  'substituto.alternar':   ['gestor', 'fiscal'],    // fiscal: só nas contratações em que é fiscal

  'os.solicitar':          ['compras', 'gestor'],
  'os.emitir':             ['gestor'],
  'os.assinar':            ['gestor', 'gabinete'],

  'competencia.abrir':     ['fiscal', 'gestor'],
  'competencia.fiscal':    ['fiscal'],              // NF, fiscalização, glosa, documentação e atesto
  'competencia.liberar':   ['gestor'],              // conferência, devolução e liberação ao Financeiro

  'ocorrencia.registrar':  ['fiscal', 'gestor'],
  'evento.registrar':      ['gestor'],
  'pendencia.registrar':   ['gestor'],
  'documento.registrar':   ['compras', 'gestor', 'fiscal', 'financeiro'],

  'financeiro.empenho':    ['financeiro'],
  'financeiro.execucao':   ['financeiro'],

  'relatorio.financeiro':  ['gestor', 'financeiro'],
  'processo.editar':       ['compras'],             // módulo licitatório (tabela processos)
  'tramitacao.abrir':      ['secretario', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'juridico', 'administrativo', 'rh', 'ti'], // abrir processo administrativo
  'documento.criar':       ['secretario', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'juridico', 'administrativo', 'rh', 'ti'], // criar e assinar documentos
  'compras.solicitar':     ['secretario'],          // só o secretário faz a DFD e o pedido ao Compras
  'compras.analisar':      ['compras'],             // analisar as DFDs recebidas e abrir o processo de contratação
  'compras.registrar':     [],                      // lançar processo sem DFD (processos antigos): só a administração
  'usuarios.admin':        [],
  'parametros.admin':      [],
}

export function can(role, action) {
  const r = normalizeRole(role)
  if (isMaster(r)) return true
  return (MATRIX[action] || []).includes(r)
}

// Perfis que têm uma mesa de trabalho (tarefas que aguardam a sua atuação)
export const PERFIS_COM_MESA = ['secretario', 'gestor', 'fiscal', 'financeiro', 'compras', 'juridico', 'administrativo', 'rh', 'ti']

// Tela inicial de cada perfil
export function landingFor(role) {
  if (role === 'editor') return '/home'
  const r = normalizeRole(role)
  if (r === 'presidente') return '/painel'
  if (r === 'admin' || PERFIS_COM_MESA.includes(r)) return '/mesa'
  if (r === 'gabinete') return '/gabinete'
  return '/home'
}

// Módulos do sistema. O trilho à esquerda mostra só os módulos do perfil e o menu
// ao lado, só as telas do módulo aberto.
export const MODULOS = {
  painel:     { label: 'Visão geral',            curto: 'Painel',     icon: 'bi-bullseye' },
  mesa:       { label: 'Minha mesa',             curto: 'Mesa',       icon: 'bi-inbox' },
  processos:  { label: 'Processos',              curto: 'Processos',  icon: 'bi-diagram-3' },
  documentos: { label: 'Documentos',             curto: 'Documentos', icon: 'bi-file-earmark-richtext' },
  compras:    { label: 'Compras e contratações', curto: 'Compras',    icon: 'bi-cart-check' },
  contratos:  { label: 'Contratações',           curto: 'Contratos',  icon: 'bi-file-earmark-text' },
  financeiro: { label: 'Financeiro',             curto: 'Financeiro', icon: 'bi-cash-coin' },
  licitacoes: { label: 'Processos licitatórios', curto: 'Licitações', icon: 'bi-kanban' },
  gabinete:   { label: 'Gabinete',               curto: 'Gabinete',   icon: 'bi-vector-pen' },
  admin:      { label: 'Administração',          curto: 'Admin',      icon: 'bi-gear' },
}
const ORDEM_MODULOS = {
  presidente: ['painel', 'processos', 'documentos', 'compras', 'contratos', 'financeiro', 'licitacoes', 'gabinete', 'admin'],
  compras: ['mesa', 'compras', 'processos', 'documentos', 'licitacoes', 'contratos'],
  secretario: ['mesa', 'compras', 'processos', 'documentos'],
  financeiro: ['mesa', 'processos', 'documentos', 'financeiro', 'contratos', 'compras'],
}
const ORDEM_PADRAO = ['mesa', 'processos', 'documentos', 'compras', 'contratos', 'financeiro', 'licitacoes', 'gabinete', 'admin']

// Telas de cada módulo por perfil (ordem = ordem no menu)
export function menuFor(role) {
  const r = normalizeRole(role)
  const all = isMaster(r)
  const has = (...p) => all || p.includes(r)
  const item = (to, icon, label) => ({ to, icon, label })
  return {
    painel: r === 'presidente' ? [item('/painel', 'bi-bullseye', 'Visão geral')] : [],
    mesa: has(...PERFIS_COM_MESA)
      ? [item('/mesa', 'bi-inbox', 'Minha mesa'), has('compras', 'gestor', 'fiscal', 'financeiro', 'juridico') && item('/alertas', 'bi-bell', 'Alertas e prazos')].filter(Boolean)
      : [],
    processos: [
      item('/processos', 'bi-folder2-open', 'Processos'),
      has('gestor', 'gabinete', 'viewer') && item('/acompanhamento', 'bi-activity', 'Acompanhamento'),
    ].filter(Boolean),
    documentos: [
      item('/documentos', 'bi-file-earmark-richtext', 'Documentos'),
      has('secretario', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'juridico', 'administrativo', 'rh', 'ti') && item('/documentos/novo', 'bi-file-earmark-plus', 'Novo documento'),
      item('/documentos/verificar', 'bi-patch-check', 'Verificar autenticidade'),
    ].filter(Boolean),
    compras: [
      item('/solicitacoes', 'bi-send', has('compras') ? 'DFDs recebidas' : r === 'secretario' ? 'Meus pedidos ao Compras' : 'Pedidos ao Compras'),
      r === 'secretario' && item('/solicitacoes/nova', 'bi-file-earmark-plus', 'Nova DFD'),
      has('secretario', 'compras', 'gestor', 'gabinete', 'viewer') && item('/solicitacoes/acompanhamento', 'bi-binoculars', r === 'secretario' ? 'Acompanhar meus pedidos' : 'Acompanhamento dos pedidos'),
      has('compras', 'gestor', 'gabinete', 'viewer') && item('/compras/processos', 'bi-folder-check', 'Processos de contratação'),
      has('compras', 'secretario', 'gestor', 'gabinete', 'viewer') && item('/itens', 'bi-box-seam', 'Catálogo de itens'),
      item('/compras/roteiros', 'bi-list-check', 'Documentos por tipo de processo'),
    ].filter(Boolean),
    contratos: [
      has('gestor', 'viewer') && item('/gestao', 'bi-speedometer2', 'Painel da gestão'),
      has('compras', 'gestor', 'financeiro', 'juridico', 'viewer') && item('/contratos', 'bi-files', 'Contratações'),
      r === 'fiscal' && item('/contratos', 'bi-search', 'Minhas fiscalizações'),
      has('compras', 'gestor', 'viewer') && item('/ordens-servico', 'bi-clipboard-check', 'OS / OC'),
      has('gestor', 'fiscal', 'financeiro', 'viewer') && item('/competencias', 'bi-calendar2-check', 'Competências'),
      has('gestor', 'fiscal', 'compras', 'viewer') && item('/relatorios', 'bi-file-earmark-bar-graph', 'Relatórios'),
      r === 'viewer' && item('/alertas', 'bi-bell', 'Alertas e prazos'),
    ].filter(Boolean),
    financeiro: [
      has('financeiro', 'gestor', 'viewer') && item('/financeiro', 'bi-cash-coin', 'Painel financeiro'),
      r === 'financeiro' && item('/relatorios', 'bi-file-earmark-bar-graph', 'Relatórios'),
    ].filter(Boolean),
    licitacoes: has('compras', 'viewer')
      ? [
          item('/home', 'bi-kanban', 'Quadro de prioridades'),
          item('/controle', 'bi-journal-check', 'Processos'),
          item('/dashboard', 'bi-bar-chart-line', 'Indicadores'),
          item('/arquivados', 'bi-archive', 'Arquivados'),
        ]
      : [],
    gabinete: has('gabinete') ? [item('/gabinete', 'bi-vector-pen', 'Atos para assinatura')] : [],
    admin: all ? [item('/usuarios', 'bi-people', 'Usuários e perfis'), item('/unidades', 'bi-diagram-2', 'Unidades'), item('/parametros', 'bi-sliders', 'Parâmetros')] : [],
  }
}

// Módulos do perfil, na ordem do trilho, cada um com as suas telas
export function modulosFor(role) {
  const r = normalizeRole(role)
  const menu = menuFor(role)
  // para o fiscal, o módulo de contratações é a fiscalização
  const proprio = r === 'fiscal' ? { contratos: { label: 'Fiscalização', curto: 'Fiscalização', icon: 'bi-search' } } : {}
  return (ORDEM_MODULOS[r] || ORDEM_PADRAO)
    .filter((key) => menu[key].length > 0)
    .map((key) => ({ key, ...MODULOS[key], ...proprio[key], itens: menu[key] }))
}

// Módulo e tela da rota atual (a ficha /contratos/:id fica em Contratações)
export function moduloDaRota(modulos, pathname) {
  const casa = (to) => pathname === to || pathname.startsWith(`${to}/`)
  for (const modulo of modulos) {
    const item = modulo.itens.filter((i) => casa(i.to)).sort((a, b) => b.to.length - a.to.length)[0]
    if (item) return { modulo, item }
  }
  return { modulo: modulos[0] || null, item: null }
}

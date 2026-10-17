// Perfis e permissões da Plataforma de Gestão Contratual.
// A mesma regra é aplicada no banco (RLS + triggers em backend/supabase/migrations);
// aqui ela serve para esconder/expor ações e montar o fluxo de telas por perfil.

export const ROLES = {
  admin:      { label: 'Administrador',          desc: 'Usuários, perfis, parâmetros e cadastros auxiliares' },
  compras:    { label: 'Compras',                desc: 'Cadastra a contratação e a encaminha à Gestão (solicita fiscais e OS/OC)' },
  gestor:     { label: 'Gestão de contratos',    desc: 'Designa fiscais, portaria, termo de ciência, OS/OC, confere competências e libera ao Financeiro' },
  fiscal:     { label: 'Fiscal',                 desc: 'Recebe a NF, fiscaliza, registra ocorrência e glosa e atesta — só nas contratações em que é designado' },
  financeiro: { label: 'Financeiro',             desc: 'Empenho, reforço, anulação, liquidação, pagamento e saldos' },
  gabinete:   { label: 'Gabinete',               desc: 'Assinatura/publicação de portarias e assinatura de OS/OC' },
  editor:     { label: 'Editor (legado)',        desc: 'Perfil anterior à gestão contratual — tratado como Compras' },
  viewer:     { label: 'Visualizador',           desc: 'Somente consulta' },
}

export const normalizeRole = (r) => (r === 'editor' ? 'compras' : r || 'viewer')

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
  'usuarios.admin':        [],
  'parametros.admin':      [],
}

export function can(role, action) {
  const r = normalizeRole(role)
  if (r === 'admin') return true
  return (MATRIX[action] || []).includes(r)
}

// Perfis que têm uma mesa de trabalho (tarefas que aguardam a sua atuação)
export const PERFIS_COM_MESA = ['gestor', 'fiscal', 'financeiro', 'compras']

// Tela inicial de cada perfil
export function landingFor(role) {
  if (role === 'editor') return '/home'
  const r = normalizeRole(role)
  if (r === 'admin' || PERFIS_COM_MESA.includes(r)) return '/mesa'
  if (r === 'gabinete') return '/gabinete'
  return '/home'
}

// Módulos do sistema. O trilho à esquerda mostra só os módulos do perfil e o menu
// ao lado, só as telas do módulo aberto.
export const MODULOS = {
  mesa:       { label: 'Minha mesa',             curto: 'Mesa',       icon: 'bi-inbox' },
  contratos:  { label: 'Contratações',           curto: 'Contratos',  icon: 'bi-file-earmark-text' },
  financeiro: { label: 'Financeiro',             curto: 'Financeiro', icon: 'bi-cash-coin' },
  licitacoes: { label: 'Processos licitatórios', curto: 'Licitações', icon: 'bi-kanban' },
  gabinete:   { label: 'Gabinete',               curto: 'Gabinete',   icon: 'bi-vector-pen' },
  admin:      { label: 'Administração',          curto: 'Admin',      icon: 'bi-gear' },
}
const ORDEM_MODULOS = {
  compras: ['mesa', 'licitacoes', 'contratos'],
  financeiro: ['mesa', 'financeiro', 'contratos'],
}
const ORDEM_PADRAO = ['mesa', 'contratos', 'financeiro', 'licitacoes', 'gabinete', 'admin']

// Telas de cada módulo por perfil (ordem = ordem no menu)
export function menuFor(role) {
  const r = normalizeRole(role)
  const all = r === 'admin'
  const has = (...p) => all || p.includes(r)
  const item = (to, icon, label) => ({ to, icon, label })
  return {
    mesa: has(...PERFIS_COM_MESA)
      ? [item('/mesa', 'bi-inbox', 'Minha mesa'), item('/alertas', 'bi-bell', 'Alertas e prazos')]
      : [],
    contratos: [
      has('gestor', 'viewer') && item('/gestao', 'bi-speedometer2', 'Painel da gestão'),
      has('compras', 'gestor', 'financeiro', 'viewer') && item('/contratos', 'bi-files', 'Contratações'),
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
    admin: all ? [item('/usuarios', 'bi-people', 'Usuários e perfis'), item('/parametros', 'bi-sliders', 'Parâmetros')] : [],
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
    const item = modulo.itens.find((i) => casa(i.to))
    if (item) return { modulo, item }
  }
  return { modulo: modulos[0] || null, item: null }
}

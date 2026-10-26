// Substitui '@supabase/supabase-js' no modo demonstração (vite.demo.config.js).
// Tudo fica em memória no navegador: recarregar a página volta aos dados de demo/dados.js.
// Reproduz o essencial do banco real: login por perfil, o que cada perfil enxerga
// (gc_pode_ver), colunas calculadas, auditoria e as funções do fluxo.
import * as D from './dados.js'

export const PERFIS = {
  gestor: 'u-gestor', fiscal: 'u-fiscal', substituto: 'u-subst', compras: 'u-compras',
  financeiro: 'u-fin', gabinete: 'u-gab', admin: 'u-admin', viewer: 'u-viewer',
}
const CHAVE = 'licitacrt.demo.perfil'

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)))
const agora = () => new Date().toISOString()
const hoje = () => agora().slice(0, 10)
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`)
const lerPerfil = () => { try { return localStorage.getItem(CHAVE) } catch { return null } }
const gravarPerfil = (v) => { try { localStorage.setItem(CHAVE, v) } catch { /* sem armazenamento */ } }

// valor_liquido é coluna calculada no banco
const comLiquido = (r) => ({ ...r, valor_liquido: (Number(r.nf_valor_bruto ?? r.valor_medido ?? 0) || 0) - (Number(r.glosa_valor) || 0) })

const banco = {
  usuarios: clone(D.USUARIOS),
  processos: clone(D.PROCESSOS),
  gc_contratos: clone(D.CONTRATOS),
  gc_responsaveis: clone(D.RESPONSAVEIS),
  gc_ordens_servico: clone(D.ORDENS),
  gc_competencias: clone(D.COMPETENCIAS).map(comLiquido),
  gc_empenhos: clone(D.EMPENHOS),
  gc_empenho_movs: clone(D.MOVIMENTOS),
  gc_execucoes: clone(D.EXECUCOES),
  gc_eventos: clone(D.EVENTOS),
  gc_ocorrencias: clone(D.OCORRENCIAS),
  gc_documentos: clone(D.DOCUMENTOS),
  gc_pendencias: clone(D.PENDENCIAS),
  gc_parametros: clone(D.PARAMETROS),
  gc_auditoria: clone(D.AUDITORIA),
}

const PADROES = {
  gc_contratos: {
    situacao: 'em_cadastro', valor_inicial: 0, prorrogavel: false, exige_garantia: false, validado_gestao: false,
    instrumento: 'contrato', substituto_em_atuacao: false, execucao_anterior: false, encaminhado_em: null, portaria_status: null,
  },
  gc_responsaveis: { ativo: true },
  gc_ordens_servico: { status: 'solicitada', tipo: 'os' },
  gc_competencias: {
    relatorio_recebido: false, medicao_realizada: false, houve_ocorrencia: false, houve_descumprimento: false,
    nf_recebida: false, certidoes_verificadas: false, doc_trabalhista_ok: false, doc_completa: false,
    houve_glosa: false, atestado: false, liberado_financeiro: false, suspensa: false,
  },
  gc_ocorrencias: { status: 'aberta' },
  gc_pendencias: { status: 'aberta' },
  gc_eventos: { situacao: 'solicitado' },
  processos: { arquivado: false },
}

// ---- sessão --------------------------------------------------------------
// ?tema=escuro|claro (para capturas de tela)
const temaPedido = new URLSearchParams(window.location.search).get('tema')
if (temaPedido) {
  try { localStorage.setItem('app-theme', temaPedido === 'escuro' ? 'dark' : 'light') } catch { /* sem armazenamento */ }
  document.documentElement.setAttribute('data-bs-theme', temaPedido === 'escuro' ? 'dark' : 'light')
}
const pedido = new URLSearchParams(window.location.search).get('perfil')
if (pedido && (PERFIS[pedido] || pedido === 'sair')) gravarPerfil(pedido)
let perfil = lerPerfil() || 'gestor'

const usuarioId = () => PERFIS[perfil] || null
const perfilDoUsuario = () => banco.usuarios.find((u) => u.id === usuarioId())
const papel = () => (perfilDoUsuario()?.ativo ? perfilDoUsuario().role : 'sem_acesso')
const sessao = () => {
  const u = perfilDoUsuario()
  return u ? { access_token: 'demo', user: { id: u.id, email: u.email, user_metadata: { nome: u.nome } } } : null
}
const ouvintes = new Set()
const avisar = (evento) => setTimeout(() => ouvintes.forEach((cb) => cb(evento, sessao())), 0)

// ---- visibilidade (mesmas regras de gc_pode_ver e das políticas de usuarios) ----
function podeVer(contratoId) {
  const r = papel()
  if (r === 'sem_acesso') return false
  if (r === 'fiscal') {
    return banco.gc_responsaveis.some((x) => x.contrato_id === contratoId && x.usuario_id === usuarioId() && x.ativo)
  }
  if (r === 'gabinete') {
    return banco.gc_contratos.some((c) => c.id === contratoId && c.portaria_status === 'aguardando_publicacao')
      || banco.gc_ordens_servico.some((o) => o.contrato_id === contratoId && o.status === 'aguardando_assinatura' && !o.cancelado)
  }
  return true
}
function visivel(tabela, row) {
  if (tabela === 'usuarios') return row.id === usuarioId() || ['gestor', 'admin'].includes(papel())
  if (papel() === 'sem_acesso') return false
  if (tabela === 'gc_contratos') return podeVer(row.id)
  if (tabela.startsWith('gc_') && 'contrato_id' in row) return podeVer(row.contrato_id)
  return true
}

function auditar(tabela, acao, antes, depois) {
  if (!tabela.startsWith('gc_') || tabela === 'gc_auditoria' || tabela === 'gc_parametros') return
  const linha = depois || antes
  banco.gc_auditoria.push({
    id: banco.gc_auditoria.length + 1, em: agora(), tabela, registro_id: linha.id,
    contrato_id: tabela === 'gc_contratos' ? linha.id : linha.contrato_id, acao,
    usuario_id: usuarioId(), usuario_nome: perfilDoUsuario()?.nome, antes: clone(antes), depois: clone(depois),
  })
}

function novaLinha(tabela, valores) {
  const base = { id: novoId(), created_at: agora(), updated_at: agora(), created_by: usuarioId() }
  if (tabela.startsWith('gc_')) base.cancelado = false
  if (tabela === 'gc_contratos') base.id_interno = Math.max(0, ...banco.gc_contratos.map((c) => c.id_interno || 0)) + 1
  if (tabela === 'gc_ordens_servico') base.data_solicitacao = hoje()
  if (tabela === 'gc_ocorrencias') base.data = hoje()
  const linha = { ...base, ...(PADROES[tabela] || {}), ...valores }
  return tabela === 'gc_competencias' ? comLiquido(linha) : linha
}

const erro = (message, code) => ({ data: null, error: { message, code } })
const espera = () => new Promise((r) => setTimeout(r, 80))

// ---- consultas -------------------------------------------------------------
class Consulta {
  constructor(tabela) {
    this.tabela = tabela
    this.acao = 'select'
    this.filtros = []
  }
  select() { return this }
  insert(v) { this.acao = 'insert'; this.valores = [].concat(v); return this }
  upsert(v) { this.acao = 'upsert'; this.valores = [].concat(v); return this }
  update(v) { this.acao = 'update'; this.valores = v; return this }
  delete() { this.acao = 'delete'; return this }
  eq(c, v) { this.filtros.push((r) => r[c] === v); return this }
  neq(c, v) { this.filtros.push((r) => r[c] !== v); return this }
  in(c, lista) { this.filtros.push((r) => lista.includes(r[c])); return this }
  is(c, v) { this.filtros.push((r) => (r[c] ?? null) === v); return this }
  order(c, { ascending = true } = {}) { this.ordem = { c, ascending }; return this }
  range(a, b) { this.faixa = [a, b]; return this }
  limit(n) { this.limite = n; return this }
  single() { this.um = 'single'; return this }
  maybeSingle() { this.um = 'talvez'; return this }
  then(ok, falha) { return this.executar().then(ok, falha) }

  async executar() {
    await espera()
    const t = banco[this.tabela]
    if (!t) return erro(`Tabela ${this.tabela} não existe na demonstração`, 'PGRST205')
    const passa = (r) => visivel(this.tabela, r) && this.filtros.every((f) => f(r))
    let linhas

    if (this.acao === 'select') {
      linhas = t.filter(passa)
    } else if (this.acao === 'insert') {
      linhas = this.valores.map((v) => novaLinha(this.tabela, v))
      t.push(...linhas)
      linhas.forEach((l) => auditar(this.tabela, 'INSERT', null, l))
    } else if (this.acao === 'update') {
      linhas = t.filter(passa)
      if (!linhas.length) return erro('Registro não encontrado ou sem permissão (new row violates row-level security)', '42501')
      for (const r of linhas) {
        const antes = clone(r)
        Object.assign(r, this.valores, { updated_at: agora(), updated_by: usuarioId() })
        if (this.tabela === 'gc_competencias') Object.assign(r, comLiquido(r))
        auditar(this.tabela, 'UPDATE', antes, r)
      }
    } else if (this.acao === 'upsert') {
      const chave = this.tabela === 'gc_parametros' ? 'chave' : 'id'
      linhas = this.valores.map((v) => {
        const existente = t.find((r) => r[chave] === v[chave])
        if (existente) return Object.assign(existente, v)
        const nova = this.tabela === 'gc_parametros' ? { ...v } : novaLinha(this.tabela, v)
        t.push(nova)
        return nova
      })
    } else if (this.acao === 'delete') {
      if (this.tabela.startsWith('gc_')) return erro('Registros da gestão contratual não podem ser excluídos: cancele com justificativa.', 'P0001')
      linhas = t.filter(passa)
      for (const r of linhas) t.splice(t.indexOf(r), 1)
    }

    if (this.ordem) {
      const { c, ascending } = this.ordem
      linhas = [...linhas].sort((a, b) => (String(a[c] ?? '') < String(b[c] ?? '') ? -1 : String(a[c] ?? '') > String(b[c] ?? '') ? 1 : 0) * (ascending ? 1 : -1))
    }
    if (this.faixa) linhas = linhas.slice(this.faixa[0], this.faixa[1] + 1)
    if (this.limite) linhas = linhas.slice(0, this.limite)
    linhas = clone(linhas)

    if (this.um) {
      if (linhas.length) return { data: linhas[0], error: null }
      return this.um === 'talvez' ? { data: null, error: null } : erro('Nenhuma linha encontrada', 'PGRST116')
    }
    return { data: linhas, error: null }
  }
}

// ---- funções do fluxo (mesmas regras das RPCs do banco, simplificadas) ----
const achar = (tabela, id) => banco[tabela].find((r) => r.id === id && !r.cancelado)
const exigir = (cond, msg) => { if (!cond) throw new Error(msg) }
const atualizar = (tabela, linha, valores) => {
  const antes = clone(linha)
  Object.assign(linha, valores, { updated_at: agora(), updated_by: usuarioId() })
  auditar(tabela, 'UPDATE', antes, linha)
}

const RPC = {
  // senha provisória: na demonstração ninguém precisa trocar a senha
  gc_precisa_trocar_senha: () => false,
  gc_marcar_senha_provisoria: () => null,
  gc_senha_trocada: () => null,
  gc_encaminhar_contratacao({ p_contrato, p_tipo_ordem = 'os' }) {
    exigir(['compras', 'admin'].includes(papel()), 'Somente Compras encaminha a contratação à Gestão.')
    const c = achar('gc_contratos', p_contrato)
    exigir(c, 'Contratação não encontrada.')
    exigir(!c.encaminhado_em, 'Contratação já encaminhada à Gestão.')
    atualizar('gc_contratos', c, { encaminhado_em: agora(), encaminhado_por: usuarioId() })
    banco.gc_pendencias.push(novaLinha('gc_pendencias', {
      contrato_id: c.id, descricao: 'Designar fiscal titular e fiscal substituto (solicitado por Compras)',
      prazo: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), perfil_responsavel: 'gestor',
    }))
    banco.gc_ordens_servico.push(novaLinha('gc_ordens_servico', {
      contrato_id: c.id, tipo: p_tipo_ordem, solicitante_id: usuarioId(), solicitante_nome: perfilDoUsuario()?.nome,
      sei_processo: c.sei_processo, observacoes: 'Solicitação gerada no encaminhamento da contratação por Compras.',
    }))
  },
  gc_registrar_publicacao_portaria({ p_contrato, p_numero, p_data, p_publicacao_data, p_publicacao_meio, p_sei, p_link }) {
    exigir(['gestor', 'gabinete', 'admin'].includes(papel()), 'Somente a Gestão ou o Gabinete registra a publicação da portaria.')
    const c = achar('gc_contratos', p_contrato)
    exigir(c, 'Contratação não encontrada.')
    exigir(papel() !== 'gabinete' || c.portaria_status === 'aguardando_publicacao', 'Esta portaria não está aguardando publicação.')
    atualizar('gc_contratos', c, {
      portaria_numero: p_numero, portaria_data: p_data, portaria_publicacao_data: p_publicacao_data,
      portaria_publicacao_meio: p_publicacao_meio ?? null, portaria_sei: p_sei || c.portaria_sei,
      portaria_sei_link: p_link || c.portaria_sei_link, portaria_status: 'publicada',
    })
  },
  gc_registrar_assinatura_os({ p_os, p_presidente, p_diretor, p_sei, p_link }) {
    exigir(['gestor', 'gabinete', 'admin'].includes(papel()), 'Somente a Gestão ou o Gabinete registra as assinaturas.')
    const o = achar('gc_ordens_servico', p_os)
    exigir(o && o.status === 'aguardando_assinatura', 'Esta OS/OC não está aguardando assinatura.')
    const presidente = p_presidente || o.assinatura_presidente_em
    const diretor = p_diretor || o.assinatura_diretor_em
    atualizar('gc_ordens_servico', o, {
      assinatura_presidente_em: presidente, assinatura_diretor_em: diretor,
      sei_documento: p_sei || o.sei_documento, sei_link: p_link || o.sei_link,
      status: presidente && diretor ? 'emitida' : o.status,
    })
  },
  gc_definir_substituto_em_atuacao({ p_contrato, p_ativo }) {
    const designado = banco.gc_responsaveis.some((r) => r.contrato_id === p_contrato && r.usuario_id === usuarioId() && r.ativo
      && ['fiscal_tecnico', 'fiscal_substituto'].includes(r.papel))
    exigir(['gestor', 'admin'].includes(papel()) || (papel() === 'fiscal' && designado), 'Somente a Gestão ou os fiscais da contratação alteram o fiscal em atuação.')
    exigir(!p_ativo || banco.gc_responsaveis.some((r) => r.contrato_id === p_contrato && r.ativo && r.papel === 'fiscal_substituto'),
      'Não há fiscal substituto designado nesta contratação.')
    atualizar('gc_contratos', achar('gc_contratos', p_contrato), { substituto_em_atuacao: p_ativo, substituto_desde: p_ativo ? hoje() : null })
  },
}

// ---- cliente ----------------------------------------------------------------
export function createClient() {
  return {
    from: (tabela) => new Consulta(tabela),
    // Realtime: na demonstração os dados vivem só neste navegador, então não há o que escutar
    channel() {
      const canal = { on: () => canal, subscribe: () => canal }
      return canal
    },
    removeChannel: () => {},
    async rpc(funcao, args) {
      await espera()
      if (!RPC[funcao]) return erro(`Função ${funcao} indisponível na demonstração`)
      try {
        return { data: RPC[funcao](args || {}) ?? null, error: null }
      } catch (e) {
        return erro(e.message, 'P0001')
      }
    },
    functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
    auth: {
      getSession: async () => ({ data: { session: sessao() }, error: null }),
      onAuthStateChange(cb) {
        ouvintes.add(cb)
        return { data: { subscription: { unsubscribe: () => ouvintes.delete(cb) } } }
      },
      async signInWithPassword({ email }) {
        await espera()
        const u = banco.usuarios.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase())
        const chave = u && Object.keys(PERFIS).find((k) => PERFIS[k] === u.id)
        if (!chave) return erro('Invalid login credentials')
        perfil = chave
        gravarPerfil(chave)
        if (window.__demoSel) window.__demoSel.value = chave
        avisar('SIGNED_IN')
        return { data: sessao(), error: null }
      },
      async signOut() {
        perfil = 'sair'
        gravarPerfil('sair')
        if (window.__demoSel) window.__demoSel.value = 'sair'
        avisar('SIGNED_OUT')
        return { error: null }
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: { user: sessao()?.user }, error: null }),
      signUp: async ({ email }) => ({ data: { user: { id: novoId(), email, identities: [{ provider: 'email' }] } }, error: null }),
    },
    storage: {
      from: () => ({
        upload: async (path) => ({ data: { path }, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: 'about:blank' }, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  }
}

// ---- faixa "Demonstração" com troca de perfil (oculta com ?captura) ----
function faixa() {
  if (new URLSearchParams(window.location.search).has('captura')) return
  const el = document.createElement('div')
  el.setAttribute('style', [
    'position:fixed', 'left:12px', 'bottom:12px', 'z-index:3000', 'display:flex', 'gap:8px', 'align-items:center',
    'padding:6px 8px 6px 10px', 'border-radius:6px', 'background:#1f2328', 'color:#fff',
    'font:600 11px/1.2 system-ui,sans-serif', 'letter-spacing:.04em', 'box-shadow:0 4px 14px rgba(0,0,0,.25)',
  ].join(';'))
  el.textContent = 'DEMONSTRAÇÃO · DADOS FICTÍCIOS'
  const sel = document.createElement('select')
  sel.setAttribute('aria-label', 'Perfil da demonstração')
  sel.setAttribute('style', 'font:12px system-ui,sans-serif;border-radius:4px;border:0;padding:2px 4px')
  const nomes = { gestor: 'Gestão', fiscal: 'Fiscal titular', substituto: 'Fiscal substituto', compras: 'Compras', financeiro: 'Financeiro', gabinete: 'Gabinete', admin: 'Administrador', viewer: 'Visualizador', sair: '(deslogado)' }
  for (const k of [...Object.keys(PERFIS), 'sair']) sel.add(new Option(nomes[k], k))
  sel.value = perfil
  // troca de perfil sem recarregar: os dados já lançados na demonstração continuam
  sel.onchange = () => {
    perfil = sel.value
    gravarPerfil(perfil)
    avisar(perfil === 'sair' ? 'SIGNED_OUT' : 'SIGNED_IN')
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  el.append(sel)
  el.dataset.seletor = '1'
  document.body.append(el)
  window.__demoSel = sel
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', faixa)
else faixa()

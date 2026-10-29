// Substitui '@supabase/supabase-js' no modo demonstração (vite.demo.config.js).
// Tudo fica em memória no navegador: recarregar a página volta aos dados de demo/dados.js.
// Reproduz o essencial do banco real: login por perfil, o que cada perfil enxerga
// (gc_pode_ver), colunas calculadas, auditoria e as funções do fluxo.
import * as D from './dados.js'

export const PERFIS = {
  secretario: 'u-sec', secretario2: 'u-sec2', gestor: 'u-gestor', fiscal: 'u-fiscal', substituto: 'u-subst', compras: 'u-compras',
  financeiro: 'u-fin', gabinete: 'u-gab', juridico: 'u-jur', administrativo: 'u-adm', rh: 'u-rh', ti: 'u-ti',
  admin: 'u-admin', presidente: 'u-pres', viewer: 'u-viewer',
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
  tr_unidades: clone(D.UNIDADES),
  tr_processos: clone(D.TR_PROCESSOS),
  tr_tramitacoes: clone(D.TR_TRAMITACOES),
  doc_documentos: clone(D.DOC_DOCUMENTOS),
  doc_assinaturas: clone(D.DOC_ASSINATURAS),
  cp_solicitacoes: clone(D.CP_SOLICITACOES),
  cp_eventos: clone(D.CP_EVENTOS),
  cp_checklist: clone(D.CP_CHECKLIST),
  cp_itens: clone(D.CP_ITENS),
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
  tr_unidades: { ativa: true },
  cp_itens: { ativo: true, unidade_medida: 'unidade' },
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
// como gc_role() no banco: o presidente vale como administrador nas regras de acesso
const papel = () => {
  const u = perfilDoUsuario()
  return u?.ativo ? (u.role === 'presidente' ? 'admin' : u.role) : 'sem_acesso'
}
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
  // RH, TI e Administrativo não veem contratações nem processos licitatórios (como no banco)
  if (['rh', 'ti', 'administrativo', 'secretario'].includes(papel()) && (tabela === 'processos' || (tabela.startsWith('gc_') && tabela !== 'gc_parametros'))) return false
  if (tabela === 'doc_documentos') return docPodeVer(row.id)
  if (tabela === 'doc_assinaturas') return docPodeVer(row.documento_id)
  if (tabela === 'tr_processos') return trPodeVer(row.id)
  if (tabela === 'tr_tramitacoes') return trPodeVer(row.processo_id)
  if (tabela === 'cp_solicitacoes') return cpPodeVer(row)
  if (tabela === 'cp_eventos') return cpPodeVer(banco.cp_solicitacoes.find((s) => s.id === row.solicitacao_id))
  if (tabela === 'cp_checklist') return trPodeVer(row.processo_id)
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
    if (['cp_itens', 'tr_unidades'].includes(this.tabela) && this.acao !== 'select' && papel() !== 'admin') {
      return erro('new row violates row-level security policy', '42501')
    }
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

// ---- tramitação de processos (mesmas regras de tr_pode_ver, tr_pode_atuar e das funções tr_*) ----
const unidadeDoUsuario = () => perfilDoUsuario()?.unidade_id || null
const nomeDe = (id) => banco.usuarios.find((u) => u.id === id)?.nome || null
function trPodeVer(id) {
  const r = papel()
  if (r === 'sem_acesso') return false
  if (['admin', 'gestor', 'gabinete', 'viewer'].includes(r)) return true
  const p = banco.tr_processos.find((x) => x.id === id)
  const u = unidadeDoUsuario()
  if (!p) return false
  return p.aberto_por === usuarioId() || p.responsavel_atual === usuarioId() || (!!u && p.unidade_atual === u)
    || banco.tr_tramitacoes.some((t) => t.processo_id === id && (t.criada_por === usuarioId() || t.para_usuario === usuarioId()
      || (!!u && (t.de_unidade === u || t.para_unidade === u))))
}
const trProcesso = (id) => {
  const p = banco.tr_processos.find((x) => x.id === id)
  exigir(p, 'Processo não encontrado.')
  return p
}
const trAtuar = (p, acao) => exigir(papel() === 'admin' || (!['viewer', 'sem_acesso'].includes(papel())
  && (p.responsavel_atual === usuarioId() || (!!unidadeDoUsuario() && p.unidade_atual === unidadeDoUsuario()))),
`Somente a unidade onde o processo está pode ${acao}.`)
const unidadeAtiva = (id) => banco.tr_unidades.some((u) => u.id === id && u.ativa)
function movimento(p, campos) {
  banco.tr_tramitacoes.push({
    id: banco.tr_tramitacoes.length + 1, processo_id: p.id, criada_em: agora(), criada_por: usuarioId(), criada_por_nome: nomeDe(usuarioId()),
    de_unidade: null, para_unidade: null, para_usuario: null, para_usuario_nome: null, despacho: null, prazo: null, ...campos,
  })
}
const texto = (v) => String(v ?? '').trim()

// ---- documentos e assinatura eletrônica (mesmas regras das funções doc_*) ----
const docEditor = (d) => d.status === 'rascunho' && !['viewer', 'sem_acesso'].includes(papel())
  && (papel() === 'admin' || d.criado_por === usuarioId() || (!!unidadeDoUsuario() && d.unidade_id === unidadeDoUsuario()))
function docPodeVer(id) {
  const d = banco.doc_documentos.find((x) => x.id === id)
  if (!d || papel() === 'sem_acesso') return false
  return papel() === 'admin' || d.criado_por === usuarioId() || banco.doc_assinaturas.some((a) => a.documento_id === id && a.usuario_id === usuarioId())
    || (!!unidadeDoUsuario() && d.unidade_id === unidadeDoUsuario()) || (!!d.processo_id && trPodeVer(d.processo_id))
    || banco.cp_solicitacoes.some((s) => s.documento_id === id && cpPodeVer(s))
}
// resumo do conteúdo (na demonstração não há SHA-256 de verdade: é só uma impressão digital para a conferência funcionar)
const impressao = (d) => {
  const base = `${d.numero}\n${d.titulo}\n${JSON.stringify(d.corpo)}`
  let hex = ''
  for (let seed = 0; seed < 8; seed += 1) {
    let h = 2166136261 ^ seed
    for (let i = 0; i < base.length; i += 1) { h ^= base.charCodeAt(i); h = Math.imul(h, 16777619) }
    hex += (h >>> 0).toString(16).padStart(8, '0')
  }
  return hex
}
const docDoId = (id) => {
  const d = banco.doc_documentos.find((x) => x.id === id)
  exigir(d, 'Documento não encontrado.')
  return d
}
const logDoc = (d, textoLog) => { if (d.processo_id) { const p = banco.tr_processos.find((x) => x.id === d.processo_id); if (p) movimento(p, { tipo: 'documento', para_unidade: p.unidade_atual, despacho: textoLog }) } }
const contadores = {}

const corpoArquivo = (titulo, descricao, arq) => [
  { t: 'titulo', x: texto(titulo) }, { t: 'p', x: texto(descricao) || 'Documento enviado como arquivo.' },
  { t: 'arquivo', nome: arq.nome, tipo: arq.tipo, tamanho: arq.tamanho, sha256: String(arq.sha256).toLowerCase() },
]
// arquivos enviados na demonstração ficam na memória do navegador
const arquivos = new Map()

const RPC_DOC = {
  doc_criar_arquivo({ p_titulo, p_descricao, p_processo, p_path, p_nome, p_tipo, p_tamanho, p_sha256 }) {
    exigir(!['viewer', 'sem_acesso'].includes(papel()), 'Seu perfil não pode enviar documentos.')
    exigir(texto(p_titulo).length >= 3, 'Informe o título do documento.')
    exigir(String(p_path || '').split('/')[0] === usuarioId(), 'Arquivo inválido.')
    exigir(/^[0-9a-f]{64}$/.test(String(p_sha256 || '').toLowerCase()), 'Código do arquivo inválido.')
    exigir(p_tamanho > 0 && p_tamanho <= 20 * 1024 * 1024, 'O arquivo deve ter até 20 MB.')
    exigir(!p_processo || trPodeVer(p_processo), 'Você não tem acesso a este processo.')
    const chave = `ANX-${new Date().getFullYear()}`
    contadores[chave] = (contadores[chave] || 0) + 1
    const d = {
      id: novoId(), numero: `${chave}/${String(contadores[chave]).padStart(6, '0')}`, sigla: 'ANX', modelo: 'arquivo', modelo_versao: 1,
      titulo: texto(p_titulo), processo_id: p_processo || null, unidade_id: unidadeDoUsuario(), conteudo: { descricao: texto(p_descricao) || null },
      corpo: corpoArquivo(p_titulo, p_descricao, { nome: p_nome, tipo: p_tipo, tamanho: p_tamanho, sha256: p_sha256 }), arquivo_path: p_path,
      status: 'rascunho', versao: 1, hash: null, codigo_verificacao: null, criado_por: usuarioId(), criado_por_nome: nomeDe(usuarioId()),
      criado_em: agora(), atualizado_em: agora(), assinado_em: null, cancelado_em: null, motivo_cancelamento: null,
    }
    banco.doc_documentos.push(d)
    logDoc(d, `Arquivo ${p_nome} juntado ao processo.`)
    return d.id
  },
  doc_encaminhar({ p_id, p_unidade, p_despacho }) {
    const d = docDoId(p_id)
    exigir(docPodeVer(p_id), 'Documento não encontrado.')
    exigir(!['viewer', 'sem_acesso'].includes(papel()), 'Seu perfil não pode encaminhar documentos.')
    exigir(d.status === 'assinado', 'Só um documento assinado pode ser encaminhado.')
    exigir(unidadeAtiva(p_unidade), 'Unidade de destino inexistente ou inativa.')
    exigir(texto(p_despacho).length >= 3, 'Escreva o despacho: o que a unidade deve fazer.')
    if (d.processo_id) {
      RPC.tr_tramitar({ p_id: d.processo_id, p_unidade_destino: p_unidade, p_usuario_destino: null, p_despacho, p_prazo: null })
      return d.processo_id
    }
    const origem = unidadeDoUsuario()
    exigir(origem || papel() === 'admin', 'Peça ao administrador para definir a sua unidade antes de encaminhar documentos.')
    exigir(p_unidade !== origem, 'O documento já está nesta unidade.')
    const un = banco.tr_unidades.find((u) => u.id === origem)
    const p = {
      id: novoId(), numero: `${new Date().getFullYear()}/${String(banco.tr_processos.length + 1).padStart(6, '0')}`,
      tipo: 'Comunicação oficial', assunto: texto(d.conteudo?.assunto) || d.titulo, interessado: un ? `${un.sigla} — ${un.nome}` : null, descricao: null,
      prioridade: 'normal', prazo: null, situacao: 'em_andamento', unidade_atual: p_unidade, responsavel_atual: null, responsavel_nome: null,
      desde: agora(), recebido_em: null, aberto_por: usuarioId(), aberto_por_nome: nomeDe(usuarioId()), aberto_em: agora(),
      concluido_em: null, motivo_conclusao: null, updated_at: agora(),
    }
    banco.tr_processos.push(p)
    movimento(p, { tipo: 'abertura', de_unidade: origem, para_unidade: p_unidade, despacho: texto(p_despacho) })
    d.processo_id = p.id
    logDoc(d, `Documento ${d.numero} encaminhado.`)
    return p.id
  },
  doc_criar({ p_sigla, p_modelo, p_modelo_versao, p_titulo, p_processo, p_conteudo, p_corpo }) {
    exigir(!['viewer', 'sem_acesso'].includes(papel()), 'Seu perfil não pode criar documentos.')
    exigir(/^[A-Z0-9]{2,8}$/.test(p_sigla || '') && /^[a-z0-9-]{2,60}$/.test(p_modelo || ''), 'Modelo inválido.')
    exigir(p_modelo !== 'arquivo', 'Use o envio de arquivo para juntar um documento de fora.')
    exigir(p_modelo !== 'dfd' || ['secretario', 'admin'].includes(papel()), 'Somente o secretário cria a DFD da sua secretaria.')
    exigir(texto(p_titulo).length >= 3, 'Informe o título do documento.')
    exigir(!p_processo || trPodeVer(p_processo), 'Você não tem acesso a este processo.')
    const chave = `${p_sigla}-${new Date().getFullYear()}`
    contadores[chave] = (contadores[chave] || 0) + 1
    const d = {
      id: novoId(), numero: `${chave}/${String(contadores[chave]).padStart(6, '0')}`, sigla: p_sigla, modelo: p_modelo, modelo_versao: p_modelo_versao || 1,
      titulo: texto(p_titulo), processo_id: p_processo || null, unidade_id: unidadeDoUsuario(), conteudo: p_conteudo || {}, corpo: p_corpo || [],
      status: 'rascunho', versao: 1, hash: null, codigo_verificacao: null, criado_por: usuarioId(), criado_por_nome: nomeDe(usuarioId()),
      criado_em: agora(), atualizado_em: agora(), assinado_em: null, cancelado_em: null, motivo_cancelamento: null,
    }
    banco.doc_documentos.push(d)
    return d.id
  },
  doc_salvar({ p_id, p_titulo, p_conteudo, p_corpo }) {
    const d = docDoId(p_id)
    exigir(docEditor(d), 'Este documento não pode mais ser editado por você.')
    exigir(texto(p_titulo).length >= 3, 'Informe o título do documento.')
    if (d.modelo === 'arquivo') {
      const arq = d.corpo.find((b) => b.t === 'arquivo')
      Object.assign(d, { titulo: texto(p_titulo), conteudo: { descricao: p_conteudo?.descricao || null }, corpo: corpoArquivo(p_titulo, p_conteudo?.descricao, arq), atualizado_em: agora() })
      return
    }
    Object.assign(d, { titulo: texto(p_titulo), conteudo: p_conteudo || {}, corpo: p_corpo || [], atualizado_em: agora() })
  },
  doc_enviar_assinatura({ p_id, p_signatarios }) {
    const d = docDoId(p_id)
    exigir(docEditor(d), 'Este documento não pode ser enviado para assinatura por você.')
    exigir(Array.isArray(d.corpo) && d.corpo.length > 0, 'O documento está vazio. Preencha antes de enviar.')
    exigir(Array.isArray(p_signatarios) && p_signatarios.length >= 1 && p_signatarios.length <= 10, 'Escolha de 1 a 10 pessoas para assinar.')
    exigir(new Set(p_signatarios.map((s) => s.usuario_id)).size === p_signatarios.length, 'A mesma pessoa foi escolhida mais de uma vez.')
    for (const s of p_signatarios) {
      const u = banco.usuarios.find((x) => x.id === s.usuario_id)
      exigir(u && u.ativo && u.role !== 'viewer', 'Uma das pessoas escolhidas não pode assinar (inativa ou só consulta).')
      exigir(texto(s.papel), 'Informe o papel de cada assinante.')
    }
    d.status = 'aguardando_assinatura'
    d.hash = impressao(d)
    d.codigo_verificacao = d.codigo_verificacao || novoId().replace(/-/g, '').slice(0, 12).toUpperCase()
    d.atualizado_em = agora()
    p_signatarios.forEach((s, i) => banco.doc_assinaturas.push({
      id: banco.doc_assinaturas.length + 1, documento_id: d.id, versao: d.versao, ordem: i + 1, papel: texto(s.papel), usuario_id: s.usuario_id,
      nome: nomeDe(s.usuario_id), status: 'pendente', assinada_em: null, hash: null, ip: null, agente: null, metodo: null, motivo_recusa: null,
    }))
    logDoc(d, `Documento ${d.numero} enviado para assinatura.`)
  },
  doc_assinar({ p_id }) {
    const d = docDoId(p_id)
    exigir(d.status === 'aguardando_assinatura', 'Este documento não está aguardando assinatura.')
    const a = banco.doc_assinaturas.find((x) => x.documento_id === p_id && x.versao === d.versao && x.usuario_id === usuarioId() && x.status === 'pendente')
    exigir(a, 'Você não tem assinatura pendente neste documento.')
    exigir(d.hash === impressao(d), 'O conteúdo do documento não confere com o que foi enviado para assinatura. Assinatura recusada.')
    Object.assign(a, { status: 'assinada', assinada_em: agora(), hash: d.hash, ip: '127.0.0.1', agente: 'Demonstração', metodo: 'senha reconfirmada (assinatura eletrônica avançada)' })
    if (!banco.doc_assinaturas.some((x) => x.documento_id === p_id && x.versao === d.versao && x.status === 'pendente')) {
      Object.assign(d, { status: 'assinado', assinado_em: agora(), atualizado_em: agora() })
      logDoc(d, `Documento ${d.numero} assinado por todos os signatários.`)
    } else logDoc(d, `Documento ${d.numero} assinado por ${a.nome}.`)
  },
  doc_recusar({ p_id, p_motivo }) {
    const d = docDoId(p_id)
    exigir(d.status === 'aguardando_assinatura', 'Este documento não está aguardando assinatura.')
    const a = banco.doc_assinaturas.find((x) => x.documento_id === p_id && x.versao === d.versao && x.usuario_id === usuarioId() && x.status === 'pendente')
    exigir(a, 'Você não tem assinatura pendente neste documento.')
    exigir(texto(p_motivo).length >= 3, 'Informe o motivo da recusa.')
    Object.assign(a, { status: 'recusada', motivo_recusa: texto(p_motivo) })
    banco.doc_assinaturas.filter((x) => x.documento_id === p_id && x.versao === d.versao && x.status === 'pendente').forEach((x) => { x.status = 'cancelada' })
    Object.assign(d, { status: 'rascunho', versao: d.versao + 1, hash: null, atualizado_em: agora() })
    logDoc(d, `Assinatura do documento ${d.numero} recusada: ${texto(p_motivo)}`)
  },
  doc_cancelar({ p_id, p_motivo }) {
    const d = docDoId(p_id)
    exigir(papel() === 'admin' || d.criado_por === usuarioId(), 'Só quem criou o documento (ou a administração) pode cancelá-lo.')
    exigir(d.status !== 'cancelado', 'O documento já está cancelado.')
    exigir(texto(p_motivo).length >= 3, 'Informe o motivo do cancelamento.')
    banco.doc_assinaturas.filter((x) => x.documento_id === p_id && x.status === 'pendente').forEach((x) => { x.status = 'cancelada' })
    Object.assign(d, { status: 'cancelado', cancelado_em: agora(), motivo_cancelamento: texto(p_motivo), atualizado_em: agora() })
    logDoc(d, `Documento ${d.numero} cancelado: ${texto(p_motivo)}`)
  },
  doc_verificar({ p_codigo }) {
    const limpo = String(p_codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const d = banco.doc_documentos.find((x) => x.codigo_verificacao === limpo)
    if (!d) return { encontrado: false }
    return {
      encontrado: true, numero: d.numero, situacao: d.status, assinado_em: d.assinado_em, cancelado_em: d.cancelado_em, hash: d.hash,
      integro: !!d.hash && d.hash === impressao(d),
      assinaturas: banco.doc_assinaturas.filter((a) => a.documento_id === d.id && a.versao === d.versao && ['assinada', 'pendente'].includes(a.status))
        .map((a) => ({ nome: a.nome, papel: a.papel, situacao: a.status, assinada_em: a.assinada_em })),
    }
  },
  doc_pessoas() {
    if (['viewer', 'sem_acesso'].includes(papel())) return []
    return banco.usuarios.filter((u) => u.ativo && u.role !== 'viewer').map((u) => ({ id: u.id, nome: u.nome, role: u.role, unidade_id: u.unidade_id }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  },
  tr_definir_contratacao({ p_id, p_modalidade, p_objeto }) {
    const p = trProcesso(p_id)
    trAtuar(p, 'alterá-lo')
    exigir(!p_modalidade || ['pregao', 'concorrencia', 'dispensa', 'inexigibilidade', 'adesao-ata'].includes(p_modalidade), 'Forma de contratação inválida.')
    exigir(!p_objeto || ['bens-consumo', 'bens-permanentes', 'servicos-comuns', 'servicos-continuos-demo', 'tic', 'obras-engenharia', 'locacao'].includes(p_objeto), 'Tipo de objeto inválido.')
    Object.assign(p, { contratacao_modalidade: p_modalidade || null, contratacao_objeto: p_objeto || null, updated_at: agora() })
    movimento(p, { tipo: 'alteracao', para_unidade: p.unidade_atual, despacho: `Tipo de contratação definido: ${p_modalidade || '—'} / ${p_objeto || '—'}.` })
  },
}

// ---- solicitações ao Compras e processos de contratação (mesmas regras das funções cp_*) ----
function cpPodeVer(s) {
  if (!s || papel() === 'sem_acesso') return false
  return ['admin', 'compras', 'gestor', 'gabinete', 'viewer'].includes(papel()) || s.solicitante === usuarioId()
    || (!!unidadeDoUsuario() && s.unidade_id === unidadeDoUsuario())
}
const cpEditar = (s) => !['viewer', 'sem_acesso'].includes(papel())
  && (papel() === 'admin' || s.solicitante === usuarioId() || (!!unidadeDoUsuario() && s.unidade_id === unidadeDoUsuario()))
const cpSol = (id) => {
  const s = banco.cp_solicitacoes.find((x) => x.id === id)
  exigir(s, 'Solicitação não encontrada.')
  return s
}
const cpEvento = (s, tipo, txt) => banco.cp_eventos.push({
  id: banco.cp_eventos.length + 1, solicitacao_id: s.id, tipo, texto: texto(txt) || null, criada_por: usuarioId(), criada_por_nome: nomeDe(usuarioId()), criada_em: agora(),
})
const cpCompras = () => exigir(['compras', 'admin'].includes(papel()), 'Somente o Compras analisa solicitações e abre processos de contratação.')
const MODALIDADES_CP = ['pregao', 'concorrencia', 'dispensa', 'inexigibilidade', 'adesao-ata']
const OBJETOS_CP = ['bens-consumo', 'bens-permanentes', 'servicos-comuns', 'servicos-continuos-demo', 'tic', 'obras-engenharia', 'locacao']
const TIPO_QUADRO = { pregao: 'Pregao', concorrencia: 'Concorrencia', dispensa: 'Dispensa', inexigibilidade: 'Inexigibilidade', 'adesao-ata': 'ARP' }
const MODALIDADE_QUADRO = { pregao: 'Pregão', concorrencia: 'Concorrência', dispensa: 'Dispensa', inexigibilidade: 'Inexigibilidade', 'adesao-ata': 'Adesão a ata' }
let contadorSol = 0

function cpValidar(id, a) {
  exigir(['dfd', 'solicitacao'].includes(a.p_tipo), 'Tipo de solicitação inválido.')
  exigir(texto(a.p_objeto).length >= 5, 'Descreva o que precisa ser contratado.')
  exigir(texto(a.p_justificativa).length >= 10, 'Explique por que a contratação é necessária.')
  exigir(['baixa', 'normal', 'alta', 'urgente'].includes(a.p_prioridade || 'normal'), 'Prioridade inválida.')
  exigir(!a.p_objeto_tipo || OBJETOS_CP.includes(a.p_objeto_tipo), 'Tipo de objeto inválido.')
  exigir(a.p_valor_estimado == null || a.p_valor_estimado >= 0, 'O valor estimado não pode ser negativo.')
  if (a.p_tipo === 'dfd') {
    exigir(a.p_documento, 'Escolha o DFD assinado que acompanha a solicitação.')
    const d = banco.doc_documentos.find((x) => x.id === a.p_documento)
    exigir(d && docPodeVer(d.id), 'DFD não encontrado.')
    exigir(d.modelo === 'dfd', 'O documento escolhido não é um DFD.')
    exigir(d.status === 'assinado', 'O DFD precisa estar assinado antes de ser enviado ao Compras.')
    exigir(!d.processo_id, 'Este DFD já faz parte de um processo.')
    exigir(!banco.cp_solicitacoes.some((s) => s.documento_id === d.id && s.id !== id && ['enviada', 'devolvida', 'aceita'].includes(s.status)), 'Este DFD já foi enviado em outra solicitação.')
  } else exigir(!a.p_documento, 'Solicitação simples não leva DFD: escolha "Com DFD".')
}
const camposSol = (a) => ({
  tipo: a.p_tipo, documento_id: a.p_documento || null, objeto: texto(a.p_objeto), quantidade: texto(a.p_quantidade) || null,
  justificativa: texto(a.p_justificativa), objeto_tipo: a.p_objeto_tipo || null, valor_estimado: a.p_valor_estimado ?? null,
  data_pretendida: a.p_data_pretendida || null, prioridade: a.p_prioridade || 'normal', previsto_pca: a.p_previsto_pca || null,
})

function cpCriarProcesso({ objeto, unidade, descricao, modalidade, objetoTipo, prioridade, prazo, valor, despacho }) {
  const compras = unidadeDoUsuario() || (papel() === 'admin' ? banco.tr_unidades.find((u) => u.sigla === 'COMP')?.id : null)
  exigir(compras, 'Peça ao administrador para definir a sua unidade antes de abrir processos.')
  exigir(MODALIDADES_CP.includes(modalidade), 'Escolha a forma de contratação.')
  exigir(!objetoTipo || OBJETOS_CP.includes(objetoTipo), 'Tipo de objeto inválido.')
  const dem = banco.tr_unidades.find((u) => u.id === unidade)
  const p = {
    id: novoId(), numero: `${new Date().getFullYear()}/${String(banco.tr_processos.length + 1).padStart(6, '0')}`,
    tipo: 'Contratação', assunto: texto(objeto), interessado: dem ? `${dem.sigla} — ${dem.nome}` : null, descricao: texto(descricao) || null,
    prioridade: prioridade || 'normal', prazo: prazo || null, situacao: 'em_andamento', unidade_atual: compras,
    responsavel_atual: usuarioId(), responsavel_nome: nomeDe(usuarioId()), desde: agora(), recebido_em: agora(),
    aberto_por: usuarioId(), aberto_por_nome: nomeDe(usuarioId()), aberto_em: agora(), concluido_em: null, motivo_conclusao: null,
    contratacao_modalidade: modalidade, contratacao_objeto: objetoTipo || null, updated_at: agora(),
  }
  banco.tr_processos.push(p)
  movimento(p, { tipo: 'abertura', de_unidade: dem?.id || compras, para_unidade: compras, despacho: texto(despacho) || null })
  banco.processos.push(novaLinha('processos', {
    numero: p.numero, objeto: p.assunto, etapa: 'Aberto', tipo: TIPO_QUADRO[modalidade], unidade_demandante: dem?.nome || null,
    modalidade: MODALIDADE_QUADRO[modalidade], valor_estimado: valor ?? null, tr_processo_id: p.id,
  }))
  return p
}

const RPC_CP = {
  cp_enviar_solicitacao(a) {
    exigir(['secretario', 'admin'].includes(papel()), 'Somente o secretário envia a DFD ao Compras.')
    exigir(unidadeDoUsuario() || papel() === 'admin', 'Peça ao administrador para definir a sua unidade antes de enviar solicitações.')
    exigir(a.p_tipo === 'dfd', 'O pedido ao Compras é feito com a DFD assinada.')
    cpValidar(null, a)
    contadorSol += 1
    const s = {
      id: novoId(), numero: `SOL-${new Date().getFullYear()}/${String(contadorSol).padStart(6, '0')}`, ...camposSol(a),
      unidade_id: unidadeDoUsuario(), solicitante: usuarioId(), solicitante_nome: nomeDe(usuarioId()), status: 'enviada', motivo: null,
      analisada_por: null, analisada_por_nome: null, analisada_em: null, processo_id: null, enviada_em: agora(), criada_em: agora(), updated_at: agora(),
    }
    banco.cp_solicitacoes.push(s)
    cpEvento(s, 'envio', null)
    return s.id
  },
  cp_reenviar_solicitacao(a) {
    const s = cpSol(a.p_id)
    exigir(['secretario', 'admin'].includes(papel()) && cpEditar(s), 'Só o secretário que fez o pedido (ou da mesma secretaria) pode corrigi-lo.')
    exigir(s.status === 'devolvida', 'Só uma solicitação devolvida pode ser corrigida e reenviada.')
    cpValidar(s.id, a)
    Object.assign(s, camposSol(a), { status: 'enviada', enviada_em: agora(), updated_at: agora() })
    cpEvento(s, 'reenvio', a.p_resposta)
  },
  cp_cancelar_solicitacao({ p_id, p_motivo }) {
    const s = cpSol(p_id)
    exigir(cpEditar(s), 'Só quem fez a solicitação (ou a sua unidade) pode cancelá-la.')
    exigir(['enviada', 'devolvida'].includes(s.status), 'Esta solicitação não pode mais ser cancelada.')
    exigir(texto(p_motivo).length >= 3, 'Informe o motivo do cancelamento.')
    Object.assign(s, { status: 'cancelada', motivo: texto(p_motivo), updated_at: agora() })
    cpEvento(s, 'cancelamento', p_motivo)
  },
  cp_devolver_solicitacao({ p_id, p_motivo }) {
    cpCompras()
    const s = cpSol(p_id)
    exigir(s.status === 'enviada', 'Só uma solicitação aguardando análise pode ser devolvida.')
    exigir(texto(p_motivo).length >= 3, 'Diga o que precisa ser ajustado.')
    Object.assign(s, { status: 'devolvida', motivo: texto(p_motivo), analisada_por: usuarioId(), analisada_por_nome: nomeDe(usuarioId()), analisada_em: agora(), updated_at: agora() })
    cpEvento(s, 'devolucao', p_motivo)
  },
  cp_recusar_solicitacao({ p_id, p_motivo }) {
    cpCompras()
    const s = cpSol(p_id)
    exigir(s.status === 'enviada', 'Só uma solicitação aguardando análise pode ser recusada.')
    exigir(texto(p_motivo).length >= 3, 'Informe o motivo da recusa.')
    Object.assign(s, { status: 'recusada', motivo: texto(p_motivo), analisada_por: usuarioId(), analisada_por_nome: nomeDe(usuarioId()), analisada_em: agora(), updated_at: agora() })
    cpEvento(s, 'recusa', p_motivo)
  },
  cp_aceitar_solicitacao({ p_id, p_modalidade, p_objeto_tipo, p_prioridade, p_despacho }) {
    cpCompras()
    const s = cpSol(p_id)
    exigir(s.status === 'enviada', 'Só uma solicitação aguardando análise pode ser aceita.')
    const p = cpCriarProcesso({
      objeto: s.objeto, unidade: s.unidade_id, modalidade: p_modalidade, objetoTipo: p_objeto_tipo || s.objeto_tipo,
      descricao: `Justificativa da demanda: ${s.justificativa}${s.quantidade ? `\nQuantidade: ${s.quantidade}` : ''}`,
      prioridade: p_prioridade || s.prioridade, prazo: s.data_pretendida, valor: s.valor_estimado,
      despacho: `Aberto a partir da solicitação ${s.numero}${texto(p_despacho) ? `. ${texto(p_despacho)}` : ''}.`,
    })
    const d = banco.doc_documentos.find((x) => x.id === s.documento_id)
    if (d && !d.processo_id) {
      d.processo_id = p.id
      movimento(p, { tipo: 'documento', para_unidade: p.unidade_atual, despacho: `DFD ${d.numero} juntado ao processo.` })
    }
    Object.assign(s, { status: 'aceita', motivo: null, processo_id: p.id, analisada_por: usuarioId(), analisada_por_nome: nomeDe(usuarioId()), analisada_em: agora(), updated_at: agora() })
    cpEvento(s, 'aceite', `Processo ${p.numero} aberto.`)
    return p.id
  },
  cp_registrar_processo({ p_objeto, p_unidade_demandante, p_justificativa, p_modalidade, p_objeto_tipo, p_prioridade, p_valor_estimado, p_prazo, p_despacho }) {
    exigir(papel() === 'admin', 'O processo de contratação começa pela DFD do secretário. Só a administração lança processos antigos.')
    exigir(texto(p_objeto).length >= 5, 'Descreva o objeto da contratação.')
    exigir(banco.tr_unidades.some((u) => u.id === p_unidade_demandante), 'Informe a unidade demandante.')
    exigir(p_valor_estimado == null || p_valor_estimado >= 0, 'O valor estimado não pode ser negativo.')
    return cpCriarProcesso({
      objeto: p_objeto, unidade: p_unidade_demandante, descricao: p_justificativa, modalidade: p_modalidade, objetoTipo: p_objeto_tipo,
      prioridade: p_prioridade, prazo: p_prazo, valor: p_valor_estimado, despacho: texto(p_despacho) || 'Processo de contratação registrado pelo Compras.',
    }).id
  },
  cp_marcar_item({ p_processo, p_item, p_situacao, p_referencia }) {
    const p = trProcesso(p_processo)
    trAtuar(p, 'registrar os documentos')
    exigir(p.situacao === 'em_andamento', 'O processo está concluído. Reabra-o para alterar.')
    exigir(/^[a-z0-9-]{2,60}$/.test(p_item || ''), 'Item inválido.')
    exigir(['juntado', 'nao_se_aplica'].includes(p_situacao), 'Situação inválida.')
    exigir(p_situacao !== 'juntado' || texto(p_referencia).length >= 2, 'Informe onde o documento está (número, folha ou link).')
    exigir(p_situacao !== 'nao_se_aplica' || texto(p_referencia).length >= 5, 'Justifique por que o documento não se aplica.')
    const atual = banco.cp_checklist.find((m) => m.processo_id === p.id && m.item === p_item)
    const dados = { situacao: p_situacao, referencia: texto(p_referencia), marcado_por: usuarioId(), marcado_por_nome: nomeDe(usuarioId()), marcado_em: agora() }
    if (atual) Object.assign(atual, dados); else banco.cp_checklist.push({ processo_id: p.id, item: p_item, ...dados })
    movimento(p, { tipo: 'documento', para_unidade: p.unidade_atual,
      despacho: p_situacao === 'juntado' ? `Documento juntado (${p_item}): ${texto(p_referencia)}` : `Documento não se aplica (${p_item}): ${texto(p_referencia)}` })
  },
  cp_desmarcar_item({ p_processo, p_item }) {
    const p = trProcesso(p_processo)
    trAtuar(p, 'registrar os documentos')
    exigir(p.situacao === 'em_andamento', 'O processo está concluído. Reabra-o para alterar.')
    const i = banco.cp_checklist.findIndex((m) => m.processo_id === p.id && m.item === p_item)
    if (i >= 0) {
      banco.cp_checklist.splice(i, 1)
      movimento(p, { tipo: 'documento', para_unidade: p.unidade_atual, despacho: `Marcação desfeita (${p_item}).` })
    }
  },
}

const RPC = {
  ...RPC_DOC,
  ...RPC_CP,
  tr_abrir_processo({ p_tipo, p_assunto, p_interessado, p_descricao, p_prioridade, p_prazo, p_unidade_destino, p_despacho }) {
    exigir(['secretario', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'juridico', 'administrativo', 'rh', 'ti', 'admin'].includes(papel()), 'Seu perfil não pode abrir processos.')
    exigir(texto(p_tipo), 'Informe o tipo do processo.')
    exigir(texto(p_assunto).length >= 3, 'Informe o assunto do processo.')
    const origem = unidadeDoUsuario()
    exigir(origem || papel() === 'admin', 'Peça ao administrador para definir a sua unidade antes de abrir processos.')
    const destino = p_unidade_destino || origem
    exigir(destino, 'Informe a unidade de destino.')
    exigir(unidadeAtiva(destino), 'Unidade de destino inexistente ou inativa.')
    const aqui = destino === origem
    const p = {
      id: novoId(), numero: `${new Date().getFullYear()}/${String(banco.tr_processos.length + 1).padStart(6, '0')}`,
      tipo: texto(p_tipo), assunto: texto(p_assunto), interessado: texto(p_interessado) || null, descricao: texto(p_descricao) || null,
      prioridade: p_prioridade || 'normal', prazo: p_prazo || null, situacao: 'em_andamento', unidade_atual: destino,
      responsavel_atual: aqui ? usuarioId() : null, responsavel_nome: aqui ? nomeDe(usuarioId()) : null, desde: agora(),
      recebido_em: aqui ? agora() : null, aberto_por: usuarioId(), aberto_por_nome: nomeDe(usuarioId()), aberto_em: agora(),
      concluido_em: null, motivo_conclusao: null, updated_at: agora(),
    }
    banco.tr_processos.push(p)
    movimento(p, { tipo: 'abertura', de_unidade: origem, para_unidade: destino, despacho: texto(p_despacho) || null, prazo: p_prazo || null })
    return p.id
  },
  tr_tramitar({ p_id, p_unidade_destino, p_usuario_destino, p_despacho, p_prazo }) {
    const p = trProcesso(p_id)
    trAtuar(p, 'enviá-lo')
    exigir(p.situacao === 'em_andamento', 'O processo está concluído. Reabra-o para enviar.')
    exigir(texto(p_despacho).length >= 3, 'Escreva o despacho: o que a próxima unidade deve fazer.')
    exigir(unidadeAtiva(p_unidade_destino), 'Unidade de destino inexistente ou inativa.')
    exigir(p_unidade_destino !== p.unidade_atual || p_usuario_destino, 'O processo já está nesta unidade.')
    exigir(!p_usuario_destino || banco.usuarios.some((u) => u.id === p_usuario_destino && u.ativo && u.unidade_id === p_unidade_destino),
      'A pessoa escolhida não está ativa nessa unidade.')
    const de = p.unidade_atual
    Object.assign(p, {
      unidade_atual: p_unidade_destino, responsavel_atual: p_usuario_destino || null, responsavel_nome: nomeDe(p_usuario_destino),
      desde: agora(), recebido_em: null, prazo: p_prazo || p.prazo, updated_at: agora(),
    })
    movimento(p, { tipo: 'envio', de_unidade: de, para_unidade: p_unidade_destino, para_usuario: p_usuario_destino || null,
      para_usuario_nome: nomeDe(p_usuario_destino), despacho: texto(p_despacho), prazo: p_prazo || null })
  },
  tr_receber({ p_id }) {
    const p = trProcesso(p_id)
    trAtuar(p, 'recebê-lo')
    if (p.situacao !== 'em_andamento' || p.recebido_em) return
    p.recebido_em = agora()
    if (!p.responsavel_atual) Object.assign(p, { responsavel_atual: usuarioId(), responsavel_nome: nomeDe(usuarioId()) })
    movimento(p, { tipo: 'recebimento', para_unidade: p.unidade_atual })
  },
  tr_atualizar_dados({ p_id, p_assunto, p_interessado, p_descricao, p_prioridade, p_prazo }) {
    const p = trProcesso(p_id)
    trAtuar(p, 'alterá-lo')
    exigir(p.situacao === 'em_andamento', 'O processo está concluído. Reabra-o para alterar.')
    exigir(texto(p_assunto).length >= 3, 'Informe o assunto do processo.')
    exigir(['baixa', 'normal', 'alta', 'urgente'].includes(p_prioridade), 'Prioridade inválida.')
    Object.assign(p, { assunto: texto(p_assunto), interessado: texto(p_interessado) || null, descricao: texto(p_descricao) || null,
      prioridade: p_prioridade, prazo: p_prazo || null, updated_at: agora() })
    movimento(p, { tipo: 'alteracao', para_unidade: p.unidade_atual, despacho: 'Dados do processo alterados.' })
  },
  tr_concluir({ p_id, p_motivo }) {
    const p = trProcesso(p_id)
    trAtuar(p, 'concluí-lo')
    exigir(p.situacao === 'em_andamento', 'O processo já está concluído.')
    exigir(texto(p_motivo).length >= 3, 'Informe como o processo foi resolvido.')
    Object.assign(p, { situacao: 'concluido', concluido_em: agora(), motivo_conclusao: texto(p_motivo), updated_at: agora() })
    movimento(p, { tipo: 'conclusao', para_unidade: p.unidade_atual, despacho: texto(p_motivo) })
  },
  tr_reabrir({ p_id, p_motivo }) {
    const p = trProcesso(p_id)
    exigir(['gestor', 'gabinete', 'admin'].includes(papel()) || (!['viewer', 'sem_acesso'].includes(papel())
      && (p.responsavel_atual === usuarioId() || (!!unidadeDoUsuario() && p.unidade_atual === unidadeDoUsuario()))), 'Seu perfil não pode reabrir este processo.')
    exigir(p.situacao === 'concluido', 'O processo não está concluído.')
    exigir(texto(p_motivo).length >= 3, 'Informe o motivo da reabertura.')
    Object.assign(p, { situacao: 'em_andamento', concluido_em: null, motivo_conclusao: null, desde: agora(), recebido_em: null, updated_at: agora() })
    movimento(p, { tipo: 'reabertura', para_unidade: p.unidade_atual, despacho: texto(p_motivo) })
  },
  tr_pessoas_da_unidade({ p_unidade }) {
    if (['viewer', 'sem_acesso'].includes(papel())) return []
    return banco.usuarios.filter((u) => u.ativo && u.unidade_id === p_unidade).map((u) => ({ id: u.id, nome: u.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  },
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
      async signOut(opcoes) {
        // saída só local (cliente da assinatura): não derruba a sessão de quem usa o sistema
        if (opcoes?.scope === 'local') return { error: null }
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
        upload: async (path, arquivo) => { arquivos.set(path, arquivo); return { data: { path }, error: null } },
        createSignedUrl: async (path) => ({ data: { signedUrl: arquivos.has(path) ? URL.createObjectURL(arquivos.get(path)) : 'about:blank' }, error: null }),
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
  const nomes = { secretario: 'Secretária de Saúde', secretario2: 'Secretário de Educação', gestor: 'Gestão', fiscal: 'Fiscal titular', substituto: 'Fiscal substituto', compras: 'Compras', financeiro: 'Financeiro', gabinete: 'Gabinete', juridico: 'Jurídico', administrativo: 'Administrativo / Protocolo', rh: 'Recursos Humanos', ti: 'Tecnologia da Informação', admin: 'Administrador', presidente: 'Presidente / Prefeito', viewer: 'Visualizador', sair: '(deslogado)' }
  // perfis em espera (fora do fluxo atual) não aparecem na troca; continuam acessíveis por ?perfil=
  const emEspera = ['gabinete', 'administrativo', 'rh', 'ti', 'viewer']
  for (const k of [...Object.keys(PERFIS).filter((x) => !emEspera.includes(x) || x === perfil), 'sair']) sel.add(new Option(nomes[k], k))
  sel.value = perfil
  // troca de perfil sem recarregar: os dados já lançados na demonstração continuam
  sel.onchange = () => {
    perfil = sel.value
    gravarPerfil(perfil)
    avisar(perfil === 'sair' ? 'SIGNED_OUT' : 'SIGNED_IN')
    // vai para a tela inicial só depois de a troca de usuário ser aplicada (senão valeria o perfil anterior)
    setTimeout(() => {
      window.history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, 0)
  }
  el.append(sel)
  el.dataset.seletor = '1'
  document.body.append(el)
  window.__demoSel = sel
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', faixa)
else faixa()

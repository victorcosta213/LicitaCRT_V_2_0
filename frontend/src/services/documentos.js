import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Tabelas que mudam com os documentos: as telas se atualizam sozinhas quando alguma delas muda
export const TABELAS_DOCUMENTOS = ['doc_documentos', 'doc_assinaturas']

// Avisa as telas desta aba que um documento mudou, para atualizarem na hora (sem esperar o Realtime)
export const EVENTO_DOCUMENTO = 'documentos:mudou'
const avisarMudanca = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_DOCUMENTO))
}

const falha = (error) => { if (error) throw error }

// listas não trazem o texto (corpo) para não pesar
const COLUNAS_LISTA = 'id, numero, sigla, modelo, titulo, processo_id, unidade_id, status, versao, hash, codigo_verificacao, criado_por, criado_por_nome, criado_em, atualizado_em, assinado_em'
const COLUNAS_ASSINATURA = 'id, documento_id, versao, ordem, papel, usuario_id, nome, status, assinada_em, motivo_recusa'

export async function listarDocumentos() {
  const { data, error } = await supabase.from('doc_documentos').select(COLUNAS_LISTA).order('atualizado_em', { ascending: false }).limit(2000)
  falha(error)
  return data
}

export async function listarAssinaturas() {
  const { data, error } = await supabase.from('doc_assinaturas').select(COLUNAS_ASSINATURA).order('id', { ascending: true }).limit(5000)
  falha(error)
  return data
}

// Assinaturas que esperam a pessoa, já com o documento (versão atual, aguardando assinatura)
export async function listarMinhasAssinaturasPendentes(usuarioId) {
  const { data: ass, error } = await supabase.from('doc_assinaturas').select(COLUNAS_ASSINATURA)
    .eq('usuario_id', usuarioId).eq('status', 'pendente')
  falha(error)
  if (!ass?.length) return []
  const { data: docs, error: e2 } = await supabase.from('doc_documentos').select(COLUNAS_LISTA)
    .in('id', ass.map((x) => x.documento_id)).eq('status', 'aguardando_assinatura')
  falha(e2)
  const porId = new Map((docs || []).map((d) => [d.id, d]))
  return ass.map((assinatura) => ({ assinatura, documento: porId.get(assinatura.documento_id) }))
    .filter(({ documento, assinatura }) => documento && documento.versao === assinatura.versao)
}

export async function obterDocumento(id) {
  const [doc, ass] = await Promise.all([
    supabase.from('doc_documentos').select('*').eq('id', id).maybeSingle(),
    supabase.from('doc_assinaturas').select('*').eq('documento_id', id).order('versao', { ascending: true }).order('ordem', { ascending: true }),
  ])
  falha(doc.error)
  falha(ass.error)
  return { documento: doc.data, assinaturas: ass.data || [] }
}

export async function listarPessoasParaAssinar() {
  const { data, error } = await supabase.rpc('doc_pessoas')
  falha(error)
  return data || []
}

async function chamar(cliente, funcao, args) {
  const { data, error } = await cliente.rpc(funcao, args)
  falha(error)
  avisarMudanca()
  return data
}

// Devolve o id do documento criado
export const criarDocumento = ({ modelo, titulo, processoId, conteudo, corpo }) => chamar(supabase, 'doc_criar', {
  p_sigla: modelo.sigla, p_modelo: modelo.codigo, p_modelo_versao: modelo.versao, p_titulo: titulo,
  p_processo: processoId || null, p_conteudo: conteudo || {}, p_corpo: corpo || [],
})

export const salvarDocumento = (id, { titulo, conteudo, corpo }) => chamar(supabase, 'doc_salvar', {
  p_id: id, p_titulo: titulo, p_conteudo: conteudo, p_corpo: corpo,
})

// signatarios: [{ usuario_id, papel }]
export const enviarParaAssinatura = (id, signatarios) => chamar(supabase, 'doc_enviar_assinatura', { p_id: id, p_signatarios: signatarios })

export const recusarAssinatura = (id, motivo) => chamar(supabase, 'doc_recusar', { p_id: id, p_motivo: motivo })
export const cancelarDocumento = (id, motivo) => chamar(supabase, 'doc_cancelar', { p_id: id, p_motivo: motivo })

// A assinatura exige a senha digitada AGORA: um cliente à parte entra com e-mail e senha e chama doc_assinar com o token
// novo (o banco confere, no próprio token, que a senha foi usada há instantes). Esse cliente não guarda sessão e sai só
// localmente, para não derrubar a sessão de quem está usando o sistema.
export async function assinarDocumento(id, { email, senha }) {
  const cliente = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  try {
    const { error } = await cliente.auth.signInWithPassword({ email, password: senha })
    falha(error)
    return await chamar(cliente, 'doc_assinar', { p_id: id })
  } finally {
    await cliente.auth.signOut({ scope: 'local' }).catch(() => {})
  }
}

// Conferência pública (funciona sem login)
export async function verificarDocumento(codigo) {
  const { data, error } = await supabase.rpc('doc_verificar', { p_codigo: codigo })
  falha(error)
  return data
}

// Tipo de contratação do processo (define o checklist de artefatos da Lei 14.133/2021)
export async function definirContratacao(processoId, { modalidade, objeto }) {
  const { error } = await supabase.rpc('tr_definir_contratacao', { p_id: processoId, p_modalidade: modalidade || null, p_objeto: objeto || null })
  falha(error)
  avisarMudanca()
  window.dispatchEvent(new Event('tramitacao:mudou'))
}

// DFD do processo (a mais avançada), para os documentos seguintes começarem com os itens e o objeto dela
export async function dfdDoProcesso(processoId) {
  if (!processoId) return null
  const { data, error } = await supabase.from('doc_documentos').select('*').eq('processo_id', processoId).eq('modelo', 'dfd')
    .neq('status', 'cancelado').order('atualizado_em', { ascending: false })
  falha(error)
  const ordem = { assinado: 0, aguardando_assinatura: 1, rascunho: 2 }
  return [...(data || [])].sort((a, b) => ordem[a.status] - ordem[b.status])[0] || null
}

// ---- arquivos enviados como documento --------------------------------------------
export const BUCKET_DOCUMENTOS = 'documentos'
export const TAMANHO_MAXIMO = 20 * 1024 * 1024
export const TIPOS_ARQUIVO = '.pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.odt,.ods'

// SHA-256 (hexadecimal) do conteúdo do arquivo: é o que entra no texto assinado
export async function sha256DoArquivo(blob) {
  const buffer = await blob.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const nomeArquivo = (nome) => String(nome || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(-80) || 'arquivo'

// Envia o arquivo (pasta da própria pessoa) e cria o documento; devolve o id do documento
export async function enviarArquivo({ arquivo, titulo, descricao, processoId, usuarioId }) {
  if (!arquivo) throw new Error('Escolha o arquivo.')
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error('O arquivo deve ter até 20 MB.')
  const sha256 = await sha256DoArquivo(arquivo)
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now())
  const path = `${usuarioId}/${id}-${nomeArquivo(arquivo.name)}`
  const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(path, arquivo, { upsert: false, contentType: arquivo.type || undefined })
  falha(error)
  return chamar(supabase, 'doc_criar_arquivo', {
    p_titulo: titulo, p_descricao: descricao || null, p_processo: processoId || null, p_path: path,
    p_nome: arquivo.name, p_tipo: arquivo.type || 'application/octet-stream', p_tamanho: arquivo.size, p_sha256: sha256,
  })
}

export async function linkDoArquivo(path, segundos = 300) {
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(path, segundos)
  falha(error)
  return data.signedUrl
}

// Baixa o arquivo guardado e confere se o SHA-256 é o registrado no documento
export async function conferirArquivo(path, sha256) {
  const resp = await fetch(await linkDoArquivo(path, 120))
  if (!resp.ok) throw new Error('Não foi possível baixar o arquivo.')
  return (await sha256DoArquivo(await resp.blob())) === String(sha256 || '').toLowerCase()
}

// Encaminha o documento assinado a uma unidade; devolve o id do processo em que ele está
export async function encaminharDocumento(id, { unidade, despacho }) {
  const proc = await chamar(supabase, 'doc_encaminhar', { p_id: id, p_unidade: unidade, p_despacho: despacho })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tramitacao:mudou'))
  return proc
}

export function mensagemErroDocumento(err) {
  const msg = String(err?.message || '')
  if (/invalid login credentials/i.test(msg)) return 'Senha incorreta. Confira a senha e tente de novo.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  if (/failed to fetch|network/i.test(msg)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  if (err?.code === '42501' && !/Seu perfil|Somente|Este documento|Você|Só quem|Só o/.test(msg)) return 'Seu perfil não tem permissão para esta ação.'
  return msg || 'Não foi possível concluir a operação.'
}

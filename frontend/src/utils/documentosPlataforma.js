// Regras de apresentação dos documentos: situação, vistas da lista, links de verificação.

export const STATUS = {
  rascunho: { label: 'Rascunho', kind: 'secondary' },
  aguardando_assinatura: { label: 'Aguardando assinatura', kind: 'warning' },
  assinado: { label: 'Assinado', kind: 'success' },
  cancelado: { label: 'Cancelado', kind: 'danger' },
}

export const VISTAS_DOC = [
  ['todos', 'Todos'],
  ['assinar', 'Aguardando a minha assinatura'],
  ['meus', 'Criados por mim'],
  ['unidade', 'Da minha unidade'],
  ['rascunhos', 'Rascunhos'],
  ['assinados', 'Assinados'],
]

// Documentos que esperam a assinatura da pessoa: assinatura pendente na versão atual de um documento aguardando
export function pendentesDoUsuario(documentos, assinaturas, usuarioId) {
  if (!usuarioId) return []
  const porId = new Map(documentos.map((d) => [d.id, d]))
  return assinaturas
    .filter((a) => a.usuario_id === usuarioId && a.status === 'pendente')
    .map((a) => ({ assinatura: a, documento: porId.get(a.documento_id) }))
    .filter(({ documento, assinatura }) => documento && documento.status === 'aguardando_assinatura' && documento.versao === assinatura.versao)
}

export function naVistaDoc(d, vista, { usuarioId, unidadeId, pendentes = new Set() } = {}) {
  switch (vista) {
    case 'assinar': return pendentes.has(d.id)
    case 'meus': return !!usuarioId && d.criado_por === usuarioId
    case 'unidade': return !!unidadeId && d.unidade_id === unidadeId
    case 'rascunhos': return d.status === 'rascunho'
    case 'assinados': return d.status === 'assinado'
    default: return true
  }
}

export function combinaBuscaDoc(d, termo, processosPorId = new Map(), nomeDoModelo = () => '') {
  const q = String(termo || '').trim().toLowerCase()
  if (!q) return true
  const p = processosPorId.get(d.processo_id)
  return [d.numero, d.titulo, d.criado_por_nome, nomeDoModelo(d.modelo), p?.numero, p?.assunto]
    .some((v) => String(v || '').toLowerCase().includes(q))
}

// Rascunhos e aguardando assinatura primeiro, os mais recentes antes; depois assinados e cancelados
const ORDEM_STATUS = { aguardando_assinatura: 0, rascunho: 1, assinado: 2, cancelado: 3 }
export const ordenarDocumentos = (docs) => [...docs].sort((a, b) => (ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status])
  || (new Date(b.atualizado_em) - new Date(a.atualizado_em)))

// XXXX-XXXX-XXXX
export const codigoFormatado = (c) => String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/(.{4})(?=.)/g, '$1-')
export const urlVerificacao = (codigo, origem = (typeof window !== 'undefined' ? window.location.origin : '')) => `${origem}/verificar/${String(codigo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`

// Tarefa da Minha mesa: documento esperando a assinatura da pessoa
export const tarefaDeAssinatura = ({ documento, assinatura }) => ({
  id: `doc:${documento.id}`, categoria: 'Documento', severidade: 'warning', dias: 0,
  titulo: 'Documento aguardando a sua assinatura', ref: documento.numero,
  sub: `${documento.titulo} — como ${assinatura.papel}`, to: `/documentos/${documento.id}`,
})

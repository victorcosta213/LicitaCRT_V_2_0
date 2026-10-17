import { createDoc, createMany, findBy, listAll, removeById, updateById } from './db'

export const TABELA = 'processos'

// As telas usam nomes em camelCase; a tabela usa snake_case.
const PARA_COLUNA = {
  anexoUrl: 'anexo_url',
  anexoPath: 'anexo_path',
  valorCotado: 'valor_cotado',
  valorContratado: 'valor_contratado',
  localDocumentacao: 'local_documentacao',
}

// Colunas graváveis de public.processos
export const COLUNAS = [
  'numero', 'objeto', 'etapa', 'tipo', 'prioridade', 'prazo', 'responsavel', 'fluxo', 'justificativa',
  'anexo_url', 'anexo_path', 'valor_cotado', 'valor_contratado', 'local_documentacao',
  'situacao_sei', 'unidade_demandante', 'modalidade', 'valor_estimado', 'arquivado',
]

// Converte para as colunas da tabela e descarta campos que só existem na tela.
export function paraBanco(dados) {
  const out = {}
  for (const [campo, valor] of Object.entries(dados)) {
    const coluna = PARA_COLUNA[campo] || campo
    if (!COLUNAS.includes(coluna)) continue
    out[coluna] = typeof valor === 'string' ? (valor.trim() || null) : valor
  }
  return out
}

// Linha do banco + os nomes usados pelas telas
export const doBanco = (row) => ({
  ...row,
  anexoUrl: row.anexo_url ?? null,
  anexoPath: row.anexo_path ?? null,
  valorCotado: row.valor_cotado ?? null,
  valorContratado: row.valor_contratado ?? null,
  localDocumentacao: row.local_documentacao ?? null,
  createdAt: row.created_at ?? null,
})

export async function listarProcessos() {
  return (await listAll(TABELA, 'created_at', false)).map(doBanco)
}

export const criarProcesso = (dados) => createDoc(TABELA, paraBanco(dados))
export const atualizarProcesso = (id, dados) => updateById(TABELA, id, paraBanco(dados))
export const importarProcessos = (lista) => createMany(TABELA, lista.map(paraBanco))
export const excluirProcesso = (id) => removeById(TABELA, id)
export const arquivarProcessos = (ids, arquivado = true) =>
  Promise.all(ids.map((id) => updateById(TABELA, id, { arquivado })))

// Número já usado por outro processo?
export async function numeroEmUso(numero, idAtual = null) {
  const rows = await findBy(TABELA, 'numero', String(numero).trim())
  return rows.some((r) => r.id !== idAtual)
}

// Colunas da tabela public.processos confirmadas no Supabase de produção em
// 16/10/2026 (consulta à API REST: colunas inexistentes retornam 42703),
// mais `arquivado` e `updated_at`, criadas pela migration 20261017.
// Qualquer payload gravado em `processos` precisa usar somente estes nomes.
export const PROCESSOS_COLUNAS = [
  'id', 'numero', 'objeto', 'etapa', 'tipo', 'prioridade', 'prazo', 'responsavel',
  'fluxo', 'justificativa', 'created_at', 'anexo_url', 'anexo_path',
  'valor_cotado', 'valor_contratado', 'local_documentacao',
  'situacao_sei', 'unidade_demandante', 'modalidade', 'valor_estimado',
  'arquivado', 'updated_at',
]

// Nomes que as telas usavam e que NÃO existem na tabela (retornavam 42703):
// anexoUrl, anexoPath, faseInicialKey, valorCotado, valorContratado,
// localDocumentacao, updatedAt, createdAt, statusGeral, dataInicioProcesso.

export const colunasInexistentes = (payload) =>
  Object.keys(payload).filter((k) => !PROCESSOS_COLUNAS.includes(k))

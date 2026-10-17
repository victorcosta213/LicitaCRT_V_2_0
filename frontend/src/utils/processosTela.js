// Auxiliares compartilhados pelas telas de processos (Controle e Arquivados).
import { abrirAnexo } from '../services/files'
import { showError } from './alerts'
import { fmtDate } from './format'

// Colunas das exportações
export const COLUNAS_PDF = [
  { header: 'Nº', dataKey: 'numero' },
  { header: 'Objeto', dataKey: 'objeto' },
  { header: 'Etapa', dataKey: 'etapa' },
  { header: 'Tipo', dataKey: 'tipo' },
  { header: 'Prioridade', dataKey: 'prioridade' },
  { header: 'Prazo', dataKey: 'prazo' },
  { header: 'Resp.', dataKey: 'responsavel' },
]
export const COLUNAS_EXCEL = [
  ...COLUNAS_PDF,
  { header: 'Situação no SEI', dataKey: 'situacao_sei' },
  { header: 'Unidade demandante', dataKey: 'unidade_demandante' },
  { header: 'Modalidade', dataKey: 'modalidade' },
  { header: 'Valor estimado', dataKey: 'valor_estimado' },
  { header: 'Local / documento', dataKey: 'local_documentacao' },
]

export const paraExportar = (rows) => rows.map((r) => ({ ...r, prazo: r.prazo ? fmtDate(r.prazo) : '' }))

export const abrirAnexoComAviso = (path) =>
  abrirAnexo(path).catch(() => showError('Não foi possível abrir o anexo.'))

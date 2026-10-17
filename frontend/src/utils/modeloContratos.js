import { utils, writeFile } from 'xlsx'
import { COLUNAS_MODELO, LINHA_EXEMPLO } from './importContratos'

// Planilha de exemplo com as colunas aceitas na importação de contratações
export function baixarModeloContratos() {
  const ws = utils.aoa_to_sheet([COLUNAS_MODELO, LINHA_EXEMPLO])
  ws['!cols'] = COLUNAS_MODELO.map((c) => ({ wch: Math.max(c.length + 2, 16) }))
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Contratações')
  writeFile(wb, 'modelo-importacao-contratacoes.xlsx')
}

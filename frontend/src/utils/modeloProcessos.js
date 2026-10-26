import { utils, writeFile } from 'xlsx'
import { COLUNAS_PLANILHA, LINHAS_EXEMPLO_PROCESSOS } from './importProcessos'
import { PHASES } from './phases'

// Planilha de exemplo para a importação de processos. A primeira aba é a que o sistema lê;
// a segunda ("Como preencher") só explica as colunas e é ignorada na importação.
export function baixarModeloProcessos() {
  const cabecalho = COLUNAS_PLANILHA.map((c) => c.cabecalho)
  const dados = utils.aoa_to_sheet([cabecalho, ...LINHAS_EXEMPLO_PROCESSOS])
  dados['!cols'] = cabecalho.map((c) => ({ wch: Math.max(c.length + 2, 22) }))

  const ajuda = utils.aoa_to_sheet([
    ['Coluna', 'Obrigatória?', 'O que informar'],
    ...COLUNAS_PLANILHA.map((c) => [c.cabecalho, c.obrigatoria ? 'Sim' : 'Não', c.ajuda]),
    [],
    ['Fases aceitas em "Fase Atual"'],
    ...PHASES.map((p) => [p.name]),
  ])
  ajuda['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 100 }]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, dados, 'Processos')
  utils.book_append_sheet(wb, ajuda, 'Como preencher')
  writeFile(wb, 'modelo-importacao-processos.xlsx')
}

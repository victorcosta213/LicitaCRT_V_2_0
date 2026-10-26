// A planilha modelo gerada: a primeira aba é lida pelo importador sem ressalvas
// e a segunda explica o preenchimento (e não é lida).
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ gravado: null }))
vi.mock('xlsx', async (importOriginal) => {
  const xlsx = await importOriginal()
  return { ...xlsx, writeFile: (wb, nome) => { h.gravado = { wb, nome } } }
})

import { utils } from 'xlsx'
import { baixarModeloProcessos } from '../../src/utils/modeloProcessos'
import { lerPlanilhaProcessos } from '../../src/utils/importProcessos'
import { PHASES } from '../../src/utils/phases'

describe('planilha modelo de processos', () => {
  baixarModeloProcessos()
  const { wb, nome } = h.gravado

  it('tem o nome esperado e duas abas, com os dados primeiro', () => {
    expect(nome).toBe('modelo-importacao-processos.xlsx')
    expect(wb.SheetNames).toEqual(['Processos', 'Como preencher'])
  })

  it('a primeira aba é importada por inteiro', () => {
    const linhas = utils.sheet_to_json(wb.Sheets.Processos, { header: 1, raw: true, defval: '' })
    const res = lerPlanilhaProcessos(linhas)
    expect(res.erro).toBeUndefined()
    expect(res.faltantes).toEqual([])
    expect(res.ignorados).toEqual([])
    expect(res.registros).toHaveLength(2)
  })

  it('a aba de instruções lista as fases aceitas', () => {
    const linhas = utils.sheet_to_json(wb.Sheets['Como preencher'], { header: 1, defval: '' }).flat()
    for (const p of PHASES) expect(linhas).toContain(p.name)
  })
})

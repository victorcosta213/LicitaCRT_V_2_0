// Instruções da importação de processos: o que a planilha precisa ter e o modelo para baixar.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const h = vi.hoisted(() => ({ baixar: vi.fn() }))
vi.mock('../../src/utils/modeloProcessos', () => ({ baixarModeloProcessos: h.baixar }))

import ImportarProcessosModal from '../../src/components/ImportarProcessosModal'
import { COLUNAS_PLANILHA, LINHAS_EXEMPLO_PROCESSOS, lerPlanilhaProcessos } from '../../src/utils/importProcessos'

describe('instruções da planilha de processos', () => {
  it('lista todas as colunas e marca só número e nome como obrigatórias', () => {
    render(<ImportarProcessosModal onEscolher={vi.fn()} onClose={vi.fn()} />)
    const tabela = screen.getByRole('table')
    for (const c of COLUNAS_PLANILHA) expect(within(tabela).getByText(c.cabecalho)).toBeInTheDocument()
    expect(within(tabela).getAllByText('Obrigatória')).toHaveLength(2)
    expect(COLUNAS_PLANILHA.filter((c) => c.obrigatoria).map((c) => c.cabecalho)).toEqual(['numero do Processo', 'nome do Processo'])
  })

  it('explica as regras e lista as fases aceitas', () => {
    render(<ImportarProcessosModal onEscolher={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/primeira aba/)).toBeInTheDocument()
    expect(screen.getByText(/ignoradas/)).toBeInTheDocument()
    expect(screen.getByText(/Fases aceitas na coluna "Fase Atual"/)).toBeInTheDocument()
  })

  it('os botões baixam o modelo, escolhem o arquivo e cancelam', async () => {
    const ui = userEvent.setup()
    const onEscolher = vi.fn()
    const onClose = vi.fn()
    render(<ImportarProcessosModal onEscolher={onEscolher} onClose={onClose} />)
    await ui.click(screen.getByRole('button', { name: /Baixar planilha modelo/ }))
    await ui.click(screen.getByRole('button', { name: /Escolher planilha/ }))
    await ui.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(h.baixar).toHaveBeenCalledOnce()
    expect(onEscolher).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('o modelo oferecido é aceito pelo importador, sem colunas faltando nem linhas ignoradas', () => {
    const linhas = [COLUNAS_PLANILHA.map((c) => c.cabecalho), ...LINHAS_EXEMPLO_PROCESSOS]
    const res = lerPlanilhaProcessos(linhas)
    expect(res.erro).toBeUndefined()
    expect(res.faltantes).toEqual([])
    expect(res.ignorados).toEqual([])
    expect(res.registros).toHaveLength(LINHAS_EXEMPLO_PROCESSOS.length)
    expect(res.registros[0]).toMatchObject({ numero: '012/2026', prioridade: 'Estrategico', tipo: 'Pregao', valor_estimado: 48000, etapa: 'Cotação de Preços' })
    expect(res.registros[1].prioridade).toBe('Critico')
    expect(res.registros.every((r) => !r._faseDesconhecida && !r._valorInvalido)).toBe(true)
  })

  it('uma planilha só com número e nome também é aceita', () => {
    const res = lerPlanilhaProcessos([['numero do Processo', 'nome do Processo'], ['1/2026', 'Teste']])
    expect(res.registros).toHaveLength(1)
    expect(res.faltantes.length).toBe(6)
  })
})

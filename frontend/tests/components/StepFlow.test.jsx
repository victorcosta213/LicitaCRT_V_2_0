import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StepFlow from '../../src/components/StepFlow'

// Fluxo gravado fora de ordem: a última fase lançada tem data retroativa.
const FLUXO = [
  { nome: 'Cotação de Preços', data: '2026-03-10T00:00:00' },
  { nome: 'Homologação', data: '2026-05-01T00:00:00' },
  { nome: 'Dotação orçamentária', data: '2026-04-02T00:00:00' },
]

describe('StepFlow', () => {
  it('exibe as fases em ordem de data', () => {
    render(<StepFlow items={FLUXO} />)
    expect(screen.getAllByText(/Cotação|Dotação|Homologação/).map((e) => e.textContent))
      .toEqual(['Cotação de Preços', 'Dotação orçamentária', 'Homologação'])
  })

  // Antes devolvia a posição na lista ordenada e o Controle apagava a fase errada.
  it('remover devolve a posição da fase no fluxo gravado', async () => {
    const onRemove = vi.fn()
    render(<StepFlow items={FLUXO} onRemove={onRemove} />)
    const botoes = screen.getAllByTitle('Remover')
    await userEvent.click(botoes[1]) // "Dotação orçamentária", 2ª na tela e 3ª no fluxo gravado
    expect(onRemove).toHaveBeenCalledWith(2)
  })

  it('sem onRemove (consulta) não mostra botão de remover', () => {
    render(<StepFlow items={FLUXO} />)
    expect(screen.queryByTitle('Remover')).not.toBeInTheDocument()
  })

  it('fluxo vazio', () => {
    render(<StepFlow items={[]} />)
    expect(screen.getByText('Nenhum documento registrado.')).toBeInTheDocument()
  })
})

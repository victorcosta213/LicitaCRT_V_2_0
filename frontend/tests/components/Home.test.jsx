// Quadro de prioridades: um processo novo entra na coluna da sua prioridade;
// arquivados e encerrados ficam de fora.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ rows: [] }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'compras' }) }))
vi.mock('../../src/services/processos', () => ({
  listarProcessos: vi.fn(() => Promise.resolve(h.rows)),
  atualizarProcesso: vi.fn(),
}))

import Home from '../../src/pages/Home'

const processo = (extra) => ({ id: extra.numero, objeto: `Objeto ${extra.numero}`, etapa: 'Cotação de Preços', arquivado: false, ...extra })
const coluna = (nome) => screen.getByText(nome).closest('.kanban-column')

beforeEach(() => { h.rows = [] })

describe('Quadro de prioridades', () => {
  it('coloca cada processo na coluna da sua prioridade; sem prioridade vai para "Sem prioridade"', async () => {
    h.rows = [
      processo({ numero: '10/2026', prioridade: 'Critico' }),
      processo({ numero: '11/2026', prioridade: 'Estrategico' }),
      processo({ numero: '12/2026', prioridade: '' }),
    ]
    render(<MemoryRouter><Home /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('10/2026')).toBeInTheDocument())
    expect(within(coluna('Crítico')).getByText('10/2026')).toBeInTheDocument()
    expect(within(coluna('Estratégico')).getByText('11/2026')).toBeInTheDocument()
    expect(within(coluna('Sem prioridade')).getByText('12/2026')).toBeInTheDocument()
  })

  it('não mostra processos arquivados nem encerrados', async () => {
    h.rows = [
      processo({ numero: '20/2026', prioridade: 'Critico' }),
      processo({ numero: '21/2026', prioridade: 'Critico', arquivado: true }),
      processo({ numero: '22/2026', prioridade: 'Critico', etapa: 'Concluído' }),
    ]
    render(<MemoryRouter><Home /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('20/2026')).toBeInTheDocument())
    expect(screen.queryByText('21/2026')).not.toBeInTheDocument()
    expect(screen.queryByText('22/2026')).not.toBeInTheDocument()
  })
})

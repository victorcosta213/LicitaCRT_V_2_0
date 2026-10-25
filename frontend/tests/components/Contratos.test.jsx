// Lista de contratações: abrir o formulário pelo atalho e, ao criar, seguir para a ficha nova.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const h = vi.hoisted(() => ({ salvar: vi.fn() }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ nome: 'Diego', role: 'compras' }) }))
vi.mock('../../src/context/GcContext', () => ({
  useGc: () => ({ consolidados: [], alertas: [], params: {}, loading: false, error: null, schemaMissing: false, raw: { contratos: [] }, reload: vi.fn() }),
}))
vi.mock('../../src/components/gc/useGcActions', () => ({
  useGcActions: () => ({ can: () => true, salvar: h.salvar, role: 'compras' }),
}))
// o formulário de verdade é testado em FormModal.test: aqui só importa o que a tela faz depois
vi.mock('../../src/components/gc/FormModal', () => ({
  default: ({ title, onSubmit, onClose }) => (
    <div role="dialog" aria-label={title}>
      <button onClick={async () => { await onSubmit({ numero: '900/2026', vigencia_fim: '2027-01-01' }); onClose() }}>Criar</button>
    </div>
  ),
}))

import Contratos from '../../src/pages/Contratos'

const Local = () => { const l = useLocation(); return <div data-testid="local">{l.pathname}{l.search}</div> }
const abrir = (rota) => render(
  <MemoryRouter initialEntries={[rota]}>
    <Local />
    <Routes>
      <Route path="/contratos" element={<Contratos />} />
      <Route path="/contratos/:id" element={<div>FICHA</div>} />
    </Routes>
  </MemoryRouter>,
)

beforeEach(() => { h.salvar.mockReset().mockResolvedValue({ id: 'nova-id' }) })

describe('Contratações', () => {
  it('o atalho ?nova=1 abre o formulário de nova contratação', async () => {
    abrir('/contratos?nova=1')
    expect(await screen.findByRole('dialog', { name: 'Nova contratação' })).toBeInTheDocument()
  })

  it('sem o atalho o formulário só abre pelo botão', async () => {
    abrir('/contratos')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Nova contratação/ }))
    expect(screen.getByRole('dialog', { name: 'Nova contratação' })).toBeInTheDocument()
  })

  it('ao criar, vai para a ficha da contratação nova (fechar o formulário não pode desfazer a navegação)', async () => {
    abrir('/contratos?nova=1')
    await userEvent.click(await screen.findByRole('button', { name: 'Criar' }))
    await waitFor(() => expect(screen.getByText('FICHA')).toBeInTheDocument())
    expect(screen.getByTestId('local')).toHaveTextContent('/contratos/nova-id')
    expect(h.salvar).toHaveBeenCalledWith('contratos', expect.objectContaining({ numero: '900/2026', situacao: 'em_cadastro' }))
  })
})

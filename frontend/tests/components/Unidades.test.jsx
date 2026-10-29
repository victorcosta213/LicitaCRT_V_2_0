// Administração das unidades (setores) da tramitação.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({ listar: vi.fn(), usuarios: vi.fn(), criar: vi.fn(), atualizar: vi.fn(), erro: vi.fn(), ok: vi.fn() }))
vi.mock('../../src/utils/alerts', () => ({ showError: h.erro, showSuccess: h.ok, showConfirm: vi.fn() }))
vi.mock('../../src/services/users', async (importOriginal) => ({ ...(await importOriginal()), listarUsuarios: h.usuarios }))
vi.mock('../../src/services/tramitacao', async (importOriginal) => ({
  ...(await importOriginal()), listarUnidades: h.listar, criarUnidade: h.criar, atualizarUnidade: h.atualizar,
}))

import Unidades from '../../src/pages/Unidades'

const UNIDADES = [
  { id: 'u1', sigla: 'COMP', nome: 'Compras e Licitações', ativa: true },
  { id: 'u2', sigla: 'JUR', nome: 'Jurídico', ativa: false },
]
const abrir = () => render(<MemoryRouter><Unidades /></MemoryRouter>)

beforeEach(() => {
  h.listar.mockReset().mockResolvedValue(UNIDADES)
  h.usuarios.mockReset().mockResolvedValue([
    { id: 'a', ativo: true, unidade_id: 'u1' }, { id: 'b', ativo: true, unidade_id: 'u1' },
    { id: 'c', ativo: false, unidade_id: 'u1' }, { id: 'd', ativo: true, unidade_id: null },
  ])
  for (const f of [h.criar, h.atualizar, h.erro, h.ok]) f.mockReset().mockResolvedValue()
})

describe('unidades', () => {
  it('lista as unidades com a situação e quantas pessoas ativas há em cada', async () => {
    abrir()
    const compras = (await screen.findByText('COMP')).closest('tr')
    expect(within(compras).getByText('Compras e Licitações')).toBeInTheDocument()
    expect(within(compras).getByText('2')).toBeInTheDocument()
    expect(within(compras).getByText('Ativa')).toBeInTheDocument()
    expect(within(screen.getByText('JUR').closest('tr')).getByText('Inativa')).toBeInTheDocument()
  })

  it('cria uma unidade com sigla e nome', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Nova unidade/ }))
    const modal = screen.getByRole('dialog')
    await ui.type(within(modal).getByLabelText(/Sigla/), 'ouv')
    await ui.type(within(modal).getByLabelText(/Nome da unidade/), 'Ouvidoria')
    await ui.click(within(modal).getByRole('button', { name: 'Criar unidade' }))
    await waitFor(() => expect(h.criar).toHaveBeenCalledWith({ sigla: 'ouv', nome: 'Ouvidoria' }))
  })

  it('sigla repetida mostra uma mensagem clara', async () => {
    h.criar.mockRejectedValue({ code: '23505', message: 'duplicate key value violates unique constraint "tr_unidades_sigla_key"', details: 'Key (sigla)=(COMP) already exists.' })
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Nova unidade/ }))
    const modal = screen.getByRole('dialog')
    await ui.type(within(modal).getByLabelText(/Sigla/), 'COMP')
    await ui.type(within(modal).getByLabelText(/Nome da unidade/), 'Outra')
    await ui.click(within(modal).getByRole('button', { name: 'Criar unidade' }))
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Já existe uma unidade com esta sigla.'))
  })

  it('edita só o nome (a sigla não muda)', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: 'Editar COMP' }))
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByLabelText(/Sigla/)).toHaveAttribute('readonly')
    const nome = within(modal).getByLabelText(/Nome da unidade/)
    await ui.clear(nome)
    await ui.type(nome, 'Compras')
    await ui.click(within(modal).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(h.atualizar).toHaveBeenCalledWith('u1', { nome: 'Compras' }))
  })

  it('desativa e reativa', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(await screen.findByRole('button', { name: 'Desativar COMP' }))
    await waitFor(() => expect(h.atualizar).toHaveBeenCalledWith('u1', { ativa: false }))
    await ui.click(screen.getByRole('button', { name: 'Reativar JUR' }))
    await waitFor(() => expect(h.atualizar).toHaveBeenCalledWith('u2', { ativa: true }))
  })

  it('sem a migration, explica o que falta', async () => {
    h.listar.mockRejectedValue({ code: '42P01', message: 'relation does not exist' })
    abrir()
    expect(await screen.findByText(/ainda não foi ativada/)).toBeInTheDocument()
  })
})

// Painel de usuários: o administrador redefine a senha de outra pessoa para a senha padrão.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const h = vi.hoisted(() => ({ fire: vi.fn(), resetar: vi.fn(), listar: vi.fn() }))
vi.mock('sweetalert2', () => ({ default: { fire: h.fire } }))
vi.mock('bootstrap/js/dist/modal', () => ({ default: class { show() {} hide() {} dispose() {} } }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }))
vi.mock('../../src/components/useAtualizacao', () => ({ useAtualizacaoAutomatica: () => {} }))
vi.mock('../../src/services/users', async (importOriginal) => ({
  ...(await importOriginal()),
  listarUsuarios: h.listar,
  resetarSenha: h.resetar,
}))

import Usuarios from '../../src/pages/Usuarios'

const PESSOAS = [
  { id: 'admin-1', nome: 'Administração', email: 'admin@crt08.gov.br', role: 'admin', ativo: true, created_at: '2026-10-15T10:00:00Z' },
  { id: 'u-ana', nome: 'Ana Ribeiro', email: 'ana@crt08.gov.br', role: 'gestor', ativo: true, created_at: '2026-10-26T10:00:00Z' },
]

beforeEach(() => {
  h.fire.mockReset().mockResolvedValue({ isConfirmed: true })
  h.resetar.mockReset().mockResolvedValue()
  h.listar.mockReset().mockResolvedValue(PESSOAS)
})

describe('Usuários: redefinir senha', () => {
  it('confirma antes, redefine só o usuário escolhido e avisa o resultado', async () => {
    const ui = userEvent.setup()
    render(<Usuarios />)
    await ui.click(await screen.findByRole('button', { name: 'Redefinir senha de Ana Ribeiro' }))

    expect(h.fire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Redefinir a senha?', text: expect.stringMatching(/senha padrão.*obrigada a criar uma nova senha/s), showCancelButton: true,
    }))
    await waitFor(() => expect(h.resetar).toHaveBeenCalledWith('u-ana'))
    expect(h.resetar).toHaveBeenCalledOnce()
    await waitFor(() => expect(h.fire).toHaveBeenLastCalledWith('Senha redefinida', expect.stringMatching(/Ana Ribeiro já pode entrar com a senha padrão/), 'success'))
  })

  it('a mensagem nunca mostra a senha padrão', async () => {
    const ui = userEvent.setup()
    render(<Usuarios />)
    await ui.click(await screen.findByRole('button', { name: 'Redefinir senha de Ana Ribeiro' }))
    await waitFor(() => expect(h.resetar).toHaveBeenCalled())
    // nenhuma das mensagens cita uma senha: nem a padrão, nem um valor qualquer
    expect(JSON.stringify(h.fire.mock.calls)).not.toMatch(/senha (é|e) |Padrao#Teste1/i)
  })

  it('cancelar na confirmação não redefine nada', async () => {
    h.fire.mockResolvedValue({ isConfirmed: false })
    const ui = userEvent.setup()
    render(<Usuarios />)
    await ui.click(await screen.findByRole('button', { name: 'Redefinir senha de Ana Ribeiro' }))
    expect(h.resetar).not.toHaveBeenCalled()
  })

  it('o administrador não redefine a própria senha por aqui', async () => {
    render(<Usuarios />)
    expect(await screen.findByRole('button', { name: 'Redefinir senha de Administração' })).toBeDisabled()
  })

  it('se a redefinição falhar, mostra o motivo', async () => {
    h.resetar.mockRejectedValue(new Error('A função de redefinição ainda não foi publicada no Supabase (veja backend/README.md).'))
    const ui = userEvent.setup()
    render(<Usuarios />)
    await ui.click(await screen.findByRole('button', { name: 'Redefinir senha de Ana Ribeiro' }))
    await waitFor(() => expect(h.fire).toHaveBeenLastCalledWith('Erro', expect.stringMatching(/ainda não foi publicada/), 'error'))
  })
})

// Primeiro acesso: a pessoa cria a própria senha antes de usar o sistema.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const h = vi.hoisted(() => ({ trocar: vi.fn(), senhaTrocada: vi.fn(), logout: vi.fn() }))
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'ana@crt08.gov.br' }, logout: h.logout, senhaTrocada: h.senhaTrocada }),
}))
vi.mock('../../src/services/users', async (importOriginal) => ({
  ...(await importOriginal()),
  trocarSenhaPrimeiroAcesso: h.trocar,
}))

import TrocarSenha from '../../src/pages/TrocarSenha'
import { validarNovaSenha } from '../../src/utils/senha'

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/bloqueada']}>
      <Routes>
        <Route path="/bloqueada" element={<TrocarSenha />} />
        <Route path="/" element={<div>área do sistema</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
const preencher = async (ui, senha, confirmacao = senha) => {
  await ui.type(screen.getByLabelText('Nova senha'), senha)
  await ui.type(screen.getByLabelText('Confirme a nova senha'), confirmacao)
  await ui.click(screen.getByRole('button', { name: 'Salvar e entrar' }))
}

beforeEach(() => {
  h.trocar.mockReset().mockResolvedValue()
  h.senhaTrocada.mockReset()
  h.logout.mockReset()
})

describe('regra da senha nova', () => {
  it.each([
    ['curta1', 'curta1', /pelo menos 8/],
    ['somenteletras', 'somenteletras', /letras e números/],
    ['12345678', '12345678', /letras e números/],
    ['Senha1234', 'Senha12345', /não conferem/],
  ])('recusa %s', (a, b, esperado) => expect(validarNovaSenha(a, b)).toMatch(esperado))

  it('aceita letras e números com 8 ou mais caracteres', () => {
    expect(validarNovaSenha('Senha1234', 'Senha1234')).toBe('')
  })
})

describe('tela "Crie a sua senha"', () => {
  it('explica o motivo e mostra de quem é o acesso', () => {
    abrir()
    expect(screen.getByRole('heading', { name: 'Crie a sua senha' })).toBeInTheDocument()
    expect(screen.getByText(/ana@crt08.gov.br/)).toBeInTheDocument()
    expect(screen.getByText(/senha que você usou para entrar é provisória/)).toBeInTheDocument()
  })

  it('senha inválida mostra o motivo e não chama o servidor', async () => {
    const ui = userEvent.setup()
    abrir()
    await preencher(ui, 'curta1')
    expect(await screen.findByRole('alert')).toHaveTextContent(/pelo menos 8/)
    expect(h.trocar).not.toHaveBeenCalled()
  })

  it('senhas diferentes não são enviadas', async () => {
    const ui = userEvent.setup()
    abrir()
    await preencher(ui, 'Senha1234', 'Senha4321')
    expect(await screen.findByRole('alert')).toHaveTextContent(/não conferem/)
    expect(h.trocar).not.toHaveBeenCalled()
  })

  it('senha válida: grava, libera o acesso e vai para o sistema', async () => {
    const ui = userEvent.setup()
    abrir()
    await preencher(ui, 'Senha1234')
    await waitFor(() => expect(screen.getByText('área do sistema')).toBeInTheDocument())
    expect(h.trocar).toHaveBeenCalledWith('Senha1234')
    expect(h.senhaTrocada).toHaveBeenCalledOnce()
  })

  it('se o servidor recusar (ex.: igual à anterior), mostra a mensagem e continua retida', async () => {
    h.trocar.mockRejectedValue({ code: 'same_password', message: 'New password should be different from the old password.' })
    const ui = userEvent.setup()
    abrir()
    await preencher(ui, 'Senha1234')
    expect(await screen.findByRole('alert')).toHaveTextContent('A nova senha precisa ser diferente da atual.')
    expect(h.senhaTrocada).not.toHaveBeenCalled()
    expect(screen.queryByText('área do sistema')).not.toBeInTheDocument()
  })

  it('permite sair sem trocar', async () => {
    const ui = userEvent.setup()
    abrir()
    await ui.click(screen.getByRole('button', { name: /Sair/ }))
    expect(h.logout).toHaveBeenCalledOnce()
  })
})

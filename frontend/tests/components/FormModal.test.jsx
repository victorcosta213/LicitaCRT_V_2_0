import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const alerts = vi.hoisted(() => ({ showError: vi.fn() }))
vi.mock('../../src/utils/alerts', () => alerts)

import FormModal from '../../src/components/gc/FormModal'

beforeEach(() => alerts.showError.mockReset())

const FIELDS = [
  { type: 'section', label: 'Dados' },
  { name: 'nome', label: 'Nome', required: true },
  { name: 'obs', label: 'Obs' },
  { name: 'valor', label: 'Valor', type: 'money' },
  { name: 'qtd', label: 'Quantidade', type: 'number' },
  { name: 'data', label: 'Data', type: 'date' },
  { name: 'ativo', label: 'Ativo', type: 'checkbox' },
  { name: 'regular', label: 'Regular?', type: 'sn' },
  { name: 'tipo', label: 'Tipo', type: 'select', options: ['A', { value: 'b', label: 'Bê' }] },
  { name: 'travado', label: 'Travado', readOnly: true },
  { name: 'extra', label: 'Extra', show: (v) => v.ativo },
]

function setup(props = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<FormModal title="Teste" fields={FIELDS} onSubmit={onSubmit} onClose={onClose} {...props} />)
  return { onSubmit, onClose, user: userEvent.setup() }
}

describe('FormModal', () => {
  it('converte os valores conforme o tipo do campo', async () => {
    const { onSubmit, onClose, user } = setup({ initial: { travado: 'X' } })
    await user.type(screen.getByLabelText(/Nome/), 'Fulano')
    await user.type(screen.getByLabelText('Valor'), '1234.56')
    await user.selectOptions(screen.getByLabelText('Regular?'), 'sim')
    await user.selectOptions(screen.getByLabelText('Tipo'), 'b')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSubmit).toHaveBeenCalledWith({
      nome: 'Fulano', obs: null, valor: 1234.56, qtd: null, data: null,
      ativo: false, regular: true, tipo: 'b',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('não envia campos somente leitura nem campos ocultos', async () => {
    const { onSubmit, user } = setup({ initial: { nome: 'A', travado: 'X', extra: 'oculto' } })
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    const enviado = onSubmit.mock.calls[0][0]
    expect(enviado).not.toHaveProperty('travado')
    expect(enviado).not.toHaveProperty('extra')
  })

  it('campo condicional aparece e é enviado quando a condição vale', async () => {
    const { onSubmit, user } = setup({ initial: { nome: 'A' } })
    expect(screen.queryByLabelText('Extra')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Ativo'))
    await user.type(screen.getByLabelText('Extra'), 'sim')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ ativo: true, extra: 'sim' })
  })

  it('sim/não vazio vira null e preserva valores iniciais', async () => {
    const { onSubmit, user } = setup({ initial: { nome: 'A', regular: false, valor: 10 } })
    expect(screen.getByLabelText('Regular?')).toHaveValue('nao')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ regular: false, valor: 10 })
  })

  it('erro de validação mantém o modal aberto e mostra a mensagem', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('A glosa não pode ser maior.'))
    const { onClose, user } = setup({ onSubmit, initial: { nome: 'A' } })
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(alerts.showError).toHaveBeenCalledWith('A glosa não pode ser maior.')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
  })

  it('campo obrigatório vazio impede o envio', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

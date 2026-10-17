import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const h = vi.hoisted(() => ({ salvar: vi.fn(), showError: vi.fn() }))
vi.mock('../../src/utils/alerts', () => ({ showError: h.showError }))
vi.mock('../../src/components/gc/useGcActions', () => ({ useGcActions: () => ({ salvar: h.salvar }) }))

import ExecucaoModal from '../../src/components/gc/ExecucaoModal'

const empenho = (id, valorAtual, liquidado) => ({
  id, numero: id.toUpperCase(), exercicio: 2026, valorAtual, liquidado, saldo: valorAtual - liquidado, saldoDisponivel: valorAtual - liquidado,
})

function abrir({ empenhos = [empenho('e1', 10000, 0)], execucao = null, valor = 3000 } = {}) {
  const k = { id: 'c1', c: { numero: '001/2026' }, empenhos }
  const comp = { id: 'comp1', competencia: '2026-09-01', valor_liquido: valor, execucao }
  render(<ExecucaoModal k={k} comp={comp} onClose={() => {}} />)
  return userEvent.setup()
}

async function preencher(user, campos) {
  for (const [rotulo, valor] of Object.entries(campos)) {
    const el = screen.getByLabelText(new RegExp(`^${rotulo.replace(/[()$]/g, '\\$&')}`))
    if (el.tagName === 'SELECT') await user.selectOptions(el, valor)
    else { await user.clear(el); await user.type(el, String(valor)) }
  }
  await user.click(screen.getByRole('button', { name: 'Salvar' }))
}

beforeEach(() => {
  h.salvar.mockReset().mockResolvedValue({})
  h.showError.mockReset()
})

describe('ExecucaoModal — validações do financeiro', () => {
  it('lança liquidação e pagamento vinculados à competência', async () => {
    const user = abrir()
    await preencher(user, {
      'Empenho utilizado': 'e1', 'Data da liquidação': '2026-10-01', 'Valor liquidado': 3000,
      'Retenções': 300, 'Data do pagamento': '2026-10-05', 'Valor pago': 2700,
    })
    expect(h.showError).not.toHaveBeenCalled()
    expect(h.salvar).toHaveBeenCalledWith('execucoes', expect.objectContaining({
      empenho_id: 'e1', valor_competencia: 3000, valor_liquidado: 3000, retencao: 300, valor_pago: 2700,
      contrato_id: 'c1', competencia_id: 'comp1',
    }), undefined)
  })

  it.each([
    [{ 'Empenho utilizado': 'e1', 'Valor liquidado': 1000 }, 'Informe a data da liquidação.'],
    [{ 'Empenho utilizado': 'e1', 'Valor pago': 100, 'Data do pagamento': '2026-10-05' }, 'Não há pagamento sem liquidação.'],
    [{ 'Empenho utilizado': 'e1', 'Valor pago': 100 }, 'Informe a data do pagamento.'],
    [{ 'Empenho utilizado': 'e1', 'Data da liquidação': '2026-10-01', 'Valor liquidado': 3500 }, 'O valor liquidado não pode superar o valor da competência.'],
    [{ 'Empenho utilizado': 'e1', 'Data da liquidação': '2026-10-01', 'Valor liquidado': 3000, 'Retenções': 500, 'Data do pagamento': '2026-10-05', 'Valor pago': 2600 }, 'Pagamento somado às retenções supera o valor liquidado.'],
  ])('bloqueia %j', async (campos, mensagem) => {
    const user = abrir()
    await preencher(user, campos)
    expect(h.showError).toHaveBeenCalledWith(mensagem)
    expect(h.salvar).not.toHaveBeenCalled()
  })

  it('bloqueia liquidação acima do saldo do empenho', async () => {
    const user = abrir({ empenhos: [empenho('e1', 10000, 8000)] })
    await preencher(user, { 'Empenho utilizado': 'e1', 'Data da liquidação': '2026-10-01', 'Valor liquidado': 3000 })
    expect(h.showError).toHaveBeenCalledWith('Saldo insuficiente no empenho E1/2026. Solicite reforço antes de liquidar.')
  })

  it('ao editar, desconta do saldo o que a própria execução já havia liquidado', async () => {
    const execucao = { id: 'x1', empenho_id: 'e1', valor_competencia: 3000, valor_liquidado: 3000, data_liquidacao: '2026-10-01' }
    const user = abrir({ empenhos: [empenho('e1', 10000, 10000)], execucao })
    await preencher(user, { 'Valor liquidado': 3000 })
    expect(h.showError).not.toHaveBeenCalled()
    expect(h.salvar).toHaveBeenCalledWith('execucoes', expect.any(Object), 'x1')
  })

  // Antes o valor já liquidado era descontado do NOVO empenho (onde nunca esteve).
  it('trocar de empenho não libera liquidação acima do saldo do novo empenho', async () => {
    const execucao = { id: 'x1', empenho_id: 'e1', valor_competencia: 3000, valor_liquidado: 3000, data_liquidacao: '2026-10-01' }
    const user = abrir({ empenhos: [empenho('e1', 10000, 3000), empenho('e2', 5000, 4000)], execucao })
    await preencher(user, { 'Empenho utilizado': 'e2' })
    expect(h.showError).toHaveBeenCalledWith('Saldo insuficiente no empenho E2/2026. Solicite reforço antes de liquidar.')
    expect(h.salvar).not.toHaveBeenCalled()
  })

  it('trocar para um empenho com saldo é permitido', async () => {
    const execucao = { id: 'x1', empenho_id: 'e1', valor_competencia: 3000, valor_liquidado: 3000, data_liquidacao: '2026-10-01' }
    const user = abrir({ empenhos: [empenho('e1', 10000, 3000), empenho('e2', 5000, 1000)], execucao })
    await preencher(user, { 'Empenho utilizado': 'e2' })
    expect(h.salvar).toHaveBeenCalledWith('execucoes', expect.objectContaining({ empenho_id: 'e2' }), 'x1')
  })
})

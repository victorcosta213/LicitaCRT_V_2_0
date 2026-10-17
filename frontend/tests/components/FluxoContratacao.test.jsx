// Telas do fluxo: registro da NF pelo fiscal, OS/OC e portaria.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const h = vi.hoisted(() => ({
  salvar: vi.fn(), executar: vi.fn(), cancelar: vi.fn(),
  role: 'fiscal',
  showError: vi.fn(), showSuccess: vi.fn(), showConfirm: vi.fn(),
}))
vi.mock('../../src/utils/alerts', () => ({
  showError: h.showError, showSuccess: h.showSuccess, showConfirm: h.showConfirm, pedirTexto: vi.fn(),
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../src/components/gc/useGcActions', async () => {
  const { can } = await import('../../src/utils/permissions')
  return {
    useGcActions: () => ({
      salvar: h.salvar, executar: h.executar, cancelar: h.cancelar, role: h.role, nome: 'Usuário',
      user: { id: 'u1' }, params: {}, can: (acao) => can(h.role, acao),
    }),
  }
})

import RegistrarNFModal from '../../src/components/gc/RegistrarNFModal'
import OSTable from '../../src/components/gc/OSTable'
import { PortariaCard } from '../../src/components/gc/Formalizacao'

const k = (extra = {}) => ({
  id: 'c1', c: { id: 'c1', numero: '001/2026', contratada: 'ACME', objeto: 'Limpeza', ...extra.c },
  b: { competencias: [], responsaveis: [], os: [], ...extra.b },
  empenhos: [], fiscalTitular: null, fiscalSubstituto: null, formalizada: false, diasVigencia: 100,
  ...extra.k,
})

beforeEach(() => {
  for (const f of [h.salvar, h.executar, h.cancelar, h.showError, h.showSuccess]) f.mockReset()
  h.salvar.mockResolvedValue({})
  h.executar.mockResolvedValue({})
  h.showConfirm.mockReset().mockResolvedValue(true)
  h.role = 'fiscal'
})

describe('fiscal registra a NF (§12)', () => {
  const preencher = async (user) => {
    fireEvent.change(screen.getByLabelText(/^Competência/), { target: { value: '2026-10' } })
    await user.type(screen.getByLabelText(/^Nº da NF/), '458')
    await user.type(screen.getByLabelText(/^Valor bruto/), '1000')
    await user.click(screen.getByRole('button', { name: 'Registrar NF' }))
  }

  it('abre a competência já com a NF quando ela ainda não existe', async () => {
    render(<RegistrarNFModal contratacoes={[k()]} onClose={() => {}} />)
    const user = userEvent.setup()
    await preencher(user)
    expect(h.salvar).toHaveBeenCalledWith('competencias', expect.objectContaining({
      contrato_id: 'c1', competencia: '2026-10-01', nf_recebida: true, nf_numero: '458', nf_valor_bruto: 1000,
    }))
  })

  it('completa a competência aberta pela Gestão', async () => {
    render(<RegistrarNFModal contratacoes={[k({ b: { competencias: [{ id: 'k10', competencia: '2026-10-01' }] } })]} onClose={() => {}} />)
    const user = userEvent.setup()
    await preencher(user)
    expect(h.salvar).toHaveBeenCalledWith('competencias', expect.objectContaining({ nf_recebida: true }), 'k10')
  })

  it('não duplica NF já registrada', async () => {
    render(<RegistrarNFModal contratacoes={[k({ b: { competencias: [{ id: 'k10', competencia: '2026-10-01', nf_recebida: true }] } })]} onClose={() => {}} />)
    const user = userEvent.setup()
    await preencher(user)
    expect(h.showError).toHaveBeenCalledWith('A NF de outubro/2026 já foi registrada. Abra a competência para corrigir.')
    expect(h.salvar).not.toHaveBeenCalled()
  })
})

describe('OS/OC (§9)', () => {
  const tabela = (os, extra) => render(
    <MemoryRouter><OSTable rows={[{ k: k(extra), os: { id: 'os1', tipo: 'oc', numero_os: '3', objeto_autorizado: 'Toner', ...os } }]} /></MemoryRouter>,
  )

  it('não vai para assinatura antes da fiscalização formalizada', async () => {
    h.role = 'gestor'
    tabela({ status: 'em_conferencia' })
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para assinatura' }))
    expect(h.showError).toHaveBeenCalledWith(expect.stringMatching(/fiscalização formalizada/))
    expect(h.salvar).not.toHaveBeenCalled()
  })

  it('formalizada, segue para assinatura', async () => {
    h.role = 'gestor'
    tabela({ status: 'em_conferencia' }, { k: { formalizada: true } })
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para assinatura' }))
    expect(h.salvar).toHaveBeenCalledWith('ordens', { status: 'aguardando_assinatura' }, 'os1')
  })

  it('o Gabinete registra as assinaturas pela função do banco', async () => {
    h.role = 'gabinete'
    tabela({ status: 'aguardando_assinatura' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Registrar assinaturas' }))
    await user.type(screen.getByLabelText('Assinatura do Presidente'), '2026-10-13')
    await user.type(screen.getByLabelText('Assinatura do Diretor Financeiro'), '2026-10-14')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(h.executar).toHaveBeenCalledWith('gc_registrar_assinatura_os', expect.objectContaining({
      p_os: 'os1', p_presidente: '2026-10-13', p_diretor: '2026-10-14',
    }))
  })

  it('cancelar pede justificativa (via ação padrão)', async () => {
    h.role = 'gestor'
    tabela({ status: 'solicitada' })
    await userEvent.click(screen.getByTitle('Cancelar'))
    expect(h.cancelar).toHaveBeenCalledWith('ordens', 'os1', { status: 'cancelada' }, expect.any(String))
  })

  it('Compras não vê ações da Gestão nem cancela OS já em tratamento', () => {
    h.role = 'compras'
    tabela({ status: 'em_conferencia' })
    expect(screen.queryByRole('button', { name: 'Enviar para assinatura' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Cancelar')).not.toBeInTheDocument()
  })
})

describe('portaria de designação (§7)', () => {
  it('não segue sem titular e substituto', () => {
    h.role = 'gestor'
    render(<PortariaCard k={k()} />)
    expect(screen.getByRole('button', { name: /Encaminhar para assinatura\/publicação/ })).toBeDisabled()
  })

  it('com os fiscais designados, é encaminhada para assinatura/publicação', async () => {
    h.role = 'gestor'
    render(<PortariaCard k={k({ k: { fiscalTitular: { nome: 'Bia' }, fiscalSubstituto: { nome: 'Caio' } } })} />)
    await userEvent.click(screen.getByRole('button', { name: /Encaminhar para assinatura\/publicação/ }))
    expect(h.salvar).toHaveBeenCalledWith('contratos', { portaria_status: 'aguardando_publicacao' }, 'c1')
  })

  it('o fiscal só consulta a portaria', () => {
    h.role = 'fiscal'
    render(<PortariaCard k={k({ k: { fiscalTitular: { nome: 'Bia' }, fiscalSubstituto: { nome: 'Caio' } } })} />)
    expect(screen.queryByRole('button', { name: /Encaminhar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Registrar publicação/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gerar minuta/ })).toBeInTheDocument()
  })
})

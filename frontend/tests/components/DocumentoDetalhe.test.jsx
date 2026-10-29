// Editor e leitura de um documento: preencher, salvar, enviar, assinar, recusar e cancelar.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const h = vi.hoisted(() => ({
  auth: {}, obter: vi.fn(), salvar: vi.fn(), enviar: vi.fn(), assinar: vi.fn(), recusar: vi.fn(), cancelar: vi.fn(), pessoas: vi.fn(),
  erro: vi.fn(), ok: vi.fn(),
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/components/useAtualizacao', () => ({ useAtualizacaoAutomatica: () => {} }))
vi.mock('../../src/components/documentos/useContextoDocumento', () => ({
  useContextoDocumento: () => ({ pronto: true, ctx: { orgao: 'CRT-08', cidade: 'Aracaju', numero: 'OF-2026/000001', data: new Date('2026-10-29T12:00:00'), autor: { id: 'eu', nome: 'Ana' }, unidade: null, processo: null } }),
}))
vi.mock('../../src/utils/alerts', () => ({ showError: h.erro, showSuccess: h.ok, showConfirm: vi.fn() }))
vi.mock('../../src/services/documentos', async (importOriginal) => ({
  ...(await importOriginal()),
  obterDocumento: h.obter,
  salvarDocumento: h.salvar,
  enviarParaAssinatura: h.enviar,
  assinarDocumento: h.assinar,
  recusarAssinatura: h.recusar,
  cancelarDocumento: h.cancelar,
  listarPessoasParaAssinar: h.pessoas,
}))

import DocumentoDetalhe from '../../src/pages/DocumentoDetalhe'
import { B, renderizar, valoresIniciais } from '../../src/modelos/base'
import { modeloPorCodigo } from '../../src/modelos/catalogo'

const OFICIO = modeloPorCodigo('oficio')
const COMPLETO = {
  ...valoresIniciais(OFICIO, {}), destinatario: 'Sr. João', orgao_destinatario: 'Empresa X', assunto: 'Proposta', texto: 'Solicitamos proposta.',
  assinante: 'Ana', cargo_assinante: 'Analista',
}
const doc = (extra) => ({
  id: 'd1', numero: 'OF-2026/000001', titulo: 'Ofício', modelo: 'oficio', status: 'rascunho', versao: 1, conteudo: COMPLETO,
  corpo: [B.p('Texto gravado')], criado_por: 'eu', criado_por_nome: 'Ana', unidade_id: 'u1', processo_id: null, criado_em: '2026-10-29T10:00:00Z',
  codigo_verificacao: null, hash: null, ...extra,
})
const ass = (extra) => ({ id: 'a1', documento_id: 'd1', usuario_id: 'outro', nome: 'Fábio', papel: 'Presidente', status: 'pendente', versao: 1, ...extra })

function abrir(role = 'compras') {
  h.auth = { role, user: { id: 'eu', email: 'eu@x.com' }, profile: { id: 'eu', unidade_id: 'u1' }, nome: 'Ana' }
  return render(
    <MemoryRouter initialEntries={['/documentos/d1']}>
      <Routes><Route path="/documentos/:id" element={<DocumentoDetalhe />} /></Routes>
    </MemoryRouter>,
  )
}
const servir = (documento, assinaturas = []) => h.obter.mockResolvedValue({ documento, assinaturas })

beforeEach(() => {
  localStorage.clear()
  for (const k of ['obter', 'salvar', 'enviar', 'assinar', 'recusar', 'cancelar', 'pessoas', 'erro', 'ok']) h[k].mockReset()
  h.salvar.mockResolvedValue()
  h.enviar.mockResolvedValue()
  h.assinar.mockResolvedValue()
  h.recusar.mockResolvedValue()
  h.cancelar.mockResolvedValue()
  h.pessoas.mockResolvedValue([{ id: 'u2', nome: 'Fábio Nunes', role: 'gabinete' }])
})
afterEach(() => { vi.useRealTimers() })

describe('rascunho', () => {
  it('mostra o formulário e a prévia, e libera o envio quando tudo está preenchido', async () => {
    servir(doc())
    abrir()
    expect(await screen.findByText('Como o documento vai ficar')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/Assunto/)).toHaveValue('Proposta'))
    expect(screen.getByText(/Tudo preenchido/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar para assinatura/ })).toBeEnabled()
  })

  it('com campo vazio, diz o que falta e bloqueia o envio', async () => {
    servir(doc({ conteudo: { ...COMPLETO, assunto: '' } }))
    abrir()
    expect(await screen.findByText(/Para enviar para assinatura, falta/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar para assinatura/ })).toBeDisabled()
  })

  it('texto com [preencher: …] pendente também bloqueia', async () => {
    servir(doc({ conteudo: { ...COMPLETO, texto: 'Valor de [preencher: valor].' } }))
    abrir()
    expect(await screen.findByText(/Substituir/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar para assinatura/ })).toBeDisabled()
  })

  it('salva sozinho um instante depois de digitar', async () => {
    servir(doc())
    abrir()
    await screen.findByText('Como o documento vai ficar')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.change(screen.getByLabelText(/Assunto/), { target: { value: 'Novo assunto' } })
    expect(screen.getByText(/Alterações ainda não salvas/)).toBeInTheDocument()
    expect(h.salvar).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1600)
    await waitFor(() => expect(h.salvar).toHaveBeenCalledOnce())
    const [id, dados] = h.salvar.mock.calls[0]
    expect(id).toBe('d1')
    expect(dados.conteudo.assunto).toBe('Novo assunto')
    expect(JSON.stringify(dados.corpo)).toContain('Novo assunto')
    expect(await screen.findByText(/Salvo às/)).toBeInTheDocument()
  })

  it('falha ao salvar mostra o motivo', async () => {
    h.salvar.mockRejectedValue(new Error('O documento não está em rascunho.'))
    servir(doc())
    abrir()
    await screen.findByText('Como o documento vai ficar')
    await userEvent.setup().click(screen.getByRole('button', { name: /^Salvar/ }))
    expect(await screen.findByText(/não está em rascunho/)).toBeInTheDocument()
  })

  it('enviar: salva, abre a escolha de assinantes e manda para assinatura', async () => {
    const ui = userEvent.setup()
    servir(doc())
    abrir()
    await ui.click(await screen.findByRole('button', { name: /Enviar para assinatura/ }))
    const modal = await screen.findByRole('dialog')
    expect(h.salvar).toHaveBeenCalled()
    await ui.selectOptions(within(modal).getByLabelText(/^Pessoa/), 'u2')
    await ui.click(within(modal).getByRole('button', { name: 'Enviar para assinatura' }))
    await waitFor(() => expect(h.enviar).toHaveBeenCalledWith('d1', [{ usuario_id: 'u2', papel: expect.any(String) }]))
    await waitFor(() => expect(h.ok).toHaveBeenCalledWith('Documento enviado para assinatura.'))
  })

  it('quem é de outra unidade e não criou o documento só lê', async () => {
    servir(doc({ criado_por: 'outro', unidade_id: 'u9' }))
    abrir()
    expect(await screen.findByText('Texto gravado')).toBeInTheDocument()
    expect(screen.queryByText('Como o documento vai ficar')).toBeNull()
    expect(screen.queryByRole('button', { name: /Enviar para assinatura/ })).toBeNull()
  })

  it('o presidente (perfil master) edita mesmo sem ser o autor', async () => {
    servir(doc({ criado_por: 'outro', unidade_id: 'u9' }))
    abrir('presidente')
    expect(await screen.findByText('Como o documento vai ficar')).toBeInTheDocument()
  })

  it('o autor pode cancelar com motivo', async () => {
    const ui = userEvent.setup()
    servir(doc())
    abrir()
    await ui.click(await screen.findByRole('button', { name: 'Cancelar documento' }))
    const modal = await screen.findByRole('dialog')
    await ui.type(within(modal).getByLabelText(/Motivo do cancelamento/), 'Criado por engano')
    await ui.click(within(modal).getByRole('button', { name: 'Cancelar documento' }))
    await waitFor(() => expect(h.cancelar).toHaveBeenCalledWith('d1', 'Criado por engano'))
  })
})

describe('aguardando assinatura', () => {
  const aguardando = doc({ status: 'aguardando_assinatura', codigo_verificacao: 'A1B2C3D4E5F6', hash: 'cd'.repeat(32), corpo: [B.p('Texto congelado')] })

  it('o signatário vê o aviso, assina com a senha e a tela recarrega', async () => {
    const ui = userEvent.setup()
    servir(aguardando, [ass({ usuario_id: 'eu' })])
    abrir()
    expect(await screen.findByText(/aguarda a sua assinatura como/)).toBeInTheDocument()
    expect(screen.getByText('Texto congelado')).toBeInTheDocument()
    expect(screen.queryByText('Como o documento vai ficar')).toBeNull()
    await ui.click(screen.getByRole('button', { name: /^Assinar/ }))
    const modal = await screen.findByRole('dialog')
    await ui.type(within(modal).getByLabelText('Sua senha'), 'segredo')
    await ui.click(within(modal).getByLabelText(/Li o documento/))
    await ui.click(within(modal).getByRole('button', { name: 'Assinar' }))
    await waitFor(() => expect(h.assinar).toHaveBeenCalledWith('d1', { email: 'eu@x.com', senha: 'segredo' }))
    await waitFor(() => expect(h.ok).toHaveBeenCalledWith('Documento assinado.'))
    expect(h.obter.mock.calls.length).toBeGreaterThan(1)
  })

  it('quem não é signatário não vê o botão de assinar', async () => {
    servir(aguardando, [ass()])
    abrir()
    expect(await screen.findByText('Texto congelado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Assinar/ })).toBeNull()
    expect(screen.getByText('Aguardando')).toBeInTheDocument()
  })

  it('assinatura de uma versão antiga não vale', async () => {
    servir({ ...aguardando, versao: 2 }, [ass({ usuario_id: 'eu', versao: 1 })])
    abrir()
    await screen.findByText('Texto congelado')
    expect(screen.queryByRole('button', { name: /^Assinar/ })).toBeNull()
  })

  it('recusar exige o motivo e devolve a quem pediu', async () => {
    const ui = userEvent.setup()
    servir(aguardando, [ass({ usuario_id: 'eu' })])
    abrir()
    await ui.click(await screen.findByRole('button', { name: 'Recusar assinatura' }))
    const modal = await screen.findByRole('dialog')
    await ui.type(within(modal).getByLabelText(/Motivo da recusa/), 'Faltou o valor')
    await ui.click(within(modal).getByRole('button', { name: 'Recusar' }))
    await waitFor(() => expect(h.recusar).toHaveBeenCalledWith('d1', 'Faltou o valor'))
    await waitFor(() => expect(h.ok).toHaveBeenCalledWith('Assinatura recusada.'))
  })

  it('erro do banco ao assinar não fecha a tela nem derruba a página', async () => {
    const ui = userEvent.setup()
    h.assinar.mockRejectedValue({ message: 'Invalid login credentials' })
    servir(aguardando, [ass({ usuario_id: 'eu' })])
    abrir()
    await ui.click(await screen.findByRole('button', { name: /^Assinar/ }))
    const modal = await screen.findByRole('dialog')
    await ui.type(within(modal).getByLabelText('Sua senha'), 'errada')
    await ui.click(within(modal).getByLabelText(/Li o documento/))
    await ui.click(within(modal).getByRole('button', { name: 'Assinar' }))
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Senha incorreta')
    expect(h.ok).not.toHaveBeenCalled()
  })
})

describe('assinado, cancelado e casos de borda', () => {
  it('assinado: mostra o rodapé, o código e o hash, e não deixa editar', async () => {
    servir(doc({ status: 'assinado', codigo_verificacao: 'A1B2C3D4E5F6', hash: 'cd'.repeat(32), assinado_em: '2026-10-29T15:00:00Z' }),
      [ass({ status: 'assinada', usuario_id: 'outro', assinada_em: '2026-10-29T15:00:00Z' })])
    abrir()
    expect((await screen.findAllByText('A1B2-C3D4-E5F6')).length).toBeGreaterThan(0)
    expect(document.querySelector('.doc-hash').textContent).toBe('cd'.repeat(32))
    expect(screen.getByRole('link', { name: 'Conferir' })).toHaveAttribute('href', '/documentos/verificar/A1B2C3D4E5F6')
    expect(screen.queryByLabelText(/Assunto/)).toBeNull()
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeInTheDocument()
  })

  it('cancelado: mostra o motivo e não oferece cancelar de novo', async () => {
    servir(doc({ status: 'cancelado', cancelado_em: '2026-10-30T10:00:00Z', motivo_cancelamento: 'Duplicado' }))
    abrir()
    expect(await screen.findByText(/Documento cancelado/, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(/Duplicado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar documento' })).toBeNull()
  })

  it('mostra recusas de versões anteriores', async () => {
    servir(doc({ versao: 2, status: 'assinado', codigo_verificacao: 'A1B2C3D4E5F6', hash: 'cd'.repeat(32) }),
      [ass({ versao: 1, status: 'recusada', motivo_recusa: 'Faltou o valor' })])
    abrir()
    await screen.findByText('Versões anteriores')
    expect(screen.getByText(/recusou: Faltou o valor/)).toBeInTheDocument()
  })

  it('documento inexistente ou sem acesso', async () => {
    servir(null)
    abrir()
    expect(await screen.findByText('Documento não encontrado')).toBeInTheDocument()
  })

  it('banco sem as tabelas explica o que aplicar; outro erro mostra o motivo', async () => {
    h.obter.mockRejectedValue({ code: '42P01', message: 'relation "documentos" does not exist' })
    const { unmount } = abrir()
    expect(await screen.findByText('Os documentos ainda não foram ativados')).toBeInTheDocument()
    unmount()
    h.obter.mockRejectedValue(new Error('sem rede'))
    abrir()
    expect(await screen.findByText(/Não foi possível carregar o documento: sem rede/)).toBeInTheDocument()
  })

  it('a prévia do rascunho vem do modelo, com marca d\'água', async () => {
    servir(doc())
    abrir()
    await screen.findByText('Como o documento vai ficar')
    expect(document.querySelector('.doc-marca').textContent).toBe('RASCUNHO')
    expect(JSON.stringify(renderizar(OFICIO, COMPLETO, { numero: 'OF-2026/000001' }))).toContain('Solicitamos proposta')
  })
})

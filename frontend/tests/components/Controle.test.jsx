// Módulo de processos licitatórios (tela Controle) contra o schema real da tabela `processos`.
// O serviço de processos é o real; só o acesso ao banco (services/db) é simulado.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { colunasInexistentes } from '../fixtures/schemaProcessos'

const h = vi.hoisted(() => ({
  rows: [],
  role: 'compras',
  listAll: vi.fn(), createDoc: vi.fn(), createMany: vi.fn(), updateById: vi.fn(), removeById: vi.fn(), findBy: vi.fn(),
  uploadFile: vi.fn(), removeFile: vi.fn(),
  showError: vi.fn(), showSuccess: vi.fn(), showConfirm: vi.fn(),
}))
vi.mock('../../src/services/db', () => ({
  listAll: h.listAll, createDoc: h.createDoc, createMany: h.createMany, updateById: h.updateById,
  removeById: h.removeById, findBy: h.findBy,
}))
vi.mock('../../src/services/files', () => ({ uploadFile: h.uploadFile, removeFile: h.removeFile, abrirAnexo: vi.fn() }))
vi.mock('../../src/services/export', () => ({ exportToExcel: vi.fn(), exportToPdf: vi.fn() }))
vi.mock('../../src/utils/alerts', () => ({ showError: h.showError, showSuccess: h.showSuccess, showConfirm: h.showConfirm }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: h.role }) }))

import Controle from '../../src/pages/Controle'

async function abrir() {
  const r = render(<MemoryRouter><Controle /></MemoryRouter>)
  await waitFor(() => expect(screen.queryByText('Carregando...')).not.toBeInTheDocument())
  return { ...r, user: userEvent.setup() }
}
const campo = (container, nome) => container.querySelector(`#modalControle [name="${nome}"]`)
const enviarFormulario = (container) => fireEvent.submit(campo(container, 'numero').closest('form'))

async function cadastrar(container, user, numero = '2026/010', objeto = 'Compra de cadeiras') {
  await user.type(campo(container, 'numero'), numero)
  await user.type(campo(container, 'objeto'), objeto)
  enviarFormulario(container)
}

beforeEach(() => {
  localStorage.clear()
  h.rows = []
  h.role = 'compras'
  for (const f of [h.createDoc, h.createMany, h.updateById, h.removeById, h.uploadFile, h.removeFile, h.showError, h.showSuccess]) f.mockReset()
  h.listAll.mockReset().mockImplementation(() => Promise.resolve(h.rows))
  h.createDoc.mockResolvedValue({})
  h.createMany.mockResolvedValue([])
  h.updateById.mockResolvedValue(true)
  h.removeById.mockResolvedValue(true)
  h.findBy.mockReset().mockResolvedValue([])
  h.showConfirm.mockReset().mockResolvedValue(true)
})

describe('Controle — processos licitatórios', () => {
  it('lista os processos carregados', async () => {
    h.rows = [{ id: 'p1', numero: '2026/001', objeto: 'Papel A4', etapa: 'Aberto', prazo: null }]
    const { container } = await abrir()
    const tabela = within(container.querySelector('tbody'))
    expect(tabela.getByText('2026/001')).toBeInTheDocument()
    expect(tabela.getByText('Papel A4')).toBeInTheDocument()
    expect(h.listAll).toHaveBeenCalledWith('processos', 'created_at', false)
  })

  it('processos arquivados não aparecem na lista ativa', async () => {
    h.rows = [{ id: 'p1', numero: '2026/001', objeto: 'Ativo' }, { id: 'p2', numero: '2026/002', objeto: 'Arquivado', arquivado: true }]
    const { container } = await abrir()
    const tabela = within(container.querySelector('tbody'))
    expect(tabela.getByText('Ativo')).toBeInTheDocument()
    expect(tabela.queryByText('Arquivado')).not.toBeInTheDocument()
  })

  it('cadastrar exige número e objeto', async () => {
    const { container } = await abrir()
    enviarFormulario(container)
    expect(h.showError).toHaveBeenCalledWith('Informe o numero.')
    expect(h.createDoc).not.toHaveBeenCalled()
  })

  // Antes o formulário enviava camelCase (anexoPath, localDocumentacao...) e o banco recusava.
  it('cadastro grava somente colunas existentes na tabela processos', async () => {
    const { container, user } = await abrir()
    await user.selectOptions(campo(container, 'localDocumentacao'), 'DFD')
    await user.type(campo(container, 'prazo'), '2026-10-20')
    await cadastrar(container, user)
    await waitFor(() => expect(h.createDoc).toHaveBeenCalled())
    const [tabela, payload] = h.createDoc.mock.calls[0]
    expect(tabela).toBe('processos')
    expect(colunasInexistentes(payload)).toEqual([])
    expect(payload).toMatchObject({ numero: '2026/010', objeto: 'Compra de cadeiras', local_documentacao: 'DFD', prazo: '2026-10-20' })
  })

  // Antes a checagem lia `res.data` (formato antigo) e nunca encontrava duplicados.
  it('impede cadastrar número de processo já existente', async () => {
    h.findBy.mockResolvedValue([{ id: 'outro', numero: '2026/010' }])
    const { container, user } = await abrir()
    await cadastrar(container, user)
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith('Ja existe um processo com esse numero.'))
    expect(h.findBy).toHaveBeenCalledWith('processos', 'numero', '2026/010')
    expect(h.createDoc).not.toHaveBeenCalled()
  })

  it('editar mantém prazo, anexo e valores, gravando nos nomes do banco', async () => {
    h.rows = [{
      id: 'p1', numero: '2026/001', objeto: 'Papel A4', prazo: '2026-10-20', tipo: 'Dispensa',
      local_documentacao: 'DFD', valor_cotado: '1.000,00', anexo_path: 'anexos/2026/001/edital.pdf',
    }]
    const { container, user } = await abrir()
    await user.click(screen.getAllByTitle('Editar')[0])
    expect(campo(container, 'prazo')).toHaveValue('2026-10-20')
    enviarFormulario(container)
    await waitFor(() => expect(h.updateById).toHaveBeenCalled())
    const [tabela, id, payload] = h.updateById.mock.calls[0]
    expect([tabela, id]).toEqual(['processos', 'p1'])
    expect(colunasInexistentes(payload)).toEqual([])
    expect(payload).toMatchObject({
      prazo: '2026-10-20', local_documentacao: 'DFD', valor_cotado: '1.000,00', anexo_path: 'anexos/2026/001/edital.pdf',
    })
  })

  it('se o anexo não sobe, o processo não é salvo', async () => {
    h.uploadFile.mockRejectedValue(new Error('storage'))
    const { container, user } = await abrir()
    const arquivo = new File(['%PDF'], 'edital.pdf', { type: 'application/pdf' })
    fireEvent.change(container.querySelector('#modalControle input[type="file"]'), { target: { files: [arquivo] } })
    await cadastrar(container, user)
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith('Falha ao enviar o anexo. O processo não foi salvo.'))
    expect(h.createDoc).not.toHaveBeenCalled()
  })

  it('anexo enviado é gravado pelo caminho (bucket privado)', async () => {
    h.uploadFile.mockResolvedValue({ path: 'anexos/2026_010/edital.pdf' })
    const { container, user } = await abrir()
    const arquivo = new File(['%PDF'], 'edital.pdf', { type: 'application/pdf' })
    fireEvent.change(container.querySelector('#modalControle input[type="file"]'), { target: { files: [arquivo] } })
    await cadastrar(container, user)
    await waitFor(() => expect(h.createDoc).toHaveBeenCalled())
    expect(h.createDoc.mock.calls[0][1]).toMatchObject({ anexo_path: 'anexos/2026_010/edital.pdf', anexo_url: null })
  })

  // Antes a coluna `arquivado` não existia (migration 20261017 cria).
  it('arquivar grava somente colunas existentes na tabela processos', async () => {
    h.rows = [{ id: 'p1', numero: '2026/001', objeto: 'Papel A4' }]
    const { container, user } = await abrir()
    await user.click(container.querySelector('tbody input[type="checkbox"]'))
    await user.click(screen.getByRole('button', { name: /Arquivar \(1\)/ }))
    await waitFor(() => expect(h.updateById).toHaveBeenCalledWith('processos', 'p1', { arquivado: true }))
  })

  it('excluir remove o processo e depois o anexo', async () => {
    h.rows = [{ id: 'p1', numero: '2026/001', objeto: 'Papel A4', anexo_path: 'anexos/x.pdf' }]
    const { user } = await abrir()
    await user.click(screen.getAllByTitle('Excluir')[0])
    await waitFor(() => expect(h.removeById).toHaveBeenCalledWith('processos', 'p1'))
    expect(h.removeFile).toHaveBeenCalledWith('anexos/x.pdf')
  })

  it('importa planilha gravando apenas colunas existentes', async () => {
    h.rows = [{ id: 'p0', numero: '2026/001', objeto: 'Já existe' }]
    const { container } = await abrir()
    const ws = XLSX.utils.aoa_to_sheet([
      ['numero do Processo', 'Situação no SEI', 'nome do Processo', 'Unidade Demandante', 'Modalidade', 'Valor Estimado (R$)', 'Prioridade', 'Fase Atual'],
      ['2026/001', '', 'Duplicado', '', '', '', '', ''],
      ['2026/020', 'Em andamento', 'Material de limpeza', 'Almoxarifado', 'Pregão Eletrônico', 'R$ 8.500,00', 'Crítico', 'Fase local'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'P')
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const arquivo = new File([bytes], 'processos.xlsx')

    fireEvent.change(container.querySelector('input[type="file"][accept]'), { target: { files: [arquivo] } })

    await waitFor(() => expect(h.createMany).toHaveBeenCalled(), { timeout: 5000 })
    const [tabela, payload] = h.createMany.mock.calls[0]
    expect(tabela).toBe('processos')
    expect(payload).toHaveLength(1)
    expect(payload[0]).toMatchObject({ numero: '2026/020', valor_estimado: 8500, tipo: 'Pregao', prioridade: 'Critico', etapa: 'Fase local' })
    expect(colunasInexistentes(payload[0])).toEqual([])
    expect(h.showConfirm.mock.calls[0][1]).toMatch(/1 linha\(s\) ignorada\(s\)/)
    expect(h.showConfirm.mock.calls[0][1]).toMatch(/fora da lista oficial/)
  })

  it('visualizador consulta, mas não vê ações de gravação', async () => {
    h.role = 'viewer'
    h.rows = [{ id: 'p1', numero: '2026/001', objeto: 'Papel A4' }]
    const { container, user } = await abrir()
    expect(screen.queryByRole('button', { name: /Novo/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Importar/ })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Editar')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Excluir')).not.toBeInTheDocument()
    await user.click(container.querySelector('tbody input[type="checkbox"]'))
    expect(screen.queryByRole('button', { name: /Arquivar/ })).not.toBeInTheDocument()
  })
})

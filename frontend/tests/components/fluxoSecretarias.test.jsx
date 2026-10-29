// Fluxo das secretarias: itens do catálogo na DFD, cadastro do catálogo, arquivo enviado e encaminhamento.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

const h = vi.hoisted(() => ({
  auth: {}, catalogo: { carregando: false, ausente: false, erro: null, itens: [] },
  criar: vi.fn(), atualizar: vi.fn(), ativar: vi.fn(), conferir: vi.fn(), link: vi.fn(), erro: vi.fn(), ok: vi.fn(),
}))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => h.auth }))
vi.mock('../../src/components/compras/useCatalogoItens', () => ({ useCatalogoItens: () => h.catalogo }))
vi.mock('../../src/utils/alerts', () => ({ showError: h.erro, showSuccess: h.ok, showConfirm: vi.fn() }))
vi.mock('../../src/services/itens', async (importOriginal) => ({ ...(await importOriginal()), criarItem: h.criar, atualizarItem: h.atualizar, ativarItem: h.ativar }))
vi.mock('../../src/services/documentos', async (importOriginal) => ({ ...(await importOriginal()), conferirArquivo: h.conferir, linkDoArquivo: h.link }))

import ItensCatalogo from '../../src/components/documentos/ItensCatalogo'
import CatalogoItens from '../../src/pages/CatalogoItens'
import EnviarArquivoModal from '../../src/components/documentos/EnviarArquivoModal'
import DocumentoView from '../../src/components/documentos/DocumentoView'
import { sha256DoArquivo } from '../../src/services/documentos'

const ITENS = [
  { id: 'i1', codigo: 'INF-001', nome: 'Computador desktop', especificacao: '16 GB de RAM, SSD 512 GB', unidade_medida: 'unidade', categoria: 'Informática', objeto_tipo: 'bens-permanentes', valor_referencia: 4500, ativo: true },
  { id: 'i2', codigo: 'INF-002', nome: 'Monitor 24 polegadas', especificacao: 'Full HD', unidade_medida: 'unidade', categoria: 'Informática', objeto_tipo: 'bens-permanentes', valor_referencia: 950, ativo: true },
  { id: 'i3', codigo: 'OLD-1', nome: 'Computador antigo', especificacao: 'Desativado', unidade_medida: 'unidade', ativo: false },
]

beforeEach(() => {
  h.catalogo = { carregando: false, ausente: false, erro: null, itens: ITENS }
  for (const k of ['criar', 'atualizar', 'ativar', 'conferir', 'link', 'erro', 'ok']) h[k].mockReset()
  h.criar.mockResolvedValue(); h.atualizar.mockResolvedValue(); h.ativar.mockResolvedValue()
})

describe('itens do catálogo na DFD', () => {
  function Preso() {
    const [v, setV] = useState([])
    return <><ItensCatalogo campo={{ nome: 'itens', rotulo: 'Itens' }} linhas={v} onChange={setV} /><output data-testid="v">{JSON.stringify(v)}</output></>
  }
  const valor = () => JSON.parse(screen.getByTestId('v').textContent)

  it('procura no catálogo (só itens ativos), adiciona com a especificação e pede só a quantidade', async () => {
    const ui = userEvent.setup()
    render(<Preso />)
    await ui.type(screen.getByLabelText('Procurar item no catálogo'), 'computador')
    const opcoes = screen.getAllByRole('option')
    expect(opcoes).toHaveLength(1) // o desativado não aparece
    await ui.click(opcoes[0])
    expect(valor()).toEqual([{ item_id: 'i1', codigo: 'INF-001', nome: 'Computador desktop', especificacao: '16 GB de RAM, SSD 512 GB', unidade: 'unidade', valor_unitario: 4500, quantidade: '' }])
    expect(screen.getByText('16 GB de RAM, SSD 512 GB')).toBeInTheDocument()
    await ui.type(screen.getByLabelText('Quantidade de Computador desktop'), '30')
    expect(valor()[0].quantidade).toBe('30')
    expect(screen.getByText('Estimativa preliminar: R$ 135.000,00')).toBeInTheDocument()
  })

  it('item já escolhido não aparece de novo; dá para remover', async () => {
    const ui = userEvent.setup()
    render(<Preso />)
    await ui.type(screen.getByLabelText('Procurar item no catálogo'), 'INF')
    await ui.click(screen.getAllByRole('option')[0])
    await ui.type(screen.getByLabelText('Procurar item no catálogo'), 'INF')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Monitor')])
    await ui.click(screen.getByRole('button', { name: 'Remover Computador desktop' }))
    expect(valor()).toEqual([])
  })

  it('busca sem resultado e catálogo vazio orientam a pessoa', async () => {
    const ui = userEvent.setup()
    const { unmount } = render(<Preso />)
    await ui.type(screen.getByLabelText('Procurar item no catálogo'), 'zzz')
    expect(screen.getByText('Nenhum item encontrado no catálogo.')).toBeInTheDocument()
    unmount()
    h.catalogo = { ...h.catalogo, itens: [] }
    render(<Preso />)
    expect(screen.getByText(/O catálogo está vazio/)).toBeInTheDocument()
  })
})

describe('tela do catálogo', () => {
  it('a administração cadastra item', async () => {
    const ui = userEvent.setup()
    h.auth = { role: 'admin' }
    render(<CatalogoItens />)
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2) // desativado escondido
    await ui.click(screen.getByLabelText('Mostrar desativados'))
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(3)
    await ui.click(screen.getByRole('button', { name: /Novo item/ }))
    const modal = screen.getByRole('dialog')
    await ui.type(within(modal).getByLabelText(/Nome do item/), 'Cadeira')
    await ui.type(within(modal).getByLabelText(/Especificação técnica/), 'Giratória, NR-17')
    await ui.type(within(modal).getByLabelText(/Unidade de medida/), 'unidade')
    await ui.click(within(modal).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(h.criar).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Cadeira', especificacao: 'Giratória, NR-17', unidade_medida: 'unidade' })))
  })

  it('desativa item (sem apagar)', async () => {
    const ui = userEvent.setup()
    h.auth = { role: 'admin' }
    render(<CatalogoItens />)
    await ui.click(screen.getAllByRole('button', { name: 'Desativar' })[0])
    await waitFor(() => expect(h.ativar).toHaveBeenCalledWith('i1', false))
  })

  it('Compras e secretário só consultam', () => {
    for (const role of ['compras', 'secretario']) {
      h.auth = { role }
      const { unmount } = render(<CatalogoItens />)
      expect(screen.queryByRole('button', { name: /Novo item/ })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull()
      expect(screen.getByText('Computador desktop')).toBeInTheDocument()
      unmount()
    }
  })
})

describe('arquivo enviado como documento', () => {
  it('o SHA-256 do arquivo é calculado no navegador', async () => {
    expect(await sha256DoArquivo(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('o envio pede o arquivo e sugere o título pelo nome', async () => {
    const ui = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue()
    const onClose = vi.fn()
    render(<EnviarArquivoModal onSubmit={onSubmit} onClose={onClose} />)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    const f = new File(['%PDF'], 'proposta_empresa-x.pdf', { type: 'application/pdf' })
    await ui.upload(screen.getByLabelText(/^Arquivo/), f)
    expect(screen.getByLabelText(/^Título/)).toHaveValue('proposta empresa x')
    await ui.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ arquivo: f, titulo: 'proposta empresa x', descricao: '' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('arquivo acima de 20 MB é recusado antes de enviar', async () => {
    const ui = userEvent.setup()
    render(<EnviarArquivoModal onSubmit={vi.fn()} onClose={vi.fn()} />)
    const grande = new File(['x'], 'grande.pdf', { type: 'application/pdf' })
    Object.defineProperty(grande, 'size', { value: 21 * 1024 * 1024 })
    await ui.upload(screen.getByLabelText(/^Arquivo/), grande)
    expect(h.erro).toHaveBeenCalledWith('O arquivo deve ter até 20 MB.')
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  const bloco = { t: 'arquivo', nome: 'proposta.pdf', tipo: 'application/pdf', tamanho: 2048, sha256: 'ab'.repeat(32) }
  const doc = { status: 'rascunho', versao: 1, arquivo_path: 'u1/x-proposta.pdf' }

  it('o documento mostra o arquivo e confere o guardado com o código registrado', async () => {
    h.conferir.mockResolvedValue(true)
    render(<DocumentoView documento={doc} corpo={[bloco]} />)
    expect(screen.getByText('proposta.pdf')).toBeInTheDocument()
    expect(screen.getByText(`SHA-256 do arquivo: ${'ab'.repeat(32)}`)).toBeInTheDocument()
    expect(await screen.findByText(/O arquivo guardado confere/)).toBeInTheDocument()
    expect(h.conferir).toHaveBeenCalledWith('u1/x-proposta.pdf', 'ab'.repeat(32))
  })

  it('arquivo trocado no armazenamento dá alerta', async () => {
    h.conferir.mockResolvedValue(false)
    render(<DocumentoView documento={doc} corpo={[bloco]} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('NÃO confere')
  })
})

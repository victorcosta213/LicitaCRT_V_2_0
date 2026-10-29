// Desenho do documento, formulário dos campos e os modais de envio e de assinatura.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

const h = vi.hoisted(() => ({ erro: vi.fn() }))
vi.mock('../../src/utils/alerts', () => ({ showError: h.erro, showSuccess: vi.fn(), showConfirm: vi.fn() }))

import AssinarModal from '../../src/components/documentos/AssinarModal'
import DocumentoForm from '../../src/components/documentos/DocumentoForm'
import DocumentoView from '../../src/components/documentos/DocumentoView'
import EnviarAssinaturaModal from '../../src/components/documentos/EnviarAssinaturaModal'
import { B } from '../../src/modelos/base'
import { modeloPorCodigo } from '../../src/modelos/catalogo'

beforeEach(() => { h.erro.mockReset() })

describe('DocumentoView', () => {
  const corpo = [
    B.cab('Conselho Regional', 'OF-2026/000001', ''), B.titulo('OFÍCIO Nº OF-2026/000001'), B.secao('1. Objeto'), B.rotulo('Itens'),
    B.p('Primeiro parágrafo.'), B.campo('Assunto', 'Compra'), B.nota('Observação.'), B.lista(['a', 'b']), B.numerada(['um', 'dois']),
    B.tabela(['Item', 'Qtde'], [['Caneta', '10'], ['Papel', '5']]), B.espaco(), B.assina('Ana Ribeiro', 'Presidente'),
  ]
  const doc = { status: 'rascunho', versao: 1, codigo_verificacao: null, hash: null }

  it('desenha cada tipo de bloco', () => {
    render(<DocumentoView documento={doc} corpo={corpo} />)
    expect(screen.getByText('Conselho Regional')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'OFÍCIO Nº OF-2026/000001' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1. Objeto' })).toBeInTheDocument()
    expect(screen.getByText('Primeiro parágrafo.')).toBeInTheDocument()
    expect(screen.getByText('Assunto:')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['a', 'b', 'um', 'dois'])
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('Ana Ribeiro')).toBeInTheDocument()
    expect(screen.getByText('Presidente')).toBeInTheDocument()
  })

  it('tudo que foi digitado aparece como texto, nunca como código', () => {
    const malicioso = '<img src=x onerror="window.__invadido=1"><script>window.__invadido=1</script>'
    const { container } = render(<DocumentoView documento={doc} corpo={[B.p(malicioso), B.campo('R', malicioso), B.lista([malicioso]), B.tabela(['<b>c</b>'], [[malicioso]])]} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getAllByText(malicioso, { exact: false }).length).toBeGreaterThan(0)
    expect(window.__invadido).toBeUndefined()
  })

  it('destaca o que ainda falta preencher', () => {
    const { container } = render(<DocumentoView documento={doc} corpo={[B.p('Valor: [preencher: valor] e o resto.')]} />)
    const marca = container.querySelector('mark.doc-pendente')
    expect(marca.textContent).toBe('[preencher: valor]')
  })

  it('rascunho e cancelado têm marca d\'água; assinado, não', () => {
    const { container, rerender } = render(<DocumentoView documento={{ ...doc, status: 'rascunho' }} corpo={[]} />)
    expect(container.querySelector('.doc-marca').textContent).toBe('RASCUNHO')
    rerender(<DocumentoView documento={{ ...doc, status: 'cancelado' }} corpo={[]} />)
    expect(container.querySelector('.doc-marca--cancelado').textContent).toBe('CANCELADO')
    rerender(<DocumentoView documento={{ ...doc, status: 'assinado' }} corpo={[]} />)
    expect(container.querySelector('.doc-marca')).toBeNull()
  })

  it('o rodapé traz quem assinou, quem falta, o link e o código de verificação', () => {
    const documento = { status: 'aguardando_assinatura', versao: 2, codigo_verificacao: 'A1B2C3D4E5F6', hash: 'ab'.repeat(32) }
    const assinaturas = [
      { id: 1, versao: 2, status: 'assinada', nome: 'Ana Ribeiro', papel: 'Presidente', assinada_em: '2026-10-29T15:00:00Z' },
      { id: 2, versao: 2, status: 'pendente', nome: 'Beto Souza', papel: 'Jurídico' },
      { id: 3, versao: 1, status: 'assinada', nome: 'Velha Versão', papel: 'Antigo', assinada_em: '2026-10-01T10:00:00Z' },
    ]
    render(<DocumentoView documento={documento} corpo={[B.p('x')]} assinaturas={assinaturas} />)
    const rodape = screen.getByLabelText('Assinaturas e verificação')
    expect(rodape).toHaveTextContent('assinado eletronicamente por Ana Ribeiro (Presidente)')
    expect(rodape).toHaveTextContent('Aguardando a assinatura de Beto Souza (Jurídico)')
    expect(rodape).not.toHaveTextContent('Velha Versão')
    expect(rodape).toHaveTextContent('/verificar/A1B2C3D4E5F6')
    expect(rodape).toHaveTextContent('A1B2-C3D4-E5F6')
    expect(rodape).toHaveTextContent('ab'.repeat(32))
  })

  it('sem código nem assinatura, não há rodapé', () => {
    render(<DocumentoView documento={doc} corpo={[B.p('x')]} />)
    expect(screen.queryByLabelText('Assinaturas e verificação')).toBeNull()
  })
})

describe('DocumentoForm', () => {
  function Preso({ modelo, inicial, disabled }) {
    const [v, setV] = useState(inicial)
    return (
      <>
        <DocumentoForm modelo={modelo} valores={v} onChange={setV} disabled={disabled} />
        <output data-testid="valores">{JSON.stringify(v)}</output>
      </>
    )
  }
  const valores = () => JSON.parse(screen.getByTestId('valores').textContent)

  it('mostra os campos do modelo e grava o que a pessoa digita', async () => {
    const ui = userEvent.setup()
    render(<Preso modelo={modeloPorCodigo('oficio')} inicial={{ vocativo: 'Senhor', fecho: 'Atenciosamente,' }} />)
    await ui.type(screen.getByLabelText(/Assunto/), 'Proposta')
    await ui.selectOptions(screen.getByLabelText(/Tratamento/), 'Senhora')
    expect(valores()).toMatchObject({ assunto: 'Proposta', vocativo: 'Senhora' })
    expect(screen.getAllByTitle('Obrigatório').length).toBeGreaterThan(3)
    expect(screen.getByText(/Resuma em uma linha/)).toBeInTheDocument()
  })

  it('campos condicionais só aparecem quando a escolha pede', async () => {
    const ui = userEvent.setup()
    render(<Preso modelo={modeloPorCodigo('justificativa-direta')} inicial={{}} />)
    expect(screen.queryByLabelText(/Hipótese da dispensa/)).toBeNull()
    await ui.selectOptions(screen.getByLabelText(/Espécie/), 'dispensa')
    expect(screen.getByLabelText(/Hipótese da dispensa/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Hipótese da inexigibilidade/)).toBeNull()
    await ui.selectOptions(screen.getByLabelText(/Espécie/), 'inexigibilidade')
    expect(screen.getByLabelText(/Hipótese da inexigibilidade/)).toBeInTheDocument()
  })

  it('tabelas: adicionar e remover linhas', async () => {
    const ui = userEvent.setup()
    render(<Preso modelo={modeloPorCodigo('ata')} inicial={{ participantes: [{ nome: '', cargo: '' }] }} />)
    expect(screen.getByLabelText('Nome (linha 1)')).toBeInTheDocument()
    await ui.type(screen.getByLabelText('Nome (linha 1)'), 'Ana Ribeiro')
    await ui.click(screen.getAllByRole('button', { name: 'Adicionar linha' })[0])
    await ui.type(screen.getByLabelText('Nome (linha 2)'), 'Beto Souza')
    expect(valores().participantes).toEqual([expect.objectContaining({ nome: 'Ana Ribeiro' }), expect.objectContaining({ nome: 'Beto Souza' })])
    await ui.click(screen.getByRole('button', { name: 'Remover linha 1 de Participantes' }))
    expect(valores().participantes).toEqual([expect.objectContaining({ nome: 'Beto Souza' })])
    expect(screen.getByRole('button', { name: 'Remover linha 1 de Participantes' })).toBeDisabled() // a última linha fica
  })

  it('desabilitado: nada pode ser digitado', () => {
    render(<Preso modelo={modeloPorCodigo('oficio')} inicial={{}} disabled />)
    expect(screen.getByLabelText(/Assunto/)).toBeDisabled()
  })
})

describe('AssinarModal', () => {
  const documento = { numero: 'OF-2026/000001', titulo: 'Ofício de teste' }

  it('só habilita "Assinar" com a senha e a confirmação de leitura', async () => {
    const ui = userEvent.setup()
    render(<AssinarModal documento={documento} papel="Presidente" onSubmit={vi.fn()} onClose={vi.fn()} />)
    const botao = within(screen.getByRole('dialog')).getByRole('button', { name: 'Assinar' })
    expect(botao).toBeDisabled()
    await ui.type(screen.getByLabelText('Sua senha'), 'segredo')
    expect(botao).toBeDisabled()
    await ui.click(screen.getByLabelText(/Li o documento/))
    expect(botao).toBeEnabled()
    expect(screen.getByText(/assina como/)).toHaveTextContent('Presidente')
    expect(screen.getByText(/IP, o seu navegador/)).toBeInTheDocument()
  })

  it('assina com a senha digitada e fecha', async () => {
    const ui = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue()
    const onClose = vi.fn()
    render(<AssinarModal documento={documento} papel="Presidente" onSubmit={onSubmit} onClose={onClose} />)
    await ui.type(screen.getByLabelText('Sua senha'), 'segredo')
    await ui.click(screen.getByLabelText(/Li o documento/))
    await ui.click(screen.getByRole('button', { name: 'Assinar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('segredo'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('senha errada: mostra o motivo, continua aberto e permite tentar de novo', async () => {
    const ui = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValueOnce({ message: 'Invalid login credentials' }).mockResolvedValueOnce()
    const onClose = vi.fn()
    render(<AssinarModal documento={documento} papel="Presidente" onSubmit={onSubmit} onClose={onClose} />)
    await ui.type(screen.getByLabelText('Sua senha'), 'errada')
    await ui.click(screen.getByLabelText(/Li o documento/))
    await ui.click(screen.getByRole('button', { name: 'Assinar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta')
    expect(onClose).not.toHaveBeenCalled()
    await ui.clear(screen.getByLabelText('Sua senha'))
    await ui.type(screen.getByLabelText('Sua senha'), 'certa')
    await ui.click(screen.getByRole('button', { name: 'Assinar' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
})

describe('EnviarAssinaturaModal', () => {
  const pessoas = [{ id: 'u1', nome: 'Ana Ribeiro', role: 'gabinete' }, { id: 'u2', nome: 'Beto Souza', role: 'juridico' }]
  const modelo = { papeisSugeridos: ['Presidente', 'Jurídico'] }

  it('avisa que o texto fica congelado e sugere o primeiro papel do modelo', () => {
    render(<EnviarAssinaturaModal modelo={modelo} pessoas={pessoas} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('congelado')).toBeInTheDocument()
    expect(screen.getByLabelText('Papel na assinatura')).toHaveValue('Presidente')
    expect(screen.getByRole('option', { name: 'Ana Ribeiro — Gabinete' })).toBeInTheDocument()
  })

  it('envia as pessoas escolhidas com os papéis', async () => {
    const ui = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue()
    const onClose = vi.fn()
    render(<EnviarAssinaturaModal modelo={modelo} pessoas={pessoas} onSubmit={onSubmit} onClose={onClose} />)
    await ui.selectOptions(screen.getByLabelText(/^Pessoa/), 'u1')
    await ui.click(screen.getByRole('button', { name: /Adicionar assinante/ }))
    await ui.selectOptions(screen.getByLabelText('Pessoa 2'), 'u2')
    expect(screen.getAllByLabelText('Papel na assinatura')[1]).toHaveValue('Jurídico')
    await ui.click(screen.getByRole('button', { name: 'Enviar para assinatura' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([{ usuario_id: 'u1', papel: 'Presidente' }, { usuario_id: 'u2', papel: 'Jurídico' }]))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('não deixa escolher a mesma pessoa duas vezes', async () => {
    const ui = userEvent.setup()
    const onSubmit = vi.fn()
    render(<EnviarAssinaturaModal modelo={modelo} pessoas={pessoas} onSubmit={onSubmit} onClose={vi.fn()} />)
    await ui.selectOptions(screen.getByLabelText(/^Pessoa/), 'u1')
    await ui.click(screen.getByRole('button', { name: /Adicionar assinante/ }))
    await ui.selectOptions(screen.getByLabelText('Pessoa 2'), 'u1')
    await ui.click(screen.getByRole('button', { name: 'Enviar para assinatura' }))
    expect(h.erro).toHaveBeenCalledWith('A mesma pessoa foi escolhida mais de uma vez.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('o banco recusando mostra o motivo e mantém o modal aberto', async () => {
    const ui = userEvent.setup()
    const onClose = vi.fn()
    render(<EnviarAssinaturaModal modelo={modelo} pessoas={pessoas} onSubmit={vi.fn().mockRejectedValue(new Error('O documento está vazio.'))} onClose={onClose} />)
    await ui.selectOptions(screen.getByLabelText(/^Pessoa/), 'u1')
    await ui.click(screen.getByRole('button', { name: 'Enviar para assinatura' }))
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('O documento está vazio.'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

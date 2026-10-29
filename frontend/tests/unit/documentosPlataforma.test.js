import { describe, expect, it } from 'vitest'
import {
  STATUS, VISTAS_DOC, codigoFormatado, combinaBuscaDoc, naVistaDoc, ordenarDocumentos, pendentesDoUsuario, tarefaDeAssinatura, urlVerificacao,
} from '../../src/utils/documentosPlataforma'

const doc = (extra) => ({
  id: 'd1', numero: 'OF-2026/000001', titulo: 'Ofício de teste', modelo: 'oficio', status: 'rascunho', versao: 1, criado_por: 'ana', criado_por_nome: 'Ana',
  unidade_id: 'u-comp', processo_id: null, atualizado_em: '2026-10-29T12:00:00Z', ...extra,
})

describe('situações', () => {
  it('cada situação tem rótulo e cor', () => {
    expect(Object.keys(STATUS)).toEqual(['rascunho', 'aguardando_assinatura', 'assinado', 'cancelado'])
    for (const s of Object.values(STATUS)) expect(s.label && s.kind).toBeTruthy()
  })
})

describe('assinaturas pendentes da pessoa', () => {
  const docs = [
    doc({ id: 'a', status: 'aguardando_assinatura', versao: 2 }),
    doc({ id: 'b', status: 'assinado' }),
    doc({ id: 'c', status: 'aguardando_assinatura', versao: 1 }),
    doc({ id: 'd', status: 'cancelado' }),
  ]
  const ass = (documento_id, extra) => ({ id: documento_id, documento_id, usuario_id: 'eu', status: 'pendente', versao: 1, papel: 'Presidente', ...extra })

  it('só conta a assinatura pendente, da versão atual, de documento ainda aguardando', () => {
    const lista = pendentesDoUsuario(docs, [
      ass('a', { versao: 2 }),            // vale
      ass('a', { id: 'x', versao: 1, status: 'cancelada' }), // versão antiga e já cancelada
      ass('b'),                           // documento já assinado
      ass('c', { versao: 5 }),            // versão que não é a atual
      ass('d'),                           // cancelado
      ass('a', { id: 'y', usuario_id: 'outro', versao: 2 }), // de outra pessoa
      ass('c', { status: 'assinada' }),   // já assinou
    ], 'eu')
    expect(lista.map((p) => p.documento.id)).toEqual(['a'])
  })

  it('sem usuário, não há pendências', () => {
    expect(pendentesDoUsuario(docs, [ass('a', { versao: 2 })], null)).toEqual([])
  })

  it('a tarefa da mesa mostra o número, o título e o papel', () => {
    const t = tarefaDeAssinatura({ documento: doc({ id: 'a' }), assinatura: { papel: 'Presidente' } })
    expect(t).toMatchObject({ id: 'doc:a', categoria: 'Documento', severidade: 'warning', titulo: 'Documento aguardando a sua assinatura', ref: 'OF-2026/000001', to: '/documentos/a' })
    expect(t.sub).toContain('Presidente')
  })
})

describe('vistas e busca', () => {
  const eu = { usuarioId: 'ana', unidadeId: 'u-comp', pendentes: new Set(['p']) }
  it('cada vista filtra como o nome diz', () => {
    expect(VISTAS_DOC.map(([k]) => k)).toEqual(['todos', 'assinar', 'meus', 'unidade', 'rascunhos', 'assinados'])
    expect(naVistaDoc(doc({ id: 'p' }), 'assinar', eu)).toBe(true)
    expect(naVistaDoc(doc({ id: 'q' }), 'assinar', eu)).toBe(false)
    expect(naVistaDoc(doc(), 'meus', eu)).toBe(true)
    expect(naVistaDoc(doc({ criado_por: 'bia' }), 'meus', eu)).toBe(false)
    expect(naVistaDoc(doc(), 'unidade', eu)).toBe(true)
    expect(naVistaDoc(doc({ unidade_id: 'u-fin' }), 'unidade', eu)).toBe(false)
    expect(naVistaDoc(doc(), 'unidade', { usuarioId: 'ana' })).toBe(false)
    expect(naVistaDoc(doc(), 'rascunhos', eu)).toBe(true)
    expect(naVistaDoc(doc({ status: 'assinado' }), 'rascunhos', eu)).toBe(false)
    expect(naVistaDoc(doc({ status: 'assinado' }), 'assinados', eu)).toBe(true)
    expect(naVistaDoc(doc({ status: 'cancelado' }), 'todos', eu)).toBe(true)
  })

  it('a busca acha por número, título, autor, tipo e processo, sem ligar para maiúsculas', () => {
    const procs = new Map([['pr1', { numero: '2026/000010', assunto: 'Compra de notebooks' }]])
    const d = doc({ processo_id: 'pr1' })
    const nome = (c) => (c === 'oficio' ? 'Ofício' : c)
    for (const termo of ['000001', 'TESTE', 'ana', 'ofício', '2026/000010', 'notebooks', '']) expect(combinaBuscaDoc(d, termo, procs, nome), termo).toBe(true)
    expect(combinaBuscaDoc(d, 'zzz', procs, nome)).toBe(false)
  })

  it('ordena: aguardando assinatura, rascunho, assinado, cancelado; dentro de cada um, o mais recente primeiro', () => {
    const r = ordenarDocumentos([
      doc({ id: 'ca', status: 'cancelado' }), doc({ id: 'as1', status: 'assinado', atualizado_em: '2026-10-01T00:00:00Z' }),
      doc({ id: 'ra1', atualizado_em: '2026-10-10T00:00:00Z' }), doc({ id: 'ag', status: 'aguardando_assinatura' }),
      doc({ id: 'ra2', atualizado_em: '2026-10-20T00:00:00Z' }), doc({ id: 'as2', status: 'assinado', atualizado_em: '2026-10-05T00:00:00Z' }),
    ])
    expect(r.map((d) => d.id)).toEqual(['ag', 'ra2', 'ra1', 'as2', 'as1', 'ca'])
  })
})

describe('código de verificação', () => {
  it('formata em grupos de quatro e aceita qualquer forma de entrada', () => {
    expect(codigoFormatado('4955a8eb1ebcf')).toBe('4955-A8EB-1EBC-F')
    expect(codigoFormatado('4955-8EB1-EBCF')).toBe('4955-8EB1-EBCF')
    expect(codigoFormatado(' 4955 8eb1 ebcf ')).toBe('4955-8EB1-EBCF')
    expect(codigoFormatado(null)).toBe('')
  })

  it('o link de verificação leva ao endereço público, sem hífens', () => {
    expect(urlVerificacao('4955-8eb1-ebcf', 'https://app.crt08.org.br')).toBe('https://app.crt08.org.br/verificar/49558EB1EBCF')
  })
})

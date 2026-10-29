import { describe, expect, it } from 'vitest'
import { naVistaPedido, resumoPedidos, situacaoDoPedido, travasDoProcesso } from '../../src/utils/acompanhamentoPedidos'

const AGORA = new Date('2026-10-29T12:00:00Z')
const dia = (n) => new Date(AGORA.getTime() - n * 86400000).toISOString()
const UN = new Map([
  ['u-sms', { id: 'u-sms', sigla: 'SMS', nome: 'Secretaria de Saúde' }],
  ['u-comp', { id: 'u-comp', sigla: 'COMP', nome: 'Compras' }],
  ['u-jur', { id: 'u-jur', sigla: 'JUR', nome: 'Jurídico' }],
])
const proc = (extra) => ({
  id: 'p1', numero: '2026/000003', tipo: 'Contratação', situacao: 'em_andamento', unidade_atual: 'u-jur', desde: dia(2), recebido_em: dia(1),
  prazo: null, responsavel_nome: 'Helena', contratacao_modalidade: 'pregao', contratacao_objeto: 'bens-permanentes', ...extra,
})
const sol = (extra) => ({ id: 's1', numero: 'SOL-2026/000001', status: 'aceita', processo_id: 'p1', unidade_id: 'u-sms', enviada_em: dia(10), motivo: null, ...extra })
const op = { unidadesPorId: UN, agora: AGORA, diasParado: 5 }

describe('o que está travando o processo', () => {
  it('não recebido, parado, prazo vencido', () => {
    expect(travasDoProcesso(proc({ recebido_em: null }), op)[0]).toMatchObject({ nivel: 'warning', texto: expect.stringMatching(/Enviado a JUR \(Jurídico\) há 2 dia\(s\) e ainda não foi recebido/) })
    expect(travasDoProcesso(proc({ desde: dia(8) }), op).find((t) => t.nivel === 'danger').texto).toMatch(/Parado em JUR \(Jurídico\) há 8 dias, sem movimentação \(com Helena\)/)
    expect(travasDoProcesso(proc({ prazo: '2026-10-20' }), op)[0].texto).toMatch(/Prazo vencido em 20\/10\/2026/)
  })

  it('documento aguardando assinatura mostra quem falta assinar', () => {
    const documentos = [{ id: 'd1', processo_id: 'p1', modelo: 'etp', numero: 'ETP-2026/000001', status: 'aguardando_assinatura', versao: 1, atualizado_em: dia(6) }]
    const assinaturas = [
      { documento_id: 'd1', versao: 1, status: 'pendente', nome: 'Laura' },
      { documento_id: 'd1', versao: 1, status: 'assinada', nome: 'Diego' },
    ]
    const t = travasDoProcesso(proc(), { ...op, documentos, assinaturas }).find((x) => x.texto.startsWith('ETP'))
    expect(t).toMatchObject({ nivel: 'danger', quem: 'Laura' })
    expect(t.texto).toBe('ETP ETP-2026/000001 aguardando a assinatura de Laura há 6 dia(s).')
  })

  it('aponta o próximo documento obrigatório do roteiro e quem faz', () => {
    const documentos = [{ id: 'd', processo_id: 'p1', modelo: 'dfd', status: 'assinado' }]
    const prox = travasDoProcesso(proc(), { ...op, documentos }).find((t) => t.nivel === 'info')
    expect(prox.texto).toBe('Próximo documento: Estudo Técnico Preliminar (ETP).')
    expect(prox.quem).toMatch(/Compras/)
  })

  it('sem forma de contratação, avisa; concluído, diz quando', () => {
    expect(travasDoProcesso(proc({ contratacao_modalidade: null }), op).some((t) => /ainda não definiu a forma/.test(t.texto))).toBe(true)
    expect(travasDoProcesso(proc({ situacao: 'concluido', concluido_em: '2026-10-28' }), op)).toEqual([{ nivel: 'success', texto: 'Processo concluído em 28/10/2026.' }])
  })
})

describe('situação de cada pedido', () => {
  const ctx = { ...op, processosPorId: new Map([['p1', proc()]]) }

  it('na fila do Compras: trava quando passa do prazo de parado', () => {
    const unidades = new Map([...UN])
    const novo = situacaoDoPedido(sol({ status: 'enviada', enviada_em: dia(2), processo_id: null }), { ...ctx, unidadesPorId: unidades })
    expect(novo).toMatchObject({ grupo: 'analise', etapa: 1, travado: false })
    expect(novo.onde.unidade.sigla).toBe('COMP')
    expect(situacaoDoPedido(sol({ status: 'enviada', enviada_em: dia(9), processo_id: null }), ctx).travado).toBe(true)
  })

  it('devolvido: a ação é da secretaria', () => {
    const s = situacaoDoPedido(sol({ status: 'devolvida', motivo: 'Detalhe por UBS', analisada_em: dia(1) }), ctx)
    expect(s).toMatchObject({ grupo: 'ajuste', travado: true })
    expect(s.travas[0].texto).toMatch(/Detalhe por UBS/)
  })

  it('em andamento: onde está, por onde passou, último movimento e etapa do roteiro', () => {
    const tramitacoes = [
      { id: 1, processo_id: 'p1', tipo: 'abertura', de_unidade: 'u-sms', para_unidade: 'u-comp', criada_em: dia(9) },
      { id: 2, processo_id: 'p1', tipo: 'documento', para_unidade: 'u-comp', criada_em: dia(8) },
      { id: 3, processo_id: 'p1', tipo: 'envio', de_unidade: 'u-comp', para_unidade: 'u-jur', despacho: 'Para parecer', criada_por_nome: 'Diego', criada_em: dia(2) },
    ]
    const s = situacaoDoPedido(sol(), { ...ctx, tramitacoesPorProcesso: new Map([['p1', tramitacoes]]) })
    expect(s).toMatchObject({ grupo: 'andamento', etapa: 2, travado: false })
    expect(s.onde).toMatchObject({ dias: 2, recebido: true, responsavel: 'Helena' })
    expect(s.onde.unidade.sigla).toBe('JUR')
    expect(s.passagens.map((x) => [x.unidade.sigla, x.dias])).toEqual([['COMP', 7], ['JUR', 2]])
    expect(s.ultimo).toMatchObject({ id: 3, despacho: 'Para parecer' }) // o registro de documento não conta como movimento
  })

  it('recusado/cancelado ficam encerrados; vistas e resumo', () => {
    const lista = [
      situacaoDoPedido(sol({ status: 'recusada', motivo: 'Já existe ata' }), ctx),
      situacaoDoPedido(sol({ status: 'enviada', enviada_em: dia(9), processo_id: null }), ctx),
      situacaoDoPedido(sol(), { ...ctx, processosPorId: new Map([['p1', proc({ desde: dia(9) })]]) }),
      situacaoDoPedido(sol(), { ...ctx, processosPorId: new Map([['p1', proc({ situacao: 'concluido', concluido_em: dia(1) })]]) }),
    ]
    expect(lista[0].grupo).toBe('encerrado')
    expect(resumoPedidos(lista)).toEqual({ analise: 1, ajuste: 0, andamento: 1, travados: 2, concluidos: 1 })
    expect(lista.filter((x) => naVistaPedido(x, 'travados'))).toHaveLength(2)
    expect(lista.filter((x) => naVistaPedido(x, 'todos'))).toHaveLength(4)
    expect(lista[3].etapa).toBe(5)
  })
})

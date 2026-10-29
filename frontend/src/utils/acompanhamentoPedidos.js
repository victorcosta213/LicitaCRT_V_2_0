// Acompanhamento dos pedidos das secretarias: em que etapa cada um está, em que setor, há quanto tempo
// e o que está segurando o andamento (análise, recebimento, assinatura, documento que falta, prazo).
import { checklistDoProcesso, itemPronto } from '../modelos/artefatos'
import { modeloPorCodigo } from '../modelos/catalogo'
import { DIAS_PARADO_PADRAO, diasDesde, estadoDoProcesso, permanencias } from './tramitacao'
import { fmtDate } from './format'

// Etapas mostradas na régua do pedido
export const ETAPAS_PEDIDO = ['Pedido enviado', 'Análise do Compras', 'Planejamento', 'Seleção / instrução', 'Contrato', 'Concluído']

const nomeDoc = (d) => (d.modelo === 'arquivo' ? 'arquivo' : modeloPorCodigo(d.modelo)?.sigla || d.modelo)
const unidadeTxt = (u) => (u ? `${u.sigla} (${u.nome})` : 'unidade não identificada')

// O que segura o processo agora. nivel: danger (parado/atrasado/ação sua), warning (atenção), info (próximo passo)
export function travasDoProcesso(p, { documentos = [], assinaturas = [], marcas = [], unidadesPorId = new Map(), diasParado = DIAS_PARADO_PADRAO, agora = new Date() } = {}) {
  if (!p) return []
  if (p.situacao === 'concluido') return [{ nivel: 'success', texto: `Processo concluído em ${fmtDate(p.concluido_em)}.` }]
  const travas = []
  const e = estadoDoProcesso(p, { agora, diasParado })
  const onde = unidadeTxt(unidadesPorId.get(p.unidade_atual))

  if (e.atrasado) travas.push({ nivel: 'danger', texto: `Prazo vencido em ${fmtDate(p.prazo)} (${Math.abs(e.diasPrazo)} dia(s) de atraso).` })
  if (!p.recebido_em) {
    travas.push({ nivel: e.parado ? 'danger' : 'warning', texto: `Enviado a ${onde} há ${e.diasNaUnidade} dia(s) e ainda não foi recebido.` })
  } else if (e.parado) {
    travas.push({ nivel: 'danger', texto: `Parado em ${onde} há ${e.diasNaUnidade} dias, sem movimentação${p.responsavel_nome ? ` (com ${p.responsavel_nome})` : ''}.` })
  }

  // documentos do processo esperando assinatura: quem ainda não assinou
  const docs = documentos.filter((d) => d.processo_id === p.id && d.status !== 'cancelado')
  for (const d of docs.filter((x) => x.status === 'aguardando_assinatura')) {
    const faltam = assinaturas.filter((a) => a.documento_id === d.id && a.versao === d.versao && a.status === 'pendente').map((a) => a.nome).filter(Boolean)
    const dias = diasDesde(d.atualizado_em, agora)
    travas.push({
      nivel: dias >= diasParado ? 'danger' : 'warning',
      texto: `${nomeDoc(d)} ${d.numero} aguardando a assinatura de ${faltam.length ? faltam.join(', ') : 'signatário'}${dias ? ` há ${dias} dia(s)` : ''}.`,
      quem: faltam.join(', '),
    })
  }

  if (p.tipo === 'Contratação' || p.contratacao_modalidade) {
    if (!p.contratacao_modalidade) {
      travas.push({ nivel: 'warning', texto: 'O Compras ainda não definiu a forma de contratação.', quem: 'Compras' })
    } else {
      const ch = checklistDoProcesso(p.contratacao_modalidade, docs, { marcas: marcas.filter((m) => m.processo_id === p.id), objeto: p.contratacao_objeto })
      const pendente = ch?.etapas.flatMap((x) => x.itens).find((i) => i.obrigatorio && !itemPronto(i))
      if (pendente) {
        const andamento = pendente.status === 'rascunho' ? ' (em elaboração)' : pendente.status === 'aguardando_assinatura' ? ' (aguardando assinatura)' : ''
        travas.push({ nivel: 'info', texto: `Próximo documento: ${pendente.nome}${andamento}.`, quem: pendente.quem })
      }
    }
  }
  if (!travas.length) travas.push({ nivel: 'info', texto: `Em andamento em ${onde} há ${e.diasNaUnidade} dia(s), dentro do esperado.` })
  return travas
}

// Etapa da régua (0 a 5) a partir do pedido e do roteiro do processo
function etapaDoProcesso(p, docs, marcas) {
  if (p.situacao === 'concluido') return 5
  if (!p.contratacao_modalidade) return 2
  const ch = checklistDoProcesso(p.contratacao_modalidade, docs, { marcas, objeto: p.contratacao_objeto })
  const i = ch.etapas.findIndex((e) => e.itens.some((x) => x.obrigatorio && !itemPronto(x)))
  return i < 0 ? 4 : Math.min(2 + i, 4)
}

// Situação completa de um pedido (solicitação) para a tela de acompanhamento
export function situacaoDoPedido(s, { processosPorId = new Map(), tramitacoesPorProcesso = new Map(), documentos = [], assinaturas = [], marcas = [], unidadesPorId = new Map(), diasParado = DIAS_PARADO_PADRAO, agora = new Date() } = {}) {
  const dias = diasDesde(s.enviada_em, agora)
  const compras = [...unidadesPorId.values()].find((u) => u.sigla === 'COMP')
  if (s.status === 'enviada') {
    return {
      grupo: 'analise', etapa: 1, onde: { unidade: compras || null, dias, recebido: false },
      travas: [{ nivel: dias >= diasParado ? 'danger' : 'warning', texto: `Aguardando a análise do Compras há ${dias} dia(s).`, quem: 'Compras' }],
      travado: dias >= diasParado,
    }
  }
  if (s.status === 'devolvida') {
    return {
      grupo: 'ajuste', etapa: 1, onde: { unidade: unidadesPorId.get(s.unidade_id) || null, dias: diasDesde(s.analisada_em, agora), recebido: true },
      travas: [{ nivel: 'danger', texto: `Devolvido pelo Compras para ajuste: ${s.motivo}. Refaça a DFD e reenvie.`, quem: 'Sua secretaria' }],
      travado: true,
    }
  }
  if (s.status === 'recusada' || s.status === 'cancelada') {
    return { grupo: 'encerrado', etapa: 1, onde: null, travas: [{ nivel: 'info', texto: `${s.status === 'recusada' ? 'Recusado pelo Compras' : 'Cancelado'}: ${s.motivo}` }], travado: false }
  }
  const p = processosPorId.get(s.processo_id)
  if (!p) return { grupo: 'andamento', etapa: 2, onde: null, travas: [{ nivel: 'info', texto: 'Processo aberto pelo Compras.' }], travado: false }
  const docs = documentos.filter((d) => d.processo_id === p.id && d.status !== 'cancelado')
  const mp = marcas.filter((m) => m.processo_id === p.id)
  const e = estadoDoProcesso(p, { agora, diasParado })
  const travas = travasDoProcesso(p, { documentos, assinaturas, marcas, unidadesPorId, diasParado, agora })
  const tram = tramitacoesPorProcesso.get(p.id) || []
  return {
    grupo: p.situacao === 'concluido' ? 'concluido' : 'andamento',
    etapa: etapaDoProcesso(p, docs, mp),
    processo: p,
    estado: e,
    onde: { unidade: unidadesPorId.get(p.unidade_atual) || null, dias: e.diasNaUnidade, recebido: !!p.recebido_em, responsavel: p.responsavel_nome },
    passagens: tram.length ? permanencias(p, tram, unidadesPorId, agora) : [],
    ultimo: tram.filter((t) => t.tipo !== 'documento').at(-1) || null,
    travas,
    travado: travas.some((t) => t.nivel === 'danger'),
  }
}

export const VISTAS_PEDIDOS = [
  ['todos', 'Todos'],
  ['travados', 'Travados'],
  ['analise', 'No Compras'],
  ['ajuste', 'Devolvidos'],
  ['andamento', 'Em andamento'],
  ['concluido', 'Concluídos'],
]
export const naVistaPedido = (sit, vista) => (vista === 'todos' ? true : vista === 'travados' ? sit.travado : sit.grupo === vista)

// Contagens do topo
export function resumoPedidos(situacoes) {
  return {
    analise: situacoes.filter((x) => x.grupo === 'analise').length,
    ajuste: situacoes.filter((x) => x.grupo === 'ajuste').length,
    andamento: situacoes.filter((x) => x.grupo === 'andamento').length,
    travados: situacoes.filter((x) => x.travado).length,
    concluidos: situacoes.filter((x) => x.grupo === 'concluido').length,
  }
}

// Estrutura dos modelos de documento.
//
// Um modelo é dado puro: seções, campos (com ajuda e textos-padrão) e, quando o layout é especial, uma
// função `bloco`. O documento guarda BLOCOS (texto estruturado), nunca HTML: a tela os desenha sempre com
// escape, então nenhum conteúdo digitado vira código, e o que foi assinado é exatamente o que se vê.
//
// Blocos: cab, titulo, sub, secao, rotulo, p, lista, numerada, tabela, campo, nota, espaco, assina, arquivo (documento enviado)

export const PENDENTE = '[preencher'
const VAZIO = '[não informado]'

const texto = (v) => String(v ?? '').trim()

// ---- construtores de bloco -------------------------------------------------
export const B = {
  cab: (orgao, numero, local) => ({ t: 'cab', orgao, numero, local }),
  titulo: (x) => ({ t: 'titulo', x: texto(x) }),
  sub: (x) => ({ t: 'sub', x: texto(x) }),
  secao: (x) => ({ t: 'secao', x: texto(x) }),
  rotulo: (x) => ({ t: 'rotulo', x: texto(x) }),
  p: (x) => ({ t: 'p', x: texto(x) || VAZIO }),
  lista: (itens) => ({ t: 'lista', itens: itens.map(texto).filter(Boolean) }),
  numerada: (itens) => ({ t: 'numerada', itens: itens.map(texto).filter(Boolean) }),
  tabela: (cab, linhas) => ({ t: 'tabela', cab, linhas: linhas.map((l) => l.map((c) => texto(c))) }),
  campo: (r, x) => ({ t: 'campo', r, x: texto(x) || VAZIO }),
  nota: (x) => ({ t: 'nota', x: texto(x) }),
  espaco: () => ({ t: 'espaco' }),
  // linha para a assinatura de quem assina o documento (o nome/cargo vêm do que o autor informar)
  assina: (nome, cargo) => ({ t: 'assina', nome: texto(nome) || '[preencher: nome]', cargo: texto(cargo) }),
}

// texto com quebras de linha vira vários parágrafos
// `rotulo`: se o texto estiver vazio, o documento mostra "[preencher: rótulo]" (impede o envio para assinatura)
export const paragrafos = (x, rotulo) => {
  const partes = texto(x).split(/\n{1,}/).map((s) => s.trim()).filter(Boolean)
  return partes.length ? partes.map((s) => B.p(s)) : [B.p(rotulo ? `${PENDENTE}: ${rotulo}]` : '')]
}

// valor ou, se vazio, o marcador de pendência
export const ou = (valor, rotulo) => texto(valor) || `${PENDENTE}: ${rotulo}]`

// ---- construtores de campo ---------------------------------------------------
const campo = (tipo) => (nome, rotulo, o = {}) => ({ nome, rotulo, tipo, ...o })
export const T = campo('texto')
export const L = (nome, rotulo, o = {}) => ({ nome, rotulo, tipo: 'texto-longo', linhas: 4, ...o })
export const D = campo('data')
export const N = campo('numero')
export const M = campo('dinheiro')
export const S = (nome, rotulo, opcoes, o = {}) => ({ nome, rotulo, tipo: 'select', opcoes, ...o })
// tabela editável: colunas = [{ nome, rotulo, tipo?: 'texto'|'numero'|'dinheiro' }]
export const R = (nome, rotulo, colunas, o = {}) => ({ nome, rotulo, tipo: 'linhas', colunas, ...o })
// itens escolhidos do catálogo (cadastrado pelo administrador): cada linha guarda uma CÓPIA do item no momento
// da escolha — { item_id, codigo, nome, especificacao, unidade, quantidade, valor_unitario }
export const I = (nome, rotulo, o = {}) => ({ nome, rotulo, tipo: 'itens', ...o })

// itens com quantidade informada
export const itensValidos = (lista) => (lista || []).filter((l) => texto(l.nome) && Number(l.quantidade) > 0)
export const totalItens = (lista) => itensValidos(lista).reduce((s, l) => s + (Number(l.quantidade) || 0) * (Number(l.valor_unitario) || 0), 0)
const qtde = (n) => Number(n).toLocaleString('pt-BR')

export const rotuloDe = (campoDef, valor) => {
  if (campoDef.tipo !== 'select') return valor
  const op = campoDef.opcoes.find((o) => (typeof o === 'string' ? o : o.valor) === valor)
  return op ? (typeof op === 'string' ? op : op.rotulo) : valor
}

export const dinheiro = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && texto(v) !== '' ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
}
export const dataBR = (v) => (/^\d{4}-\d{2}-\d{2}/.test(texto(v)) ? texto(v).slice(0, 10).split('-').reverse().join('/') : texto(v))
const porExtenso = (d = new Date()) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
export { porExtenso }

// ---- valores de um campo, prontos para o texto ----------------------------------
export function valorTexto(c, v) {
  const x = v?.[c.nome]
  switch (c.tipo) {
    case 'dinheiro': return dinheiro(x)
    case 'data': return dataBR(x)
    case 'select': return rotuloDe(c, x)
    default: return texto(x)
  }
}

const aparece = (o, v) => !o.mostrar || o.mostrar(v)

// Blocos de um campo, quando a seção não define o seu próprio layout
// Campo opcional vazio não aparece; obrigatório vazio vira "[preencher: …]", que impede o envio para assinatura
export const celula = (col, l) => {
  const x = l[col.nome]
  if (col.tipo === 'dinheiro') return dinheiro(x)
  if (col.tipo === 'select') return rotuloDe(col, x)
  return x
}

export function blocosDeItens(rotulo, lista, obrigatorio = true) {
  const linhas = itensValidos(lista)
  if (!linhas.length) return obrigatorio ? [B.rotulo(rotulo), B.p(`${PENDENTE}: ${rotulo}]`)] : []
  const comValor = linhas.some((l) => Number(l.valor_unitario) > 0)
  return [
    B.rotulo(rotulo),
    B.tabela(['Item', 'Especificação', 'Unid.', 'Qtde', ...(comValor ? ['Valor unit. estimado', 'Total estimado'] : [])],
      linhas.map((l, i) => [`${i + 1}. ${l.nome}${l.codigo ? ` (${l.codigo})` : ''}`, l.especificacao, l.unidade, qtde(l.quantidade),
        ...(comValor ? [dinheiro(l.valor_unitario), dinheiro((Number(l.quantidade) || 0) * (Number(l.valor_unitario) || 0))] : [])])),
    ...(comValor ? [B.campo('Estimativa preliminar do valor', dinheiro(totalItens(linhas)))] : []),
  ]
}

function blocosDoCampo(c, v) {
  if (c.tipo === 'itens') return blocosDeItens(c.rotulo, v?.[c.nome], c.obrigatorio)
  if (c.tipo === 'linhas') {
    const linhas = (v?.[c.nome] || []).filter((l) => c.colunas.some((col) => texto(l[col.nome]) !== ''))
    if (!linhas.length) return c.obrigatorio ? [B.rotulo(c.rotulo), B.p(`${PENDENTE}: ${c.rotulo}]`)] : []
    return [B.rotulo(c.rotulo), B.tabela(c.colunas.map((col) => col.rotulo), linhas.map((l) => c.colunas.map((col) => celula(col, l))))]
  }
  const x = valorTexto(c, v)
  if (x === '') return c.obrigatorio ? [B.campo(c.rotulo, `${PENDENTE}: ${c.rotulo}]`)] : []
  if (c.tipo === 'texto-longo') return [B.rotulo(c.rotulo), ...paragrafos(x)]
  return [B.campo(c.rotulo, x)]
}

// ---- renderização do documento ---------------------------------------------------
// ctx: { orgao, cidade, numero, data (Date) }
export function renderizar(modelo, v, ctx = {}) {
  const valores = v || {}
  const blocos = [B.cab(ctx.orgao || '[preencher: nome do órgão]', ctx.numero || '', ctx.cidade || '')]
  if (modelo.titulo) blocos.push(B.titulo(typeof modelo.titulo === 'function' ? modelo.titulo(valores, ctx) : modelo.titulo))
  let n = 0
  for (const s of modelo.secoes) {
    if (!aparece(s, valores)) continue
    const extra = s.bloco ? s.bloco(valores, ctx) : null
    if (extra === 'omitir') continue
    if (s.titulo) n += 1 // seção sem título (ex.: bloco de assinatura) não ocupa número
    // modelos sem numeração (ofício, memorando, despacho…) não têm cabeçalho de seção: o título só orienta o preenchimento
    if (s.titulo && modelo.numerar !== false) blocos.push(B.secao(modelo.formatoSecao ? modelo.formatoSecao(n, s.titulo) : `${n}. ${s.titulo}`))
    if (extra) blocos.push(...extra)
    else for (const c of s.campos) if (aparece(c, valores)) blocos.push(...blocosDoCampo(c, valores))
  }
  if (modelo.fecho) blocos.push(...modelo.fecho(valores, ctx))
  return blocos.filter(Boolean)
}

// Todos os campos do modelo, na ordem
export const camposDe = (modelo) => modelo.secoes.flatMap((s) => s.campos.map((c) => ({ ...c, secao: s })))

// Campos obrigatórios que ainda estão vazios (só os que aparecem para os valores atuais)
export function camposFaltando(modelo, v) {
  const valores = v || {}
  return modelo.secoes.filter((s) => aparece(s, valores)).flatMap((s) => s.campos
    .filter((c) => c.obrigatorio && aparece(c, valores))
    .filter((c) => {
      if (c.tipo === 'itens') return itensValidos(valores[c.nome]).length === 0
      if (c.tipo === 'linhas') return !(valores[c.nome] || []).some((l) => c.colunas.some((col) => texto(l[col.nome]) !== ''))
      return texto(valores[c.nome]) === ''
    })
    .map((c) => c.rotulo))
}

// Valores iniciais: o padrão de cada campo (texto-padrão do modelo) e o que o contexto já sabe
export function valoresIniciais(modelo, ctx = {}) {
  const v = {}
  for (const c of camposDe(modelo)) {
    if (c.tipo === 'itens') v[c.nome] = []
    else if (c.tipo === 'linhas') {
      // o padrão pode vir do contexto (ex.: os itens da DFD do processo)
      const padrao = typeof c.padrao === 'function' ? c.padrao(ctx) : c.padrao
      v[c.nome] = padrao?.length ? padrao.map((l) => ({ ...l })) : [Object.fromEntries(c.colunas.map((col) => [col.nome, '']))]
    }
    else v[c.nome] = typeof c.padrao === 'function' ? c.padrao(ctx) : (c.padrao ?? '')
  }
  return v
}

// Quantos trechos "[preencher: …]" ainda restam no texto (o documento só segue para assinatura sem eles)
export function pendenciasNoCorpo(corpo) {
  const alvo = JSON.stringify(corpo || [])
  return (alvo.match(/\[preencher/g) || []).length
}

// Lista os trechos pendentes, para mostrar ao autor o que falta
export function trechosPendentes(corpo, limite = 8) {
  const achados = []
  const varre = (x) => {
    if (typeof x === 'string') {
      for (const m of x.matchAll(/\[preencher[^\]]*\]/g)) achados.push(m[0])
    } else if (Array.isArray(x)) x.forEach(varre)
    else if (x && typeof x === 'object') Object.values(x).forEach(varre)
  }
  varre(corpo)
  return [...new Set(achados)].slice(0, limite)
}

// Leitura da planilha de processos licitatórios.
//
// Colunas esperadas (ordem livre; acentos, maiúsculas e espaços são ignorados):
//   numero do Processo | Situação no SEI | nome do Processo | Unidade Demandante |
//   Modalidade | Valor Estimado (R$) | Prioridade | Fase Atual
//
// Entrada: matriz de linhas (sheet_to_json com header:1). Saída: registros já no
// formato da tabela `processos` (snake_case) + lista de linhas ignoradas.

import { PHASES } from './phases'

const OPT_PRIOR = ['Critico', 'Nao Critico', 'Estrategico', 'Alavancavel']
const OPT_TIPO = ['Inexigibilidade', 'Dispensa Eletronica', 'Dispensa', 'Pregao', 'Concorrencia', 'Pronto Pagamento', 'ARP']

export const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase()

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim())

// Identifica a coluna de cada campo pelo cabeçalho
const CAMPOS = [
  ['numero', (h) => h.includes('numero') || h.startsWith('n.') || h === 'no' || h.includes('n°') || h.includes('nº')],
  ['situacao_sei', (h) => h.includes('situacao')],
  ['objeto', (h) => h.includes('nome') || h.includes('objeto')],
  ['unidade_demandante', (h) => h.includes('unidade') || h.includes('demandante')],
  ['modalidade', (h) => h.includes('modalidade')],
  ['valor_estimado', (h) => h.includes('valor')],
  ['prioridade', (h) => h.includes('prioridade')],
  ['fase', (h) => h.includes('fase')],
]

function mapearCabecalho(linha) {
  const cols = {}
  linha.forEach((cel, i) => {
    const h = norm(cel)
    if (!h) return
    for (const [campo, teste] of CAMPOS) {
      if (cols[campo] === undefined && teste(h)) {
        cols[campo] = i
        break
      }
    }
  })
  return cols
}

// "R$ 1.234,56" | "1234,56" | "1.234.567" | 1234.56 -> número
export function parseValor(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).replace(/R\$\s*/i, '').replace(/\s/g, '')
  if (!s || !/\d/.test(s)) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '')
  else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '')   // 1.500 -> 1500
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function normalizarPrioridade(v) {
  const s = norm(v)
  if (!s) return ''
  if (s.startsWith('nao') || s.includes('nao crit')) return 'Nao Critico'
  if (s.startsWith('crit')) return 'Critico'
  if (s.includes('estrat')) return 'Estrategico'
  if (s.includes('alavanc')) return 'Alavancavel'
  return OPT_PRIOR.find((o) => norm(o) === s) || texto(v)
}

// Modalidade da planilha -> opção de "Tipo" do sistema (ou o próprio texto)
export function tipoPorModalidade(v) {
  const s = norm(v)
  if (!s) return ''
  if (s.includes('dispensa') && s.includes('eletron')) return 'Dispensa Eletronica'
  if (s.includes('dispensa')) return 'Dispensa'
  if (s.includes('inexigib')) return 'Inexigibilidade'
  if (s.includes('pregao')) return 'Pregao'
  if (s.includes('concorrenc')) return 'Concorrencia'
  if (s.includes('pronto')) return 'Pronto Pagamento'
  if (s === 'arp' || s.includes('registro de preco') || s.includes('ata de registro')) return 'ARP'
  return OPT_TIPO.find((o) => norm(o) === s) || texto(v)
}

// Fase Atual -> nome oficial da fase do fluxo (ou o próprio texto)
export function fasePorTexto(v) {
  const t = texto(v)
  const s = norm(t)
  if (!s) return { nome: '', conhecida: false }
  const exata = PHASES.find((p) => norm(p.name) === s)
  if (exata) return { nome: exata.name, conhecida: true, key: exata.key }
  const parcial = s.length >= 4
    ? PHASES.find((p) => norm(p.name).includes(s) || s.includes(norm(p.name)))
    : null
  if (parcial) return { nome: parcial.name, conhecida: true, key: parcial.key }
  return { nome: t, conhecida: false }
}

export function lerPlanilhaProcessos(linhas, { numerosExistentes = [] } = {}) {
  // localiza o cabeçalho nas primeiras linhas (a planilha pode ter título acima)
  let hIdx = -1
  let cols = {}
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const c = mapearCabecalho(linhas[i] || [])
    if (c.numero !== undefined && c.objeto !== undefined) {
      hIdx = i
      cols = c
      break
    }
  }
  if (hIdx === -1) {
    return {
      erro: 'Cabeçalho não encontrado. A planilha precisa ter as colunas "numero do Processo" e "nome do Processo".',
      registros: [], ignorados: [], colunas: {},
    }
  }

  const vistos = new Set(numerosExistentes.map((n) => norm(n)))
  const registros = []
  const ignorados = []
  const agora = new Date().toISOString()
  const faltantes = ['situacao_sei', 'unidade_demandante', 'modalidade', 'valor_estimado', 'prioridade', 'fase']
    .filter((c) => cols[c] === undefined)

  for (let i = hIdx + 1; i < linhas.length; i++) {
    const row = linhas[i]
    const linha = i + 1
    if (!row || row.every((c) => texto(c) === '')) continue

    const get = (campo) => (cols[campo] === undefined ? '' : texto(row[cols[campo]]))
    const numero = get('numero')
    const objeto = get('objeto')
    if (!numero) { ignorados.push({ linha, motivo: 'sem número do processo' }); continue }
    if (!objeto) { ignorados.push({ linha, numero, motivo: 'sem nome do processo' }); continue }
    if (vistos.has(norm(numero))) {
      ignorados.push({ linha, numero, motivo: 'número já cadastrado ou repetido na planilha' })
      continue
    }
    vistos.add(norm(numero))

    const bruto = cols.valor_estimado === undefined ? null : row[cols.valor_estimado]
    const valor = parseValor(bruto)
    const fase = fasePorTexto(get('fase'))

    registros.push({
      numero,
      objeto,
      situacao_sei: get('situacao_sei') || null,
      unidade_demandante: get('unidade_demandante') || null,
      modalidade: get('modalidade') || null,
      tipo: tipoPorModalidade(get('modalidade')) || null,
      valor_estimado: valor,
      prioridade: normalizarPrioridade(get('prioridade')) || null,
      etapa: fase.nome || 'Aberto',
      fluxo: fase.nome ? [{ nome: fase.nome, data: agora }] : [],
      local_documentacao: 'DFD',
      _faseDesconhecida: !!fase.nome && !fase.conhecida,
      _valorInvalido: texto(bruto) !== '' && valor === null,
    })
  }

  return { registros, ignorados, colunas: cols, faltantes, linhaCabecalho: hIdx + 1 }
}

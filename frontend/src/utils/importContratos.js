// Leitura da planilha de contratações (contratos, notas de empenho e outros instrumentos).
//
// Colunas (ordem livre; acentos, maiúsculas e espaços são ignorados):
//   Instrumento | Nº | Processo SEI | Contratada | CNPJ | Objeto | Modalidade | Unidade demandante |
//   Valor | Início | Fim da vigência | Prazo de execução (dias) | Prorrogável | Gestor | Fiscal
// Obrigatórias: Nº, Contratada e Objeto. Entrada: matriz de linhas (sheet_to_json header:1).
// Saída: registros no formato de gc_contratos + linhas ignoradas.

import { norm, parseValor } from './importProcessos'
import { cnpjValido, fmtCnpj, soDigitos } from './format'

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim())

export const COLUNAS_MODELO = [
  'Instrumento', 'Nº', 'Processo SEI', 'Contratada', 'CNPJ', 'Objeto', 'Modalidade', 'Unidade demandante',
  'Valor (R$)', 'Início', 'Fim da vigência', 'Prazo de execução (dias)', 'Prorrogável',
]
export const LINHA_EXEMPLO = [
  'Contrato', '014/2026', '0001.000214/2026-11', 'Empresa Exemplo Ltda', '11.222.333/0001-81',
  'Prestação de serviços de limpeza', 'Pregão eletrônico', 'Gerência Administrativa',
  '312000,00', '01/03/2026', '28/02/2027', '', 'Sim',
]

const CAMPOS = [
  ['instrumento', (h) => h.includes('instrumento') || h === 'tipo'],
  ['numero', (h) => h === 'n' || h.startsWith('n.') || h.includes('numero') || h.includes('nº') || h.includes('n°')],
  ['sei_processo', (h) => h.includes('sei') || h.includes('processo')],
  ['contratada', (h) => h.includes('contratada') || h.includes('empresa') || h.includes('fornecedor')],
  ['cnpj', (h) => h.includes('cnpj')],
  ['objeto', (h) => h.includes('objeto')],
  ['modalidade', (h) => h.includes('modalidade')],
  ['unidade_demandante', (h) => h.includes('unidade') || h.includes('demandante') || h.includes('setor')],
  ['valor_inicial', (h) => h.includes('valor')],
  ['vigencia_fim', (h) => (h.includes('fim') || h.includes('termino') || h.includes('vencimento')) && !h.includes('prazo')],
  ['vigencia_inicio', (h) => h.includes('inicio') || h.includes('vigencia')],
  ['prazo_execucao_dias', (h) => h.includes('prazo')],
  ['prorrogavel', (h) => h.includes('prorrog')],
]

function mapearCabecalho(linha) {
  const cols = {}
  linha.forEach((cel, i) => {
    const h = norm(cel)
    if (!h) return
    for (const [campo, teste] of CAMPOS) {
      if (cols[campo] === undefined && teste(h)) { cols[campo] = i; break }
    }
  })
  return cols
}

// "31/12/2026" | "2026-12-31" | Date | número serial do Excel -> "2026-12-31" (ou null)
export function parseData(v) {
  if (v === null || v === undefined || v === '') return null
  const iso = (a, m, d) => {
    const dt = new Date(Date.UTC(a, m - 1, d))
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
      ? `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate())
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null
    const dt = new Date(Math.round((v - 25569) * 86400000))
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]))
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? iso(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

export function parseInstrumento(v) {
  const s = norm(v)
  if (!s) return 'contrato'
  if (s.includes('empenho') || s === 'ne') return 'nota_empenho'
  if (s.includes('contrato')) return 'contrato'
  return 'outro'
}

const parseSimNao = (v) => ['sim', 's', 'x', '1', 'true', 'verdadeiro'].includes(norm(v))

// existentes: [{ instrumento, numero }] já cadastrados (evita duplicar)
export function lerPlanilhaContratos(linhas, { existentes = [] } = {}) {
  let hIdx = -1
  let cols = {}
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const c = mapearCabecalho(linhas[i] || [])
    if (c.numero !== undefined && c.contratada !== undefined && c.objeto !== undefined) { hIdx = i; cols = c; break }
  }
  if (hIdx === -1) {
    return {
      erro: 'Cabeçalho não encontrado. A planilha precisa ter as colunas "Nº", "Contratada" e "Objeto". Baixe o modelo para ver o formato.',
      registros: [], ignorados: [], colunas: {},
    }
  }

  const chave = (instrumento, numero) => `${instrumento}|${norm(numero)}`
  const vistos = new Set(existentes.map((e) => chave(e.instrumento || 'contrato', e.numero)))
  const registros = []
  const ignorados = []

  for (let i = hIdx + 1; i < linhas.length; i++) {
    const row = linhas[i]
    const linha = i + 1
    if (!row || row.every((c) => texto(c) === '')) continue
    const bruto = (campo) => (cols[campo] === undefined ? '' : row[cols[campo]])
    const get = (campo) => texto(bruto(campo))

    const numero = get('numero')
    const contratada = get('contratada')
    const objeto = get('objeto')
    if (!numero) { ignorados.push({ linha, motivo: 'sem número do instrumento' }); continue }
    if (!contratada) { ignorados.push({ linha, numero, motivo: 'sem contratada' }); continue }
    if (!objeto) { ignorados.push({ linha, numero, motivo: 'sem objeto' }); continue }

    const instrumento = parseInstrumento(get('instrumento'))
    const k = chave(instrumento, numero)
    if (vistos.has(k)) { ignorados.push({ linha, numero, motivo: 'já cadastrada ou repetida na planilha' }); continue }
    vistos.add(k)

    const avisos = []
    const cnpjTxt = get('cnpj')
    let cnpj = null
    if (cnpjTxt) {
      if (cnpjValido(cnpjTxt)) cnpj = fmtCnpj(soDigitos(cnpjTxt))
      else avisos.push('CNPJ inválido (ficou em branco)')
    }
    const data = (campo, nome) => {
      const b = bruto(campo)
      const d = parseData(b)
      if (texto(b) !== '' && !d) avisos.push(`${nome} ilegível (ficou em branco)`)
      return d
    }
    const inicio = data('vigencia_inicio', 'início')
    const fim = data('vigencia_fim', 'fim da vigência')
    const valorBruto = bruto('valor_inicial')
    const valor = parseValor(valorBruto)
    if (texto(valorBruto) !== '' && valor === null) avisos.push('valor ilegível (ficou zero)')
    const prazoN = Number(String(bruto('prazo_execucao_dias')).replace(/\D/g, ''))
    const sei = get('sei_processo')

    const pendencias = []
    if (!sei) pendencias.push('processo SEI')
    if (!(valor > 0)) pendencias.push('valor')
    if (!fim && !(prazoN > 0)) pendencias.push('vigência ou prazo')
    if (inicio && fim && fim < inicio) { avisos.push('fim anterior ao início (fim descartado)'); pendencias.push('vigência ou prazo') }

    registros.push({
      linha,
      pendencias,
      avisos,
      dados: {
        instrumento, numero, contratada, objeto,
        sei_processo: sei || null,
        cnpj,
        modalidade: get('modalidade') || null,
        unidade_demandante: get('unidade_demandante') || null,
        valor_inicial: valor ?? 0,
        vigencia_inicio: inicio,
        vigencia_fim: inicio && fim && fim < inicio ? null : fim,
        prazo_execucao_dias: prazoN > 0 ? prazoN : null,
        prorrogavel: parseSimNao(bruto('prorrogavel')),
      },
    })
  }

  const faltantes = ['instrumento', 'sei_processo', 'cnpj', 'valor_inicial', 'vigencia_inicio', 'vigencia_fim']
    .filter((c) => cols[c] === undefined)
  return { registros, ignorados, colunas: cols, faltantes, linhaCabecalho: hIdx + 1 }
}

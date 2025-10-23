const PHASES = [
  { key: 'oficio_tr',            name: 'Ofício e Termo de Referência do Secretário',        sector: 'Secretaria Demandante' },
  { key: 'cotacao',              name: 'Cotação de Preços',                                  sector: 'Compras' },
  { key: 'dotacao',              name: 'Dotação orçamentária',                               sector: 'Financeiro' },
  { key: 'autorizacao_gestor',   name: 'Autorização do gestor',                              sector: 'Gabinete/Ordenador' },
  { key: 'edital_anexos',        name: 'Arquivo do Edital e anexos',                         sector: 'Compras' },
  { key: 'parecer_juridico_ini', name: 'Parecer Jurídico inicial',                           sector: 'Jurídico' },
  { key: 'publicacao_edital',    name: 'Publicação do edital',                               sector: 'Compras/Comunicação' },
  { key: 'impugnacoes',          name: 'Impugnações/esclarecimentos referentes ao Edital',   sector: 'Compras/Pregoeiro' },
  { key: 'vencedores',           name: 'Vencedore(s) do certame/itens vencidos',             sector: 'Pregoeiro/Comissão' },
  { key: 'habilitacao',          name: 'Fase de Habilitação – Situação/Habilitados',         sector: 'Pregoeiro/Comissão' },
  { key: 'adjudicacao',          name: 'Adjudicação',                                        sector: 'Pregoeiro/Comissão' },
  { key: 'parecer_juridico_fin', name: 'Parecer Jurídico final',                             sector: 'Jurídico' },
  { key: 'homologacao',          name: 'Homologação',                                        sector: 'Ordenador' },
  { key: 'arp',                  name: 'Ata de Registro de Preços/Empresa(s)',               sector: 'Compras' },
  { key: 'contratos',            name: 'Contratos/Empresa(s)/Ordenador(es)',                 sector: 'Jurídico/Contratos' },
  { key: 'controle_arp',         name: 'Controle de prazo da ARP (24 meses)',                sector: 'Compras' },
  { key: 'controle_contratos',   name: 'Controle de prazo dos contratos (12 meses)',         sector: 'Contratos' },
  { key: 'envio_empenho',        name: 'Envio do(s) contrato(s) para o Empenho',             sector: 'Financeiro' },
  { key: 'envio_lincon',         name: 'Envio no Lincon',                                    sector: 'Compras/Setor Responsável' },
  { key: 'envio_transparencia',  name: 'Envio no Portal da Transparência',                   sector: 'Controle Interno' },
  { key: 'assinaturas',          name: 'Coleta de assinaturas',                              sector: 'Contratos' },
  { key: 'aditivo',              name: 'Aditivo – controle de prazo',                        sector: 'Contratos' },
  { key: 'digitalizacao',        name: 'Digitalização integral do processo',                 sector: 'Arquivo/Protocolo' },
  { key: 'valor_empenhado',      name: 'Valor empenhado/saldo utilizado',                    sector: 'Financeiro' },
]

function normalize(s) {
  return (s || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
  .toLowerCase()
}

function phaseNameByKey(key) {
  const f = PHASES.find(p => p.key === key)
  return f ? f.name : ''
}

function phaseKeyByName(name) {
  const n = normalize(name)
  if (!n) return null
  const found = PHASES.find(p => normalize(p.name) === n)
  return found ? found.key : null
}

function computePhaseState(proc) {
  const total = PHASES.length
  let currentName = ''
  if (Array.isArray(proc?.fluxo) && proc.fluxo.length) {
    const last = proc.fluxo[proc.fluxo.length - 1]
    currentName = last?.nome || ''
  } else if (proc?.etapa) {
    currentName = proc.etapa
  }
  let key = proc?.faseAtualKey || phaseKeyByName(currentName) || null
  let name = key ? phaseNameByKey(key) : (currentName || '')
  let index = key ? PHASES.findIndex(p => p.key === key) : PHASES.findIndex(p => p.name === name)
  if (index < 0) index = 0
  if (!key && PHASES[index]) key = PHASES[index].key
  if (!name && PHASES[index]) name = PHASES[index].name
  const pct = total > 1 ? Math.round((index / (total - 1)) * 100) : 0
  return { key, name, index, total, pct }
}

function monthFromNumero(numero) {
  if (!numero) return null
  const s = String(numero).trim()
  let m = s.match(/^(\d{4})\D+(\d{2})/)
  if (!m) m = s.match(/(\d{4})\D+(\d{2})/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!year || !month || month < 1 || month > 12) return null
  return new Date(year, month - 1, 1)
}

export { PHASES, phaseNameByKey, computePhaseState, monthFromNumero }

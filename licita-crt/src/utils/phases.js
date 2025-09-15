export const PHASES = [
  { key: 'oficio_tr',              name: 'Ofício e Termo de Referência do Secretário',                     sector: 'Secretaria Demandante' },
  { key: 'cotacao',                name: 'Cotação de Preços',                                             sector: 'Compras' },
  { key: 'dotacao',                name: 'Dotação orçamentária',                                          sector: 'Financeiro' },
  { key: 'autorizacao_gestor',     name: 'Autorização do gestor',                                         sector: 'Gabinete/Ordenador' },
  { key: 'edital_anexos',          name: 'Arquivo do Edital e anexos',                                    sector: 'Compras' },
  { key: 'parecer_juridico_ini',   name: 'Parecer Jurídico inicial',                                      sector: 'Jurídico' },
  { key: 'publicacao_edital',      name: 'Publicação do edital',                                          sector: 'Compras/Comunicação' },
  { key: 'impugnacoes',            name: 'Impugnações/esclarecimentos referentes ao Edital',              sector: 'Compras/Pregoeiro' },
  { key: 'vencedores',             name: 'Vencedore(s) do certame/itens vencidos',                        sector: 'Pregoeiro/Comissão' },
  { key: 'habilitacao',            name: 'Fase de Habilitação – Situação/Habilitados',                    sector: 'Pregoeiro/Comissão' },
  { key: 'adjudicacao',            name: 'Adjudicação',                                                   sector: 'Pregoeiro/Comissão' },
  { key: 'parecer_juridico_fin',   name: 'Parecer Jurídico final',                                        sector: 'Jurídico' },
  { key: 'homologacao',            name: 'Homologação',                                                   sector: 'Ordenador' },
  { key: 'arp',                    name: 'Ata de Registro de Preços/Empresa(s)',                          sector: 'Compras' },
  { key: 'contratos',              name: 'Contratos/Empresa(s)/Ordenador(es)',                            sector: 'Jurídico/Contratos' },
  { key: 'controle_arp',           name: 'Controle de prazo da ARP (24 meses)',                           sector: 'Compras' },
  { key: 'controle_contratos',     name: 'Controle de prazo dos contratos (12 meses)',                    sector: 'Contratos' },
  { key: 'envio_empenho',          name: 'Envio do(s) contrato(s) para o Empenho',                        sector: 'Financeiro' },
  { key: 'envio_lincon',           name: 'Envio no Lincon',                                               sector: 'Compras/Setor Responsável' },
  { key: 'envio_transparencia',    name: 'Envio no Portal da Transparência',                              sector: 'Controle Interno' },
  { key: 'assinaturas',            name: 'Coleta de assinaturas',                                         sector: 'Contratos' },
  { key: 'aditivo',                name: 'Aditivo – controle de prazo',                                   sector: 'Contratos' },
  { key: 'digitalizacao',          name: 'Digitalização integral do processo',                            sector: 'Arquivo/Protocolo' },
  { key: 'valor_empenhado',        name: 'Valor empenhado/saldo utilizado',                               sector: 'Financeiro' },
]


const norm = s => (s || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()


export function findPhaseIndexByName(stepName) {
  const n = norm(stepName)
  if (!n) return -1
  let idx = PHASES.findIndex(p => norm(p.name).includes(n) || n.includes(norm(p.name)))
  if (idx >= 0) return idx
  const aliases = [
    { rx: /termo.*referencia|tr/, key: 'oficio_tr' },
    { rx: /cotac/, key: 'cotacao' },
    { rx: /dotac/, key: 'dotacao' },
    { rx: /parecer.*inicial/, key: 'parecer_juridico_ini' },
    { rx: /parecer.*final/, key: 'parecer_juridico_fin' },
    { rx: /publica/, key: 'publicacao_edital' },
    { rx: /habilit/, key: 'habilitacao' },
    { rx: /adjudic/, key: 'adjudicacao' },
    { rx: /homolog/, key: 'homologacao' },
    { rx: /ata.*registro|arp/, key: 'arp' },
    { rx: /contrat/, key: 'contratos' },
    { rx: /assinatur/, key: 'assinaturas' },
    { rx: /transparenc/, key: 'envio_transparencia' },
    { rx: /digitaliz/, key: 'digitalizacao' },
    { rx: /empenh/, key: 'envio_empenho' },
  ]
  const hit = aliases.find(a => a.rx.test(n))
  if (!hit) return -1
  return PHASES.findIndex(p => p.key === hit.key)
}

export function monthFromNumero(numero) {
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


export function computePhaseState(fluxo = []) {
  const steps = Array.isArray(fluxo) ? fluxo : []
  if (!steps.length) return { currentIndex: 0, completed: 0, lastChangeAt: null }


  const last = steps[steps.length - 1]
  const idx = findPhaseIndexByName(last?.nome)
  const lastDate = last?.data?.toDate?.() ?? (last?.data ? new Date(last.data) : null)

  const currentIndex = idx >= 0 ? Math.min(idx + 1, PHASES.length - 1) : 0
  const completed = idx >= 0 ? idx + 1 : steps.length
  return { currentIndex, completed, lastChangeAt: lastDate }
}

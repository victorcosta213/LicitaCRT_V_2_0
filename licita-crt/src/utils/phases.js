export const PHASES = [
  { key: 'oficio_tr',              name: 'Ofício e Termo de Referência do Secretário', sector: 'Secretaria Demandante' },
  { key: 'cotacao',                name: 'Cotação de Preços',                           sector: 'Compras' },
  { key: 'dotacao',                name: 'Dotação orçamentária',                        sector: 'Financeiro' },
  { key: 'autorizacao_gestor',     name: 'Autorização do gestor',                       sector: 'Gabinete/Ordenador' },
  { key: 'edital_anexos',          name: 'Arquivo do Edital e anexos',                  sector: 'Compras' },
  { key: 'parecer_juridico_ini',   name: 'Parecer Jurídico inicial',                    sector: 'Jurídico' },
  { key: 'publicacao_edital',      name: 'Publicação do edital',                        sector: 'Compras/Comunicação' },
  { key: 'impugnacoes',            name: 'Impugnações/esclarecimentos referentes ao Edital', sector: 'Compras/Pregoeiro' },
  { key: 'vencedores',             name: 'Vencedore(s) do certame/itens vencidos',      sector: 'Pregoeiro/Comissão' },
  { key: 'habilitacao',            name: 'Fase de Habilitação – Situação/Habilitados',  sector: 'Pregoeiro/Comissão' },
  { key: 'adjudicacao',            name: 'Adjudicação',                                  sector: 'Pregoeiro/Comissão' },
  { key: 'parecer_juridico_fin',   name: 'Parecer Jurídico final',                      sector: 'Jurídico' },
  { key: 'homologacao',            name: 'Homologação',                                  sector: 'Ordenador' },
  { key: 'arp',                    name: 'Ata de Registro de Preços/Empresa(s)',        sector: 'Compras' },
  { key: 'contratos',              name: 'Contratos/Empresa(s)/Ordenador(es)',          sector: 'Jurídico/Contratos' },
  { key: 'controle_arp',           name: 'Controle de prazo da ARP (24 meses)',         sector: 'Compras' },
  { key: 'controle_contratos',     name: 'Controle de prazo dos contratos (12 meses)',  sector: 'Contratos' },
  { key: 'envio_empenho',          name: 'Envio do(s) contrato(s) para o Empenho',      sector: 'Financeiro' },
  { key: 'envio_lincon',           name: 'Envio no Lincon',                              sector: 'Compras/Setor Responsável' },
  { key: 'envio_transparencia',    name: 'Envio no Portal da Transparência',            sector: 'Controle Interno' },
  { key: 'assinaturas',            name: 'Coleta de assinaturas',                        sector: 'Contratos' },
  { key: 'aditivo',                name: 'Aditivo – controle de prazo',                 sector: 'Contratos' },
  { key: 'digitalizacao',          name: 'Digitalização integral do processo',          sector: 'Arquivo/Protocolo' },
  { key: 'valor_empenhado',        name: 'Valor empenhado/saldo utilizado',             sector: 'Financeiro' },
]

export const PHASE_BY_KEY = Object.fromEntries(PHASES.map(p => [p.key, p]))
export const PHASE_OPTIONS = PHASES.map(p => ({ value: p.key, label: p.name }))
export const PHASE_NAMES = PHASES.map(p => p.name)

export function phaseNameByKey(key) {
  return PHASE_BY_KEY[key]?.name || key || ''
}

export function findPhaseByNameLoose(name) {
  if (!name) return null
  const n = String(name).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return PHASES.find(p => {
    const a = p.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    return a.includes(n) || n.includes(a)
  }) || null
}

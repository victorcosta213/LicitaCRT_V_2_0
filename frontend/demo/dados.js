// Modo demonstração (npm run demo): só os perfis de acesso e os parâmetros; sem contratações nem processos.
// Nada aqui toca o banco real.
// Datas relativas a hoje, para que prazos, alertas e competências façam sentido em qualquer dia.

const hoje = new Date()
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const dia = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d) }
export const mes = (n) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1); return iso(d) }
const ts = (n) => `${dia(n)}T13:00:00.000Z`

export const USUARIOS = [
  { id: 'u-admin', nome: 'Administração do Sistema', email: 'admin@crt08.demo', role: 'admin' },
  { id: 'u-gestor', nome: 'Ana Ribeiro', email: 'ana.ribeiro@crt08.demo', role: 'gestor' },
  { id: 'u-fiscal', nome: 'Bruno Lima', email: 'bruno.lima@crt08.demo', role: 'fiscal' },
  { id: 'u-subst', nome: 'Carla Souza', email: 'carla.souza@crt08.demo', role: 'fiscal' },
  { id: 'u-compras', nome: 'Diego Alves', email: 'diego.alves@crt08.demo', role: 'compras' },
  { id: 'u-fin', nome: 'Elisa Martins', email: 'elisa.martins@crt08.demo', role: 'financeiro' },
  { id: 'u-gab', nome: 'Fábio Nunes', email: 'fabio.nunes@crt08.demo', role: 'gabinete' },
  { id: 'u-viewer', nome: 'Gisele Prado', email: 'gisele.prado@crt08.demo', role: 'viewer' },
].map((u) => ({ ...u, ativo: true, created_at: ts(-200), updated_at: null }))

export const CONTRATOS = []

export const RESPONSAVEIS = []

export const ORDENS = []

export const COMPETENCIAS = []

export const EMPENHOS = []
export const MOVIMENTOS = []
export const EXECUCOES = []

export const EVENTOS = []
export const OCORRENCIAS = []
export const PENDENCIAS = []
export const DOCUMENTOS = []
export const AUDITORIA = []

export const PARAMETROS = [
  ['alerta_vigencia_dias', [120, 90, 60, 30]], ['alerta_garantia_dias', [60, 30]], ['alerta_reajuste_dias', [60, 30]],
  ['prazo_competencia_dias', 10], ['prazo_ocorrencia_aviso_dias', 5],
  ['tipos_contrato', ['Serviço continuado', 'Fornecimento', 'Obra / engenharia', 'TIC / software', 'Locação', 'Outros']],
  ['modalidades', ['Pregão eletrônico', 'Concorrência', 'Dispensa', 'Inexigibilidade', 'Adesão a ata', 'Outra']],
  ['indices_reajuste', ['IPCA', 'IGP-M', 'INPC', 'ICTI', 'Convenção coletiva', 'Outro']],
  ['orgao_nome', 'Conselho Regional dos Técnicos Industriais da 8ª Região'], ['orgao_cidade', 'Maceió/AL'],
  ['presidente_nome', 'Presidente (demonstração)'], ['diretor_financeiro_nome', 'Diretor Financeiro (demonstração)'],
  ['email_gestao_contratos', 'contratos@crt08.demo'],
  ['atribuicoes_fiscal', 'I – acompanhar e fiscalizar a execução do objeto;\nII – receber e conferir as notas fiscais;\nIII – registrar ocorrências;\nIV – atestar a execução.'],
].map(([chave, valor]) => ({ chave, valor }))

export const PROCESSOS = []

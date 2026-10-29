// Modo demonstração (npm run demo): só os perfis de acesso e os parâmetros; sem contratações nem processos.
// Nada aqui toca o banco real.
// Datas relativas a hoje, para que prazos, alertas e competências façam sentido em qualquer dia.

const hoje = new Date()
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const dia = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d) }
export const mes = (n) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1); return iso(d) }
const ts = (n) => `${dia(n)}T13:00:00.000Z`

const UNIDADE_DE = { 'u-sec': 'un-sms', 'u-sec2': 'un-semed', 'u-jur': 'un-jur', 'u-adm': 'un-adm', 'u-rh': 'un-rh', 'u-ti': 'un-ti', 'u-pres': 'un-pres', 'u-gestor': 'un-gcon', 'u-fiscal': 'un-fisc', 'u-subst': 'un-fisc', 'u-compras': 'un-comp', 'u-fin': 'un-fin', 'u-gab': 'un-pres' }

export const USUARIOS = [
  { id: 'u-admin', nome: 'Administração do Sistema', email: 'admin@crt08.demo', role: 'admin' },
  { id: 'u-pres', nome: 'Marcos Tavares', email: 'marcos.tavares@crt08.demo', role: 'presidente' },
  { id: 'u-sec', nome: 'Laura Mendes', email: 'laura.mendes@crt08.demo', role: 'secretario' },
  { id: 'u-sec2', nome: 'Rafael Pires', email: 'rafael.pires@crt08.demo', role: 'secretario' },
  { id: 'u-gestor', nome: 'Ana Ribeiro', email: 'ana.ribeiro@crt08.demo', role: 'gestor' },
  { id: 'u-fiscal', nome: 'Bruno Lima', email: 'bruno.lima@crt08.demo', role: 'fiscal' },
  { id: 'u-subst', nome: 'Carla Souza', email: 'carla.souza@crt08.demo', role: 'fiscal' },
  { id: 'u-compras', nome: 'Diego Alves', email: 'diego.alves@crt08.demo', role: 'compras' },
  { id: 'u-fin', nome: 'Elisa Martins', email: 'elisa.martins@crt08.demo', role: 'financeiro' },
  { id: 'u-gab', nome: 'Fábio Nunes', email: 'fabio.nunes@crt08.demo', role: 'gabinete' },
  { id: 'u-jur', nome: 'Helena Costa', email: 'helena.costa@crt08.demo', role: 'juridico' },
  { id: 'u-adm', nome: 'Igor Matos', email: 'igor.matos@crt08.demo', role: 'administrativo' },
  { id: 'u-rh', nome: 'Júlia Prado', email: 'julia.prado@crt08.demo', role: 'rh' },
  { id: 'u-ti', nome: 'Kleber Nunes', email: 'kleber.nunes@crt08.demo', role: 'ti' },
  { id: 'u-viewer', nome: 'Gisele Prado', email: 'gisele.prado@crt08.demo', role: 'viewer' },
].map((u) => ({ ...u, ativo: true, unidade_id: UNIDADE_DE[u.id] ?? null, created_at: ts(-200), updated_at: null }))

// Unidades (setores) da tramitação e a unidade de cada perfil da demonstração; sem processos de exemplo
export const UNIDADES = [
  ['un-pres', 'PRES', 'Presidência / Gabinete'], ['un-adm', 'ADM', 'Administrativo'], ['un-comp', 'COMP', 'Compras e Licitações'],
  ['un-gcon', 'GCON', 'Gestão de Contratos'], ['un-fin', 'FIN', 'Financeiro'], ['un-jur', 'JUR', 'Jurídico'],
  ['un-fisc', 'FISC', 'Fiscalização'], ['un-ti', 'TI', 'Tecnologia da Informação'], ['un-rh', 'RH', 'Recursos Humanos'],
  ['un-sms', 'SMS', 'Secretaria de Saúde'], ['un-semed', 'SEMED', 'Secretaria de Educação'],
].map(([id, sigla, nome]) => ({ id, sigla, nome, ativa: true, created_at: ts(-200) }))
export const TR_PROCESSOS = []
export const TR_TRAMITACOES = []
export const DOC_DOCUMENTOS = []
export const DOC_ASSINATURAS = []
export const CP_SOLICITACOES = []
export const CP_EVENTOS = []
export const CP_CHECKLIST = []
// Catálogo de exemplo (na vida real, a administração cadastra)
export const CP_ITENS = [
  ['it-1', 'INF-001', 'Computador desktop', 'Processador de 6 núcleos ou superior, 16 GB de RAM, SSD de 512 GB, rede gigabit, sistema operacional licenciado, garantia de 36 meses on-site.', 'unidade', 'Informática', 'bens-permanentes', 4500],
  ['it-2', 'INF-002', 'Monitor 24 polegadas', 'Tela LED IPS Full HD (1920x1080), entradas HDMI e DisplayPort, ajuste de altura, garantia de 36 meses.', 'unidade', 'Informática', 'bens-permanentes', 950],
  ['it-3', 'INF-003', 'Notebook', 'Processador de 6 núcleos ou superior, 16 GB de RAM, SSD de 512 GB, tela de 14 a 15,6 polegadas, bateria de 6 h ou mais, garantia de 24 meses.', 'unidade', 'Informática', 'bens-permanentes', 5200],
  ['it-4', 'MOB-001', 'Cadeira ergonômica', 'Cadeira giratória com regulagem de altura, encosto e apoio de braços, conforme NR-17, assento em espuma injetada.', 'unidade', 'Mobiliário', 'bens-permanentes', 780],
  ['it-5', 'EXP-001', 'Papel A4', 'Papel sulfite branco, 75 g/m², 210 x 297 mm, resma com 500 folhas.', 'resma', 'Material de expediente', 'bens-consumo', 28],
  ['it-6', 'SRV-001', 'Manutenção de ar-condicionado', 'Manutenção preventiva e corretiva de aparelhos split, com fornecimento de peças, conforme PMOC.', 'mês', 'Serviços', 'servicos-comuns', 3200],
].map(([id, codigo, nome, especificacao, unidade_medida, categoria, objeto_tipo, valor_referencia]) => ({
  id, codigo, nome, especificacao, unidade_medida, categoria, objeto_tipo, valor_referencia, ativo: true, created_at: ts(-100), updated_at: ts(-100),
}))

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

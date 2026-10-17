// Dados fictícios do modo demonstração (npm run demo). Nada aqui toca o banco real.
// Datas relativas a hoje, para que prazos, alertas e competências façam sentido em qualquer dia.

const hoje = new Date()
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const dia = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d) }
export const mes = (n) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1); return iso(d) }
const ts = (n) => `${dia(n)}T13:00:00.000Z`
const ano = hoje.getFullYear()

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

const base = (id, extra) => ({
  id, legacy_id: null, cancelado: false, created_at: ts(-120), updated_at: ts(-2), created_by: 'u-compras',
  modalidade: 'Pregão eletrônico', unidade_demandante: 'Gerência Administrativa', prorrogavel: true,
  validado_gestao: true, encaminhado_em: ts(-110), portaria_status: 'publicada', execucao_anterior: false,
  substituto_em_atuacao: false, exige_garantia: false, ...extra,
})

export const CONTRATOS = [
  base('c1', {
    id_interno: 14, instrumento: 'contrato', numero: '014/2026', situacao: 'ativo',
    contratada: 'LimpaMais Serviços Ltda', cnpj: '11.222.333/0001-81', objeto: 'Limpeza, conservação e higienização da sede e da delegacia de Aracaju',
    sei_processo: '0001.000214/2026-11', valor_inicial: 312000, vigencia_inicio: dia(-200), vigencia_fim: dia(165),
    contratada_endereco: 'Av. Fernandes Lima, 1200 — Maceió/AL', contratada_representante: 'Marta Cavalcante',
    portaria_numero: '22/2026', portaria_data: dia(-190), portaria_publicacao_data: dia(-188), portaria_sei: '0045871',
    termo_sei: '0045990', data_base_reajuste: dia(-330), indice_reajuste: 'IPCA', exige_garantia: true,
    garantia_modalidade: 'Seguro-garantia', garantia_valor: 15600, garantia_vencimento: dia(150),
  }),
  base('c2', {
    id_interno: 21, instrumento: 'contrato', numero: '021/2026', situacao: 'ativo',
    contratada: 'Vigilância Nordeste Segurança Patrimonial', cnpj: '00.000.000/0001-91', objeto: 'Vigilância armada diurna e noturna — sede Maceió',
    sei_processo: '0001.000301/2026-04', valor_inicial: 486000, vigencia_inicio: dia(-150), vigencia_fim: dia(215),
    portaria_numero: '31/2026', portaria_data: dia(-140), portaria_publicacao_data: dia(-139), portaria_sei: '0046210',
  }),
  base('c3', {
    id_interno: 33, instrumento: 'nota_empenho', numero: '2026NE000233', situacao: 'ativo', modalidade: 'Dispensa',
    contratada: 'Papelaria Central Comércio', cnpj: '12.345.678/0001-95', objeto: 'Material de expediente para o segundo semestre',
    sei_processo: '0001.000512/2026-87', valor_inicial: 18750, vigencia_inicio: dia(-20), vigencia_fim: null, prazo_execucao_dias: 30,
    portaria_numero: '40/2026', portaria_data: dia(-15), portaria_publicacao_data: dia(-14), portaria_sei: '0047755', termo_sei: '0047801',
  }),
  base('c4', {
    id_interno: 36, instrumento: 'contrato', numero: '027/2026', situacao: 'ativo',
    contratada: 'Clima Engenharia e Manutenção', cnpj: '23.456.789/0001-04', objeto: 'Manutenção preventiva e corretiva dos aparelhos de ar-condicionado',
    sei_processo: '0001.000533/2026-19', valor_inicial: 96400, vigencia_inicio: dia(-10), vigencia_fim: dia(355),
    portaria_status: 'aguardando_publicacao', portaria_numero: null,
  }),
  base('c5', {
    id_interno: 38, instrumento: 'contrato', numero: '030/2026', situacao: 'em_cadastro', validado_gestao: false,
    encaminhado_em: ts(-1), portaria_status: null, modalidade: 'Inexigibilidade',
    contratada: 'TechSoft Sistemas', cnpj: '34.567.890/0001-12', objeto: 'Licenciamento e suporte do sistema de protocolo eletrônico',
    sei_processo: '0001.000560/2026-02', valor_inicial: 54000, vigencia_inicio: dia(5), vigencia_fim: dia(370),
  }),
  base('c6', {
    id_interno: 39, instrumento: 'contrato', numero: '031/2026', situacao: 'em_cadastro', validado_gestao: false,
    encaminhado_em: null, portaria_status: null, created_by: 'u-compras',
    contratada: 'Gráfica Rápida Impressos', cnpj: '', objeto: 'Impressão de carteiras profissionais e material institucional',
    sei_processo: '0001.000571/2026-66', valor_inicial: 0, vigencia_inicio: dia(15), vigencia_fim: null,
  }),
  base('c7', {
    id_interno: 9, instrumento: 'contrato', numero: '009/2025', situacao: 'em_prorrogacao', modalidade: 'Pregão eletrônico',
    contratada: 'Telefonia Brasil S.A.', cnpj: '45.678.901/0001-30', objeto: 'Telefonia fixa e internet dedicada',
    sei_processo: '0001.000099/2025-33', valor_inicial: 72000, vigencia_inicio: dia(-325), vigencia_fim: dia(40),
    limite_prorrogacao: dia(1500), portaria_numero: '08/2025', portaria_data: dia(-320), portaria_sei: '0039012',
  }),
  base('c8', {
    id_interno: 2, instrumento: 'contrato', numero: '002/2024', situacao: 'ativo', legacy_id: 'legado-2',
    execucao_anterior: true, validado_gestao: false, portaria_status: null, modalidade: 'Dispensa',
    contratada: 'Água Pura Distribuidora', cnpj: '56.789.012/0001-49', objeto: 'Fornecimento de água mineral em garrafões de 20 L',
    sei_processo: '0001.000018/2024-71', valor_inicial: 9600, vigencia_inicio: dia(-640), vigencia_fim: dia(85),
    exige_garantia: true, garantia_modalidade: 'Caução', garantia_valor: 480, garantia_vencimento: dia(25),
  }),
]

const resp = (id, contrato_id, papel, nome, usuario_id, extra = {}) => ({
  id, contrato_id, papel, nome, usuario_id, email: USUARIOS.find((u) => u.id === usuario_id)?.email || null,
  ativo: true, ciente_em: dia(-100), sei_documento: null, created_at: ts(-110), ...extra,
})
export const RESPONSAVEIS = [
  resp('r1', 'c1', 'gestor_titular', 'Ana Ribeiro', 'u-gestor'),
  resp('r2', 'c1', 'fiscal_tecnico', 'Bruno Lima', 'u-fiscal'),
  resp('r3', 'c1', 'fiscal_substituto', 'Carla Souza', 'u-subst'),
  resp('r4', 'c2', 'gestor_titular', 'Ana Ribeiro', 'u-gestor'),
  resp('r5', 'c2', 'fiscal_tecnico', 'Bruno Lima', 'u-fiscal'),
  resp('r6', 'c2', 'fiscal_substituto', 'Carla Souza', 'u-subst'),
  resp('r7', 'c3', 'gestor_titular', 'Ana Ribeiro', 'u-gestor', { ciente_em: dia(-12) }),
  resp('r8', 'c3', 'fiscal_tecnico', 'Carla Souza', 'u-subst', { ciente_em: dia(-12), created_at: ts(-3) }),
  resp('r9', 'c3', 'fiscal_substituto', 'Bruno Lima', 'u-fiscal', { ciente_em: dia(-12), created_at: ts(-3) }),
  resp('r10', 'c4', 'gestor_titular', 'Ana Ribeiro', 'u-gestor', { ciente_em: null }),
  resp('r11', 'c4', 'fiscal_tecnico', 'Bruno Lima', 'u-fiscal', { ciente_em: null, created_at: ts(-4) }),
  resp('r12', 'c4', 'fiscal_substituto', 'Carla Souza', 'u-subst', { ciente_em: null, created_at: ts(-4) }),
  resp('r13', 'c7', 'gestor_titular', 'Ana Ribeiro', 'u-gestor'),
  resp('r14', 'c7', 'fiscal_tecnico', 'Carla Souza', 'u-subst'),
  resp('r15', 'c8', 'fiscal_tecnico', 'Bruno Lima', 'u-fiscal', { ciente_em: null }),
]

const os = (id, contrato_id, extra) => ({
  id, contrato_id, tipo: 'os', cancelado: false, created_at: ts(-100), data_solicitacao: dia(-105),
  solicitante_nome: 'Diego Alves', conferencia: null, ...extra,
})
export const ORDENS = [
  os('o1', 'c1', { status: 'vigente', numero_os: '014/2026-01', data_emissao: dia(-185), valor: 312000, objeto_autorizado: 'Início dos serviços de limpeza', periodo_inicio: dia(-180), periodo_fim: dia(165), data_ciencia: dia(-182), data_efetiva_inicio: dia(-180), assinatura_presidente_em: dia(-184), assinatura_diretor_em: dia(-184), envio_data: dia(-183), envio_meio: 'e-mail', sei_documento: '0045920' }),
  os('o2', 'c2', { status: 'vigente', numero_os: '021/2026-01', data_emissao: dia(-135), objeto_autorizado: 'Postos de vigilância 24h', periodo_inicio: dia(-130), periodo_fim: dia(215), data_ciencia: dia(-131), data_efetiva_inicio: dia(-130), sei_documento: '0046300' }),
  os('o3', 'c3', { tipo: 'oc', status: 'aguardando_assinatura', numero_os: '07/2026', data_emissao: dia(-2), valor: 18750, objeto_autorizado: 'Fornecimento integral do material de expediente', data_solicitacao: dia(-19), assinatura_presidente_em: dia(-1), created_at: ts(-19) }),
  os('o4', 'c4', { status: 'em_conferencia', numero_os: '027/2026-01', objeto_autorizado: 'Manutenção preventiva mensal', data_solicitacao: dia(-9), created_at: ts(-9) }),
  os('o5', 'c5', { status: 'solicitada', data_solicitacao: dia(-1), created_at: ts(-1) }),
  os('o6', 'c7', { status: 'vigente', numero_os: '009/2025-01', data_efetiva_inicio: dia(-320), periodo_inicio: dia(-320), periodo_fim: dia(40) }),
]

const comp = (id, contrato_id, m, extra) => ({
  id, contrato_id, competencia: mes(m), cancelado: false, suspensa: false, created_at: ts(m * 30), updated_at: ts(-1),
  nf_recebida: false, relatorio_recebido: false, doc_completa: false, atestado: false, liberado_financeiro: false,
  houve_glosa: false, houve_ocorrencia: false, fiscal_nome: 'Bruno Lima', ...extra,
})
const fiscalizada = {
  nf_recebida: true, relatorio_recebido: true, execucao_realizada: true, conforme_contrato: true,
  quantidade_adequada: 'sim', qualidade_adequada: true, prazo_cumprido: true, certidoes_verificadas: true,
  doc_trabalhista_ok: true, doc_completa: true,
}
export const COMPETENCIAS = [
  comp('k1-4', 'c1', -4, { ...fiscalizada, nf_numero: '1180', nf_valor_bruto: 26000, atestado: true, atesto_data: dia(-100), liberado_financeiro: true, liberado_data: dia(-98), sei_atesto: '0049001' }),
  comp('k1-3', 'c1', -3, { ...fiscalizada, nf_numero: '1214', nf_valor_bruto: 26000, atestado: true, atesto_data: dia(-70), liberado_financeiro: true, liberado_data: dia(-68), sei_atesto: '0050112' }),
  comp('k1-2', 'c1', -2, { ...fiscalizada, nf_numero: '1251', nf_valor_bruto: 26000, atestado: true, atesto_data: dia(-40), liberado_financeiro: true, liberado_data: dia(-38), sei_atesto: '0051230' }),
  comp('k1-1', 'c1', -1, { ...fiscalizada, nf_numero: '1290', nf_valor_bruto: 26000, nf_recebimento_data: dia(-6), atestado: true, atesto_data: dia(-3), sei_atesto: '0052004' }),
  comp('k1-0', 'c1', 0, { nf_recebida: true, nf_numero: '1322', nf_valor_bruto: 26000, nf_recebimento_data: dia(-1) }),
  comp('k2-2', 'c2', -2, { ...fiscalizada, nf_numero: '8812', nf_valor_bruto: 40500, atestado: true, atesto_data: dia(-45), liberado_financeiro: true, liberado_data: dia(-44) }),
  comp('k2-1', 'c2', -1, { ...fiscalizada, nf_numero: '8890', nf_valor_bruto: 40500, houve_glosa: true, glosa_valor: 2700, glosa_motivo: 'Posto noturno descoberto em 2 plantões', houve_ocorrencia: true }),
  comp('k2-0', 'c2', 0, {}),
  comp('k7-1', 'c7', -1, { ...fiscalizada, nf_numero: '552201', nf_valor_bruto: 6000, atestado: true, atesto_data: dia(-12), liberado_financeiro: true, liberado_data: dia(-10), fiscal_nome: 'Carla Souza' }),
]

export const EMPENHOS = [
  { id: 'e1', contrato_id: 'c1', numero: `${ano}NE000101`, exercicio: ano, valor_inicial: 200000, data: dia(-195), fonte_dotacao: '6.3.1.3.01.01.006', cancelado: false, created_at: ts(-195) },
  { id: 'e2', contrato_id: 'c2', numero: `${ano}NE000140`, exercicio: ano, valor_inicial: 250000, data: dia(-145), cancelado: false, created_at: ts(-145) },
  { id: 'e3', contrato_id: 'c3', numero: `${ano}NE000233`, exercicio: ano, valor_inicial: 18750, data: dia(-20), cancelado: false, created_at: ts(-20) },
  { id: 'e4', contrato_id: 'c7', numero: `${ano}NE000012`, exercicio: ano, valor_inicial: 60000, data: dia(-280), cancelado: false, created_at: ts(-280) },
]
export const MOVIMENTOS = [
  { id: 'm1', empenho_id: 'e1', contrato_id: 'c1', tipo: 'reforco', valor: 60000, data: dia(-30), cancelado: false, created_at: ts(-30) },
]
export const EXECUCOES = [
  { id: 'x1', contrato_id: 'c1', competencia_id: 'k1-4', empenho_id: 'e1', valor_competencia: 26000, data_liquidacao: dia(-95), valor_liquidado: 26000, data_pagamento: dia(-90), valor_pago: 24440, retencao: 1560, cancelado: false, created_at: ts(-95) },
  { id: 'x2', contrato_id: 'c1', competencia_id: 'k1-3', empenho_id: 'e1', valor_competencia: 26000, data_liquidacao: dia(-65), valor_liquidado: 26000, data_pagamento: dia(-60), valor_pago: 24440, retencao: 1560, cancelado: false, created_at: ts(-65) },
  { id: 'x3', contrato_id: 'c1', competencia_id: 'k1-2', empenho_id: 'e1', valor_competencia: 26000, data_liquidacao: dia(-8), valor_liquidado: 26000, cancelado: false, created_at: ts(-8) },
  { id: 'x4', contrato_id: 'c2', competencia_id: 'k2-2', empenho_id: 'e2', valor_competencia: 40500, data_liquidacao: dia(-40), valor_liquidado: 40500, data_pagamento: dia(-35), valor_pago: 40500, cancelado: false, created_at: ts(-40) },
]

export const EVENTOS = [
  { id: 'ev1', contrato_id: 'c7', tipo: 'prorrogacao', situacao: 'em_analise', data_solicitacao: dia(-20), valor_anterior: 72000, vigencia_anterior: dia(40), responsavel: 'Ana Ribeiro', observacao: 'Prorrogação por mais 12 meses', cancelado: false, created_at: ts(-20) },
  { id: 'ev2', contrato_id: 'c1', tipo: 'acrescimo', situacao: 'concluido', data_evento: dia(-60), valor_anterior: 312000, valor_posterior: 338000, sei_documento: '0050990', observacao: '1º Termo Aditivo — acréscimo de área', cancelado: false, created_at: ts(-60) },
]
export const OCORRENCIAS = [
  { id: 'oc1', contrato_id: 'c2', competencia_id: 'k2-1', data: dia(-20), tipo: 'ausencia_empregado', descricao: 'Posto noturno descoberto em dois plantões', providencia: 'Notificação à contratada', prazo_concedido: dia(3), status: 'aguardando_contratada', fiscal_nome: 'Bruno Lima', cancelado: false, created_at: ts(-20) },
]
export const PENDENCIAS = [
  { id: 'p1', contrato_id: 'c8', descricao: 'Solicitar renovação da caução à contratada', prazo: dia(5), perfil_responsavel: 'gestor', status: 'aberta', cancelado: false, created_at: ts(-3) },
  { id: 'p2', contrato_id: 'c5', descricao: 'Designar fiscal titular e fiscal substituto (solicitado por Compras)', prazo: dia(4), perfil_responsavel: 'gestor', status: 'aberta', cancelado: false, created_at: ts(-1) },
]
export const DOCUMENTOS = [
  { id: 'd1', contrato_id: 'c1', tipo: 'Contrato', numero_sei: '0045500', data: dia(-200), descricao: 'Contrato assinado', cancelado: false, created_at: ts(-199) },
  { id: 'd2', contrato_id: 'c1', tipo: 'Garantia', numero_sei: '0045711', data: dia(-195), descricao: 'Apólice do seguro-garantia', cancelado: false, created_at: ts(-195) },
]
export const AUDITORIA = [
  { id: 1, em: ts(-1), tabela: 'gc_competencias', registro_id: 'k1-0', contrato_id: 'c1', acao: 'UPDATE', usuario_id: 'u-fiscal', usuario_nome: 'Bruno Lima', antes: { nf_recebida: false }, depois: { nf_recebida: true, nf_numero: '1322' } },
  { id: 2, em: ts(-3), tabela: 'gc_competencias', registro_id: 'k1-1', contrato_id: 'c1', acao: 'UPDATE', usuario_id: 'u-fiscal', usuario_nome: 'Bruno Lima', antes: { atestado: false }, depois: { atestado: true } },
]

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

const fases = ['Cotação de Preços', 'Dotação orçamentária', 'Parecer Jurídico inicial', 'Publicação do edital', 'Habilitação', 'Homologação', 'Contratos/Empresa(s)/Ordenador(es)']
const proc = (i, numero, objeto, etapa, prioridade, tipo, prazo, extra = {}) => ({
  id: `pr${i}`, numero, objeto, etapa, prioridade, tipo, prazo: prazo === null ? null : dia(prazo),
  responsavel: ['Diego Alves', 'Helena Costa', 'Igor Matos'][i % 3], unidade_demandante: ['Gerência Administrativa', 'Fiscalização', 'Tecnologia', 'Comunicação'][i % 4],
  valor_estimado: [12500, 48000, 186000, 7300, 92000, 25400][i % 6], local_documentacao: ['DFD', 'Pesquisa de preço', 'Termo de referencia', 'Parecer do juridico'][i % 4],
  modalidade: tipo, situacao_sei: 'Em andamento', arquivado: false, justificativa: null, anexo_path: null, anexo_url: null,
  fluxo: fases.slice(0, Math.max(1, fases.indexOf(etapa) + 1)).map((nome, j) => ({ nome, data: `${dia(-90 + j * 12)}T00:00:00` })),
  created_at: ts(-90 + i), ...extra,
})
export const PROCESSOS = [
  proc(1, '2026/041', 'Aquisição de notebooks para a fiscalização', 'Cotação de Preços', 'Critico', 'Pregao', 6),
  proc(2, '2026/044', 'Serviço de dedetização da sede', 'Dotação orçamentária', 'Nao Critico', 'Dispensa Eletronica', 18),
  proc(3, '2026/047', 'Reforma da delegacia de Aracaju', 'Parecer Jurídico inicial', 'Estrategico', 'Concorrencia', -3),
  proc(4, '2026/050', 'Assinatura de base normativa técnica', 'Habilitação', 'Alavancavel', 'Inexigibilidade', 2),
  proc(5, '2026/052', 'Locação de veículos para a fiscalização', 'Publicação do edital', 'Critico', 'Pregao', 25),
  proc(6, '2026/055', 'Material de copa e cozinha', 'Homologação', 'Nao Critico', 'Dispensa', 40),
  proc(7, '2026/058', 'Seguro predial', 'Cotação de Preços', 'Estrategico', 'Pregao', 12),
  proc(8, '2026/061', 'Certificado digital A3 para conselheiros', 'Dotação orçamentária', 'Nao Critico', 'Dispensa Eletronica', null),
  proc(9, '2026/063', 'Capacitação em fiscalização de contratos', 'Contratos/Empresa(s)/Ordenador(es)', 'Alavancavel', 'Inexigibilidade', 9),
  proc(10, '2026/066', 'Serviço de chaveiro sob demanda', 'Homologação', 'Nao Critico', 'Dispensa', 60, { arquivado: true }),
]

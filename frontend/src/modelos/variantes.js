// Tipos de contratação e de objeto: definem o checklist de artefatos e as particularidades de ETP, TR e contrato.
import { L, T } from './base'

export const MODALIDADES = [
  { valor: 'pregao', rotulo: 'Pregão (art. 28, I)' },
  { valor: 'concorrencia', rotulo: 'Concorrência (art. 28, II)' },
  { valor: 'dispensa', rotulo: 'Dispensa de licitação (art. 75)' },
  { valor: 'inexigibilidade', rotulo: 'Inexigibilidade (art. 74)' },
  { valor: 'adesao-ata', rotulo: 'Adesão a ata de registro de preços (art. 86, §2º)' },
]

export const OBJETOS = [
  { valor: 'bens-consumo', rotulo: 'Bens de consumo' },
  { valor: 'bens-permanentes', rotulo: 'Bens permanentes' },
  { valor: 'servicos-comuns', rotulo: 'Serviços comuns (sem dedicação exclusiva de mão de obra)' },
  { valor: 'servicos-continuos-demo', rotulo: 'Serviços contínuos com dedicação exclusiva de mão de obra' },
  { valor: 'tic', rotulo: 'Soluções de tecnologia da informação (TIC)' },
  { valor: 'obras-engenharia', rotulo: 'Obras e serviços de engenharia' },
  { valor: 'locacao', rotulo: 'Locação de bens ou de imóveis' },
]

export const rotuloDo = (lista, valor) => lista.find((x) => x.valor === valor)?.rotulo || valor

// Particularidades de cada tipo de objeto para o ETP: seções que só aparecem quando o tipo é o escolhido
export const PARTICULARIDADES_ETP = {
  'bens-consumo': {
    titulo: 'Particularidades: bens de consumo',
    campos: [
      L('consumo_anual', 'Expectativa de consumo anual e histórico', { obrigatorio: true, ajuda: 'Art. 40, caput: o planejamento de compras considera a expectativa de consumo anual. Informe o consumo dos últimos exercícios e a projeção.' }),
      L('padronizacao', 'Padronização, armazenamento e validade', { ajuda: 'Art. 40, V e IV: padronização das especificações e condições de guarda que evitem a deterioração. Informe prazo de validade mínimo e local de armazenamento.' }),
      L('sustentabilidade_bens', 'Critérios de sustentabilidade', { ajuda: 'Embalagem, origem, certificações e descarte, quando aplicável.' }),
    ],
  },
  'bens-permanentes': {
    titulo: 'Particularidades: bens permanentes',
    campos: [
      L('vida_util', 'Vida útil e custo de ciclo de vida', { obrigatorio: true, ajuda: 'Considere o ciclo de vida do objeto, incluindo manutenção e descarte (art. 18, §1º, VII e art. 34 — custos indiretos).' }),
      L('garantia_assistencia', 'Garantia e assistência técnica', { obrigatorio: true, ajuda: 'Prazo mínimo de garantia e condições de manutenção e assistência técnica (art. 92, XIII).' }),
      L('patrimonio', 'Tombamento e treinamento', { ajuda: 'Registro patrimonial e eventual capacitação dos usuários.' }),
    ],
  },
  'servicos-comuns': {
    titulo: 'Particularidades: serviços comuns',
    campos: [
      L('nivel_servico', 'Níveis de serviço esperados', { obrigatorio: true, ajuda: 'Indicadores objetivos para medir a qualidade da entrega (prazo, quantidade, qualidade).' }),
      L('local_horario', 'Local e horário de execução', {}),
      L('materiais_equipamentos', 'Materiais, equipamentos e qualificação da equipe', {}),
    ],
  },
  'servicos-continuos-demo': {
    titulo: 'Particularidades: serviços contínuos com dedicação exclusiva de mão de obra',
    campos: [
      L('dimensionamento', 'Dimensionamento da mão de obra', { obrigatorio: true, ajuda: 'Postos, jornada, funções e a metodologia usada para chegar ao quantitativo. Confirme o enquadramento no art. 6º, XVI.' }),
      L('convencao_coletiva', 'Convenção coletiva aplicável e categoria', { obrigatorio: true, ajuda: 'Indique a convenção coletiva e a data-base; ela orienta a planilha de custos e a repactuação (art. 25, §8º, II).' }),
      L('vedacoes_cautelas', 'Vedações e cautelas trabalhistas', { padrao: 'Serão observadas as vedações do art. 48 da Lei 14.133/2021 à Administração na contratação de serviço terceirizado e avaliadas as medidas do art. 50 para assegurar o cumprimento das obrigações trabalhistas (garantia com cobertura para verbas rescisórias, condicionamento do pagamento à quitação trabalhista, conta vinculada). [preencher: medidas adotadas]', ajuda: 'Respeite as vedações do art. 48 e avalie as medidas do art. 50.' }),
      L('reserva_vagas', 'Reserva de vagas (art. 49)', { padrao: 'Verificada a exigência de reserva de percentual de vagas para mulheres vítimas de violência doméstica e para egressos do sistema prisional (art. 49). [preencher: percentual e justificativa, se não se aplicar]', ajuda: 'Veja a exigência de reserva de vagas.' }),
    ],
  },
  tic: {
    titulo: 'Particularidades: tecnologia da informação',
    campos: [
      L('alinhamento_tic', 'Alinhamento com o planejamento de TIC', { obrigatorio: true, ajuda: 'Relacione a solução com o planejamento e a infraestrutura de TI do órgão.' }),
      L('seguranca_lgpd', 'Segurança da informação e proteção de dados', { obrigatorio: true, ajuda: 'Requisitos de segurança e de tratamento de dados pessoais (Lei 13.709/2018 — LGPD).' }),
      L('propriedade_suporte', 'Propriedade intelectual, licenciamento e suporte', { ajuda: 'Quem detém o código e os dados, modelo de licença, níveis de suporte e continuidade.' }),
    ],
  },
  'obras-engenharia': {
    titulo: 'Particularidades: obras e serviços de engenharia',
    campos: [
      L('projeto_basico', 'Projeto básico ou anteprojeto', { obrigatorio: true, padrao: 'O projeto básico (art. 6º, XXV, da Lei 14.133/2021) reúne os elementos necessários e suficientes para caracterizar a obra ou o serviço de engenharia. [preencher: situação do projeto básico ou anteprojeto]', ajuda: 'Art. 6º, XXV: o projeto básico é elemento do planejamento. No ETP de obras e serviços comuns de engenharia, a especificação pode ficar para o TR/projeto básico (art. 18, §3º).' }),
      L('licenciamento_responsabilidade', 'Licenciamento ambiental e responsabilidade técnica', { ajuda: 'Licenças necessárias e ART/RRT do responsável técnico.' }),
      L('orcamento_engenharia', 'Orçamento de referência e BDI', { ajuda: 'Parâmetros de custo e BDI usados (art. 23, §2º).' }),
      L('grande_vulto_riscos', 'Grande vulto e matriz de riscos', { padrao: 'Avaliar se a obra é de grande vulto ou se será adotada contratação integrada ou semi-integrada: nesses casos o edital contemplará matriz de alocação de riscos (art. 22, §3º). [preencher: conclusão]', ajuda: 'Obras de grande vulto ou com regime de contratação integrada/semi-integrada exigem matriz de alocação de riscos no edital (art. 22, §3º).' }),
    ],
  },
  locacao: {
    titulo: 'Particularidades: locação',
    campos: [
      L('avaliacao_bem', 'Avaliação prévia do bem', { obrigatorio: true, padrao: 'A locação será precedida de avaliação prévia do bem, do seu estado de conservação, dos custos de adaptações e do prazo de amortização dos investimentos (art. 51). [preencher: resultado da avaliação]', ajuda: 'Avaliação do bem, do estado de conservação, dos custos de adaptação e do prazo de amortização dos investimentos (art. 51).' }),
      L('localizacao_instalacoes', 'Localização e características de instalações', { ajuda: 'Se a escolha do imóvel decorrer de suas características e localização, justifique (art. 74, V).' }),
    ],
  },
}

// Particularidades do TR (modelo de execução e gestão) por objeto
export const PARTICULARIDADES_TR = {
  'bens-consumo': [T('prazo_entrega_consumo', 'Prazo e local de entrega', { obrigatorio: true }), L('amostras', 'Amostras e prova de conceito', {}), L('validade_embalagem', 'Validade mínima e embalagem', {})],
  'bens-permanentes': [T('prazo_entrega_permanente', 'Prazo e local de entrega', { obrigatorio: true }), T('garantia', 'Prazo de garantia (meses)', { obrigatorio: true }), L('assistencia', 'Assistência técnica e treinamento', {})],
  'servicos-comuns': [L('nivel_servico', 'Níveis de serviço e ajuste no pagamento', { obrigatorio: true }), L('local_horario', 'Local e horário de execução', {})],
  'servicos-continuos-demo': [
    L('postos', 'Postos de trabalho, jornada e funções', { obrigatorio: true }),
    L('planilha_custos', 'Planilha de custos e formação de preços', { obrigatorio: true, padrao: 'Os licitantes apresentarão planilha de custos e formação de preços. Os preços serão repactuados após o interregno mínimo de 1 (um) ano, mediante demonstração analítica da variação dos custos (art. 25, §8º, II, da Lei 14.133/2021). [preencher: convenção coletiva e data-base]', ajuda: 'Os licitantes apresentam planilha de custos; a repactuação exige demonstração analítica da variação dos custos (art. 25, §8º, II).' }),
    L('cautelas_trabalhistas', 'Garantias e cautelas trabalhistas', { padrao: 'Poderão ser adotadas as medidas do art. 50 da Lei 14.133/2021: garantia com cobertura para verbas rescisórias, condicionamento do pagamento à quitação das obrigações trabalhistas, conta vinculada e pagamento direto das verbas inadimplidas. [preencher: medidas escolhidas]', ajuda: 'Medidas do art. 50: caução/seguro-garantia, condicionamento do pagamento à quitação trabalhista, conta vinculada.' }),
  ],
  tic: [L('sla', 'Níveis de serviço (SLA) e suporte', { obrigatorio: true }), L('seguranca_lgpd', 'Segurança e proteção de dados (LGPD)', { obrigatorio: true }), L('transicao', 'Transição contratual e continuidade', {})],
  'obras-engenharia': [L('projeto', 'Projeto básico e memorial descritivo', { obrigatorio: true }), L('responsavel_tecnico', 'Responsável técnico e ART/RRT', { obrigatorio: true }), L('cronograma', 'Cronograma físico-financeiro e medições', { obrigatorio: true })],
  locacao: [T('imovel', 'Descrição do bem ou do imóvel', { obrigatorio: true }), L('avaliacao', 'Avaliação prévia e adaptações', { obrigatorio: true })],
}

// Gestão e fiscalização do contrato e atos setoriais (Gabinete, TI, RH e demais áreas técnicas).
import { B, D, L, R, S, T, ou, paragrafos } from './base'
import { TODOS } from './comuns'

export const CAT_GESTAO = 'Gestão e fiscalização do contrato (Lei 14.133/2021)'
export const CAT_SETORIAIS = 'Atos e pareceres setoriais'

const assina = (v) => [B.espaco(), B.assina(v.assinante, v.cargo_assinante)]
const ASSINANTE = (rotulo = 'Nome de quem assina') => [
  T('assinante', rotulo, { obrigatorio: true, padrao: (c) => c.autor?.nome || '' }),
  T('cargo_assinante', 'Cargo / função', { obrigatorio: true }),
]
const FECHO = (rotulo) => ({ id: 'assina', titulo: '', campos: ASSINANTE(rotulo), bloco: assina })

export const TERMO_RECEBIMENTO = {
  codigo: 'termo-recebimento', sigla: 'TRC', versao: 1, nome: 'Termo de recebimento (provisório ou definitivo)', categoria: CAT_GESTAO, perfis: ['fiscal', 'gestor'],
  descricao: 'Registra o recebimento do objeto, com a conferência das exigências contratuais.',
  baseLegal: 'Lei 14.133/2021, art. 140 (recebimento provisório pelo responsável pela fiscalização e definitivo por servidor ou comissão, mediante termo detalhado).',
  numerar: true, papeisSugeridos: ['Fiscal do contrato', 'Gestor do contrato'],
  titulo: (v, ctx) => `TERMO DE RECEBIMENTO ${v.fase === 'definitivo' ? 'DEFINITIVO' : 'PROVISÓRIO'} Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: [
      S('fase', 'Tipo de recebimento', [{ valor: 'provisorio', rotulo: 'Provisório (art. 140, I, a e II, a)' }, { valor: 'definitivo', rotulo: 'Definitivo (art. 140, I, b e II, b)' }], { obrigatorio: true, padrao: 'provisorio' }),
      T('contrato', 'Contrato nº', { obrigatorio: true }),
      T('contratada', 'Contratada', { obrigatorio: true }),
      L('objeto', 'Objeto recebido', { obrigatorio: true }),
      T('nota_fiscal', 'Nota fiscal / documento', { obrigatorio: true }),
      D('data_recebimento', 'Data do recebimento', { obrigatorio: true }),
    ] },
    { id: 'conferencia', titulo: 'Conferência', campos: [
      R('exigencias', 'Exigências contratuais verificadas', [
        { nome: 'exigencia', rotulo: 'Exigência' },
        { nome: 'atendida', rotulo: 'Atendida?', tipo: 'select', opcoes: [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'parcial', rotulo: 'Parcialmente' }, { valor: 'nao', rotulo: 'Não' }] },
        { nome: 'observacao', rotulo: 'Observação' },
      ], { obrigatorio: true, padrao: [
        { exigencia: 'Quantidade e especificação conforme o contrato', atendida: '', observacao: '' },
        { exigencia: 'Prazo de entrega ou execução', atendida: '', observacao: '' },
        { exigencia: 'Qualidade e desempenho exigidos', atendida: '', observacao: '' },
      ] }),
      L('pendencias', 'Pendências e recomendações', { ajuda: 'Se houver pendência, diga o que a contratada deve corrigir e em que prazo.' }),
    ] },
    { id: 'conclusao', titulo: 'Conclusão', campos: [
      S('resultado', 'Resultado', [{ valor: 'aceito', rotulo: 'Objeto recebido, sem ressalvas' }, { valor: 'ressalvas', rotulo: 'Objeto recebido, com ressalvas' }, { valor: 'recusado', rotulo: 'Objeto recusado' }], { obrigatorio: true }),
    ] },
    FECHO('Fiscal ou servidor/comissão responsável'),
  ],
}

export const NOTIFICACAO = {
  codigo: 'notificacao-contratada', sigla: 'NOT', versao: 1, nome: 'Notificação à contratada', categoria: CAT_GESTAO, perfis: ['gestor', 'fiscal', 'juridico'],
  descricao: 'Comunica falha na execução, dá prazo para regularizar e abre o prazo de defesa quando houver possibilidade de sanção.',
  baseLegal: 'Lei 14.133/2021, art. 117, §1º (registro e providências do fiscal); arts. 155 e 156 (infrações e sanções); art. 157 (defesa em 15 dias úteis para multa); art. 158 (processo de responsabilização).',
  numerar: false, papeisSugeridos: ['Gestor ou fiscal do contrato'],
  titulo: (v, ctx) => `NOTIFICAÇÃO Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [{
    id: 'not', titulo: '',
    campos: [
      T('contratada', 'Contratada (destinatária)', { obrigatorio: true }),
      T('contrato', 'Contrato nº', { obrigatorio: true }),
      T('processo', 'Processo', { padrao: (c) => c.processo?.numero || '' }),
      L('fato', 'Fatos que motivam a notificação', { obrigatorio: true, linhas: 6, ajuda: 'Descreva o que ocorreu, com datas, e a cláusula ou obrigação descumprida.' }),
      T('clausula', 'Cláusula ou obrigação descumprida', { obrigatorio: true }),
      L('providencia', 'Providência exigida', { obrigatorio: true, ajuda: 'O que a contratada deve fazer para regularizar.' }),
      T('prazo_regularizacao', 'Prazo para regularizar', { obrigatorio: true, ajuda: 'Ex.: 5 dias úteis.' }),
      S('sancao', 'Possível sanção', [
        { valor: 'nenhuma', rotulo: 'Apenas orientação (sem previsão de sanção)' }, { valor: 'advertencia', rotulo: 'Advertência (art. 156, I)' },
        { valor: 'multa', rotulo: 'Multa (art. 156, II)' }, { valor: 'impedimento', rotulo: 'Impedimento de licitar e contratar (art. 156, III)' },
        { valor: 'inidoneidade', rotulo: 'Declaração de inidoneidade (art. 156, IV)' },
      ], { obrigatorio: true, padrao: 'nenhuma' }),
      ...ASSINANTE(),
    ],
    bloco: (v) => {
      const sancao = {
        nenhuma: null,
        advertencia: 'O descumprimento poderá ensejar a aplicação de advertência (art. 156, I, da Lei 14.133/2021), assegurado o contraditório e a ampla defesa.',
        multa: 'O descumprimento poderá ensejar a aplicação de multa (art. 156, II, da Lei 14.133/2021). Fica a notificada intimada para, no prazo de 15 (quinze) dias úteis, apresentar defesa (art. 157).',
        impedimento: 'O descumprimento poderá ensejar o impedimento de licitar e contratar (art. 156, III). A aplicação exige processo de responsabilização, com defesa escrita no prazo de 15 (quinze) dias úteis (art. 158).',
        inidoneidade: 'O descumprimento poderá ensejar a declaração de inidoneidade (art. 156, IV). A aplicação exige processo de responsabilização, com defesa escrita no prazo de 15 (quinze) dias úteis (art. 158).',
      }[v.sancao]
      return [
        B.campo('Notificada', ou(v.contratada, 'contratada')), B.campo('Contrato', ou(v.contrato, 'contrato')), v.processo ? B.campo('Processo', v.processo) : null, B.espaco(),
        B.p('Pelo presente, fica a contratada NOTIFICADA dos fatos a seguir:'), ...paragrafos(v.fato, 'fatos'),
        B.campo('Obrigação descumprida', ou(v.clausula, 'obrigação descumprida')), B.campo('Providência exigida', ou(v.providencia, 'providência exigida')), B.campo('Prazo para regularizar', ou(v.prazo_regularizacao, 'prazo')),
        sancao ? B.p(sancao) : null, ...assina(v),
      ]
    },
  }],
}

export const RELATORIO_FISCALIZACAO = {
  codigo: 'relatorio-fiscalizacao', sigla: 'RF', versao: 1, nome: 'Relatório de fiscalização', categoria: CAT_GESTAO, perfis: ['fiscal', 'gestor'],
  descricao: 'Registro periódico da fiscalização: ocorrências, providências e avaliação da execução.',
  baseLegal: 'Lei 14.133/2021, art. 117, §1º (anotação em registro próprio de todas as ocorrências) e §2º (comunicação aos superiores das situações que ultrapassem a competência do fiscal).',
  numerar: true, papeisSugeridos: ['Fiscal do contrato', 'Gestor do contrato'],
  titulo: (v, ctx) => `RELATÓRIO DE FISCALIZAÇÃO Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: [
      T('contrato', 'Contrato nº', { obrigatorio: true }),
      T('contratada', 'Contratada', { obrigatorio: true }),
      T('periodo', 'Período acompanhado', { obrigatorio: true, ajuda: 'Ex.: setembro/2026.' }),
    ] },
    { id: 'ocorrencias', titulo: 'Ocorrências e providências', campos: [
      R('ocorrencias', 'Registro', [{ nome: 'data', rotulo: 'Data', tipo: 'texto' }, { nome: 'ocorrencia', rotulo: 'Ocorrência' }, { nome: 'providencia', rotulo: 'Providência determinada' }]),
    ] },
    { id: 'avaliacao', titulo: 'Avaliação da execução', campos: [
      S('avaliacao', 'Avaliação geral', [{ valor: 'otima', rotulo: 'Ótima' }, { valor: 'boa', rotulo: 'Boa' }, { valor: 'regular', rotulo: 'Regular' }, { valor: 'insatisfatoria', rotulo: 'Insatisfatória' }], { obrigatorio: true }),
      L('analise', 'Análise', { obrigatorio: true, ajuda: 'Cumprimento de prazos, qualidade, equipe, documentos de regularidade (fiscal, trabalhista).' }),
      L('comunicacao', 'Situações que exigem decisão superior', { ajuda: 'O que ultrapassa a competência do fiscal e precisa chegar à Gestão (art. 117, §2º).' }),
    ] },
    FECHO('Fiscal do contrato'),
  ],
}

export const PORTARIA_AGENTE = {
  codigo: 'portaria-agente', sigla: 'PORT', versao: 1, nome: 'Portaria de designação do agente de contratação', categoria: CAT_SETORIAIS, perfis: ['gabinete', 'compras', 'administrativo'],
  descricao: 'Designa o agente de contratação e a equipe de apoio para conduzir a licitação.',
  baseLegal: 'Lei 14.133/2021, art. 7º (requisitos dos agentes públicos) e art. 8º (agente de contratação e equipe de apoio).',
  numerar: false, papeisSugeridos: ['Autoridade competente'],
  titulo: (v, ctx) => `PORTARIA Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [{
    id: 'port', titulo: '',
    campos: [
      T('processo', 'Processo / licitação', { obrigatorio: true, padrao: (c) => c.processo?.numero || '' }),
      L('objeto', 'Objeto da licitação', { obrigatorio: true }),
      T('agente', 'Agente de contratação (nome)', { obrigatorio: true }),
      T('agente_cargo', 'Cargo e matrícula do agente', { obrigatorio: true, ajuda: 'Deve ser servidor efetivo ou empregado público dos quadros permanentes (art. 8º).' }),
      R('equipe', 'Equipe de apoio', [{ nome: 'nome', rotulo: 'Nome' }, { nome: 'cargo', rotulo: 'Cargo / matrícula' }]),
      ...ASSINANTE('Autoridade que assina'),
    ],
    bloco: (v) => [
      B.p('A autoridade abaixo identificada, no uso de suas atribuições, e considerando os arts. 7º e 8º da Lei 14.133/2021, RESOLVE:'),
      B.p(`Art. 1º Designar ${v.agente || '[preencher: agente]'}, ${v.agente_cargo || '[preencher: cargo]'}, como agente de contratação responsável pela condução da licitação referente ao Processo nº ${v.processo || '[preencher: processo]'}, cujo objeto é: ${v.objeto || '[preencher: objeto]'}.`),
      (v.equipe || []).some((l) => l.nome)
        ? B.p('Art. 2º Designar a equipe de apoio, que auxiliará o agente de contratação:') : B.p('Art. 2º Não há equipe de apoio designada nesta portaria.'),
      (v.equipe || []).some((l) => l.nome) ? B.lista((v.equipe || []).filter((l) => l.nome).map((l) => `${l.nome}${l.cargo ? ` — ${l.cargo}` : ''}`)) : null,
      B.p('Art. 3º Esta Portaria entra em vigor na data de sua assinatura.'), ...assina(v),
    ],
  }],
}

export const PARECER_TECNICO = {
  codigo: 'parecer-tecnico', sigla: 'PT', versao: 1, nome: 'Parecer técnico', categoria: CAT_SETORIAIS, perfis: TODOS,
  descricao: 'Manifestação da área técnica (TI, pessoal, financeiro, engenharia, etc.) sobre um ponto do processo.',
  baseLegal: 'Lei 14.133/2021, art. 72, III (pareceres técnicos, se for o caso, que demonstrem o atendimento dos requisitos exigidos).',
  numerar: true, papeisSugeridos: ['Responsável técnico'],
  titulo: (v, ctx) => `PARECER TÉCNICO Nº ${ctx.numero || '[preencher: número]'}`,
  secoes: [
    { id: 'ident', titulo: 'Identificação', campos: [
      T('area', 'Área técnica', { obrigatorio: true, padrao: (c) => c.unidade?.nome || '', ajuda: 'Ex.: Tecnologia da Informação, Recursos Humanos, Engenharia.' }),
      T('processo', 'Processo', { padrao: (c) => c.processo?.numero || '' }),
      L('consulta', 'Questão analisada', { obrigatorio: true, ajuda: 'O que foi perguntado à área técnica.' }),
    ] },
    { id: 'analise', titulo: 'Análise', campos: [L('analise', 'Análise técnica', { obrigatorio: true, linhas: 8, ajuda: 'Fatos, critérios técnicos e fontes. Seja objetivo.' })] },
    { id: 'conclusao', titulo: 'Conclusão', campos: [
      S('conclusao', 'Conclusão', [{ valor: 'atende', rotulo: 'Atende aos requisitos' }, { valor: 'ressalvas', rotulo: 'Atende, com ressalvas' }, { valor: 'nao-atende', rotulo: 'Não atende' }], { obrigatorio: true }),
      L('recomendacoes', 'Recomendações', {}),
    ] },
    FECHO('Responsável técnico'),
  ],
}

export const MODELOS_GESTAO = [TERMO_RECEBIMENTO, NOTIFICACAO, RELATORIO_FISCALIZACAO, PORTARIA_AGENTE, PARECER_TECNICO]

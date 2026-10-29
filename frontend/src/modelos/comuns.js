// Comunicação oficial: ofício, memorando, despacho, declaração e ata. Servem a todos os setores.
import { B, D, L, R, S, T, ou, paragrafos, porExtenso } from './base'

export const TODOS = ['secretario', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'juridico', 'administrativo', 'rh', 'ti']
export const CAT_COMUM = 'Comunicação oficial'

const assinatura = (v) => [B.espaco(), B.assina(v.assinante, v.cargo_assinante)]
const CAMPOS_ASSINANTE = [
  T('assinante', 'Nome de quem assina', { obrigatorio: true, padrao: (c) => c.autor?.nome || '' }),
  T('cargo_assinante', 'Cargo / função', { obrigatorio: true, ajuda: 'Ex.: Presidente, Gerente Administrativo, Assessor Jurídico.' }),
]

const localData = (ctx) => `${ctx.cidade ? `${ctx.cidade}, ` : ''}${porExtenso(ctx.data)}`

export const OFICIO = {
  codigo: 'oficio', sigla: 'OF', versao: 1, nome: 'Ofício', categoria: CAT_COMUM, perfis: TODOS,
  descricao: 'Comunicação formal dirigida a outro órgão, empresa ou pessoa externa.',
  baseLegal: 'Manual de redação oficial (estrutura usual de ofício).',
  numerar: false,
  titulo: (v, ctx) => `OFÍCIO Nº ${ctx.numero || '[preencher: número]'}`,
  papeisSugeridos: ['Signatário'],
  secoes: [
    {
      id: 'destinatario', titulo: 'Destinatário',
      campos: [
        T('destinatario', 'Destinatário (nome e cargo)', { obrigatorio: true, ajuda: 'Ex.: Sr. João da Silva, Diretor-Geral.' }),
        T('orgao_destinatario', 'Órgão ou empresa', { obrigatorio: true }),
        T('endereco', 'Endereço (opcional)'),
        T('assunto', 'Assunto', { obrigatorio: true, ajuda: 'Resuma em uma linha o que o ofício trata.' }),
        T('referencia', 'Referência (opcional)', { padrao: (c) => (c.processo ? `Processo nº ${c.processo.numero}` : ''), ajuda: 'Número do processo ou do documento a que o ofício responde.' }),
      ],
      bloco: (v, ctx) => [
        B.p(localData(ctx)),
        B.campo('Assunto', ou(v.assunto, 'assunto')),
        v.referencia ? B.campo('Referência', v.referencia) : null,
        B.espaco(),
        B.p(ou(v.destinatario, 'destinatário')), B.p(ou(v.orgao_destinatario, 'órgão ou empresa')), v.endereco ? B.p(v.endereco) : null,
      ],
    },
    {
      id: 'texto', titulo: 'Texto',
      campos: [
        S('vocativo', 'Tratamento', [{ valor: 'Senhor', rotulo: 'Senhor' }, { valor: 'Senhora', rotulo: 'Senhora' }, { valor: 'Prezados Senhores', rotulo: 'Prezados Senhores' }], { obrigatorio: true, padrao: 'Senhor' }),
        L('texto', 'Texto do ofício', { obrigatorio: true, linhas: 10, ajuda: 'Escreva de forma clara e objetiva. Separe os parágrafos com uma linha em branco.' }),
        S('fecho', 'Fecho', [{ valor: 'Atenciosamente,', rotulo: 'Atenciosamente,' }, { valor: 'Respeitosamente,', rotulo: 'Respeitosamente,' }, { valor: 'Cordialmente,', rotulo: 'Cordialmente,' }], { obrigatorio: true, padrao: 'Atenciosamente,' }),
        ...CAMPOS_ASSINANTE,
      ],
      bloco: (v) => [B.p(`${v.vocativo || 'Senhor'},`), ...paragrafos(v.texto, 'texto do ofício'), B.p(v.fecho || 'Atenciosamente,'), ...assinatura(v)],
    },
  ],
}

export const MEMORANDO = {
  codigo: 'memorando', sigla: 'MEMO', versao: 1, nome: 'Memorando', categoria: CAT_COMUM, perfis: TODOS,
  descricao: 'Comunicação interna entre unidades do órgão.',
  baseLegal: 'Manual de redação oficial (estrutura usual de memorando).',
  numerar: false,
  titulo: (v, ctx) => `MEMORANDO Nº ${ctx.numero || '[preencher: número]'}`,
  papeisSugeridos: ['Signatário'],
  secoes: [{
    id: 'memo', titulo: '',
    campos: [
      T('de', 'De (unidade)', { obrigatorio: true, padrao: (c) => c.unidade?.nome || '' }),
      T('para', 'Para (unidade ou pessoa)', { obrigatorio: true }),
      T('assunto', 'Assunto', { obrigatorio: true }),
      T('referencia', 'Referência (opcional)', { padrao: (c) => (c.processo ? `Processo nº ${c.processo.numero}` : '') }),
      L('texto', 'Texto', { obrigatorio: true, linhas: 10, ajuda: 'Seja direto: o que se pede ou informa, e até quando.' }),
      ...CAMPOS_ASSINANTE,
    ],
    bloco: (v, ctx) => [
      B.p(localData(ctx)), B.campo('De', ou(v.de, 'unidade de origem')), B.campo('Para', ou(v.para, 'destinatário')), B.campo('Assunto', ou(v.assunto, 'assunto')),
      v.referencia ? B.campo('Referência', v.referencia) : null, B.espaco(), ...paragrafos(v.texto, 'texto do memorando'), ...assinatura(v),
    ],
  }],
}

export const DESPACHO = {
  codigo: 'despacho', sigla: 'DESP', versao: 1, nome: 'Despacho', categoria: CAT_COMUM, perfis: TODOS,
  descricao: 'Decisão ou encaminhamento dado a um processo, com a orientação à unidade seguinte.',
  baseLegal: 'Ato de impulso do processo administrativo.',
  numerar: false,
  titulo: (v, ctx) => `DESPACHO Nº ${ctx.numero || '[preencher: número]'}`,
  papeisSugeridos: ['Signatário'],
  secoes: [{
    id: 'despacho', titulo: '',
    campos: [
      T('processo', 'Processo', { obrigatorio: true, padrao: (c) => (c.processo ? c.processo.numero : ''), ajuda: 'Número do protocolo do processo.' }),
      T('interessado', 'Interessado / assunto', { padrao: (c) => c.processo?.assunto || '' }),
      L('texto', 'Despacho', { obrigatorio: true, linhas: 7, ajuda: 'Diga o que foi decidido ou analisado, em poucas linhas.' }),
      T('encaminhamento', 'Encaminhe-se a', { ajuda: 'Unidade ou pessoa que deve dar o próximo passo (opcional).' }),
      T('finalidade', 'Para que', { ajuda: 'Ex.: para análise e parecer; para providências; para ciência.' }),
      ...CAMPOS_ASSINANTE,
    ],
    bloco: (v, ctx) => [
      B.p(localData(ctx)), B.campo('Processo', ou(v.processo, 'processo')), v.interessado ? B.campo('Assunto', v.interessado) : null, B.espaco(),
      ...paragrafos(v.texto, 'texto do despacho'),
      v.encaminhamento ? B.p(`Encaminhe-se a ${v.encaminhamento}${v.finalidade ? `, ${v.finalidade}` : ''}.`) : null,
      ...assinatura(v),
    ],
  }],
}

export const DECLARACAO = {
  codigo: 'declaracao', sigla: 'DECL', versao: 1, nome: 'Declaração', categoria: CAT_COMUM, perfis: TODOS,
  descricao: 'Declaração formal do órgão ou de um setor sobre fato de que tem conhecimento.',
  baseLegal: 'Documento declaratório de uso geral.',
  numerar: false,
  titulo: () => 'DECLARAÇÃO',
  papeisSugeridos: ['Declarante'],
  secoes: [{
    id: 'declaracao', titulo: '',
    campos: [
      L('texto', 'Texto da declaração', { obrigatorio: true, linhas: 8, padrao: 'Declaramos, para os devidos fins, que [preencher: o que se declara].', ajuda: 'Comece com "Declaramos, para os devidos fins, que…" e diga apenas o que o órgão pode afirmar com segurança.' }),
      T('finalidade', 'Finalidade (opcional)', { ajuda: 'Ex.: para instruir o processo nº …' }),
      ...CAMPOS_ASSINANTE,
    ],
    bloco: (v, ctx) => [
      ...paragrafos(v.texto, 'texto da declaração'), v.finalidade ? B.p(`Finalidade: ${v.finalidade}.`) : null, B.espaco(), B.p(localData(ctx)), ...assinatura(v),
    ],
  }],
}

export const ATA = {
  codigo: 'ata', sigla: 'ATA', versao: 1, nome: 'Ata de reunião', categoria: CAT_COMUM, perfis: TODOS,
  descricao: 'Registro de reunião: quem participou, o que foi tratado e o que ficou combinado.',
  baseLegal: 'Registro administrativo de reunião.',
  numerar: true,
  titulo: (v, ctx) => `ATA Nº ${ctx.numero || '[preencher: número]'}`,
  papeisSugeridos: ['Secretário(a) da reunião'],
  secoes: [
    {
      id: 'reuniao', titulo: 'Reunião',
      campos: [
        T('assunto', 'Assunto da reunião', { obrigatorio: true }),
        D('data', 'Data', { obrigatorio: true }),
        T('hora', 'Horário', { obrigatorio: true, ajuda: 'Ex.: 14h às 15h30.' }),
        T('local', 'Local', { obrigatorio: true, ajuda: 'Sala ou "videoconferência".' }),
      ],
    },
    { id: 'participantes', titulo: 'Participantes', campos: [R('participantes', 'Participantes', [{ nome: 'nome', rotulo: 'Nome' }, { nome: 'cargo', rotulo: 'Cargo / unidade' }], { obrigatorio: true })] },
    {
      id: 'pauta', titulo: 'Pauta e deliberações',
      campos: [
        L('pauta', 'Pauta', { obrigatorio: true, ajuda: 'Os assuntos tratados, na ordem.' }),
        L('deliberacoes', 'O que foi decidido', { obrigatorio: true }),
        R('encaminhamentos', 'Encaminhamentos', [{ nome: 'acao', rotulo: 'Ação' }, { nome: 'responsavel', rotulo: 'Responsável' }, { nome: 'prazo', rotulo: 'Prazo' }]),
      ],
    },
    { id: 'fecho', titulo: 'Encerramento', campos: [...CAMPOS_ASSINANTE], bloco: (v) => [B.p('Nada mais havendo a tratar, a reunião foi encerrada e a presente ata, lida e aprovada, vai assinada eletronicamente.'), ...assinatura(v)] },
  ],
}

export const MODELOS_COMUNS = [OFICIO, MEMORANDO, DESPACHO, DECLARACAO, ATA]

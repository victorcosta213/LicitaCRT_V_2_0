// Catálogo de modelos de documento: integridade, renderização e cobertura da Lei 14.133/2021.
import { describe, expect, it } from 'vitest'
import { camposDe, camposFaltando, pendenciasNoCorpo, renderizar, trechosPendentes, valoresIniciais } from '../../src/modelos/base'
import { CATEGORIAS, MODELOS, agruparPorCategoria, modeloPorCodigo, modelosDoPerfil, podeUsarModelo } from '../../src/modelos/catalogo'
import { ARTEFATOS, avisosDoRoteiro, checklistDoProcesso, itemPronto, resumoChecklist, roteiro } from '../../src/modelos/artefatos'
import { MODALIDADES, OBJETOS } from '../../src/modelos/variantes'
import { ROLES } from '../../src/utils/permissions'

const CTX = {
  orgao: 'Conselho Regional dos Técnicos Industriais da 8ª Região', cidade: 'Maceió/AL', numero: 'XX-2026/000001', data: new Date(2026, 9, 29),
  autor: { nome: 'Ana Ribeiro' }, unidade: { sigla: 'COMP', nome: 'Compras e Licitações' },
  processo: { numero: '2026/000010', assunto: 'Compra de notebooks', contratacao_modalidade: 'pregao' },
}
const TIPOS_BLOCO = ['cab', 'titulo', 'sub', 'secao', 'rotulo', 'p', 'lista', 'numerada', 'tabela', 'campo', 'nota', 'espaco', 'assina']

// preenche tudo o que é obrigatório com um valor de exemplo coerente com o tipo do campo
function preencher(modelo, extra = {}) {
  const v = valoresIniciais(modelo, CTX)
  for (const c of camposDe(modelo)) {
    if (c.tipo === 'itens') {
      if (!(v[c.nome] || []).length) v[c.nome] = [{ item_id: 'i1', codigo: 'INF-01', nome: 'Computador', especificacao: 'i5, 16 GB', unidade: 'unidade', quantidade: '20', valor_unitario: '4500' }]
    } else if (c.tipo === 'linhas') {
      if (!(v[c.nome] || []).some((l) => c.colunas.some((col) => String(l[col.nome] ?? '').trim()))) {
        v[c.nome] = [Object.fromEntries(c.colunas.map((col) => [col.nome, col.tipo === 'numero' || col.tipo === 'dinheiro' ? '10' : col.tipo === 'select' ? (typeof col.opcoes[0] === 'string' ? col.opcoes[0] : col.opcoes[0].valor) : 'Exemplo']))]
      }
    } else if (String(v[c.nome] ?? '').trim() === '') {
      v[c.nome] = c.tipo === 'select' ? (typeof c.opcoes[0] === 'string' ? c.opcoes[0] : c.opcoes[0].valor)
        : c.tipo === 'dinheiro' || c.tipo === 'numero' ? '1000' : c.tipo === 'data' ? '2026-11-15' : 'Exemplo de preenchimento'
    }
  }
  return { ...v, ...extra }
}
const textoDe = (blocos) => JSON.stringify(blocos)

describe('catálogo de modelos', () => {
  it('tem modelos em todas as categorias', () => {
    expect(MODELOS.length).toBeGreaterThanOrEqual(24)
    for (const c of CATEGORIAS) expect(MODELOS.some((m) => m.categoria === c), c).toBe(true)
    expect(agruparPorCategoria(MODELOS).map((g) => g.categoria)).toEqual(CATEGORIAS)
  })

  it('códigos e siglas são únicos e têm o formato que o banco aceita', () => {
    expect(new Set(MODELOS.map((m) => m.codigo)).size).toBe(MODELOS.length)
    expect(new Set(MODELOS.map((m) => m.sigla)).size).toBe(MODELOS.length)
    for (const m of MODELOS) {
      expect(m.codigo, m.codigo).toMatch(/^[a-z0-9-]{2,60}$/)
      expect(m.sigla, m.codigo).toMatch(/^[A-Z0-9]{2,8}$/)
    }
  })

  it.each(MODELOS.map((m) => [m.codigo, m]))('%s: descrição, base legal, categoria e perfis válidos', (codigo, m) => {
    expect(m.nome && m.descricao && m.baseLegal, codigo).toBeTruthy()
    expect(CATEGORIAS).toContain(m.categoria)
    expect(m.perfis.length).toBeGreaterThan(0)
    for (const p of m.perfis) expect(Object.keys(ROLES), `${codigo}: ${p}`).toContain(p)
    expect(m.papeisSugeridos?.length, codigo).toBeGreaterThan(0)
    expect(modeloPorCodigo(codigo)).toBe(m)
  })

  it.each(MODELOS.map((m) => [m.codigo, m]))('%s: nomes de campo únicos e campos bem definidos', (codigo, m) => {
    const nomes = camposDe(m).map((c) => c.nome)
    expect(new Set(nomes).size, `${codigo}: ${nomes.filter((n, i) => nomes.indexOf(n) !== i).join(',')}`).toBe(nomes.length)
    for (const c of camposDe(m)) {
      expect(c.rotulo, `${codigo}.${c.nome}`).toBeTruthy()
      if (c.tipo === 'select') expect(c.opcoes.length, `${codigo}.${c.nome}`).toBeGreaterThan(0)
      if (c.tipo === 'linhas') expect(c.colunas.length, `${codigo}.${c.nome}`).toBeGreaterThan(0)
    }
  })

  it.each(MODELOS.map((m) => [m.codigo, m]))('%s: abre com texto-padrão e acusa o que falta preencher', (codigo, m) => {
    const inicial = valoresIniciais(m, CTX)
    const blocos = renderizar(m, inicial, CTX)
    for (const b of blocos) expect(TIPOS_BLOCO, `${codigo}: ${b.t}`).toContain(b.t)
    expect(blocos[0]).toMatchObject({ t: 'cab', orgao: CTX.orgao, numero: CTX.numero })
    expect(blocos[1].t).toBe('titulo')
    expect(blocos[1].x).toContain(CTX.numero === 'XX-2026/000001' && m.titulo.toString().includes('numero') ? 'XX-2026/000001' : blocos[1].x)
    // um documento recém-aberto nunca pode seguir para assinatura sem ser preenchido
    expect(pendenciasNoCorpo(blocos), codigo).toBeGreaterThan(0)
  })

  it.each(MODELOS.map((m) => [m.codigo, m]))('%s: totalmente preenchido, não sobra campo obrigatório vazio nem texto quebrado', (codigo, m) => {
    const v = preencher(m)
    expect(camposFaltando(m, v), codigo).toEqual([])
    const blocos = renderizar(m, v, CTX)
    const txt = textoDe(blocos)
    expect(txt).not.toMatch(/undefined|null|\[object/)
    expect(txt).not.toContain('[não informado]')
    expect(blocos.some((b) => b.t !== 'cab' && b.t !== 'titulo')).toBe(true)
  })

  it('o que a pessoa digita é texto: nada vira marcação', () => {
    const v = preencher(modeloPorCodigo('oficio'), { texto: '<script>alert(1)</script> & <b>negrito</b>' })
    const blocos = renderizar(modeloPorCodigo('oficio'), v, CTX)
    const par = blocos.find((b) => b.t === 'p' && b.x.includes('<script>'))
    expect(par.x).toBe('<script>alert(1)</script> & <b>negrito</b>')
  })

  it('lista os trechos que ainda precisam ser preenchidos', () => {
    const blocos = renderizar(modeloPorCodigo('declaracao'), valoresIniciais(modeloPorCodigo('declaracao'), CTX), CTX)
    expect(trechosPendentes(blocos)).toContain('[preencher: o que se declara]')
  })
})

describe('perfis e modelos', () => {
  const codigos = (role) => modelosDoPerfil(role).map((m) => m.codigo)

  it('Compras prepara o planejamento e o contrato, mas não emite parecer jurídico', () => {
    for (const c of ['etp', 'tr', 'riscos', 'pesquisa-precos', 'edital', 'contrato', 'justificativa-direta', 'oficio']) expect(codigos('compras'), c).toContain(c)
    expect(codigos('compras')).not.toContain('parecer-juridico')
    expect(codigos('compras')).not.toContain('dfd') // a DFD é do secretário
  })

  it('só o Jurídico emite parecer jurídico', () => {
    for (const r of Object.keys(ROLES).filter((x) => !['juridico', 'admin', 'presidente'].includes(x))) expect(codigos(r), r).not.toContain('parecer-juridico')
    expect(codigos('juridico')).toContain('parecer-juridico')
  })

  it('cada setor tem os seus modelos específicos', () => {
    expect(codigos('financeiro')).toContain('adequacao-orcamentaria')
    expect(codigos('fiscal')).toEqual(expect.arrayContaining(['termo-recebimento', 'relatorio-fiscalizacao']))
    expect(codigos('gabinete')).toEqual(expect.arrayContaining(['portaria-agente', 'autorizacao', 'homologacao']))
    expect(codigos('gestor')).toEqual(expect.arrayContaining(['termo-aditivo', 'notificacao-contratada']))
    for (const r of ['ti', 'rh', 'administrativo']) expect(codigos(r), r).toEqual(expect.arrayContaining(['oficio', 'memorando', 'despacho', 'parecer-tecnico']))
  })

  it('administração e presidência usam todos os modelos; a consulta, nenhum', () => {
    expect(modelosDoPerfil('admin')).toHaveLength(MODELOS.length)
    expect(modelosDoPerfil('presidente')).toHaveLength(MODELOS.length)
    expect(modelosDoPerfil('viewer')).toEqual([])
    expect(podeUsarModelo(modeloPorCodigo('etp'), 'editor')).toBe(true) // perfil antigo = Compras
  })

  it('todo perfil de trabalho tem pelo menos os modelos de comunicação oficial', () => {
    for (const r of ['compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'juridico', 'administrativo', 'rh', 'ti']) {
      expect(codigos(r), r).toEqual(expect.arrayContaining(['oficio', 'memorando', 'despacho', 'declaracao', 'ata']))
    }
  })
})

describe('Lei 14.133/2021: cobertura dos elementos exigidos', () => {
  const titulos = (modelo, v) => renderizar(modelo, v, CTX).filter((b) => b.t === 'secao').map((b) => b.x).join(' | ')

  it('o ETP traz os 13 elementos do art. 18, §1º e indica os mínimos do §2º', () => {
    const etp = modeloPorCodigo('etp')
    const t = titulos(etp, preencher(etp))
    for (const inc of ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII']) {
      expect(t, `inciso ${inc}`).toMatch(new RegExp(`art\\. 18, §1º, ${inc}\\)`))
    }
    // incisos mínimos (I, IV, VI, VIII, XIII): obrigatórios
    const obrigatorios = camposDe(etp).filter((c) => c.obrigatorio).map((c) => c.secao.id)
    for (const s of ['necessidade', 'quantidades', 'valor', 'parcelamento', 'conclusao']) expect(obrigatorios, s).toContain(s)
    expect(etp.baseLegal).toMatch(/art\. 18, §1º.*§2º/)
  })

  it('o TR traz as alíneas a a j do art. 6º, XXIII', () => {
    const tr = modeloPorCodigo('tr')
    const t = titulos(tr, preencher(tr, { objeto_tipo: 'bens-consumo' }))
    for (const a of 'abcdefghij') expect(t, `alínea ${a}`).toContain(`art. 6º, XXIII, ${a})`)
  })

  it('a minuta de contrato traz as 19 cláusulas necessárias do art. 92', () => {
    const contrato = modeloPorCodigo('contrato')
    const t = titulos(contrato, preencher(contrato, { objeto_tipo: 'bens-consumo', exige_garantia: 'sim' }))
    const incisos = new Set()
    for (const m of t.matchAll(/art\. 92, ([IVXL]+)(?: e ([IVXL]+))?/gi)) { incisos.add(m[1]); if (m[2]) incisos.add(m[2]) }
    const esperado = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX']
    expect([...incisos].sort()).toEqual(esperado.sort())
    expect(t).toMatch(/CLÁUSULA PRIMEIRA — DO OBJETO/)
    expect(t).toMatch(/CLÁUSULA SEGUNDA/)
  })

  it('as cláusulas do contrato são numeradas em sequência, sem pular por causa do bloco inicial', () => {
    const t = titulos(modeloPorCodigo('contrato'), preencher(modeloPorCodigo('contrato'), { objeto_tipo: 'bens-consumo' }))
    expect(t.startsWith('CLÁUSULA PRIMEIRA')).toBe(true)
  })

  it('a justificativa de contratação direta confere os 8 incisos do art. 72', () => {
    const jcd = modeloPorCodigo('justificativa-direta')
    const doc = JSON.stringify(valoresIniciais(jcd, CTX).instrucao)
    for (const inc of ['I —', 'II —', 'III —', 'IV —', 'V —', 'VI —', 'VII —', 'VIII —']) expect(doc, inc).toContain(inc)
  })

  it('a adesão a ata cobre os três requisitos do art. 86, §2º', () => {
    const t = titulos(modeloPorCodigo('justificativa-adesao-ata'), preencher(modeloPorCodigo('justificativa-adesao-ata')))
    for (const inc of ['I', 'II', 'III']) expect(t).toContain(`art. 86, §2º, ${inc}`)
  })

  it('o parecer jurídico indica o art. 53 e começa com a verificação documental', () => {
    const pj = modeloPorCodigo('parecer-juridico')
    expect(pj.baseLegal).toMatch(/art\. 53/)
    expect(valoresIniciais(pj, CTX).verificacao.length).toBeGreaterThanOrEqual(8)
  })

  it('o termo de recebimento distingue provisório e definitivo (art. 140)', () => {
    const trc = modeloPorCodigo('termo-recebimento')
    expect(renderizar(trc, preencher(trc, { fase: 'provisorio' }), CTX)[1].x).toMatch(/PROVISÓRIO/)
    expect(renderizar(trc, preencher(trc, { fase: 'definitivo' }), CTX)[1].x).toMatch(/DEFINITIVO/)
  })
})

describe('particularidades por tipo de objeto', () => {
  for (const [codigo, campoTipo] of [['etp', 'objeto_tipo'], ['tr', 'objeto_tipo'], ['contrato', 'objeto_tipo']]) {
    it(`${codigo}: cada tipo de objeto mostra só a sua seção`, () => {
      const m = modeloPorCodigo(codigo)
      const secoes = (tipo) => renderizar(m, preencher(m, { [campoTipo]: tipo }), CTX).filter((b) => b.t === 'secao').map((b) => b.x)
      const extras = (tipo) => secoes(tipo).filter((s) => /Particularidades|dedicação exclusiva de mão de obra e da repactuação|Do recebimento da obra|segurança da informação|Da locação/i.test(s))
      for (const o of OBJETOS) {
        if (codigo === 'contrato' && ['bens-consumo', 'bens-permanentes', 'servicos-comuns'].includes(o.valor)) { expect(extras(o.valor), o.valor).toEqual([]); continue }
        expect(extras(o.valor), `${codigo}/${o.valor}`).toHaveLength(1)
      }
    })
  }

  it('serviço com dedicação exclusiva de mão de obra cita repactuação e as cautelas do art. 50', () => {
    const txt = textoDe(renderizar(modeloPorCodigo('tr'), preencher(modeloPorCodigo('tr'), { objeto_tipo: 'servicos-continuos-demo' }), CTX))
    expect(txt).toMatch(/repactuados.*art\. 25, §8º, II/)
    const etp = textoDe(renderizar(modeloPorCodigo('etp'), preencher(modeloPorCodigo('etp'), { objeto_tipo: 'servicos-continuos-demo' }), CTX))
    expect(etp).toMatch(/art\. 48/)
    expect(etp).toMatch(/art\. 50/)
  })

  it('obras: o ETP lembra do projeto básico e da matriz de riscos de grande vulto', () => {
    const txt = textoDe(renderizar(modeloPorCodigo('etp'), preencher(modeloPorCodigo('etp'), { objeto_tipo: 'obras-engenharia' }), CTX))
    expect(txt).toMatch(/art\. 6º, XXV/)
    expect(txt).toMatch(/art\. 22, §3º/)
  })

  it('o tipo de objeto não escolhido não aparece nem como pendência', () => {
    const m = modeloPorCodigo('etp')
    const v = valoresIniciais(m, CTX)
    expect(camposFaltando(m, { ...v, objeto_tipo: 'tic' })).toEqual(expect.arrayContaining(['Alinhamento com o planejamento de TIC']))
    expect(camposFaltando(m, { ...v, objeto_tipo: 'tic' })).not.toContain('Avaliação prévia do bem')
  })
})

describe('layout de alguns modelos', () => {
  it('ofício, memorando e despacho não têm cabeçalhos de seção no texto (só o formulário os usa)', () => {
    for (const codigo of ['oficio', 'memorando', 'despacho', 'declaracao']) {
      const m = modeloPorCodigo(codigo)
      expect(renderizar(m, preencher(m), CTX).filter((b) => b.t === 'secao'), codigo).toEqual([])
    }
  })

  it('ofício: assunto, vocativo, texto, fecho e linha de assinatura', () => {
    const m = modeloPorCodigo('oficio')
    const blocos = renderizar(m, preencher(m, { assunto: 'Solicitação', texto: 'Primeiro.\nSegundo.', vocativo: 'Senhora', fecho: 'Respeitosamente,', assinante: 'Ana', cargo_assinante: 'Presidente' }), CTX)
    expect(blocos[1].x).toBe('OFÍCIO Nº XX-2026/000001')
    expect(blocos.find((b) => b.t === 'campo' && b.r === 'Assunto').x).toBe('Solicitação')
    expect(blocos.find((b) => b.x === 'Senhora,')).toBeTruthy()
    expect(blocos.filter((b) => b.t === 'p').map((b) => b.x)).toEqual(expect.arrayContaining(['Primeiro.', 'Segundo.', 'Respeitosamente,']))
    expect(blocos.at(-1)).toEqual({ t: 'assina', nome: 'Ana', cargo: 'Presidente' })
    expect(blocos.some((b) => b.t === 'p' && b.x.includes('29 de outubro de 2026'))).toBe(true)
  })

  it('pesquisa de preços: calcula o total (quantidade × valor de referência)', () => {
    const m = modeloPorCodigo('pesquisa-precos')
    const v = preencher(m, { itens: [
      { item: 'Notebook', unidade: 'un', quantidade: '3', fonte1: '4000', fonte2: '4200', fonte3: '4100', referencia: '4100' },
      { item: 'Mouse', unidade: 'un', quantidade: '10', fonte1: '40', fonte2: '45', fonte3: '50', referencia: '45' },
    ] })
    const campo = renderizar(m, v, CTX).find((b) => b.t === 'campo' && b.r === 'Valor total estimado')
    expect(campo.x.replace(/\s/g, ' ')).toBe('R$ 12.750,00')
  })

  it('portaria: lista a equipe de apoio, e avisa quando não há', () => {
    const m = modeloPorCodigo('portaria-agente')
    const com = renderizar(m, preencher(m, { equipe: [{ nome: 'Beatriz', cargo: 'Analista' }] }), CTX)
    expect(com.find((b) => b.t === 'lista').itens).toEqual(['Beatriz — Analista'])
    const sem = renderizar(m, preencher(m, { equipe: [{ nome: '', cargo: '' }] }), CTX)
    expect(sem.some((b) => b.t === 'p' && /Não há equipe de apoio/.test(b.x))).toBe(true)
  })

  it('notificação: a defesa de 15 dias úteis aparece só quando há sanção prevista', () => {
    const m = modeloPorCodigo('notificacao-contratada')
    const txt = (sancao) => textoDe(renderizar(m, preencher(m, { sancao }), CTX))
    expect(txt('nenhuma')).not.toMatch(/15 \(quinze\) dias úteis/)
    expect(txt('multa')).toMatch(/15 \(quinze\) dias úteis.*art\. 157|art\. 157/)
    expect(txt('impedimento')).toMatch(/art\. 158/)
  })

  it('justificativa direta: os campos mudam conforme a hipótese', () => {
    const m = modeloPorCodigo('justificativa-direta')
    const falta = (v) => camposFaltando(m, { ...valoresIniciais(m, CTX), ...v })
    expect(falta({ tipo: 'dispensa' })).toContain('Hipótese da dispensa')
    expect(falta({ tipo: 'dispensa' })).not.toContain('Hipótese da inexigibilidade')
    expect(falta({ tipo: 'inexigibilidade' })).toContain('Hipótese da inexigibilidade')
  })
})

describe('roteiro de documentos por forma de contratação (Lei 14.133/2021)', () => {
  const itens = (m, objeto) => roteiro(m, objeto).etapas.flatMap((e) => e.itens)
  const obrig = (m, objeto) => itens(m, objeto).filter((i) => i.obrigatorio).map((i) => i.chave)

  it('toda forma de contratação tem roteiro; cada item tem nome, base legal e quem faz, e todo modelo citado existe', () => {
    for (const { valor } of MODALIDADES) {
      expect(ARTEFATOS[valor], valor).toBeTruthy()
      for (const objeto of [null, ...OBJETOS.map((o) => o.valor)]) {
        const lista = itens(valor, objeto)
        expect(new Set(lista.map((i) => i.chave)).size, `${valor}/${objeto}: chaves repetidas`).toBe(lista.length)
        for (const i of lista) {
          if (i.modelo) expect(modeloPorCodigo(i.modelo), `${valor}: ${i.modelo}`).toBeTruthy()
          expect(i.chave, `${valor}: ${i.chave}`).toMatch(/^[a-z0-9-]{2,60}$/)
          expect(i.nome && i.base && i.quem, `${valor}: ${i.chave}`).toBeTruthy()
        }
      }
    }
  })

  it('licitação: planejamento do art. 18, edital, parecer, publicação, sessão, habilitação, homologação, contrato e PNCP', () => {
    for (const m of ['pregao', 'concorrencia']) {
      expect(obrig(m)).toEqual(expect.arrayContaining(['dfd', 'etp', 'riscos', 'pesquisa-precos', 'tr', 'adequacao-orcamentaria', 'portaria-agente',
        'edital', 'parecer-juridico', 'publicacao-edital', 'propostas-sessao', 'habilitacao', 'homologacao', 'contrato', 'publicacao-contrato', 'designacao-fiscal']))
    }
  })

  it('contratação direta segue o art. 72: DFD, estimativa, parecer, orçamento, habilitação, justificativas, autorização e divulgação', () => {
    for (const m of ['dispensa', 'inexigibilidade']) {
      expect(obrig(m)).toEqual(expect.arrayContaining(['dfd', 'pesquisa-precos', 'parecer-juridico', 'adequacao-orcamentaria', 'habilitacao-contratado',
        'justificativa-direta', 'autorizacao', 'publicacao-ato']))
      expect(obrig(m)).not.toContain('edital')
      expect(obrig(m)).not.toContain('contrato') // o contrato pode ser substituído (art. 95)
    }
    expect(obrig('inexigibilidade')).toContain('comprovacao-inexigibilidade')
    expect(itens('dispensa').find((i) => i.chave === 'aviso-dispensa').obrigatorio).toBe(false)
    expect(obrig('adesao-ata')).toEqual(expect.arrayContaining(['justificativa-adesao-ata', 'aceite-gerenciador', 'pesquisa-precos', 'autorizacao']))
  })

  it('o tipo de objeto acrescenta ou tira documentos', () => {
    expect(obrig('concorrencia', 'obras-engenharia')).toContain('projeto-basico')
    expect(obrig('concorrencia', 'obras-engenharia')).not.toContain('tr')
    expect(obrig('concorrencia', 'bens-consumo')).not.toContain('projeto-basico')
    expect(obrig('pregao', 'servicos-continuos-demo')).toContain('planilha-custos')
    expect(obrig('pregao')).not.toContain('planilha-custos')
    expect(obrig('inexigibilidade', 'locacao')).toContain('imoveis-vagos')
  })

  it('avisa as combinações que a lei restringe', () => {
    expect(avisosDoRoteiro('pregao', 'obras-engenharia').join(' ')).toMatch(/art\. 29/)
    expect(avisosDoRoteiro('dispensa', 'bens-consumo').join(' ')).toMatch(/art\. 182/)
    expect(avisosDoRoteiro('concorrencia', 'bens-consumo')).toEqual([])
    expect(avisosDoRoteiro('concorrencia', null).join(' ')).toMatch(/tipo de objeto/)
  })

  it('o checklist mostra o estágio mais avançado de cada documento e ignora cancelados', () => {
    const docs = [
      { id: 'a', modelo: 'dfd', status: 'rascunho' }, { id: 'b', modelo: 'dfd', status: 'assinado' },
      { id: 'c', modelo: 'etp', status: 'aguardando_assinatura' }, { id: 'd', modelo: 'tr', status: 'cancelado' },
    ]
    const ch = checklistDoProcesso('pregao', docs)
    const por = Object.fromEntries(ch.etapas.flatMap((e) => e.itens).map((i) => [i.chave, i]))
    expect(por.dfd.status).toBe('assinado')
    expect(por.dfd.documentos.map((d) => d.id)).toEqual(['b', 'a'])
    expect(por.etp.status).toBe('aguardando_assinatura')
    expect(por.tr.status).toBe('nenhum')
    const r = resumoChecklist(ch)
    expect(r).toMatchObject({ total: ch.etapas.flatMap((e) => e.itens).filter((i) => i.obrigatorio).length, prontos: 1 })
    expect(r.proximo.chave).toBe('etp')
  })

  it('as marcações contam: juntado vale como pronto; "não se aplica" só dispensa o que é opcional', () => {
    const marcas = [
      { item: 'publicacao-edital', situacao: 'juntado', referencia: 'PNCP 1' },
      { item: 'garantia', situacao: 'nao_se_aplica', referencia: 'Não exigida' },
      { item: 'edital', situacao: 'nao_se_aplica', referencia: 'indevido' },
      { item: 'etp', situacao: 'juntado', referencia: 'fls. 3' },
    ]
    const ch = checklistDoProcesso('pregao', [{ id: 'x', modelo: 'etp', status: 'rascunho' }], { marcas })
    const por = Object.fromEntries(ch.etapas.flatMap((e) => e.itens).map((i) => [i.chave, i]))
    expect(por['publicacao-edital']).toMatchObject({ status: 'juntado', marca: marcas[0] })
    expect(itemPronto(por['publicacao-edital'])).toBe(true)
    expect(itemPronto(por.garantia)).toBe(true)
    expect(itemPronto(por.edital)).toBe(false) // obrigatório não é dispensado por "não se aplica"
    expect(por.etp.status).toBe('juntado') // feito fora vale mais que um rascunho
    expect(resumoChecklist(ch).prontos).toBe(2)
  })

  it('documento assinado na plataforma prevalece sobre a marcação', () => {
    const ch = checklistDoProcesso('pregao', [{ id: 'x', modelo: 'dfd', status: 'assinado' }], { marcas: [{ item: 'dfd', situacao: 'juntado', referencia: 'x' }] })
    expect(ch.etapas[0].itens.find((i) => i.chave === 'dfd').status).toBe('assinado')
  })

  it('sem forma de contratação definida, não há checklist', () => {
    expect(checklistDoProcesso(null, [])).toBeNull()
    expect(checklistDoProcesso('leilao', [])).toBeNull()
    expect(roteiro('leilao')).toBeNull()
  })
})

describe('DFD do secretário (itens do catálogo) e documentos que nascem dela', () => {
  const DFD = modeloPorCodigo('dfd')
  const itens = [
    { item_id: 'a', codigo: 'INF-01', nome: 'Computador desktop', especificacao: 'i5, 16 GB, SSD 512 GB', unidade: 'unidade', quantidade: '20', valor_unitario: '4500' },
    { item_id: 'b', codigo: '', nome: 'Monitor 24"', especificacao: 'Full HD, HDMI', unidade: 'unidade', quantidade: '0', valor_unitario: '900' },
  ]

  it('só o secretário (e os perfis mestres) faz a DFD', () => {
    expect(modelosDoPerfil('secretario').map((m) => m.codigo)).toContain('dfd')
    for (const r of ['compras', 'gestor', 'juridico', 'financeiro', 'fiscal', 'rh']) expect(modelosDoPerfil(r).map((m) => m.codigo), r).not.toContain('dfd')
    expect(modelosDoPerfil('presidente').map((m) => m.codigo)).toContain('dfd')
  })

  it('traz o conteúdo mínimo da formalização da demanda', () => {
    const nomes = camposDe(DFD).map((c) => c.nome)
    for (const n of ['unidade', 'responsavel', 'objeto', 'objeto_tipo', 'itens', 'memoria_calculo', 'necessidade', 'previsto_pca', 'data_pretendida', 'prioridade', 'correlatas', 'assinante'])
      expect(nomes, n).toContain(n)
    expect(DFD.baseLegal).toMatch(/art\. 12, VII/)
  })

  it('sem item com quantidade, a DFD não segue para assinatura', () => {
    const v = { ...valoresIniciais(DFD, CTX), itens: [{ ...itens[1] }] }
    expect(camposFaltando(DFD, v)).toContain('Itens')
    expect(camposFaltando(DFD, { ...v, itens })).not.toContain('Itens')
  })

  it('a tabela de itens leva a especificação, a quantidade e a estimativa preliminar (só os itens com quantidade)', () => {
    const blocos = renderizar(DFD, { ...valoresIniciais(DFD, CTX), itens }, CTX)
    const tabela = blocos.find((b) => b.t === 'tabela')
    expect(tabela.cab).toEqual(['Item', 'Especificação', 'Unid.', 'Qtde', 'Valor unit. estimado', 'Total estimado'])
    expect(tabela.linhas).toEqual([['1. Computador desktop (INF-01)', 'i5, 16 GB, SSD 512 GB', 'unidade', '20', 'R$\xa04.500,00', 'R$\xa090.000,00']])
    expect(blocos.find((b) => b.t === 'campo' && b.r === 'Estimativa preliminar do valor').x).toBe('R$\xa090.000,00')
  })

  it('justificativas condicionais: fora do plano anual e prioridade alta', () => {
    const base = { ...valoresIniciais(DFD, CTX), itens }
    expect(camposFaltando(DFD, { ...base, previsto_pca: 'nao' })).toContain('Por que não está no plano')
    expect(camposFaltando(DFD, { ...base, prioridade: 'alta' })).toContain('Por que a prioridade é alta')
    expect(camposFaltando(DFD, { ...base, prioridade: 'baixa', previsto_pca: 'nao-elaborado' })).not.toContain('Por que a prioridade é alta')
  })

  it('a DFD criada a partir de um ofício já o cita', () => {
    expect(valoresIniciais(DFD, { ...CTX, origem: 'Processo 2026/000003 — Compra de computadores' }).origem).toBe('Processo 2026/000003 — Compra de computadores')
  })

  it('ETP, pesquisa de preços e TR começam com o objeto e os itens da DFD do processo', () => {
    const ctx = { ...CTX, processo: { numero: '2026/000010', assunto: 'Assunto do processo', contratacao_objeto: 'bens-permanentes' }, dfd: { conteudo: { objeto: 'Computadores para as escolas', itens, memoria_calculo: '1 por sala' } } }
    const etp = valoresIniciais(modeloPorCodigo('etp'), ctx)
    expect(etp.objeto).toBe('Computadores para as escolas')
    expect(etp.objeto_tipo).toBe('bens-permanentes')
    expect(etp.itens).toEqual([{ item: 'Computador desktop', unidade: 'unidade', quantidade: '20', memoria: '1 por sala' }])
    expect(valoresIniciais(modeloPorCodigo('pesquisa-precos'), ctx).itens[0]).toMatchObject({ item: 'Computador desktop', quantidade: '20', referencia: '' })
    expect(valoresIniciais(modeloPorCodigo('tr'), ctx).itens).toEqual([{ item: 'Computador desktop', descricao: 'i5, 16 GB, SSD 512 GB', unidade: 'unidade', quantidade: '20' }])
    // sem DFD, uma linha vazia para preencher e o assunto do processo como objeto
    const semDfd = valoresIniciais(modeloPorCodigo('tr'), { ...CTX, processo: { assunto: 'Assunto do processo' } })
    expect(semDfd.objeto).toBe('Assunto do processo')
    expect(semDfd.itens).toHaveLength(1)
  })
})

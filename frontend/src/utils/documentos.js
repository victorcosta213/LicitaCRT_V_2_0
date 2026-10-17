// Minutas geradas pela plataforma para inserir no SEI (portaria, termo de ciência,
// OS/OC e atesto). Os documentos oficiais continuam sendo assinados no SEI.
// Todo valor vindo do banco passa por `esc` antes de entrar no HTML.
import { brl, fmtCnpj, fmtCompetencia, fmtDate, num, soDigitos } from './format'
import { INSTRUMENTO, TIPO_ORDEM } from './contrato'

const LACUNA = '__________'
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const v = (x) => (x === null || x === undefined || String(x).trim() === '' ? LACUNA : esc(x))
const p = (html) => `<p>${html}</p>`
const titulo = (t) => `<p style="text-align:center"><strong>${t}</strong></p>`
const dataHoje = () => new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
const instrumento = (c) => `${INSTRUMENTO[c.instrumento] || 'Contrato'} nº ${v(c.numero)}`
const cnpj = (c) => (c.cnpj ? `, CNPJ ${esc(fmtCnpj(soDigitos(c.cnpj)))}` : '')
const localData = (params) => p(`${v(params.orgao_cidade)}, ${dataHoje()}.`)
const assinatura = (nome, cargo) => p(`<br>${v(nome)}<br>${esc(cargo)}`)
const simNao = (b) => (b === true ? 'sim' : b === false ? 'não' : 'não informado')

// Texto da regra da Nota Fiscal (§11): PARA o fiscal titular, CC a Gestão de Contratos
export function orientacaoNotaFiscal(k, params) {
  const t = k.fiscalTitular
  return `As Notas Fiscais e demais documentos relacionados à execução deverão ser encaminhados ao Fiscal Titular `
    + `da contratação, Sr.(a) ${v(t?.nome)}, pelo e-mail ${v(t?.email)}, com cópia para o endereço institucional `
    + `da Gestão de Contratos ${v(params.email_gestao_contratos)}.`
}

export function minutaPortaria(k, params) {
  const c = k.c
  const atribuicoes = String(params.atribuicoes_fiscal || '').split('\n').map((s) => s.trim()).filter(Boolean)
  const html = [
    titulo(`PORTARIA Nº ${v(c.portaria_numero)}, DE ${c.portaria_data ? esc(fmtDate(c.portaria_data)) : LACUNA}`),
    p(`<em>Designa a gestão e a fiscalização da contratação ${instrumento(c)}, firmada com ${v(c.contratada)}.</em>`),
    p(`O(A) PRESIDENTE DO(A) ${v(params.orgao_nome)}, no uso de suas atribuições, considerando o art. 117 da `
      + `Lei nº 14.133/2021 e o que consta do Processo SEI nº ${v(c.sei_processo)},`),
    p('<strong>RESOLVE:</strong>'),
    p(`<strong>Art. 1º</strong> Designar, para acompanhar e fiscalizar a execução do(a) ${instrumento(c)}, `
      + `celebrado(a) com ${v(c.contratada)}${cnpj(c)}, cujo objeto é ${v(c.objeto)}:`),
    p(`I – Gestor(a) do contrato: ${v(k.gestorTitular?.nome)};`),
    p(`II – Fiscal titular: ${v(k.fiscalTitular?.nome)};`),
    p(`III – Fiscal substituto: ${v(k.fiscalSubstituto?.nome)}.`),
    p('<strong>Art. 2º</strong> Compete à fiscalização:'),
    ...(atribuicoes.length ? atribuicoes.map((a) => p(esc(a))) : [p(LACUNA)]),
    p('<strong>Art. 3º</strong> Esta Portaria entra em vigor na data de sua publicação.'),
    localData(params),
    assinatura(params.presidente_nome, 'Presidente'),
  ].join('\n')
  return { titulo: `Portaria de designação — ${c.numero}`, arquivo: `portaria-${c.numero}`, html }
}

export function termoCiencia(k, params) {
  const c = k.c
  const linhas = [
    ['Gestor(a) do contrato', k.gestorTitular?.nome],
    ['Fiscal titular', k.fiscalTitular?.nome],
    ['Fiscal substituto', k.fiscalSubstituto?.nome],
  ]
  const html = [
    titulo('TERMO DE CIÊNCIA E ACEITE'),
    p(`<strong>Processo SEI:</strong> ${v(c.sei_processo)}<br><strong>Instrumento:</strong> ${instrumento(c)}`
      + `<br><strong>Contratada:</strong> ${v(c.contratada)}${cnpj(c)}<br><strong>Objeto:</strong> ${v(c.objeto)}`
      + `<br><strong>Portaria de designação:</strong> nº ${v(c.portaria_numero)}, de ${c.portaria_data ? esc(fmtDate(c.portaria_data)) : LACUNA}`),
    p('Declaramos ciência da designação para atuar na gestão e na fiscalização da contratação acima, nos termos '
      + 'da Portaria indicada e do art. 117 da Lei nº 14.133/2021, bem como das atribuições correspondentes, e '
      + 'aceitamos o encargo.'),
    ...linhas.map(([cargo, nome]) => p(`${v(nome)} — ${esc(cargo)} (assinatura eletrônica no SEI)`)),
    localData(params),
  ].join('\n')
  return { titulo: `Termo de ciência e aceite — ${c.numero}`, arquivo: `termo-ciencia-${c.numero}`, html }
}

export function minutaOrdem(k, os, params) {
  const c = k.c
  const nome = (TIPO_ORDEM[os.tipo] || TIPO_ORDEM.os).toUpperCase()
  const empenhos = k.empenhos?.length
    ? k.empenhos.map((e) => `${esc(e.numero)}/${esc(e.exercicio)}`).join(', ')
    : v(c.empenho_referencia)
  const html = [
    titulo(`${nome} Nº ${v(os.numero_os)}`),
    p(`<strong>Processo SEI:</strong> ${v(c.sei_processo)}<br><strong>Instrumento:</strong> ${instrumento(c)}`
      + `<br><strong>Contratada:</strong> ${v(c.contratada)}${cnpj(c)}<br><strong>Endereço:</strong> ${v(c.contratada_endereco)}`
      + `<br><strong>Representante/preposto:</strong> ${v(os.preposto_nome || c.contratada_representante)}`
      + `<br><strong>Objeto da contratação:</strong> ${v(c.objeto)}<br><strong>Valor da contratação:</strong> ${esc(brl(k.valorAtualizado))}`
      + `<br><strong>Empenho:</strong> ${empenhos}`),
    p(`<strong>Gestor(a):</strong> ${v(k.gestorTitular?.nome)} · <strong>Fiscal titular:</strong> ${v(k.fiscalTitular?.nome)}`
      + ` · <strong>Fiscal substituto:</strong> ${v(k.fiscalSubstituto?.nome)}`
      + `<br><strong>Portaria de designação:</strong> nº ${v(c.portaria_numero)}${c.portaria_data ? `, de ${esc(fmtDate(c.portaria_data))}` : ''}`),
    p(`Fica a contratada autorizada a executar/fornecer: ${v(os.objeto_autorizado)}.`),
    p(`<strong>Valor desta ordem:</strong> ${os.valor != null ? esc(brl(os.valor)) : LACUNA}`
      + `<br><strong>Início:</strong> ${os.data_prevista_inicio ? esc(fmtDate(os.data_prevista_inicio)) : LACUNA}`
      + `<br><strong>Período/prazo de execução:</strong> ${os.periodo_inicio ? esc(fmtDate(os.periodo_inicio)) : LACUNA} a ${os.periodo_fim ? esc(fmtDate(os.periodo_fim)) : LACUNA}`
      + `<br><strong>Local:</strong> ${v(os.local_execucao)}`
      + (os.observacoes ? `<br><strong>Observações:</strong> ${esc(os.observacoes)}` : '')),
    p(`<strong>Notas fiscais:</strong> ${orientacaoNotaFiscal(k, params)}`),
    localData(params),
    assinatura(params.presidente_nome, 'Presidente'),
    assinatura(params.diretor_financeiro_nome, 'Diretor(a) Financeiro(a)'),
  ].join('\n')
  return { titulo: `${TIPO_ORDEM[os.tipo] || TIPO_ORDEM.os} — ${c.numero}`, arquivo: `${os.tipo || 'os'}-${c.numero}`, html }
}

export function minutaAtesto(k, comp, params, fiscal = k.fiscalEmAtuacao) {
  const c = k.c
  const glosa = comp.houve_glosa
    ? `Glosa de ${esc(brl(comp.glosa_valor))} — ${v(comp.glosa_motivo)}${comp.glosa_obs ? ` (${esc(comp.glosa_obs)})` : ''}.`
    : 'Sem glosa.'
  const quantidade = { sim: 'adequada', nao: 'inadequada', na: 'não se aplica' }[comp.quantidade_adequada] || 'não informada'
  const liquido = num(comp.nf_valor_bruto ?? comp.valor_medido) - num(comp.glosa_valor)
  const html = [
    titulo('ATESTO'),
    p(`<strong>Processo SEI:</strong> ${v(c.sei_processo)}<br><strong>Contratada:</strong> ${v(c.contratada)}${cnpj(c)}`
      + `<br><strong>Instrumento:</strong> ${instrumento(c)}<br><strong>Objeto:</strong> ${v(c.objeto)}`),
    p(`<strong>Competência:</strong> ${esc(fmtCompetencia(comp.competencia))}<br><strong>Nota Fiscal:</strong> nº ${v(comp.nf_numero)}`
      + `${comp.nf_data ? `, de ${esc(fmtDate(comp.nf_data))}` : ''} — valor bruto ${esc(brl(comp.nf_valor_bruto))}`
      + `<br><strong>Glosa:</strong> ${glosa}<br><strong>Valor atestado (líquido):</strong> ${esc(brl(liquido))}`),
    p(`Atesto, para fins de liquidação e pagamento, a execução do objeto na competência indicada. Manifestação da `
      + `fiscalização: execução realizada: ${simNao(comp.execucao_realizada)}; conforme contrato/TR/OS: `
      + `${simNao(comp.conforme_contrato)}; quantidade: ${quantidade}; qualidade adequada: ${simNao(comp.qualidade_adequada)}; `
      + `prazo cumprido: ${simNao(comp.prazo_cumprido)}; documentação conferida: ${simNao(comp.doc_completa)}.`),
    ...(comp.obs_fiscal ? [p(`<strong>Observações:</strong> ${esc(comp.obs_fiscal)}`)] : []),
    localData(params),
    assinatura(fiscal?.nome || comp.fiscal_nome, fiscal?.papel === 'fiscal_substituto' ? 'Fiscal substituto' : 'Fiscal titular'),
  ].join('\n')
  return { titulo: `Atesto — ${c.numero} · ${fmtCompetencia(comp.competencia)}`, arquivo: `atesto-${c.numero}-${comp.competencia}`, html }
}

// A mesma orientação, em texto puro (para exibir na tela)
export const orientacaoNotaFiscalTexto = (k, params) => paraTexto(orientacaoNotaFiscal(k, params))

// Texto simples (para a área de transferência quando o HTML não é aceito)
export const paraTexto = (html) => html
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\n{3,}/g, '\n\n').trim()

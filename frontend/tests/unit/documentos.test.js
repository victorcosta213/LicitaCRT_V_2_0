import { describe, expect, it } from 'vitest'
import { consolidar } from '../../src/utils/contrato'
import {
  esc, minutaAtesto, minutaOrdem, minutaPortaria, orientacaoNotaFiscal, orientacaoNotaFiscalTexto, paraTexto, termoCiencia,
} from '../../src/utils/documentos'

const PARAMS = {
  orgao_nome: 'Conselho Regional dos Técnicos Industriais — CRT-08', orgao_cidade: 'Belém/PA',
  presidente_nome: 'Fulano Presidente', diretor_financeiro_nome: 'Beltrana Diretora',
  email_gestao_contratos: 'contratos@crt08.gov.br',
  atribuicoes_fiscal: 'I – acompanhar a execução;\nII – atestar as notas fiscais.',
}
const k = consolidar({
  id: 'c1', numero: '014/2026', instrumento: 'contrato', contratada: 'ACME <Serviços> & Cia', cnpj: '11222333000181',
  objeto: 'Limpeza predial', sei_processo: '0001.000123/2026-11', valor_inicial: 120000,
  contratada_endereco: 'Av. Central, 100', contratada_representante: 'José Preposto',
  portaria_numero: '12/2026', portaria_data: '2026-10-10', empenho_referencia: '2026NE000777',
}, {
  responsaveis: [
    { id: 'g', papel: 'gestor_titular', nome: 'Ana Gestora', ativo: true },
    { id: 't', papel: 'fiscal_tecnico', nome: 'Bia Fiscal', email: 'bia@crt08.gov.br', ativo: true },
    { id: 's', papel: 'fiscal_substituto', nome: 'Caio Substituto', ativo: true },
  ],
  os: [], competencias: [], empenhos: [], movs: [], execucoes: [], eventos: [], ocorrencias: [], documentos: [], pendencias: [],
})

describe('documentos gerados para o SEI', () => {
  it('portaria (§7) puxa instrumento, contratada, objeto, gestão, fiscais e atribuições', () => {
    const t = paraTexto(minutaPortaria(k, PARAMS).html)
    expect(t).toContain('PORTARIA Nº 12/2026, DE 10/10/2026')
    expect(t).toContain('Contrato nº 014/2026')
    expect(t).toContain('CNPJ 11.222.333/0001-81')
    expect(t).toContain('Limpeza predial')
    expect(t).toContain('Gestor(a) do contrato: Ana Gestora')
    expect(t).toContain('Fiscal titular: Bia Fiscal')
    expect(t).toContain('Fiscal substituto: Caio Substituto')
    expect(t).toContain('II – atestar as notas fiscais.')
    expect(t).toContain('Processo SEI nº 0001.000123/2026-11')
    expect(t).toContain('Fulano Presidente')
  })

  it('termo de ciência e aceite (§8) para gestora, titular e substituto', () => {
    const t = paraTexto(termoCiencia(k, PARAMS).html)
    expect(t).toContain('TERMO DE CIÊNCIA E ACEITE')
    for (const nome of ['Ana Gestora', 'Bia Fiscal', 'Caio Substituto']) expect(t).toContain(nome)
  })

  it('OS/OC (§9) traz os dados da contratação, a autorização e a regra da NF (§11)', () => {
    const os = { tipo: 'oc', numero_os: '3/2026', objeto_autorizado: 'Fornecimento de 10 toners', valor: 5000, local_execucao: 'Sede' }
    const t = paraTexto(minutaOrdem(k, os, PARAMS).html)
    expect(t).toContain('ORDEM DE COMPRA Nº 3/2026')
    expect(t).toContain('Endereço: Av. Central, 100')
    expect(t).toContain('Representante/preposto: José Preposto')
    expect(t).toContain('Empenho: 2026NE000777')
    expect(t).toContain('Fornecimento de 10 toners')
    expect(t).toContain('Local: Sede')
    expect(t).toContain('encaminhados ao Fiscal Titular da contratação, Sr.(a) Bia Fiscal, pelo e-mail bia@crt08.gov.br, '
      + 'com cópia para o endereço institucional da Gestão de Contratos contratos@crt08.gov.br')
    expect(t).toContain('Beltrana Diretora')
  })

  it('atesto (§14) com NF, glosa, valor líquido e manifestação do fiscal', () => {
    const comp = {
      competencia: '2026-09-01', nf_numero: '458', nf_data: '2026-10-02', nf_valor_bruto: 1000,
      houve_glosa: true, glosa_valor: 150, glosa_motivo: 'Falta de postos', execucao_realizada: true,
      conforme_contrato: true, quantidade_adequada: 'na', qualidade_adequada: true, prazo_cumprido: false, doc_completa: true,
    }
    const t = paraTexto(minutaAtesto(k, comp, PARAMS).html)
    expect(t).toContain('Competência: setembro/2026')
    expect(t).toMatch(/Nota Fiscal: nº 458, de 02\/10\/2026 — valor bruto R\$\s1\.000,00/)
    expect(t).toMatch(/Glosa de R\$\s150,00 — Falta de postos/)
    expect(t).toMatch(/Valor atestado \(líquido\): R\$\s850,00/)
    expect(t).toContain('quantidade: não se aplica')
    expect(t).toContain('prazo cumprido: não')
    expect(t).toContain('Bia Fiscal')
  })

  it('dados do banco são escapados no HTML', () => {
    const html = minutaPortaria(k, PARAMS).html
    expect(html).toContain('ACME &lt;Serviços&gt; &amp; Cia')
    expect(html).not.toContain('<Serviços>')
    expect(esc(`<script>"x"</script>`)).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;')
  })

  it('o que falta aparece como lacuna para preencher', () => {
    const t = paraTexto(minutaOrdem(k, { tipo: 'os' }, {}).html)
    expect(t).toContain('ORDEM DE SERVIÇO Nº __________')
    expect(orientacaoNotaFiscalTexto(k, {})).toContain('Gestão de Contratos __________')
  })

  it('a orientação da NF em HTML e em texto', () => {
    expect(orientacaoNotaFiscal(k, PARAMS)).toContain('bia@crt08.gov.br')
    expect(orientacaoNotaFiscalTexto(k, PARAMS)).not.toMatch(/&[a-z]+;/)
  })
})

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGc } from '../context/GcContext'
import { useAuth } from '../context/AuthContext'
import { Card, DefList, Empty, GcGate, PageHeader } from '../components/gc/ui'
import {
  PAPEL_RESPONSAVEL, SITUACAO_CONTRATO, SITUACOES_OPERACIONAIS, STATUS_OCORRENCIA, STATUS_OS,
  TIPO_EVENTO, TIPO_OCORRENCIA, documentosReferenciados,
} from '../utils/contrato'
import {
  brl, exercicioDe, fmtCnpj, fmtCompetencia, fmtDate, num, soDigitos,
} from '../utils/format'
import { can } from '../utils/permissions'
import { exportarPdf, exportarXlsx } from '../utils/exportar'

const BASE_COLS = [
  { key: 'contrato', label: 'Contrato' },
  { key: 'contratada', label: 'Contratada' },
]

const RELATORIOS = {
  contratos_ativos: {
    label: 'Contratos ativos',
    colunas: [...BASE_COLS, { key: 'objeto', label: 'Objeto' }, { key: 'gestor', label: 'Gestor' },
      { key: 'fiscal', label: 'Fiscal' }, { key: 'fim', label: 'Fim da vigência' }, { key: 'valor', label: 'Valor atualizado' }],
    linhas: (ks) => ks.filter((k) => SITUACOES_OPERACIONAIS.includes(k.c.situacao)).map((k) => ({
      contrato: k.c.numero, contratada: k.c.contratada, objeto: k.c.objeto, gestor: k.nomeGestor || '—',
      fiscal: k.nomeFiscal || '—', fim: fmtDate(k.vigenciaFim), valor: brl(k.valorAtualizado),
    })),
  },
  por_vencer: {
    label: 'Contratos por vencer',
    colunas: [...BASE_COLS, { key: 'fim', label: 'Fim da vigência' }, { key: 'dias', label: 'Dias' },
      { key: 'prorrogavel', label: 'Prorrogável' }, { key: 'inicioPror', label: 'Iniciar prorrogação' }],
    linhas: (ks) => ks.filter((k) => !['encerrado', 'em_cadastro'].includes(k.c.situacao)
      && k.diasVigencia !== null && k.diasVigencia <= 180)
      .sort((a, b) => a.diasVigencia - b.diasVigencia)
      .map((k) => ({
        contrato: k.c.numero, contratada: k.c.contratada, fim: fmtDate(k.vigenciaFim), dias: k.diasVigencia,
        prorrogavel: k.c.prorrogavel ? 'Sim' : 'Não', inicioPror: k.c.prorrogavel ? fmtDate(k.inicioProrrogacao) : '—',
      })),
  },
  situacao_financeira: {
    label: 'Situação financeira por contrato',
    colunas: [...BASE_COLS, { key: 'valor', label: 'Valor atualizado' }, { key: 'empenhado', label: 'Empenhado' },
      { key: 'saldoEmp', label: 'Saldo empenhos' }, { key: 'exec', label: 'Executado' }, { key: 'liq', label: 'Liquidado' },
      { key: 'pago', label: 'Pago' }, { key: 'pend', label: 'Pendente pgto' }],
    financeiro: true,
    linhas: (ks) => ks.map((k) => ({
      contrato: k.c.numero, contratada: k.c.contratada, valor: brl(k.valorAtualizado), empenhado: brl(k.empenhado),
      saldoEmp: brl(k.saldoEmpenhos), exec: brl(k.execucaoReconhecida), liq: brl(k.liquidado), pago: brl(k.pago),
      pend: brl(k.pendentePagamento),
    })),
  },
  pagamentos_competencia: {
    label: 'Pagamentos por competência',
    colunas: [{ key: 'competencia', label: 'Competência' }, ...BASE_COLS, { key: 'empenho', label: 'Empenho' },
      { key: 'liq', label: 'Liquidado' }, { key: 'dataPag', label: 'Data pgto' }, { key: 'pago', label: 'Pago' },
      { key: 'situacao', label: 'Situação' }],
    financeiro: true,
    linhas: (ks, f) => ks.flatMap((k) => k.competencias
      .filter((c) => c.liberado_financeiro && (!f.competencia || c.competencia === `${f.competencia}-01`))
      .map((c) => {
        const e = k.empenhos.find((x) => x.id === c.execucao?.empenho_id)
        return {
          competencia: fmtCompetencia(c.competencia), contrato: k.c.numero, contratada: k.c.contratada,
          empenho: e ? `${e.numero}/${e.exercicio}` : '—', liq: brl(c.execucao?.valor_liquidado),
          dataPag: fmtDate(c.execucao?.data_pagamento), pago: brl(c.execucao?.valor_pago), situacao: c.situacaoFin.label,
        }
      })),
  },
  pagamentos_contratada: {
    label: 'Pagamentos por contratada',
    colunas: [{ key: 'contratada', label: 'Contratada' }, { key: 'cnpj', label: 'CNPJ' }, { key: 'qtd', label: 'Contratos' },
      { key: 'liq', label: 'Liquidado' }, { key: 'pago', label: 'Pago' }, { key: 'pend', label: 'Pendente' }],
    financeiro: true,
    linhas: (ks) => {
      const m = new Map()
      for (const k of ks) {
        const key = soDigitos(k.c.cnpj) || k.c.contratada
        const r = m.get(key) || { contratada: k.c.contratada, cnpj: fmtCnpj(k.c.cnpj), qtd: 0, liq: 0, pago: 0, pend: 0 }
        r.qtd += 1; r.liq += k.liquidado; r.pago += k.pago; r.pend += k.pendentePagamento
        m.set(key, r)
      }
      return [...m.values()].sort((a, b) => b.pago - a.pago)
        .map((r) => ({ ...r, liq: brl(r.liq), pago: brl(r.pago), pend: brl(r.pend) }))
    },
  },
  execucao_anual: {
    label: 'Execução anual',
    colunas: [{ key: 'ano', label: 'Exercício' }, ...BASE_COLS, { key: 'emp', label: 'Empenhado' },
      { key: 'rec', label: 'Reconhecido' }, { key: 'liq', label: 'Liquidado' }, { key: 'pago', label: 'Pago' }],
    financeiro: true,
    linhas: (ks, f) => {
      const out = []
      for (const k of ks) {
        const anos = new Map()
        const at = (a) => {
          if (!anos.has(a)) anos.set(a, { emp: 0, rec: 0, liq: 0, pago: 0 })
          return anos.get(a)
        }
        k.empenhos.forEach((e) => { at(e.exercicio).emp += e.valorAtual })
        k.competencias.forEach((c) => {
          const a = at(exercicioDe(c.competencia))
          if (c.atestado && !c.suspensa) a.rec += num(c.valor_liquido)
          a.liq += num(c.execucao?.valor_liquidado)
          a.pago += num(c.execucao?.valor_pago)
        })
        for (const [ano, v] of anos) {
          if (f.exercicio && Number(f.exercicio) !== ano) continue
          out.push({
            ano, contrato: k.c.numero, contratada: k.c.contratada,
            emp: brl(v.emp), rec: brl(v.rec), liq: brl(v.liq), pago: brl(v.pago),
          })
        }
      }
      return out.sort((a, b) => b.ano - a.ano)
    },
  },
  ocorrencias: {
    label: 'Ocorrências',
    colunas: [{ key: 'data', label: 'Data' }, ...BASE_COLS, { key: 'tipo', label: 'Tipo' },
      { key: 'descricao', label: 'Descrição' }, { key: 'prazo', label: 'Prazo' }, { key: 'status', label: 'Status' }],
    linhas: (ks) => ks.flatMap((k) => k.b.ocorrencias.filter((o) => !o.cancelado).map((o) => ({
      data: fmtDate(o.data), contrato: k.c.numero, contratada: k.c.contratada, tipo: TIPO_OCORRENCIA[o.tipo],
      descricao: o.descricao, prazo: fmtDate(o.prazo_concedido), status: STATUS_OCORRENCIA[o.status].label,
    }))),
  },
  glosas: {
    label: 'Glosas',
    colunas: [{ key: 'competencia', label: 'Competência' }, ...BASE_COLS, { key: 'motivo', label: 'Motivo' },
      { key: 'valor', label: 'Valor da glosa' }, { key: 'liquido', label: 'Líquido devido' }],
    linhas: (ks, f) => ks.flatMap((k) => k.competencias
      .filter((c) => c.houve_glosa && (!f.competencia || c.competencia === `${f.competencia}-01`))
      .map((c) => ({
        competencia: fmtCompetencia(c.competencia), contrato: k.c.numero, contratada: k.c.contratada,
        motivo: c.glosa_motivo || '—', valor: brl(c.glosa_valor), liquido: brl(c.valor_liquido),
      }))),
  },
  prorrogacoes: {
    label: 'Prorrogações',
    colunas: [...BASE_COLS, { key: 'situacao', label: 'Situação' }, { key: 'solic', label: 'Solicitação' },
      { key: 'de', label: 'Vigência anterior' }, { key: 'para', label: 'Nova vigência' }, { key: 'sei', label: 'SEI' }],
    linhas: (ks) => ks.flatMap((k) => k.b.eventos.filter((e) => !e.cancelado && e.tipo === 'prorrogacao').map((e) => ({
      contrato: k.c.numero, contratada: k.c.contratada, situacao: e.situacao, solic: fmtDate(e.data_solicitacao),
      de: fmtDate(e.vigencia_anterior), para: fmtDate(e.vigencia_posterior), sei: e.sei_documento || '—',
    }))),
  },
  reajustes: {
    label: 'Reajustes e reequilíbrios',
    colunas: [...BASE_COLS, { key: 'tipo', label: 'Tipo' }, { key: 'situacao', label: 'Situação' },
      { key: 'data', label: 'Data' }, { key: 'de', label: 'Valor anterior' }, { key: 'para', label: 'Valor posterior' },
      { key: 'base', label: 'Data-base' }],
    linhas: (ks) => ks.flatMap((k) => k.b.eventos
      .filter((e) => !e.cancelado && ['reajuste', 'repactuacao', 'reequilibrio'].includes(e.tipo))
      .map((e) => ({
        contrato: k.c.numero, contratada: k.c.contratada, tipo: TIPO_EVENTO[e.tipo], situacao: e.situacao,
        data: fmtDate(e.data_evento || e.data_solicitacao), de: brl(e.valor_anterior), para: brl(e.valor_posterior),
        base: fmtDate(k.c.data_base_reajuste),
      }))),
  },
  pendencias: {
    label: 'Pendências e alertas',
    colunas: [...BASE_COLS, { key: 'categoria', label: 'Categoria' }, { key: 'titulo', label: 'Pendência' },
      { key: 'detalhe', label: 'Detalhe' }, { key: 'sev', label: 'Severidade' }],
    linhas: (ks, f, alertas) => alertas
      .filter((a) => ks.some((k) => k.id === a.contratoId))
      .map((a) => ({
        contrato: a.contratoNumero, contratada: a.contratada, categoria: a.categoria, titulo: a.titulo,
        detalhe: a.detalhe, sev: { danger: 'Crítico', warning: 'Atenção', info: 'Informativo' }[a.severidade],
      })),
  },
  individual: { label: 'Relatório individual completo do contrato', individual: true },
}

export default function Relatorios() {
  const { consolidados, alertas } = useGc()
  const { role } = useAuth()
  const [sp, setSp] = useSearchParams()
  const tipo = sp.get('tipo') || 'contratos_ativos'
  const contratoId = sp.get('contrato') || ''
  const [f, setF] = useState({ busca: '', cnpj: '', processo: '', gestor: '', fiscal: '', exercicio: '', situacao: '', competencia: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  const def = RELATORIOS[tipo] || RELATORIOS.contratos_ativos
  const ver = (rep) => !rep.financeiro || can(role, 'relatorio.financeiro') || role === 'viewer'

  const opcoes = useMemo(() => ({
    gestores: [...new Set(consolidados.map((k) => k.nomeGestor).filter(Boolean))].sort(),
    fiscais: [...new Set(consolidados.map((k) => k.nomeFiscal).filter(Boolean))].sort(),
    exercicios: [...new Set(consolidados.flatMap((k) => [exercicioDe(k.c.vigencia_inicio), exercicioDe(k.vigenciaFim)])
      .filter(Boolean))].sort((a, b) => b - a),
  }), [consolidados])

  const filtrados = useMemo(() => {
    const q = f.busca.trim().toLowerCase()
    return consolidados.filter((k) => {
      const c = k.c
      if (contratoId && k.id !== contratoId) return false
      if (q && !`${c.numero} ${c.contratada} ${c.objeto}`.toLowerCase().includes(q)) return false
      if (f.cnpj && !soDigitos(c.cnpj).includes(soDigitos(f.cnpj))) return false
      if (f.processo && !(c.sei_processo || '').includes(f.processo)) return false
      if (f.gestor && k.nomeGestor !== f.gestor) return false
      if (f.fiscal && k.nomeFiscal !== f.fiscal) return false
      if (f.situacao && c.situacao !== f.situacao) return false
      if (f.exercicio) {
        const y = Number(f.exercicio)
        if (y < (exercicioDe(c.vigencia_inicio) ?? y) || y > (exercicioDe(k.vigenciaFim) ?? y)) return false
      }
      return true
    })
  }, [consolidados, f, contratoId])

  const individual = def.individual ? (consolidados.find((k) => k.id === contratoId) || null) : null
  const linhas = useMemo(
    () => (def.linhas ? def.linhas(filtrados, f, alertas) : []),
    [def, filtrados, f, alertas],
  )

  const nomeArquivo = `relatorio-${tipo}`

  return (
    <GcGate>
      <PageHeader
        title="Relatórios"
        subtitle="Pesquise, filtre e exporte as informações da gestão contratual e financeira."
        actions={def.linhas && linhas.length > 0 && (
          <>
            <button className="btn btn-outline-secondary" onClick={() => exportarXlsx(nomeArquivo, def.colunas, linhas, def.label)}>
              <i className="bi bi-file-earmark-excel me-2" />Excel
            </button>
            <button className="btn btn-outline-secondary" onClick={() => exportarPdf(nomeArquivo, def.label, def.colunas, linhas)}>
              <i className="bi bi-file-earmark-pdf me-2" />PDF
            </button>
          </>
        )}
      />

      <Card className="gc-noprint">
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold">Relatório</label>
            <select className="form-select" value={tipo} onChange={(e) => setSp({ tipo: e.target.value })}>
              {Object.entries(RELATORIOS).filter(([, r]) => ver(r)).map(([id, r]) => (
                <option key={id} value={id}>{r.label}</option>
              ))}
            </select>
          </div>
          {def.individual ? (
            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">Contrato</label>
              <select className="form-select" value={contratoId} onChange={(e) => setSp({ tipo, contrato: e.target.value })}>
                <option value="">Selecione…</option>
                {consolidados.map((k) => <option key={k.id} value={k.id}>{k.c.numero} — {k.c.contratada}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Contrato / empresa</label>
                <input className="form-control" value={f.busca} onChange={(e) => set('busca', e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">CNPJ</label>
                <input className="form-control" value={f.cnpj} onChange={(e) => set('cnpj', e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Processo SEI</label>
                <input className="form-control" value={f.processo} onChange={(e) => set('processo', e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Competência</label>
                <input type="month" className="form-control" value={f.competencia} onChange={(e) => set('competencia', e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Gestor</label>
                <select className="form-select" value={f.gestor} onChange={(e) => set('gestor', e.target.value)}>
                  <option value="">Todos</option>{opcoes.gestores.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Fiscal</label>
                <select className="form-select" value={f.fiscal} onChange={(e) => set('fiscal', e.target.value)}>
                  <option value="">Todos</option>{opcoes.fiscais.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Exercício / vigência</label>
                <select className="form-select" value={f.exercicio} onChange={(e) => set('exercicio', e.target.value)}>
                  <option value="">Todos</option>{opcoes.exercicios.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold">Situação</label>
                <select className="form-select" value={f.situacao} onChange={(e) => set('situacao', e.target.value)}>
                  <option value="">Todas</option>
                  {Object.entries(SITUACAO_CONTRATO).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </Card>

      {def.individual ? (
        individual ? <RelatorioIndividual k={individual} /> : <Empty>Selecione um contrato.</Empty>
      ) : (
        <Card flush title={`${def.label} — ${linhas.length} registro(s)`}>
          {linhas.length === 0 ? <Empty /> : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 gc-table">
                <thead className="table-light">
                  <tr>{def.colunas.map((c) => <th key={c.key} className="px-3">{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i}>{def.colunas.map((c) => <td key={c.key} className="px-3">{l[c.key] ?? '—'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </GcGate>
  )
}

/* ------------------------------------------------------------------ */
/* Relatório individual (imprimível)                                    */
/* ------------------------------------------------------------------ */

function Secao({ titulo, children }) {
  return (
    <section className="mb-4">
      <h2 className="h6 fw-bold text-uppercase border-bottom pb-1 mb-3">{titulo}</h2>
      {children}
    </section>
  )
}

function Tabela({ cols, rows }) {
  if (!rows.length) return <div className="small text-secondary">Sem registros.</div>
  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function RelatorioIndividual({ k }) {
  const c = k.c
  const hoje = new Date().toLocaleString('pt-BR')
  return (
    <div className="card shadow-sm border-0">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start mb-4 gc-noprint">
          <span className="text-secondary small">Relatório gerado em {hoje}</span>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <i className="bi bi-printer me-2" />Imprimir / salvar PDF
          </button>
        </div>
        <h1 className="h4 fw-bold">Contrato {c.numero} — {c.contratada}</h1>
        <p className="text-secondary">
          CNPJ {fmtCnpj(c.cnpj)} · Processo SEI {c.sei_processo || '—'} · Situação {SITUACAO_CONTRATO[c.situacao]?.label}
          {' '}· Emitido em {hoje}
        </p>

        <Secao titulo="Identificação e vigência">
          <DefList cols={3} items={[
            ['Objeto', c.objeto], ['Unidade demandante', c.unidade_demandante], ['Modalidade', c.modalidade],
            ['Nº licitação', c.numero_licitacao], ['Assinatura', fmtDate(c.data_assinatura)],
            ['Vigência', `${fmtDate(c.vigencia_inicio)} a ${fmtDate(k.vigenciaFim)}`],
            ['Dias restantes', k.diasVigencia], ['Prorrogável', c.prorrogavel ? 'Sim' : 'Não'],
            ['Data-base reajuste', fmtDate(c.data_base_reajuste)],
          ]} />
        </Secao>

        <Secao titulo="Responsáveis">
          <Tabela cols={['Papel', 'Nome', 'E-mail', 'SEI']}
            rows={k.b.responsaveis.filter((r) => r.ativo).map((r) => [PAPEL_RESPONSAVEL[r.papel], r.nome, r.email, r.sei_documento])} />
          <div className="small text-secondary mt-2">Portaria: {c.portaria_sei || '—'} ({fmtDate(c.portaria_data)})</div>
        </Secao>

        <Secao titulo="Valores e saldos">
          <DefList cols={4} items={[
            ['Valor inicial', brl(k.valorInicial)], ['Valor atualizado', brl(k.valorAtualizado)],
            ['Executado reconhecido', brl(k.execucaoReconhecida)], ['Saldo de execução', brl(k.saldoExecucao)],
            ['Empenhado', brl(k.empenhado)], ['Saldo dos empenhos', brl(k.saldoEmpenhos)],
            ['Liquidado', brl(k.liquidado)], ['Pago', brl(k.pago)], ['Pendente de pagamento', brl(k.pendentePagamento)],
          ]} />
        </Secao>

        <Secao titulo="Garantia">
          {c.exige_garantia ? (
            <DefList cols={4} items={[
              ['Modalidade', c.garantia_modalidade], ['Valor', brl(c.garantia_valor)],
              ['Início', fmtDate(c.garantia_inicio)], ['Vencimento', fmtDate(c.garantia_vencimento)],
            ]} />
          ) : <div className="small text-secondary">Não exigida.</div>}
        </Secao>

        <Secao titulo="Ordens de serviço">
          <Tabela cols={['Nº', 'Status', 'Emissão', 'Início efetivo', 'SEI']}
            rows={k.b.os.filter((o) => !o.cancelado).map((o) => [o.numero_os || '—', STATUS_OS[o.status].label,
              fmtDate(o.data_emissao), fmtDate(o.data_efetiva_inicio), o.sei_documento])} />
        </Secao>

        <Secao titulo="Competências">
          <Tabela cols={['Competência', 'Status', 'Valor líquido', 'Glosa', 'Liquidado', 'Pago']}
            rows={k.competencias.map((x) => [fmtCompetencia(x.competencia), x.status.label, brl(x.valor_liquido),
              x.houve_glosa ? brl(x.glosa_valor) : '—', brl(x.execucao?.valor_liquidado), brl(x.execucao?.valor_pago)])} />
        </Secao>

        <Secao titulo="Empenhos">
          <Tabela cols={['Empenho', 'Inicial', 'Reforços', 'Anulações', 'Atualizado', 'Liquidado', 'Saldo']}
            rows={k.empenhos.map((e) => [`${e.numero}/${e.exercicio}`, brl(e.valor_inicial), brl(e.reforcos),
              brl(e.anulacoes), brl(e.valorAtual), brl(e.liquidado), brl(e.saldo)])} />
        </Secao>

        <Secao titulo="Eventos contratuais">
          <Tabela cols={['Tipo', 'Situação', 'Data', 'Valor', 'Vigência', 'SEI']}
            rows={k.b.eventos.filter((e) => !e.cancelado).map((e) => [TIPO_EVENTO[e.tipo], e.situacao,
              fmtDate(e.data_evento || e.data_solicitacao), `${brl(e.valor_anterior)} → ${brl(e.valor_posterior)}`,
              `${fmtDate(e.vigencia_anterior)} → ${fmtDate(e.vigencia_posterior)}`, e.sei_documento])} />
        </Secao>

        <Secao titulo="Ocorrências">
          <Tabela cols={['Data', 'Tipo', 'Descrição', 'Status']}
            rows={k.b.ocorrencias.filter((o) => !o.cancelado).map((o) => [fmtDate(o.data), TIPO_OCORRENCIA[o.tipo],
              o.descricao, STATUS_OCORRENCIA[o.status].label])} />
        </Secao>

        <Secao titulo="Documentos no SEI">
          <Tabela cols={['Documento', 'Nº SEI', 'Data', 'Origem']}
            rows={documentosReferenciados(k).map((d) => [d.tipo, d.sei, fmtDate(d.data), d.origem])} />
        </Secao>
      </div>
    </div>
  )
}


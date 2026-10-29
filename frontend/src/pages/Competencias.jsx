import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGc } from '../context/GcContext'
import { Card, Distribuicao, GcGate, PageHeader } from '../components/gc/ui'
import CompetenciasTable from '../components/gc/CompetenciasTable'
import RegistrarNFModal from '../components/gc/RegistrarNFModal'
import { useGcActions } from '../components/gc/useGcActions'
import { ETAPAS_COMPETENCIA, SITUACOES_OPERACIONAIS, competenciasFaltantes, fiscalPodeOperar, minhaVez } from '../utils/contrato'
import { fmtCompetencia, mesAtualISO } from '../utils/format'
import { salvarVarios } from '../services/gc'
import { showConfirm, showError, showSuccess } from '../utils/alerts'
import { isMaster } from '../utils/permissions'

const ROTULO_CURTO = {
  aguardando_nf: 'Aguardando NF', aguardando_fiscalizacao: 'Em fiscalização', aguardando_atesto: 'Aguardando atesto',
  conferencia_gestao: 'Conferência da Gestão', em_liquidacao: 'Liquidação', aguardando_pagamento: 'Pagamento',
  concluida: 'Pagas', suspensa: 'Suspensas',
}
const COR_ETAPA = {
  aguardando_nf: 'var(--neutro)', aguardando_fiscalizacao: 'color-mix(in srgb, var(--azul) 50%, var(--folha))',
  aguardando_atesto: 'var(--azul)', conferencia_gestao: 'var(--ocre)',
  em_liquidacao: 'color-mix(in srgb, var(--verde) 55%, var(--folha))', aguardando_pagamento: 'var(--verde)',
  concluida: 'var(--traco-forte)', suspensa: 'var(--vermelho)',
}

export default function Competencias() {
  const { consolidados, reload } = useGc()
  const { role, can, user } = useGcActions()
  const papelComFila = ['gestor', 'fiscal', 'financeiro'].includes(role)
  const [sp] = useSearchParams()
  const [registrarNF, setRegistrarNF] = useState(() => sp.get('nf') === '1')
  const minhasContratacoes = useMemo(
    () => (can('competencia.fiscal') ? consolidados.filter((k) => fiscalPodeOperar(k, user?.id)) : []),
    [consolidados, can, user],
  )

  // vindo de um link com etapa, mostra a etapa inteira (não só a minha vez)
  const [soMinhaVez, setSoMinhaVez] = useState(() => papelComFila && !sp.get('etapa'))
  const [etapa, setEtapa] = useState(() => sp.get('etapa') || '')
  const [mes, setMes] = useState('')
  const [busca, setBusca] = useState('')
  const [incluirConcluidas, setIncluirConcluidas] = useState(false)

  const todas = useMemo(
    () => consolidados.flatMap((k) => k.competencias.map((comp) => ({ k, comp }))),
    [consolidados],
  )

  const meses = useMemo(
    () => [...new Set(todas.map((r) => r.comp.competencia))].sort().reverse(),
    [todas],
  )

  const contagem = useMemo(() => {
    const m = {}
    for (const { comp } of todas) m[comp.status.key] = (m[comp.status.key] || 0) + 1
    return m
  }, [todas])

  const rows = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return todas
      .filter(({ k, comp }) => {
        if (!incluirConcluidas && !etapa && ['concluida', 'cancelada'].includes(comp.status.key)) return false
        if (etapa && comp.status.key !== etapa) return false
        if (mes && comp.competencia !== mes) return false
        if (q && !`${k.c.numero} ${k.c.contratada}`.toLowerCase().includes(q)) return false
        if (soMinhaVez && !isMaster(role) && !minhaVez(k, comp, role, user?.id)) return false
        return true
      })
      .sort((a, b) => String(a.comp.competencia).localeCompare(String(b.comp.competencia))
        || String(a.k.c.numero).localeCompare(String(b.k.c.numero), 'pt-BR', { numeric: true }))
  }, [todas, etapa, mes, busca, soMinhaVez, incluirConcluidas, role, user])

  // contratos com OS vigente que ainda não têm a competência do mês aberta
  const pendentesAbrir = useMemo(() => {
    const mesAtual = mesAtualISO()
    return consolidados
      .filter((k) => SITUACOES_OPERACIONAIS.includes(k.c.situacao) && k.osVigente)
      .map((k) => ({ k, faltam: competenciasFaltantes(k) }))
      .filter((x) => x.faltam.includes(mesAtual))
  }, [consolidados])

  async function abrirDoMes() {
    const mesAtual = mesAtualISO()
    const ok = await showConfirm(
      'Abrir competências do mês',
      `Abrir ${fmtCompetencia(mesAtual)} para ${pendentesAbrir.length} contrato(s) com OS vigente?`,
    )
    if (!ok) return
    try {
      await salvarVarios('competencias', pendentesAbrir.map(({ k }) => ({
        contrato_id: k.id, competencia: mesAtual, fiscal_nome: k.fiscalEmAtuacao?.nome || k.nomeFiscal,
      })))
      await reload()
      showSuccess('Competências abertas')
    } catch (err) {
      showError(err.message)
    }
  }

  return (
    <GcGate>
      <PageHeader
        title="Competências"
        subtitle="Acompanhamento mensal — da NF recebida pelo fiscal ao pagamento."
        actions={(
          <>
            {minhasContratacoes.length > 0 && (
              <button className="btn btn-primary" onClick={() => setRegistrarNF(true)}>
                <i className="bi bi-receipt me-2" />Registrar NF
              </button>
            )}
            {can('competencia.liberar') && pendentesAbrir.length > 0 && (
              <button className="btn btn-outline-primary" onClick={abrirDoMes}>
                <i className="bi bi-calendar-plus me-2" />Abrir {fmtCompetencia(mesAtualISO())} ({pendentesAbrir.length})
              </button>
            )}
          </>
        )}
      />
      {registrarNF && minhasContratacoes.length > 0 && <RegistrarNFModal contratacoes={minhasContratacoes} onClose={() => setRegistrarNF(false)} />}

      <Card title="Onde estão as competências" subtitle="Clique numa etapa para filtrar a lista">
        <Distribuicao
          vazio="Nenhuma competência aberta."
          itens={ETAPAS_COMPETENCIA
            .filter(([key]) => key !== 'suspensa' || contagem[key])
            .map(([key, label]) => ({
              key, label: ROTULO_CURTO[key] || label, value: contagem[key] || 0, cor: COR_ETAPA[key],
              ativo: etapa === key, onClick: () => setEtapa(etapa === key ? '' : key),
            }))}
        />
      </Card>

      <div className="card">
        <div className="barra-lista">
          {papelComFila && (
            <div className="segmentos" role="tablist" aria-label="Quais competências">
              <button type="button" role="tab" aria-selected={soMinhaVez} className={`segmento ${soMinhaVez ? 'ativo' : ''}`} onClick={() => setSoMinhaVez(true)}>Minha vez</button>
              <button type="button" role="tab" aria-selected={!soMinhaVez} className={`segmento ${!soMinhaVez ? 'ativo' : ''}`} onClick={() => setSoMinhaVez(false)}>Todas</button>
            </div>
          )}
          <div className="barra-lista__busca">
            <i className="bi bi-search" aria-hidden="true" />
            <input className="form-control" placeholder="Contratação ou contratada" aria-label="Buscar competência"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className="form-select w-auto" aria-label="Mês" value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Todos os meses</option>
            {meses.map((m) => <option key={m} value={m}>{fmtCompetencia(m)}</option>)}
          </select>
          <div className="form-check mb-0">
            <input id="conc" type="checkbox" className="form-check-input" checked={incluirConcluidas}
              onChange={(e) => setIncluirConcluidas(e.target.checked)} />
            <label htmlFor="conc" className="form-check-label small">Incluir pagas</label>
          </div>
        </div>
        {etapa && (
          <div className="filter-chips px-3 pt-2 mb-0">
            <span className="chip">
              <span className="chip-key">Etapa</span>
              <span className="chip-val">{ROTULO_CURTO[etapa] || etapa}</span>
              <button type="button" className="chip-close" aria-label="Remover filtro de etapa" onClick={() => setEtapa('')}><i className="bi bi-x" /></button>
            </span>
          </div>
        )}
        <CompetenciasTable
          rows={rows}
          vazio={soMinhaVez ? 'Nada pendente para você agora.' : 'Nenhuma competência com os filtros atuais.'}
        />
      </div>
    </GcGate>
  )
}

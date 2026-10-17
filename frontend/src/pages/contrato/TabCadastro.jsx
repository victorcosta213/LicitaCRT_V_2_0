import { useEffect, useState } from 'react'
import { Card, DefList, Empty, Pill, SeiRef } from '../../components/gc/ui'
import FormModal from '../../components/gc/FormModal'
import { PortariaCard, TermoCard } from '../../components/gc/Formalizacao'
import { useGcActions } from '../../components/gc/useGcActions'
import { useGc } from '../../context/GcContext'
import { listarUsuarios } from '../../services/users'
import { INSTRUMENTO, PAPEL_RESPONSAVEL } from '../../utils/contrato'
import { brl, fmtCnpj, fmtDate } from '../../utils/format'
import { normalizeRole } from '../../utils/permissions'
import { pedirTexto, showError, showSuccess } from '../../utils/alerts'
import { contratoFields, validarContrato } from './contratoForm'

export default function TabCadastro({ k, editarAberto, onFecharEditar }) {
  const { salvar, executar, can, role, user } = useGcActions()
  const { params } = useGc()
  const [editando, setEditando] = useState(false)
  const [resp, setResp] = useState(null) // { row? }
  const [usuarios, setUsuarios] = useState([])
  const c = k.c
  const podeResp = can('responsaveis.editar')

  useEffect(() => {
    if (podeResp) listarUsuarios().then(setUsuarios).catch(() => setUsuarios([]))
  }, [podeResp])

  useEffect(() => { if (editarAberto) setEditando(true) }, [editarAberto])

  // Compras altera só até encaminhar à Gestão (regra também do banco)
  const bloqueadoParaCompras = normalizeRole(role) === 'compras' && (c.validado_gestao || !!c.encaminhado_em)
  const podeEditar = can('contrato.editar') && !bloqueadoParaCompras
  const souFiscalDaContratacao = k.b.responsaveis.some((r) => r.ativo && r.usuario_id === user?.id
    && ['fiscal_tecnico', 'fiscal_substituto'].includes(r.papel))
  const podeAlternar = can('substituto.alternar') && !!k.fiscalSubstituto
    && (normalizeRole(role) !== 'fiscal' || souFiscalDaContratacao)

  const fechar = () => { setEditando(false); onFecharEditar?.() }

  async function salvarContrato(v) {
    validarContrato(v)
    await salvar('contratos', v, c.id)
  }

  async function salvarResp(v) {
    const u = usuarios.find((x) => x.id === v.usuario_id)
    const nome = v.nome || u?.nome
    if (!nome) throw new Error('Informe o nome ou selecione um usuário do sistema.')
    await salvar('responsaveis', {
      ...v, nome, email: v.email || u?.email || null, contrato_id: c.id,
    }, resp?.row?.id)
  }

  async function desativar(r) {
    const motivo = await pedirTexto(`Desativar ${PAPEL_RESPONSAVEL[r.papel]}`, `${r.nome} deixará de atuar nesta contratação.`)
    if (!motivo) return
    try {
      await salvar('responsaveis', { ativo: false, cancelamento_motivo: motivo }, r.id)
    } catch (err) {
      showError(err.message)
    }
  }

  async function alternarSubstituto() {
    const ativar = !c.substituto_em_atuacao
    try {
      await executar('gc_definir_substituto_em_atuacao', { p_contrato: c.id, p_ativo: ativar })
      showSuccess(ativar ? 'Fiscal substituto em atuação' : 'Fiscal titular reassumiu')
    } catch (err) {
      showError(err.message)
    }
  }

  const ativos = k.b.responsaveis.filter((r) => r.ativo)

  return (
    <>
      <Card
        title="Identificação"
        actions={podeEditar && (
          <button className="btn btn-sm btn-outline-primary" onClick={() => setEditando(true)}>
            <i className="bi bi-pencil me-1" />Editar cadastro
          </button>
        )}
      >
        {bloqueadoParaCompras && (
          <div className="alert alert-light border small">
            Contratação encaminhada à Gestão — Compras mantém apenas a consulta.
          </div>
        )}
        <DefList items={[
          ['Instrumento', `${INSTRUMENTO[c.instrumento] || 'Contrato'} nº ${c.numero}`],
          ['Processo SEI', <SeiRef key="p" processo={c.sei_processo} link={c.sei_link} />],
          ['Contratada', c.contratada],
          ['CNPJ', fmtCnpj(c.cnpj)],
          ['Endereço', c.contratada_endereco],
          ['Representante/preposto', c.contratada_representante],
          ['E-mail da contratada', c.contratada_email],
          ['Modalidade', c.modalidade],
          ['Nº licitação/contratação', c.numero_licitacao],
          ['Unidade demandante', c.unidade_demandante],
          ['Responsável em Compras', c.responsavel_contratacao],
          ['Encaminhada à Gestão', c.encaminhado_em ? fmtDate(c.encaminhado_em) : 'Não'],
          ['Objeto', c.objeto],
        ]} />
      </Card>

      <div className="row g-3">
        <div className="col-lg-6">
          <Card title="Vigência / prazo" className="h-100">
            <DefList cols={2} items={[
              ['Assinatura/emissão', fmtDate(c.data_assinatura)],
              ['Início', fmtDate(c.vigencia_inicio)],
              ['Fim (cadastro)', fmtDate(c.vigencia_fim)],
              ['Fim vigente', fmtDate(k.vigenciaFim)],
              ['Prazo de execução', c.prazo_execucao_dias ? `${c.prazo_execucao_dias} dias` : null],
              ['Prorrogável', c.prorrogavel ? `Sim${c.limite_prorrogacao ? ` · até ${fmtDate(c.limite_prorrogacao)}` : ''}` : 'Não'],
            ]} />
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Valores" className="h-100">
            <DefList cols={2} items={[
              ['Valor da contratação', brl(c.valor_inicial)],
              ['Valor atualizado', brl(k.valorAtualizado)],
              ['Valor anual estimado', c.valor_anual_estimado ? brl(c.valor_anual_estimado) : null],
              ['Nota de empenho (Compras)', c.empenho_referencia],
              ['Forma de pagamento', c.forma_pagamento],
              ['Índice / data-base de reajuste', c.indice_reajuste ? `${c.indice_reajuste} · ${fmtDate(c.data_base_reajuste)}` : fmtDate(c.data_base_reajuste)],
            ]} />
          </Card>
        </div>
        <div className="col-12">
          <Card title="Garantia">
            {c.exige_garantia ? (
              <DefList cols={3} items={[
                ['Modalidade', c.garantia_modalidade],
                ['Valor', c.garantia_valor ? brl(c.garantia_valor) : null],
                ['Início', fmtDate(c.garantia_inicio)],
                ['Vencimento', fmtDate(c.garantia_vencimento)],
                ['Situação', c.garantia_situacao],
              ]} />
            ) : <span className="text-secondary">Contratação sem exigência de garantia.</span>}
          </Card>
        </div>
      </div>

      <Card
        title="Gestão e fiscalização"
        flush
        actions={(
          <>
            {podeAlternar && (
              <button className={`btn btn-sm ${c.substituto_em_atuacao ? 'btn-warning' : 'btn-outline-warning'}`} onClick={alternarSubstituto}>
                <i className="bi bi-arrow-left-right me-1" />
                {c.substituto_em_atuacao ? 'Titular reassume' : 'Fiscal substituto em atuação'}
              </button>
            )}
            {podeResp && (
              <button className="btn btn-sm btn-outline-primary" onClick={() => setResp({})}>
                <i className="bi bi-person-plus me-1" />Designar
              </button>
            )}
          </>
        )}
      >
        {c.substituto_em_atuacao && (
          <div className="alert alert-warning small m-3 mb-0">
            Fiscal substituto em atuação desde {fmtDate(c.substituto_desde)}: as tarefas do fiscal estão com {k.fiscalEmAtuacao?.nome}.
          </div>
        )}
        {ativos.length === 0 ? (
          <Empty>Nenhum gestor/fiscal designado. Designe o fiscal titular e o fiscal substituto.</Empty>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 gc-table">
              <thead className="table-light">
                <tr><th className="ps-3">Papel</th><th>Nome</th><th>E-mail</th><th>Acesso</th><th>Ciência</th><th>SEI</th><th /></tr>
              </thead>
              <tbody>
                {ativos.map((r) => (
                  <tr key={r.id}>
                    <td className="ps-3">
                      <Pill kind={r.papel.startsWith('gestor') ? 'primary' : 'info'}>{PAPEL_RESPONSAVEL[r.papel]}</Pill>
                      {k.fiscalEmAtuacao?.id === r.id && <div className="small text-success mt-1">em atuação</div>}
                    </td>
                    <td className="fw-semibold">{r.nome}</td>
                    <td>{r.email || '—'}</td>
                    <td>{r.usuario_id ? <i className="bi bi-check-circle text-success" title="Tem usuário: vê a contratação em Minhas fiscalizações" /> : <span className="text-secondary small">sem usuário</span>}</td>
                    <td className="small">{r.ciente_em ? fmtDate(r.ciente_em) : '—'}</td>
                    <td><SeiRef documento={r.sei_documento} /></td>
                    <td className="text-end pe-3 text-nowrap">
                      {podeResp && (
                        <>
                          <button className="btn btn-sm btn-light me-1" onClick={() => setResp({ row: r })}><i className="bi bi-pencil" /></button>
                          <button className="btn btn-sm btn-light text-danger" title="Desativar" onClick={() => desativar(r)}><i className="bi bi-person-dash" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {c.validado_gestao && (
        <div className="row g-3">
          <div className="col-lg-6"><PortariaCard k={k} /></div>
          <div className="col-lg-6"><TermoCard k={k} /></div>
        </div>
      )}

      {editando && (
        <FormModal
          title={`Editar cadastro — ${c.numero}`}
          size="xl"
          fields={contratoFields(params, { gestao: can('contrato.situacao') })}
          initial={c}
          onSubmit={salvarContrato}
          onClose={fechar}
        />
      )}

      {resp && (
        <FormModal
          title={resp.row ? 'Editar designação' : 'Designar gestor(a) / fiscal'}
          fields={[
            {
              name: 'papel', label: 'Papel', type: 'select', col: 6, required: true,
              options: Object.entries(PAPEL_RESPONSAVEL).map(([value, label]) => ({ value, label })),
            },
            {
              name: 'usuario_id', label: 'Servidor (cadastro de usuários)', type: 'select', col: 6,
              options: usuarios.filter((u) => u.ativo !== false).map((u) => ({ value: u.id, label: `${u.nome || u.email} — ${u.role}` })),
              help: 'Com o usuário vinculado, a contratação aparece em "Minhas fiscalizações".',
            },
            { name: 'nome', label: 'Nome', col: 6 },
            { name: 'email', label: 'E-mail institucional', type: 'email', col: 6, help: 'Usado na orientação de envio da NF.' },
            { name: 'sei_documento', label: 'Documento SEI da designação', col: 6 },
          ]}
          initial={resp.row || { papel: k.fiscalTitular ? 'fiscal_substituto' : 'fiscal_tecnico' }}
          onSubmit={salvarResp}
          onClose={() => setResp(null)}
        />
      )}
    </>
  )
}

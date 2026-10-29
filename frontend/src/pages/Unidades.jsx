import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, Empty, PageHeader, Pill } from '../components/gc/ui'
import FormModal from '../components/gc/FormModal'
import { useAtualizacaoAutomatica } from '../components/useAtualizacao'
import { AvisoTramitacaoAusente } from './Processos'
import { atualizarUnidade, criarUnidade, listarUnidades, mensagemErroTramitacao } from '../services/tramitacao'
import { listarUsuarios } from '../services/users'
import { tabelaAusente } from '../services/gc'
import { showError, showSuccess } from '../utils/alerts'

const CAMPOS_NOVA = [
  { name: 'sigla', label: 'Sigla', type: 'text', required: true, col: 4, placeholder: 'Ex.: OUV', help: 'Curta, em maiúsculas. Aparece nas listas.' },
  { name: 'nome', label: 'Nome da unidade', type: 'text', required: true, col: 8, placeholder: 'Ex.: Ouvidoria' },
]
const CAMPOS_EDITAR = [
  { name: 'sigla', label: 'Sigla', type: 'text', col: 4, readOnly: true, help: 'A sigla não muda depois de criada.' },
  { name: 'nome', label: 'Nome da unidade', type: 'text', required: true, col: 8 },
]

// Administração: as unidades (setores) por onde os processos tramitam
export default function Unidades() {
  const [d, setD] = useState({ carregando: true, unidades: [], pessoas: new Map(), erro: null, ausente: false })
  const [modal, setModal] = useState(null) // 'nova' | unidade em edição
  const vivo = useRef(true)

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      const [unidades, usuarios] = await Promise.all([listarUnidades(), listarUsuarios().catch(() => [])])
      const pessoas = new Map()
      for (const u of usuarios) if (u.ativo && u.unidade_id) pessoas.set(u.unidade_id, (pessoas.get(u.unidade_id) || 0) + 1)
      if (vivo.current) setD({ carregando: false, unidades, pessoas, erro: null, ausente: false })
    } catch (err) {
      if (vivo.current && !silencioso) setD((s) => ({ ...s, carregando: false, ausente: tabelaAusente(err), erro: err?.message || 'Não foi possível carregar as unidades.' }))
    }
  }, [])
  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])
  useAtualizacaoAutomatica(['tr_unidades', 'usuarios'], () => carregar({ silencioso: true }))

  async function alternar(u) {
    try {
      await atualizarUnidade(u.id, { ativa: !u.ativa })
      showSuccess(u.ativa ? `${u.sigla} desativada: não recebe novos processos.` : `${u.sigla} reativada.`)
      await carregar({ silencioso: true })
    } catch (err) {
      showError(mensagemErroTramitacao(err))
    }
  }

  return (
    <>
      <PageHeader
        title="Unidades"
        subtitle="Os setores por onde os processos tramitam. Cada pessoa é ligada a uma unidade em Usuários e perfis."
        actions={<button className="btn btn-primary" onClick={() => setModal('nova')}><i className="bi bi-plus-lg me-2" />Nova unidade</button>}
      />

      {d.ausente && <AvisoTramitacaoAusente />}
      {!d.ausente && d.erro && <div className="alert alert-danger">{d.erro}</div>}
      {!d.ausente && !d.erro && (
        <Card flush>
          {d.carregando ? <p className="p-3 mb-0 text-secondary">Carregando…</p> : d.unidades.length === 0 ? (
            <div className="p-3"><Empty icon="bi-diagram-2">Nenhuma unidade cadastrada.</Empty></div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle gc-table mb-0">
                <thead><tr><th>Sigla</th><th>Nome</th><th>Pessoas</th><th>Situação</th><th className="text-end">Ações</th></tr></thead>
                <tbody>
                  {d.unidades.map((u) => (
                    <tr key={u.id}>
                      <td className="mono fw-semibold">{u.sigla}</td>
                      <td>{u.nome}</td>
                      <td className="num">{d.pessoas.get(u.id) || 0}</td>
                      <td><Pill kind={u.ativa ? 'success' : 'secondary'}>{u.ativa ? 'Ativa' : 'Inativa'}</Pill></td>
                      <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => setModal(u)} aria-label={`Editar ${u.sigla}`} title="Editar"><i className="bi bi-pencil" /></button>
                        <button className={`btn btn-sm ${u.ativa ? 'btn-outline-warning' : 'btn-outline-success'}`} onClick={() => alternar(u)}
                          aria-label={`${u.ativa ? 'Desativar' : 'Reativar'} ${u.sigla}`} title={u.ativa ? 'Desativar' : 'Reativar'}>
                          <i className={`bi ${u.ativa ? 'bi-pause-circle' : 'bi-play-circle'}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {modal === 'nova' && (
        <FormModal title="Nova unidade" size="md" fields={CAMPOS_NOVA} submitLabel="Criar unidade" onClose={() => setModal(null)}
          onSubmit={async (v) => { await criarUnidade(v).catch((e) => { throw new Error(mensagemErroTramitacao(e)) }); await carregar({ silencioso: true }) }} />
      )}
      {modal && modal !== 'nova' && (
        <FormModal title={`Editar ${modal.sigla}`} size="md" fields={CAMPOS_EDITAR} initial={modal} onClose={() => setModal(null)}
          onSubmit={async (v) => { await atualizarUnidade(modal.id, { nome: v.nome.trim() }); await carregar({ silencioso: true }) }} />
      )}
    </>
  )
}

import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Empty, PageHeader, Pill } from '../components/gc/ui'
import FormModal from '../components/gc/FormModal'
import { useCatalogoItens } from '../components/compras/useCatalogoItens'
import { OBJETOS, rotuloDo } from '../modelos/variantes'
import { ativarItem, atualizarItem, criarItem, mensagemErroItem } from '../services/itens'
import { isMaster, normalizeRole } from '../utils/permissions'
import { brl } from '../utils/format'
import { showError, showSuccess } from '../utils/alerts'
import './compras.css'

const CAMPOS = [
  { name: 'nome', label: 'Nome do item', type: 'text', required: true, col: 8, placeholder: 'Ex.: Computador desktop' },
  { name: 'codigo', label: 'Código (interno ou CATMAT/CATSER)', type: 'text', col: 4 },
  { name: 'especificacao', label: 'Especificação técnica', type: 'textarea', required: true, col: 12, help: 'Descreva sem indicar marca: é o texto que vai para a DFD, o ETP e o TR.' },
  { name: 'unidade_medida', label: 'Unidade de medida', type: 'text', required: true, col: 4, placeholder: 'unidade, caixa, mês, m²…' },
  { name: 'categoria', label: 'Categoria', type: 'text', col: 4, placeholder: 'Informática, mobiliário…' },
  { name: 'objeto_tipo', label: 'Tipo de objeto', type: 'select', col: 4, options: OBJETOS.map((o) => ({ value: o.valor, label: o.rotulo })) },
  { name: 'valor_referencia', label: 'Valor de referência (R$)', type: 'money', col: 4, help: 'Opcional: serve de estimativa preliminar na DFD.' },
]

// Catálogo de itens: a administração cadastra; quem faz a DFD escolhe daqui e informa só a quantidade
export default function CatalogoItens() {
  const { role } = useAuth()
  const admin = isMaster(normalizeRole(role))
  const { carregando, erro, ausente, itens } = useCatalogoItens()
  const [busca, setBusca] = useState('')
  const [inativos, setInativos] = useState(false)
  const [editando, setEditando] = useState(null) // {} = novo

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens.filter((i) => (inativos || i.ativo)
      && (!q || [i.nome, i.codigo, i.especificacao, i.categoria].some((v) => String(v || '').toLowerCase().includes(q))))
  }, [itens, busca, inativos])

  async function salvar(v) {
    try {
      if (editando?.id) await atualizarItem(editando.id, v); else await criarItem(v)
      showSuccess(editando?.id ? 'Item atualizado.' : 'Item cadastrado.')
    } catch (err) { throw new Error(mensagemErroItem(err)) }
  }
  async function alternar(i) {
    try {
      await ativarItem(i.id, !i.ativo)
      showSuccess(i.ativo ? 'Item desativado: não aparece mais nas novas DFDs.' : 'Item reativado.')
    } catch (err) { showError(mensagemErroItem(err)) }
  }

  return (
    <>
      <PageHeader
        title="Catálogo de itens"
        subtitle={admin
          ? 'Cadastre os itens com a especificação. Na DFD, o secretário escolhe daqui e informa só a quantidade.'
          : 'Itens que podem ser pedidos na DFD, com a especificação padronizada. O cadastro é feito pela administração.'}
        actions={admin && <button type="button" className="btn btn-primary" onClick={() => setEditando({})}><i className="bi bi-plus-lg me-2" />Novo item</button>}
      />
      {ausente && <div className="alert alert-warning">O catálogo ainda não foi ativado. Aplique a migration <code>20261026_fluxo_secretarias.sql</code>.</div>}
      {!ausente && erro && <div className="alert alert-danger">Não foi possível carregar o catálogo: {erro}</div>}
      {!ausente && !erro && (
        <div className="card">
          <div className="barra-lista">
            <div className="barra-lista__busca">
              <i className="bi bi-search" aria-hidden="true" />
              <input className="form-control" placeholder="Nome, código, especificação ou categoria" aria-label="Buscar itens" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="form-check form-switch">
              <input className="form-check-input" type="checkbox" id="itens-inativos" checked={inativos} onChange={(e) => setInativos(e.target.checked)} />
              <label className="form-check-label small" htmlFor="itens-inativos">Mostrar desativados</label>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table align-middle gc-table">
              <thead><tr><th>Item</th><th>Unidade</th><th>Tipo</th><th className="text-end">Referência</th>{admin && <th aria-label="Ações" />}</tr></thead>
              <tbody>
                {carregando && <tr><td colSpan={admin ? 5 : 4} className="text-center py-4 text-secondary">Carregando…</td></tr>}
                {!carregando && lista.length === 0 && (
                  <tr><td colSpan={admin ? 5 : 4}><Empty icon="bi-box-seam">{itens.length ? 'Nenhum item encontrado.' : 'O catálogo está vazio.'}</Empty></td></tr>
                )}
                {lista.map((i) => (
                  <tr key={i.id} className={i.ativo ? '' : 'text-secondary'}>
                    <td style={{ maxWidth: 520 }}>
                      <div className="fw-semibold">{i.nome} {i.codigo && <span className="mono small text-secondary">{i.codigo}</span>} {!i.ativo && <Pill kind="secondary">Desativado</Pill>}</div>
                      <div className="small text-secondary">{i.especificacao}</div>
                      {i.categoria && <div className="small">{i.categoria}</div>}
                    </td>
                    <td className="small">{i.unidade_medida}</td>
                    <td className="small">{i.objeto_tipo ? rotuloDo(OBJETOS, i.objeto_tipo) : '—'}</td>
                    <td className="small text-end">{i.valor_referencia != null ? brl(i.valor_referencia) : '—'}</td>
                    {admin && (
                      <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => setEditando(i)} aria-label={`Editar ${i.nome}`}><i className="bi bi-pencil" /></button>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => alternar(i)}>{i.ativo ? 'Desativar' : 'Reativar'}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 small text-secondary border-top">{lista.length} de {itens.length} item(ns)</div>
        </div>
      )}
      {editando && (
        <FormModal title={editando.id ? 'Editar item' : 'Novo item do catálogo'} fields={CAMPOS} initial={editando} onSubmit={salvar} onClose={() => setEditando(null)}>
          {editando.id && <div className="alert alert-info py-2 small">As DFDs já feitas guardam o item como estava; a mudança vale para as próximas.</div>}
        </FormModal>
      )}
    </>
  )
}

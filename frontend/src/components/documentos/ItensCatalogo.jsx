import { useMemo, useState } from 'react'
import { useCatalogoItens } from '../compras/useCatalogoItens'
import { linhaDoItem } from '../../services/itens'
import { dinheiro, totalItens } from '../../modelos/base'

// Itens da DFD: procura no catálogo, adiciona (a especificação vem pronta) e informa a quantidade.
// Cada linha guarda uma cópia do item: mudanças posteriores no catálogo não alteram a DFD já feita.
export default function ItensCatalogo({ campo, linhas, onChange, disabled }) {
  const { carregando, ausente, itens } = useCatalogoItens()
  const [busca, setBusca] = useState('')
  const lista = linhas || []
  const escolhidos = new Set(lista.map((l) => l.item_id))

  const achados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return []
    return itens.filter((i) => i.ativo && !escolhidos.has(i.id)
      && [i.nome, i.codigo, i.especificacao, i.categoria].some((v) => String(v || '').toLowerCase().includes(q))).slice(0, 8)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, busca, lista])

  const adicionar = (item) => { onChange([...lista, linhaDoItem(item)]); setBusca('') }
  const alterar = (i, quantidade) => onChange(lista.map((l, j) => (j === i ? { ...l, quantidade } : l)))
  const remover = (i) => onChange(lista.filter((_, j) => j !== i))
  const total = totalItens(lista)

  return (
    <div className="itens-catalogo">
      {ausente && <div className="alert alert-warning py-2 small">O catálogo de itens ainda não foi ativado no banco de dados.</div>}
      {!ausente && !carregando && itens.length === 0 && (
        <div className="alert alert-info py-2 small">O catálogo está vazio. Peça à administração para cadastrar os itens (Administração → Catálogo de itens).</div>
      )}
      {!disabled && itens.length > 0 && (
        <div className="itens-catalogo__busca mb-2">
          <label htmlFor={`doc-${campo.nome}-busca`} className="visually-hidden">Procurar item no catálogo</label>
          <input id={`doc-${campo.nome}-busca`} className="form-control" placeholder="Procure no catálogo: nome, código ou especificação"
            value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
          {busca.trim() && (
            <ul className="itens-catalogo__achados" role="listbox" aria-label="Itens encontrados">
              {achados.length === 0 && <li className="text-secondary small px-3 py-2">Nenhum item encontrado no catálogo.</li>}
              {achados.map((i) => (
                <li key={i.id}>
                  <button type="button" role="option" aria-selected="false" onClick={() => adicionar(i)}>
                    <strong>{i.nome}</strong>{i.codigo && <span className="mono small text-secondary"> {i.codigo}</span>}
                    <span className="d-block small text-secondary text-truncate">{i.especificacao}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {lista.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-1" aria-label="Itens da demanda">
            <thead><tr><th>Item</th><th style={{ width: 110 }}>Quantidade</th><th className="text-end">Total estimado</th><th aria-label="Remover" /></tr></thead>
            <tbody>
              {lista.map((l, i) => (
                <tr key={`${l.item_id}-${i}`}>
                  <td>
                    <div className="fw-semibold">{l.nome}</div>
                    <div className="small text-secondary">{l.especificacao}</div>
                    <div className="small text-secondary">Unidade: {l.unidade}{Number(l.valor_unitario) > 0 ? ` · ${dinheiro(l.valor_unitario)} cada` : ''}</div>
                  </td>
                  <td>
                    <input className="form-control" type="number" min="1" step="1" value={l.quantidade ?? ''} disabled={disabled}
                      aria-label={`Quantidade de ${l.nome}`} onChange={(e) => alterar(i, e.target.value)} />
                  </td>
                  <td className="text-end small">{Number(l.valor_unitario) > 0 && Number(l.quantidade) > 0 ? dinheiro(Number(l.quantidade) * Number(l.valor_unitario)) : '—'}</td>
                  <td className="text-end">
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => remover(i)} aria-label={`Remover ${l.nome}`}>
                      <i className="bi bi-x-lg" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 0 && <div className="small text-end"><strong>Estimativa preliminar: {dinheiro(total)}</strong></div>}
        </div>
      )}
    </div>
  )
}

// Formulário de um documento, montado a partir dos campos do modelo.
import ItensCatalogo from './ItensCatalogo'

const opcao = (o) => (typeof o === 'string' ? { valor: o, rotulo: o } : o)
const vazia = (colunas) => Object.fromEntries(colunas.map((c) => [c.nome, '']))

function Entrada({ id, tipo, valor, onChange, disabled, opcoes, linhas, rotulo }) {
  const comum = { id, 'aria-label': rotulo, disabled, value: valor ?? '', onChange: (e) => onChange(e.target.value) }
  if (tipo === 'texto-longo') return <textarea className="form-control" rows={linhas || 4} {...comum} />
  if (tipo === 'select') {
    return (
      <select className="form-select" {...comum}>
        <option value="">Selecione…</option>
        {(opcoes || []).map(opcao).map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    )
  }
  const type = tipo === 'data' ? 'date' : tipo === 'numero' || tipo === 'dinheiro' ? 'number' : 'text'
  return <input className="form-control" type={type} step={tipo === 'dinheiro' ? '0.01' : undefined} min={tipo === 'dinheiro' || tipo === 'numero' ? '0' : undefined} {...comum} />
}

function Linhas({ campo, linhas, onChange, disabled }) {
  const lista = linhas?.length ? linhas : [vazia(campo.colunas)]
  const alterar = (i, nome, v) => onChange(lista.map((l, j) => (j === i ? { ...l, [nome]: v } : l)))
  return (
    <div className="doc-linhas table-responsive">
      <table className="table table-sm align-middle mb-2">
        <thead><tr>{campo.colunas.map((c) => <th key={c.nome}>{c.rotulo}</th>)}<th aria-label="Remover" /></tr></thead>
        <tbody>
          {lista.map((l, i) => (
            <tr key={i}>
              {campo.colunas.map((c) => (
                <td key={c.nome}>
                  <Entrada id={`doc-${campo.nome}-${i}-${c.nome}`} tipo={c.tipo || 'texto'} opcoes={c.opcoes} valor={l[c.nome]} disabled={disabled}
                    rotulo={`${c.rotulo} (linha ${i + 1})`} onChange={(v) => alterar(i, c.nome, v)} />
                </td>
              ))}
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled || lista.length === 1}
                  onClick={() => onChange(lista.filter((_, j) => j !== i))} aria-label={`Remover linha ${i + 1} de ${campo.rotulo}`} title="Remover linha">
                  <i className="bi bi-x-lg" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm btn-outline-primary" disabled={disabled} onClick={() => onChange([...lista, vazia(campo.colunas)])}>
        <i className="bi bi-plus-lg me-1" />Adicionar linha
      </button>
    </div>
  )
}

export default function DocumentoForm({ modelo, valores, onChange, disabled }) {
  const definir = (nome, v) => onChange({ ...valores, [nome]: v })
  const secoes = modelo.secoes.filter((s) => !s.mostrar || s.mostrar(valores))
  return (
    <form className="doc-form" onSubmit={(e) => e.preventDefault()} aria-label={`Preenchimento: ${modelo.nome}`}>
      {secoes.map((s) => (
        <fieldset className="doc-form__secao" key={s.id} disabled={disabled}>
          {s.titulo && <legend>{s.titulo}</legend>}
          {s.campos.filter((c) => !c.mostrar || c.mostrar(valores)).map((c) => {
            const id = `doc-${c.nome}`
            return (
              <div className="mb-3" key={c.nome}>
                <label htmlFor={c.tipo === 'linhas' || c.tipo === 'itens' ? undefined : id} className="form-label fw-semibold">
                  {c.rotulo}{c.obrigatorio && <span className="text-danger" title="Obrigatório"> *</span>}
                </label>
                {c.tipo === 'itens' && <ItensCatalogo campo={c} linhas={valores[c.nome]} onChange={(v) => definir(c.nome, v)} disabled={disabled} />}
                {c.tipo === 'linhas' && <Linhas campo={c} linhas={valores[c.nome]} onChange={(v) => definir(c.nome, v)} disabled={disabled} />}
                {c.tipo !== 'linhas' && c.tipo !== 'itens' && <Entrada id={id} tipo={c.tipo} opcoes={c.opcoes} linhas={c.linhas} valor={valores[c.nome]} disabled={disabled} rotulo={c.rotulo} onChange={(v) => definir(c.nome, v)} />}
                {c.ajuda && <div className="form-text">{c.ajuda}</div>}
              </div>
            )
          })}
        </fieldset>
      ))}
    </form>
  )
}

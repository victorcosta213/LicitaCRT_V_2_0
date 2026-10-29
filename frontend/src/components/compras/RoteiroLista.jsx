import { Link } from 'react-router-dom'

// Roteiro de documentos da Lei 14.133/2021 (só leitura): o que cada etapa pede, a base legal e quem faz.
// `compacto` resume para caber num modal; `podeCriar` liga cada modelo ao "Novo documento".
export default function RoteiroLista({ roteiro, compacto = false, podeCriar = false }) {
  if (!roteiro) return null
  return (
    <div className={compacto ? 'roteiro roteiro--compacto' : 'roteiro'}>
      {roteiro.avisos.map((a) => (
        <div key={a} className="alert alert-warning py-2 small mb-2" role="note"><i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />{a}</div>
      ))}
      {roteiro.etapas.map((e, n) => (
        <section key={e.nome} className="roteiro__etapa" aria-label={e.nome}>
          <h3 className="grupo-titulo">{n + 1}. {e.nome}</h3>
          <ol className="roteiro__itens">
            {e.itens.map((i) => (
              <li key={i.chave} className="roteiro__item">
                <div className="roteiro__nome">
                  <strong>{i.nome}</strong>
                  {!i.obrigatorio && <span className="roteiro__se"> (se for o caso)</span>}
                </div>
                <div className="roteiro__meta small text-secondary">
                  <span className="mono">Lei 14.133/2021, {i.base}</span>
                  {!compacto && i.quem && <span> · Quem faz: {i.quem}</span>}
                  {!compacto && i.nota && <span> · {i.nota}</span>}
                </div>
                {!compacto && (
                  <div className="roteiro__como small">
                    {i.modeloDef
                      ? <><i className="bi bi-file-earmark-richtext me-1 text-primary" aria-hidden="true" />Feito na plataforma{podeCriar && <> · <Link to={`/documentos/novo?modelo=${i.modelo}`}>usar o modelo</Link></>}</>
                      : <><i className="bi bi-paperclip me-1 text-secondary" aria-hidden="true" />Juntado ao processo e registrado no roteiro</>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

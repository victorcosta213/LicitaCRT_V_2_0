import { COLUNAS_PLANILHA } from '../utils/importProcessos'
import { baixarModeloProcessos } from '../utils/modeloProcessos'
import { PHASES } from '../utils/phases'

// Explica como preparar a planilha de processos antes de escolher o arquivo.
export default function ImportarProcessosModal({ onEscolher, onClose }) {
  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-importar-processos">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="titulo-importar-processos">Importar processos de planilha</h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <p className="mb-3">
                Prepare uma planilha <strong>.xlsx, .xls ou .csv</strong> com uma linha por processo e os títulos de coluna abaixo na primeira linha.
                Só são obrigatórias <strong>duas colunas</strong>: o número e o nome do processo. Se faltar outra, o processo entra do mesmo jeito, com o campo em branco.
              </p>

              <div className="table-responsive mb-3">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr><th>Título da coluna</th><th>Preenchimento</th><th>O que informar</th><th>Exemplo</th></tr>
                  </thead>
                  <tbody>
                    {COLUNAS_PLANILHA.map((c) => (
                      <tr key={c.cabecalho}>
                        <td className="fw-semibold">{c.cabecalho}</td>
                        <td>{c.obrigatoria ? <span className="carimbo carimbo--danger">Obrigatória</span> : <span className="text-secondary">Opcional</span>}</td>
                        <td>{c.ajuda}</td>
                        <td className="mono small">{c.exemplo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="alert alert-light border mb-3">
                <strong>Regras da importação</strong>
                <ul className="mb-0 mt-1">
                  <li>O sistema lê só a <strong>primeira aba</strong> da planilha.</li>
                  <li>A ordem das colunas não importa. Acentos e letras maiúsculas ou minúsculas também não.</li>
                  <li>Pode haver um título acima do cabeçalho, até a 15ª linha.</li>
                  <li>Linhas sem número ou sem nome, e números que já existem no sistema ou se repetem na planilha, são <strong>ignoradas</strong>. Nada é sobrescrito.</li>
                  <li>Antes de gravar, o sistema mostra quantos processos serão importados e pede a sua confirmação.</li>
                </ul>
              </div>

              <details>
                <summary className="fw-semibold">Fases aceitas na coluna "Fase Atual" ({PHASES.length})</summary>
                <ol className="mt-2 mb-0 small">
                  {PHASES.map((p) => <li key={p.key}>{p.name}</li>)}
                </ol>
              </details>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary me-auto" onClick={baixarModeloProcessos}>
                <i className="bi bi-download me-2" />Baixar planilha modelo
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={onEscolher}>
                <i className="bi bi-upload me-2" />Escolher planilha
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

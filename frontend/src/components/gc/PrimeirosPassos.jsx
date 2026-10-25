import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { GUIA } from '../../utils/guia'
import { normalizeRole } from '../../utils/permissions'

const chave = (r) => `guia-aberto-${r}`
const lerAberto = (r) => {
  try { return localStorage.getItem(chave(r)) !== '0' } catch { return true }
}

// "Por onde começar": passos numerados do perfil, com um botão em cada um.
// Pode ser recolhido; a escolha fica guardada neste navegador.
export default function PrimeirosPassos() {
  const { role } = useAuth()
  const r = normalizeRole(role)
  const guia = GUIA[r]
  const [aberto, setAberto] = useState(() => lerAberto(r))
  if (!guia) return null

  const alternar = () => {
    const novo = !aberto
    setAberto(novo)
    try { localStorage.setItem(chave(r), novo ? '1' : '0') } catch { /* sem armazenamento: vale só nesta visita */ }
  }

  return (
    <section className="guia card mb-4" aria-label="Por onde começar">
      <div className="guia__cab">
        <div className="min-w-0">
          <h2 className="guia__titulo"><i className="bi bi-compass me-2" aria-hidden="true" />Por onde começar</h2>
          <p className="guia__resumo">{guia.resumo}</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={alternar} aria-expanded={aberto}>
          {aberto ? 'Ocultar guia' : 'Mostrar guia'}
        </button>
      </div>
      {aberto && (
        <>
          <ol className="guia__passos">
            {guia.passos.map((p) => (
              <li key={p.titulo} className="guia__passo">
                <span className="guia__num" aria-hidden="true" />
                <div className="guia__texto">
                  <strong>{p.titulo}</strong>
                  <span>{p.texto}</span>
                </div>
                <Link to={p.to} className="btn btn-sm btn-primary guia__acao">{p.acao}</Link>
              </li>
            ))}
          </ol>
          <div className="guia__rodape">
            <i className="bi bi-question-circle me-1" aria-hidden="true" />
            Dúvida sobre algum termo ou etapa? <Link to="/ajuda">Abra a Ajuda</Link>.
          </div>
        </>
      )}
    </section>
  )
}

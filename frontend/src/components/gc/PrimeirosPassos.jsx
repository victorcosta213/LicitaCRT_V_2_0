import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { GUIA, GUIA_LICITACAO } from '../../utils/guia'
import { normalizeRole } from '../../utils/permissions'

// a chave das contratações segue a antiga, para não reabrir o guia de quem já o ocultou
const chave = (r, tipo) => (tipo === 'licitacao' ? `guia-aberto-licitacao-${r}` : `guia-aberto-${r}`)
const lerAberto = (r, tipo) => {
  try { return localStorage.getItem(chave(r, tipo)) !== '0' } catch { return true }
}

// "Por onde começar": passos numerados do perfil, com um botão em cada um.
// Pode ser recolhido; a escolha fica guardada neste navegador.
// tipo: 'licitacao' mostra o guia dos processos licitatórios; sem tipo, o das contratações.
export default function PrimeirosPassos({ tipo }) {
  const { role } = useAuth()
  const r = normalizeRole(role)
  const guia = (tipo === 'licitacao' ? GUIA_LICITACAO : GUIA)[r]
  const [aberto, setAberto] = useState(() => lerAberto(r, tipo))
  if (!guia) return null

  const alternar = () => {
    const novo = !aberto
    setAberto(novo)
    try { localStorage.setItem(chave(r, tipo), novo ? '1' : '0') } catch { /* sem armazenamento: vale só nesta visita */ }
  }

  return (
    <section className="guia card mb-4" aria-label={tipo === 'licitacao' ? 'Por onde começar nas licitações' : 'Por onde começar'}>
      <div className="guia__cab">
        <div className="min-w-0">
          <h2 className="guia__titulo"><i className="bi bi-compass me-2" aria-hidden="true" />{tipo === 'licitacao' ? 'Por onde começar nas licitações' : 'Por onde começar'}</h2>
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

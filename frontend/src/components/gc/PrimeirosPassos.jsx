import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { GUIA, GUIA_DOCUMENTOS, GUIA_LICITACAO, GUIA_SOLICITACOES, GUIA_TRAMITACAO } from '../../utils/guia'
import { normalizeRole } from '../../utils/permissions'

// a chave das contratações segue a antiga, para não reabrir o guia de quem já o ocultou
const GUIAS = { licitacao: GUIA_LICITACAO, tramitacao: GUIA_TRAMITACAO, documentos: GUIA_DOCUMENTOS, solicitacoes: GUIA_SOLICITACOES }
const TITULOS = { licitacao: 'Por onde começar nas licitações', tramitacao: 'Como tramitar um processo', documentos: 'Como criar e assinar um documento', solicitacoes: 'Como funciona a solicitação ao Compras' }
const chave = (r, tipo) => (tipo ? `guia-aberto-${tipo}-${r}` : `guia-aberto-${r}`)
// sem escolha guardada, vale `padrao` (aberto para quem está começando)
const lerAberto = (r, tipo, padrao) => {
  try {
    const v = localStorage.getItem(chave(r, tipo))
    return v === null ? padrao : v !== '0'
  } catch { return padrao }
}

// "Por onde começar": passos numerados do perfil, com um botão em cada um.
// Pode ser recolhido; a escolha fica guardada neste navegador. `abertoPorPadrao` vale enquanto não houver escolha.
// tipo: 'licitacao' (processos licitatórios) ou 'tramitacao' (processos administrativos); sem tipo, o das contratações.
export default function PrimeirosPassos({ tipo, abertoPorPadrao = true }) {
  const { role } = useAuth()
  const r = normalizeRole(role)
  const guia = (GUIAS[tipo] || GUIA)[r]
  const titulo = TITULOS[tipo] || 'Por onde começar'
  const [aberto, setAberto] = useState(() => lerAberto(r, tipo, abertoPorPadrao))
  if (!guia) return null

  const alternar = () => {
    const novo = !aberto
    setAberto(novo)
    try { localStorage.setItem(chave(r, tipo), novo ? '1' : '0') } catch { /* sem armazenamento: vale só nesta visita */ }
  }

  return (
    <section className="guia card mb-4" aria-label={titulo}>
      <div className="guia__cab">
        <div className="min-w-0">
          <h2 className="guia__titulo"><i className="bi bi-compass me-2" aria-hidden="true" />{titulo}</h2>
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

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGc } from '../context/GcContext'
import { INSTRUMENTO } from '../utils/contrato'
import { ROLES, normalizeRole } from '../utils/permissions'

const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).filter(Boolean)
  .filter((p, i, arr) => i === 0 || i === arr.length - 1).map((p) => p[0]).join('').toUpperCase() || '?'

// Onde o sino leva: a mesa de quem tem tarefas; o Gabinete aos atos; os demais aos alertas
function destinoDoSino(role) {
  const r = normalizeRole(role)
  if (r === 'gabinete') return '/gabinete'
  if (r === 'viewer') return '/alertas'
  return '/mesa'
}

export default function Topbar({ nav, tema, alternarTema }) {
  const { user, profile, role, nome, logout } = useAuth()
  const { porId } = useGc() || {}
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const busca = useRef(null)
  const { modulo, item, contagens } = nav

  // "/" foca a busca (fora de campos de texto)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName)) return
      e.preventDefault()
      busca.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Busca global: abre Contratações já filtrado (nº, contratada, CNPJ, objeto, SEI)
  function submitSearch(e) {
    e?.preventDefault?.()
    const q = query.trim()
    navigate(q ? `/contratos?busca=${encodeURIComponent(q)}` : '/contratos')
    busca.current?.blur()
  }

  const ficha = pathname.match(/^\/contratos\/([^/]+)/)
  const k = ficha && porId ? porId.get(ficha[1]) : null
  const sino = destinoDoSino(role)
  const nSino = sino === '/gabinete' ? contagens.atos : contagens.tarefas
  const perfil = ROLES[normalizeRole(role)]?.label || ''

  return (
    <header className="topo">
      <button className="topo__icone topo__menu" data-bs-toggle="offcanvas" data-bs-target="#menuMovel" aria-label="Abrir menu">
        <i className="bi bi-list" />
      </button>

      <nav className="topo__trilha" aria-label="Você está em">
        {modulo && (
          <Link to={modulo.itens[0].to}>{modulo.label}</Link>
        )}
        {k ? (
          <>
            {item && item.label !== modulo?.label && (
              <>
                <i className="bi bi-chevron-right" aria-hidden="true" />
                <Link to="/contratos">{item.label}</Link>
              </>
            )}
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <strong>{INSTRUMENTO[k.c.instrumento] || 'Contrato'} {k.c.numero}</strong>
          </>
        ) : item && item.label !== modulo?.label && (
          <>
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <strong>{item.label}</strong>
          </>
        )}
      </nav>

      <form className="topo__busca" onSubmit={submitSearch} role="search">
        <i className="bi bi-search" aria-hidden="true" />
        <input
          ref={busca}
          placeholder="Buscar contratação, CNPJ ou processo SEI"
          aria-label="Buscar contratação"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query
          ? <button type="button" className="btn btn-sm btn-link text-secondary px-1" title="Limpar" onClick={() => setQuery('')}><i className="bi bi-x-lg" /></button>
          : <kbd className="d-none d-xl-inline" title="Atalho: tecla /">/</kbd>}
      </form>

      <div className="topo__acoes">
        <Link to={sino} className="topo__icone" title={nSino ? `${nSino} pendência(s) aguardando você` : 'Nada pendente'} aria-label="Pendências">
          <i className="bi bi-bell" />
          {nSino > 0 && <span className="topo__contagem">{nSino > 99 ? '99+' : nSino}</span>}
        </Link>

        <div className="dropdown">
          <button className="usuario" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Menu do usuário">
            <span className="usuario__avatar" aria-hidden="true">{iniciais(profile?.nome || nome || user?.email)}</span>
            <span className="usuario__texto">
              <span className="usuario__nome d-block">{profile?.nome || nome || user?.email}</span>
              <span className="usuario__perfil d-block">{perfil}</span>
            </span>
          </button>
          <ul className="dropdown-menu dropdown-menu-end usuario-menu">
            <li className="usuario-menu__cab">
              <b>{profile?.nome || nome || 'Usuário'}</b>
              <span>{user?.email}</span>
              <div className="mt-1"><span className="carimbo carimbo--primary">{perfil}</span></div>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item" onClick={alternarTema}>
                <i className={`bi ${tema === 'dark' ? 'bi-sun' : 'bi-moon-stars'} me-2`} />
                {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
              </button>
            </li>
            <li>
              <button className="dropdown-item" onClick={logout}>
                <i className="bi bi-box-arrow-right me-2" />
                Sair
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  )
}

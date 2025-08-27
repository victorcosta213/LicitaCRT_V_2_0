// src/components/Topbar.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Topbar() {
  const { user, role, logout } = useAuth()

  // tema claro/escuro
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // busca global
  const [query, setQuery] = useState('')
  // dispara evento ao digitar (com debounce)
  useEffect(() => {
    const t = setTimeout(() => {
      const ev = new CustomEvent('global-search', { detail: { query } })
      window.dispatchEvent(ev)
    }, 400) // debounce 400ms
    return () => clearTimeout(t)
  }, [query])

  function submitSearch(e) {
    e?.preventDefault?.()
    const ev = new CustomEvent('global-search', { detail: { query } })
    window.dispatchEvent(ev)
  }

  function clearSearch() {
    setQuery('')
    const ev = new CustomEvent('global-search', { detail: { query: '' } })
    window.dispatchEvent(ev)
  }

  return (
    <header className="app-topbar d-flex align-items-center justify-content-between">
      {/* esquerda: menu mobile + busca */}
      <div className="d-flex align-items-center gap-2">
        <button
          className="btn btn-outline-secondary d-lg-none"
          data-bs-toggle="offcanvas"
          data-bs-target="#appSidebar"
          aria-label="Abrir menu"
        >
          <i className="bi bi-list" />
        </button>

        <form className="d-none d-md-flex align-items-center topbar-search" onSubmit={submitSearch}>
          <i className="bi bi-search" />
          <input
            className="form-control"
            placeholder="Buscar no sistema…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary"
              title="Limpar"
              onClick={clearSearch}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </form>
      </div>

      {/* direita: tema + usuário */}
      <div className="d-flex align-items-center gap-2">
        <button
          className="btn btn-outline-secondary"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
          aria-label="Alternar tema"
        >
          {theme === 'light' ? <i className="bi bi-moon" /> : <i className="bi bi-sun" />}
        </button>

        <div className="dropdown">
          <button className="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
            <i className="bi bi-person-circle me-2" />
            <span className="me-2">{user?.email || 'Usuário'}</span>
            {role && <span className="badge round text-bg-secondary">{role}</span>}
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li className="dropdown-item-text small text-secondary">
              ID: <code>{user?.uid || '—'}</code>
            </li>
            <li><hr className="dropdown-divider" /></li>
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

// src/components/Topbar.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Topbar() {
  const { user, role, logout } = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // (Opcional) dispara um evento global de busca quando o usuário pressiona Enter
  function submitSearch(e) {
    if (e.key === 'Enter') {
      const ev = new CustomEvent('global-search', { detail: { query } })
      window.dispatchEvent(ev)
    }
  }

  return (
    <header className="app-topbar d-flex align-items-center justify-content-between">
      {/* esquerda: botão da sidebar (mobile) + busca */}
      <div className="d-flex align-items-center gap-2">
        <button
          className="btn btn-outline-secondary d-lg-none"
          data-bs-toggle="offcanvas"
          data-bs-target="#appSidebar"
          aria-label="Abrir menu"
        >
          <i className="bi bi-list" />
        </button>

        <div className="d-none d-md-flex align-items-center topbar-search">
          <i className="bi bi-search" />
          <input
            className="form-control"
            placeholder="Buscar no sistema… (Enter)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={submitSearch}
          />
        </div>
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

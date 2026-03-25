import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PAGE_META = {
  '/home': { eyebrow: 'Visão executiva', title: 'Painel de acompanhamento' },
  '/dashboard': { eyebrow: 'Análise operacional', title: 'Indicadores e histórico' },
  '/controle': { eyebrow: 'Centro de controle', title: 'Gestão de processos' },
  '/setores/juridico': { eyebrow: 'Setor jurídico', title: 'Fila e validações' },
  '/setores/financeiro': { eyebrow: 'Setor financeiro', title: 'Aprovações e pagamentos' },
  '/setores/secretarias': { eyebrow: 'Secretarias', title: 'Demandas e tramitação' },
}

export default function Topbar() {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const t = setTimeout(() => {
      const ev = new CustomEvent('global-search', { detail: { query } })
      window.dispatchEvent(ev)
    }, 400)
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

  const pageMeta = useMemo(
    () => PAGE_META[location.pathname] || { eyebrow: 'LicitaCRT', title: 'Gestao centralizada' },
    [location.pathname]
  )
  const today = useMemo(
    () => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date()),
    []
  )

  return (
    <header className="app-topbar">
      <div className="app-topbar__row">
        <div className="app-topbar__intro">
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-outline-secondary topbar-icon-btn d-lg-none"
              data-bs-toggle="offcanvas"
              data-bs-target="#appSidebar"
              aria-label="Abrir menu"
            >
              <i className="bi bi-list" />
            </button>
            <div>
              <div className="app-topbar__eyebrow">{pageMeta.eyebrow}</div>
              <div className="app-topbar__title">{pageMeta.title}</div>
            </div>
          </div>
          <div className="app-topbar__date">{today}</div>
        </div>

        <form className="topbar-search" onSubmit={submitSearch}>
          <i className="bi bi-search" />
          <input
            className="form-control"
            placeholder="Buscar no sistema..."
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

        <div className="app-topbar__actions">
          <button
            className="btn btn-outline-secondary topbar-icon-btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            aria-label="Alternar tema"
          >
            {theme === 'light' ? <i className="bi bi-moon" /> : <i className="bi bi-sun" />}
          </button>

          <div className="dropdown">
            <button className="btn btn-outline-secondary topbar-user dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
              <span className="topbar-user__avatar">
                {(user?.email || 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="topbar-user__meta">
                <span className="topbar-user__role">{role || 'sem perfil'}</span>
              </span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li className="dropdown-item-text small text-secondary">
                ID: <code>{user?.uid || '-'}</code>
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
      </div>
    </header>
  )
}

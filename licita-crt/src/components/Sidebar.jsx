import { NavLink, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Offcanvas from 'bootstrap/js/dist/offcanvas'
import { useAuth } from '../context/AuthContext'

function Brand({ role }) {
  return (
    <div className="sidebar-brand d-flex align-items-center justify-content-between">
      <div className="d-flex align-items-center gap-2">
        <span className="brand-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 36 36">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0d6efd"/><stop offset="1" stopColor="#6ea8fe"/>
              </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="16" fill="url(#g)"/>
            <path d="M20.5 8c-4 2-6.8 5.3-8 9.8l3.2-1.1 3.2 3.2-1.1 3.2c4.5-1.2 7.8-4 9.8-8 .6-1.2-2.3-4.1-4.1-4.1z" fill="#fff" />
            <circle cx="22.5" cy="13.5" r="1.6" fill="#0d6efd"/>
          </svg>
        </span>
        <div className="d-flex flex-column lh-1">
          <span className="brand-title">Licinauta</span>
          <small className="text-secondary">CRT-03</small>
        </div>
      </div>
      {role && <span className="badge role-pill text-bg-secondary">{role}</span>}
    </div>
  )
}

function Section({ children }) {
  return <div className="px-3 py-2 text-uppercase small fw-semibold text-secondary">{children}</div>
}

function MenuLinks({ onClick }) {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  return (
    <nav className="list-group list-group-flush menu-links">
      <Section>Visão</Section>
      <NavLink to="/home" className={({ isActive }) => 'list-group-item list-group-item-action d-flex align-items-center menu-item ' + (isActive ? 'active' : '')} onClick={onClick}>
        <i className="bi bi-house-door me-2" /> Home
      </NavLink>
      <NavLink to="/dashboard" className={({ isActive }) => 'list-group-item list-group-item-action d-flex align-items-center menu-item ' + (isActive ? 'active' : '')} onClick={onClick}>
        <i className="bi bi-speedometer2 me-2" /> Dashboard
      </NavLink>

      <Section>Operação</Section>
      <NavLink to="/controle" className={({ isActive }) => 'list-group-item list-group-item-action d-flex align-items-center menu-item ' + (isActive ? 'active' : '')} onClick={onClick}>
        <i className="bi bi-journal-check me-2" /> Processos
      </NavLink>
      <NavLink to="/arquivados" className={({ isActive }) => 'list-group-item list-group-item-action d-flex align-items-center menu-item ' + (isActive ? 'active' : '')} onClick={onClick}>
        <i className="bi bi-archive me-2" /> Arquivados
      </NavLink>
    </nav>
  )
}

export default function Sidebar() {
  const { role } = useAuth()
  const location = useLocation()

  useEffect(() => {
    const el = document.getElementById('appSidebar')
    if (!el) return
    const inst = Offcanvas.getOrCreateInstance(el)
    try { inst.hide() } catch {}
  }, [location.pathname])

  const closeSidebar = () => {
    const el = document.getElementById('appSidebar')
    if (!el) return
    Offcanvas.getOrCreateInstance(el).hide()
  }

  return (
    <>
      <aside className="sidebar-static d-none d-lg-flex flex-column">
        <Brand role={role} />
        <div className="flex-grow-1 overflow-auto">
          <MenuLinks onClick={() => {}} />
        </div>
      </aside>

      <div className="offcanvas offcanvas-start" tabIndex={-1} id="appSidebar" aria-labelledby="sidebarLabel" data-bs-scroll="true">
        <div className="offcanvas-header pb-0">
          <h5 id="sidebarLabel" className="visually-hidden">Menu</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Fechar"></button>
        </div>
        <div className="offcanvas-body p-0">
          <Brand role={role} />
          <MenuLinks onClick={closeSidebar} />
        </div>
      </div>
    </>
  )
}

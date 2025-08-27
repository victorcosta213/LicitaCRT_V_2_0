import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <>
      {/* Sidebar fixa em telas >= lg */}
      <aside className="app-sidebar d-none d-lg-flex flex-column">
        <div className="brand">
          <span className="logo">CRT-03</span>
          <small className="text-secondary">Licitações</small>
        </div>

        <nav className="nav flex-column mt-3">
          <NavLink to="/dashboard" className="nav-link">
            <i className="bi bi-speedometer2 me-2" /> Dashboard
          </NavLink>
          <NavLink to="/controle" className="nav-link">
            <i className="bi bi-folder2 me-2" /> Controle de Processos
          </NavLink>
          {/* Espaço para futuras páginas */}
          {/* <NavLink to="/estoque" className="nav-link"><i className="bi bi-box-seam me-2" /> Estoque</NavLink> */}
          {/* <NavLink to="/config" className="nav-link"><i className="bi bi-gear me-2" /> Configurações</NavLink> */}
        </nav>

        <div className="mt-auto p-3 text-secondary small">
          v1.0 • {new Date().getFullYear()}
        </div>
      </aside>

      {/* Offcanvas para mobile */}
      <div className="offcanvas offcanvas-start" tabIndex="-1" id="appSidebar">
        <div className="offcanvas-header">
          <h5 className="offcanvas-title">CRT-03</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          <nav className="nav flex-column">
            <NavLink to="/dashboard" className="nav-link" data-bs-dismiss="offcanvas">
              <i className="bi bi-speedometer2 me-2" /> Dashboard
            </NavLink>
            <NavLink to="/controle" className="nav-link" data-bs-dismiss="offcanvas">
              <i className="bi bi-folder2 me-2" /> Controle de Processos
            </NavLink>
          </nav>
        </div>
      </div>
    </>
  )
}

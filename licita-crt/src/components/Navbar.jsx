import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary border-bottom">
      <div className="container">
        <Link className="navbar-brand fw-semibold" to="/controle">CRT-03</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="nav">
          <ul className="navbar-nav ms-auto gap-2">
            {user && (
              <>
                <li className="nav-item"><NavLink className="nav-link" to="/controle">Cadastro</NavLink></li>
                <li className="nav-item"><NavLink className="nav-link" to="/dashboard">Dashboard</NavLink></li>
              </>
            )}
            {!user ? (
              <li className="nav-item"><NavLink className="btn btn-primary btn-sm" to="/login">Entrar</NavLink></li>
            ) : (
              <li className="nav-item">
                <button className="btn btn-danger btn-sm" onClick={logout}>Sair</button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  )
}

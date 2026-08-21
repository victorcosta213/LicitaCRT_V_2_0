import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './AppLayout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Controle from './pages/Controle'
import Arquivados from './pages/Arquivados'
import Login from './pages/Login'
import { useAuth } from './context/AuthContext'

function Private({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

function RoleRoute({ allow, children }) {
  const { role } = useAuth()
  if (role === 'admin') return children
  if (!allow || allow.includes(role)) return children
  return <Navigate to="/home" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Private><AppLayout /></Private>}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/controle" element={<Controle />} />
        <Route path="/arquivados" element={<Arquivados />} />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

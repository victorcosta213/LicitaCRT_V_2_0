import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './AppLayout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Controle from './pages/Controle'
import Juridico from './pages/setores/Juridico'
import Financeiro from './pages/setores/Financeiro'
import Secretarias from './pages/setores/Secretarias'
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

        <Route
          path="/setores/juridico"
          element={
            <RoleRoute allow={['juridico']}>
              <Juridico />
            </RoleRoute>
          }
        />
        <Route
          path="/setores/financeiro"
          element={
            <RoleRoute allow={['financeiro']}>
              <Financeiro />
            </RoleRoute>
          }
        />
        <Route
          path="/setores/secretarias"
          element={
            <RoleRoute allow={['secretarias']}>
              <Secretarias />
            </RoleRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Controle from './pages/Controle.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NotFound from './pages/NotFound.jsx'

function Private({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="container py-5">Carregando...</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Área autenticada com Layout (sidebar+topbar) */}
        <Route element={<Private><Layout /></Private>}>
          <Route path="/" element={<Navigate to="/controle" replace />} />
          <Route path="/controle" element={<Controle />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

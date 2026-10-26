import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './AppLayout'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import SemAcesso from './pages/SemAcesso'
import TrocarSenha from './pages/TrocarSenha'
import Carregando from './components/Carregando'
import { useAuth } from './context/AuthContext'
import { PERFIS_COM_MESA, landingFor, normalizeRole } from './utils/permissions'

// Cada tela vira um arquivo separado, baixado só quando é aberta.
const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Controle = lazy(() => import('./pages/Controle'))
const Arquivados = lazy(() => import('./pages/Arquivados'))
const Contratos = lazy(() => import('./pages/Contratos'))
const ContratoFicha = lazy(() => import('./pages/ContratoFicha'))
const OrdensServico = lazy(() => import('./pages/OrdensServico'))
const Competencias = lazy(() => import('./pages/Competencias'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
const GestaoPainel = lazy(() => import('./pages/GestaoPainel'))
const Alertas = lazy(() => import('./pages/Alertas'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const Parametros = lazy(() => import('./pages/Parametros'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Gabinete = lazy(() => import('./pages/Gabinete'))
const Mesa = lazy(() => import('./pages/Mesa'))
const Ajuda = lazy(() => import('./pages/Ajuda'))

// Logado e com perfil ativo (mesma regra do banco).
function Private({ children }) {
  const { user, loading, acesso, precisaTrocarSenha } = useAuth()
  if (loading) return <Carregando />
  if (!user) return <Navigate to="/login" replace />
  if (acesso !== 'liberado') return <SemAcesso motivo={acesso} />
  if (precisaTrocarSenha) return <TrocarSenha />
  return children
}

// Admin acessa tudo; sem `allow`, qualquer usuário autenticado.
function RoleRoute({ allow, children }) {
  const { role } = useAuth()
  const r = normalizeRole(role)
  if (r === 'admin' || !allow || allow.includes(r)) return children
  return <Navigate to={landingFor(role)} replace />
}

function Landing() {
  const { role } = useAuth()
  return <Navigate to={landingFor(role)} replace />
}

const LICITATORIO = ['compras', 'viewer']

export default function App() {
  return (
    <Suspense fallback={<Carregando />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />

        <Route element={<Private><AppLayout /></Private>}>
          <Route path="/" element={<Landing />} />
          <Route path="/mesa" element={<RoleRoute allow={PERFIS_COM_MESA}><Mesa /></RoleRoute>} />

          {/* Gestão contratual */}
          <Route path="/gestao" element={<RoleRoute allow={['gestor', 'viewer']}><GestaoPainel /></RoleRoute>} />
          <Route path="/financeiro" element={<RoleRoute allow={['financeiro', 'gestor', 'viewer']}><Financeiro /></RoleRoute>} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/contratos/:id" element={<ContratoFicha />} />
          <Route path="/ordens-servico" element={<RoleRoute allow={['compras', 'gestor', 'viewer']}><OrdensServico /></RoleRoute>} />
          <Route path="/competencias" element={<RoleRoute allow={['gestor', 'fiscal', 'financeiro', 'viewer']}><Competencias /></RoleRoute>} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/ajuda" element={<Ajuda />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/gabinete" element={<RoleRoute allow={['gabinete', 'gestor']}><Gabinete /></RoleRoute>} />

          {/* Processos licitatórios (Compras) */}
          <Route path="/home" element={<RoleRoute allow={LICITATORIO}><Home /></RoleRoute>} />
          <Route path="/dashboard" element={<RoleRoute allow={LICITATORIO}><Dashboard /></RoleRoute>} />
          <Route path="/controle" element={<RoleRoute allow={LICITATORIO}><Controle /></RoleRoute>} />
          <Route path="/arquivados" element={<RoleRoute allow={LICITATORIO}><Arquivados /></RoleRoute>} />

          {/* Administração */}
          <Route path="/usuarios" element={<RoleRoute allow={[]}><Usuarios /></RoleRoute>} />
          <Route path="/parametros" element={<RoleRoute allow={[]}><Parametros /></RoleRoute>} />
        </Route>

        <Route path="*" element={<Landing />} />
      </Routes>
    </Suspense>
  )
}

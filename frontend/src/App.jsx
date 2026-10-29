import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './AppLayout'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import SemAcesso from './pages/SemAcesso'
import TrocarSenha from './pages/TrocarSenha'
import Carregando from './components/Carregando'
import { useAuth } from './context/AuthContext'
import { PERFIS_COM_MESA, isMaster, landingFor, normalizeRole } from './utils/permissions'

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
const Painel = lazy(() => import('./pages/Painel'))
const Documentos = lazy(() => import('./pages/Documentos'))
const DocumentoNovo = lazy(() => import('./pages/DocumentoNovo'))
const DocumentoDetalhe = lazy(() => import('./pages/DocumentoDetalhe'))
const Verificar = lazy(() => import('./pages/Verificar'))
const Processos = lazy(() => import('./pages/Processos'))
const ProcessoDetalhe = lazy(() => import('./pages/ProcessoDetalhe'))
const Acompanhamento = lazy(() => import('./pages/Acompanhamento'))
const Unidades = lazy(() => import('./pages/Unidades'))
const Solicitacoes = lazy(() => import('./pages/Solicitacoes'))
const SolicitacaoNova = lazy(() => import('./pages/SolicitacaoNova'))
const SolicitacaoDetalhe = lazy(() => import('./pages/SolicitacaoDetalhe'))
const ProcessosContratacao = lazy(() => import('./pages/ProcessosContratacao'))
const Roteiros = lazy(() => import('./pages/Roteiros'))
const CatalogoItens = lazy(() => import('./pages/CatalogoItens'))
const AcompanhamentoPedidos = lazy(() => import('./pages/AcompanhamentoPedidos'))

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
  if (isMaster(r) || !allow || allow.includes(r)) return children
  return <Navigate to={landingFor(role)} replace />
}

function Landing() {
  const { role } = useAuth()
  return <Navigate to={landingFor(role)} replace />
}

const LICITATORIO = ['compras', 'viewer']
const CRIA_DOCUMENTOS = ['secretario', 'compras', 'gestor', 'fiscal', 'financeiro', 'gabinete', 'juridico', 'administrativo', 'rh', 'ti']

export default function App() {
  return (
    <Suspense fallback={<Carregando />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        {/* conferência de autenticidade: aberta a quem não tem login */}
        <Route path="/verificar" element={<Verificar publico />} />
        <Route path="/verificar/:codigo" element={<Verificar publico />} />

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
          <Route path="/painel" element={<RoleRoute allow={['presidente']}><Painel /></RoleRoute>} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/documentos/novo" element={<RoleRoute allow={CRIA_DOCUMENTOS}><DocumentoNovo /></RoleRoute>} />
          <Route path="/documentos/verificar" element={<Verificar />} />
          <Route path="/documentos/verificar/:codigo" element={<Verificar />} />
          <Route path="/documentos/:id" element={<DocumentoDetalhe />} />
          <Route path="/solicitacoes" element={<Solicitacoes />} />
          <Route path="/solicitacoes/acompanhamento" element={<RoleRoute allow={['secretario', 'compras', 'gestor', 'gabinete', 'viewer']}><AcompanhamentoPedidos /></RoleRoute>} />
          <Route path="/solicitacoes/nova" element={<RoleRoute allow={['secretario']}><SolicitacaoNova /></RoleRoute>} />
          <Route path="/solicitacoes/:id" element={<SolicitacaoDetalhe />} />
          <Route path="/compras/processos" element={<RoleRoute allow={['compras', 'gestor', 'gabinete', 'viewer']}><ProcessosContratacao /></RoleRoute>} />
          <Route path="/compras/roteiros" element={<Roteiros />} />
          <Route path="/itens" element={<RoleRoute allow={['compras', 'secretario', 'gestor', 'gabinete', 'viewer']}><CatalogoItens /></RoleRoute>} />
          <Route path="/processos" element={<Processos />} />
          <Route path="/processos/:id" element={<ProcessoDetalhe />} />
          <Route path="/acompanhamento" element={<RoleRoute allow={['gestor', 'gabinete', 'viewer']}><Acompanhamento /></RoleRoute>} />
          <Route path="/unidades" element={<RoleRoute allow={[]}><Unidades /></RoleRoute>} />
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

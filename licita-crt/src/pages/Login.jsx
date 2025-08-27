import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { resetPassword } from '../services/auth'
import './login.css'

const errorMap = {
  'auth/user-not-found': 'Usuário não encontrado.',
  'auth/wrong-password': 'Senha inválida.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/invalid-credential': 'Credenciais inválidas.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente em instantes.',
  'auth/network-request-failed': 'Falha de rede. Verifique sua conexão.',
  'auth/operation-not-allowed': 'Login por e-mail/senha não está habilitado.',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError(''); setNotice('')
    if (!email || !password) { setError('Informe e-mail e senha.'); return }
    try {
      setLoading(true)
      await login(email, password)
      // ⬇️ redireciona para o Dashboard
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('AUTH ERROR:', err?.code, err?.message)
      setError(errorMap[err?.code] || 'Falha no login. Verifique as credenciais.')
    } finally {
      setLoading(false)
    }
  }

  async function onForgot() {
    setError(''); setNotice('')
    if (!email) { setError('Digite seu e-mail para enviar o link de redefinição.'); return }
    try {
      await resetPassword(email)
      setNotice('Enviamos um link de redefinição para seu e-mail.')
    } catch (err) {
      console.error(err)
      setError(errorMap[err?.code] || 'Não foi possível enviar o e-mail agora.')
    }
  }

  return (
    <div className="login-bg d-flex align-items-center justify-content-center">
      <div className="shape s1"></div><div className="shape s2"></div><div className="shape s3"></div>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <div className="login-card shadow-lg border-0">
              <div className="login-hero d-none d-md-flex flex-column justify-content-between">
                <div>
                  <div className="brand mb-3"><span className="logo">CRT-03</span><small className="text-secondary"> Licitações</small></div>
                  <h2 className="h4 mb-2">Gestão ágil de processos</h2>
                  <p className="text-secondary mb-4">Cadastre, acompanhe prazos e centralize documentos com segurança.</p>
                  <Illustration />
                </div>
                <ul className="list-inline small text-secondary mt-4">
                  <li className="list-inline-item me-3"><i className="bi bi-shield-check me-1"></i> Firebase Auth</li>
                  <li className="list-inline-item me-3"><i className="bi bi-hdd-network me-1"></i> Firestore</li>
                  <li className="list-inline-item"><i className="bi bi-cloud-arrow-up me-1"></i> Storage</li>
                </ul>
              </div>

              <div className="login-form p-4 p-md-5">
                <h1 className="h4 mb-3">Entrar</h1>
                <p className="text-secondary mb-4">Acesse sua conta para continuar.</p>

                {error && <div className="alert alert-danger py-2">{error}</div>}
                {notice && <div className="alert alert-success py-2">{notice}</div>}

                <form onSubmit={onSubmit} className="vstack gap-3">
                  <div>
                    <label className="form-label">E-mail</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-envelope"></i></span>
                      <input className="form-control" type="email" placeholder="voce@exemplo.com"
                        value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="username" required />
                    </div>
                  </div>

                  <div>
                    <label className="form-label d-flex justify-content-between">
                      <span>Senha</span>
                      <button type="button" className="btn btn-link btn-sm p-0" onClick={()=>setShowPwd(s=>!s)}>
                        {showPwd ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-lock"></i></span>
                      <input className="form-control" type={showPwd ? 'text' : 'password'} placeholder="Sua senha"
                        value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required />
                    </div>
                  </div>

                  <div className="d-flex align-items-center justify-content-between">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="rememberMe" />
                      <label className="form-check-label" htmlFor="rememberMe">Lembrar-me</label>
                    </div>
                    <button type="button" className="btn btn-link p-0" onClick={onForgot}>Esqueci minha senha</button>
                  </div>

                  <button className="btn btn-primary btn-lg w-100" disabled={loading}>
                    {loading ? (<><span className="spinner-border spinner-border-sm me-2"></span>Entrando…</>) : 'Entrar'}
                  </button>
                </form>

                <div className="text-center mt-4 small text-secondary">
                  Ambiente seguro • {new Date().getFullYear()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Illustration() {
  return (
    <svg viewBox="0 0 360 220" className="hero-svg" role="img" aria-label="Ilustração de documentos e fluxo">
      <defs>
        <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#0d6efd" /><stop offset="1" stopColor="#6ea8fe" />
        </linearGradient>
      </defs>
      <rect x="18" y="60" width="150" height="100" rx="10" fill="url(#g1)" opacity="0.85"/>
      <rect x="34" y="74" width="118" height="72" rx="8" fill="#fff" />
      <rect x="190" y="36" width="150" height="100" rx="10" fill="#e9f2ff"/>
      <rect x="206" y="50" width="118" height="72" rx="8" fill="#fff" />
      <line x1="92" y1="126" x2="92" y2="178" stroke="#cbd5e1" strokeWidth="2"/>
      <line x1="92" y1="178" x2="266" y2="178" stroke="#cbd5e1" strokeWidth="2"/>
      <circle cx="92" cy="126" r="6" fill="#0d6efd"/>
      <circle cx="266" cy="178" r="6" fill="#0d6efd"/>
      <circle cx="266" cy="86" r="22" fill="#d1e7dd"/>
      <path d="M256,86 l10,10 l18,-18" stroke="#0a7c59" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

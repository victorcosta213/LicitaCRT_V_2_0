import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import Entrada from '../components/Entrada'

const errorMap = {
  'Invalid login credentials': 'Credenciais inválidas ou e-mail não encontrado.',
  'Email not confirmed': 'Por favor, confirme seu e-mail antes de entrar.',
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
      const { error: signInErr } = await login(email, password)
      if (signInErr) throw signInErr
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMap[err?.message] || err?.message || 'Falha no login. Verifique as credenciais.')
    } finally {
      setLoading(false)
    }
  }

  async function onForgot() {
    setError(''); setNotice('')
    if (!email) { setError('Digite seu e-mail para enviar o link de redefinição.'); return }
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      if (resetErr) throw resetErr
      setNotice('Enviamos um link de redefinição para seu e-mail.')
    } catch (err) {
      setError(errorMap[err?.message] || 'Não foi possível enviar o e-mail agora.')
    }
  }

  return (
    <Entrada>
      <h1 className="entrada__titulo">Entrar</h1>
      <p className="entrada__sub">Use o e-mail e a senha cadastrados pela administração.</p>

      {error && <div className="alert alert-danger" role="alert"><i className="bi bi-exclamation-octagon me-2" />{error}</div>}
      {notice && <div className="alert alert-success" role="status"><i className="bi bi-check-circle me-2" />{notice}</div>}

      <form onSubmit={onSubmit} noValidate>
        <div className="entrada__campo">
          <label className="form-label" htmlFor="emailInput">E-mail</label>
          <input
            type="email"
            className="form-control"
            id="emailInput"
            placeholder="nome@crt08.org.br"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="entrada__campo">
          <label className="form-label" htmlFor="pwdInput">Senha</label>
          <div className="entrada__senha">
            <input
              type={showPwd ? 'text' : 'password'}
              className="form-control"
              id="pwdInput"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <button
              type="button"
              className="entrada__olho"
              onClick={() => setShowPwd(!showPwd)}
              aria-label={showPwd ? 'Ocultar senha' : 'Exibir senha'}
              title={showPwd ? 'Ocultar senha' : 'Exibir senha'}
            >
              <i className={showPwd ? 'bi bi-eye-slash' : 'bi bi-eye'} />
            </button>
          </div>
        </div>

        <div className="entrada__linha">
          <span />
          <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={onForgot} disabled={loading}>
            Esqueceu a senha?
          </button>
        </div>

        <button type="submit" className="btn btn-primary entrada__enviar" disabled={loading}>
          {loading ? <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Entrando…</> : 'Entrar'}
        </button>
      </form>

      <p className="entrada__aviso">
        <i className="bi bi-shield-lock" aria-hidden="true" />
        Acesso restrito a servidores e colaboradores autorizados do CRT‑08.
      </p>
    </Entrada>
  )
}

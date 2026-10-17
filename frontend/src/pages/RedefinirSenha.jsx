import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import Entrada from '../components/Entrada'

// Destino do link "Esqueceu a senha?" enviado por e-mail. O Supabase abre a
// sessão a partir do link; aqui a pessoa define a nova senha.
export default function RedefinirSenha() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) { setErro('A senha deve ter pelo menos 8 caracteres.'); return }
    if (senha !== confirmacao) { setErro('As senhas não conferem.'); return }
    try {
      setSalvando(true)
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      setErro(err?.message || 'Não foi possível alterar a senha.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Entrada>
      <div className="entrada__icone" aria-hidden="true"><i className="bi bi-key" /></div>
      <h1 className="entrada__titulo">Nova senha</h1>
      <p className="entrada__sub">{user ? <>Defina a nova senha de <span className="mono">{user.email}</span>.</> : 'Abrindo o link de redefinição…'}</p>

      {!loading && !user && (
        <div className="alert alert-warning">
          Link inválido ou expirado. Volte ao login e peça um novo link em “Esqueceu a senha?”.
        </div>
      )}
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}

      {user && (
        <form onSubmit={onSubmit}>
          <div className="entrada__campo">
            <label className="form-label" htmlFor="novaSenha">Nova senha</label>
            <input id="novaSenha" type="password" className="form-control"
              value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required />
            <div className="form-text">Pelo menos 8 caracteres, misturando letras e números.</div>
          </div>
          <div className="entrada__campo">
            <label className="form-label" htmlFor="confirmaSenha">Confirme a nova senha</label>
            <input id="confirmaSenha" type="password" className="form-control"
              value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" required />
          </div>
          <button type="submit" className="btn btn-primary entrada__enviar mt-2" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      )}

      <div className="mt-4">
        <a href="/login" className="small"><i className="bi bi-arrow-left me-1" />Voltar ao login</a>
      </div>
    </Entrada>
  )
}

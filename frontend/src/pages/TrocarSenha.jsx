import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { mensagemErroUsuario, trocarSenhaPrimeiroAcesso } from '../services/users'
import { SENHA_MINIMA, validarNovaSenha } from '../utils/senha'
import Entrada from '../components/Entrada'

// Primeiro acesso, ou senha redefinida pelo administrador: a pessoa cria a própria senha
// antes de usar o sistema. É mostrada no lugar de qualquer outra tela.
export default function TrocarSenha() {
  const { user, logout, senhaTrocada } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setErro('')
    const problema = validarNovaSenha(senha, confirmacao)
    if (problema) { setErro(problema); return }
    try {
      setSalvando(true)
      await trocarSenhaPrimeiroAcesso(senha)
      senhaTrocada()
      navigate('/', { replace: true })
    } catch (err) {
      setErro(mensagemErroUsuario(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Entrada>
      <div className="entrada__icone" aria-hidden="true"><i className="bi bi-shield-lock" /></div>
      <h1 className="entrada__titulo">Crie a sua senha</h1>
      <p className="entrada__sub">
        {user?.email && <><span className="mono">{user.email}</span>: </>}
        a senha que você usou para entrar é provisória. Por segurança, escolha uma que só você conheça.
      </p>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}

      <form onSubmit={onSubmit}>
        <div className="entrada__campo">
          <label className="form-label" htmlFor="novaSenha">Nova senha</label>
          <input id="novaSenha" type="password" className="form-control" autoFocus
            value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required />
          <div className="form-text">Pelo menos {SENHA_MINIMA} caracteres, misturando letras e números.</div>
        </div>
        <div className="entrada__campo">
          <label className="form-label" htmlFor="confirmaSenha">Confirme a nova senha</label>
          <input id="confirmaSenha" type="password" className="form-control"
            value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" required />
        </div>
        <button type="submit" className="btn btn-primary entrada__enviar mt-2" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar e entrar'}
        </button>
      </form>

      <div className="mt-4">
        <button type="button" className="btn btn-link p-0 small" onClick={logout}>
          <i className="bi bi-box-arrow-left me-1" />Sair
        </button>
      </div>
    </Entrada>
  )
}

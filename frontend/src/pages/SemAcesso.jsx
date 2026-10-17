import { useAuth } from '../context/AuthContext'
import Entrada from '../components/Entrada'

const MENSAGENS = {
  sem_perfil: {
    titulo: 'Acesso não liberado',
    texto: 'Seu login existe, mas ainda não tem um perfil na plataforma. Peça a um administrador para liberar seu acesso.',
  },
  inativo: {
    titulo: 'Acesso desativado',
    texto: 'Seu acesso à plataforma foi desativado. Procure um administrador se precisar voltar a usar o sistema.',
  },
  erro: {
    titulo: 'Não foi possível carregar seu perfil',
    texto: 'Verifique sua conexão e tente novamente.',
  },
}

export default function SemAcesso({ motivo }) {
  const { user, logout, recarregarPerfil } = useAuth()
  const m = MENSAGENS[motivo] || MENSAGENS.erro

  return (
    <Entrada>
      <div className="entrada__icone" aria-hidden="true">
        <i className={`bi ${motivo === 'erro' ? 'bi-wifi-off' : 'bi-shield-lock'}`} />
      </div>
      <h1 className="entrada__titulo">{m.titulo}</h1>
      <p className="entrada__sub">{m.texto}</p>
      {user?.email && <p className="small text-secondary mb-4">Conectado como <span className="mono">{user.email}</span></p>}
      <div className="d-grid gap-2">
        {motivo === 'erro' && (
          <button type="button" className="btn btn-primary entrada__enviar" onClick={recarregarPerfil}>Tentar novamente</button>
        )}
        <button type="button" className="btn btn-outline-secondary" onClick={logout}>Sair</button>
      </div>
    </Entrada>
  )
}

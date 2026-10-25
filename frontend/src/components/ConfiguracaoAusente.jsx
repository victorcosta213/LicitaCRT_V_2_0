import Entrada from './Entrada'

// Mostrada quando a publicação foi feita sem as variáveis do Supabase (erro comum no Vercel)
export default function ConfiguracaoAusente() {
  return (
    <Entrada>
      <div className="entrada__icone" aria-hidden="true"><i className="bi bi-gear-wide-connected" /></div>
      <h1 className="entrada__titulo">Configuração incompleta</h1>
      <p className="entrada__sub">
        O sistema não encontrou o endereço do banco de dados. Quem administra a publicação deve cadastrar as variáveis{' '}
        <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> e publicar novamente.
      </p>
    </Entrada>
  )
}

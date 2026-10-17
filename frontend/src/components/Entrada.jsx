import logo from '../assets/crt08-logo.png'
import { NOME_APP, ORGAO_NOME } from '../config'
import '../pages/login.css'

// Moldura das telas de acesso: prancha azul com a marca e o formulário ao lado
export default function Entrada({ children }) {
  return (
    <div className="entrada">
      <aside className="entrada__prancha" aria-hidden="true">
        <div className="entrada__placa">
          <img src={logo} alt="" width="420" height="140" />
        </div>

        <div className="entrada__produto">
          <span className="entrada__rotulo">Contratos e licitações</span>
          <span className="entrada__nome">{NOME_APP}</span>
          <p>Do pedido de compra ao pagamento: cada etapa registrada, com prazo e responsável definidos.</p>
        </div>
      </aside>

      <main className="entrada__conteudo">
        <div className="entrada__caixa">
          <img className="entrada__logo-movel" src={logo} alt={ORGAO_NOME} width="240" height="80" />
          {children}
        </div>
        <footer className="entrada__rodape">{ORGAO_NOME}</footer>
      </main>
    </div>
  )
}

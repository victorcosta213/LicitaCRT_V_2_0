import { Component } from 'react'

// Última barreira: um erro de tela não deixa a página em branco.
export default class ErroInesperado extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('[App] erro inesperado:', erro, info?.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="container py-5 text-center" role="alert">
        <i className="bi bi-exclamation-triangle text-warning display-5" />
        <h1 className="h4 mt-3">Algo deu errado nesta tela</h1>
        <p className="text-secondary">Recarregue a página. Se o problema continuar, avise o suporte.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    )
  }
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErroInesperado from './components/ErroInesperado'
import ConfiguracaoAusente from './components/ConfiguracaoAusente'
import { configuracaoCompleta } from './services/supabase'
import { AuthProvider } from './context/AuthContext'
import { GcProvider } from './context/GcContext'
// Ordem importa: Bootstrap primeiro, depois o tema (que o ajusta) e os estilos das telas
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-sans-condensed/latin-500.css'
import '@fontsource/ibm-plex-sans-condensed/latin-600.css'
import '@fontsource/ibm-plex-sans-condensed/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './styles/tema.css'
import './styles/index.css'
import './styles/layout.css'
import './styles/ui-extras.css'
import './styles/componentes.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Após um novo deploy, abas abertas podem pedir arquivos que não existem mais:
// recarrega para buscar a versão nova (no máximo uma vez a cada 10 s, sem loop).
window.addEventListener('vite:preloadError', (event) => {
  const chave = 'licitacrt.recarregadoEm'
  try {
    if (Date.now() - Number(sessionStorage.getItem(chave) || 0) < 10000) return
    sessionStorage.setItem(chave, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErroInesperado>
      {configuracaoCompleta ? (
        <AuthProvider>
          <GcProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </GcProvider>
        </AuthProvider>
      ) : <ConfiguracaoAusente />}
    </ErroInesperado>
  </React.StrictMode>
)

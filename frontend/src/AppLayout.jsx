import { Suspense, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Carregando from './components/Carregando'
import { useNavegacao, useTema } from './components/useNavegacao'
import { NOME_APP, ORGAO_SIGLA } from './config'

export default function AppLayout() {
  const nav = useNavegacao()
  const [tema, alternarTema] = useTema()
  const comMenu = nav.modulo && nav.modulo.itens.length > 1

  // título da aba do navegador = tela aberta
  useEffect(() => {
    const tela = nav.item?.label || nav.modulo?.label
    document.title = tela ? `${tela} · ${NOME_APP}` : `${NOME_APP} · ${ORGAO_SIGLA}`
  }, [nav.item, nav.modulo])

  return (
    <div className={`app-shell ${comMenu ? '' : 'app-shell--sem-nav'}`}>
      <Sidebar nav={nav} tema={tema} alternarTema={alternarTema} />
      <main className="app-main">
        <Topbar nav={nav} tema={tema} alternarTema={alternarTema} />
        <div className="app-content">
          <div className="app-page">
            {/* menu e barra superior ficam na tela enquanto a página é baixada */}
            <Suspense fallback={<Carregando />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
}

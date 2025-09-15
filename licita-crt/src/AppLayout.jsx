import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import { Outlet } from 'react-router-dom'

export default function AppLayout() {
  return (
    <>
      <Topbar />
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <div className="app-content">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  )
}

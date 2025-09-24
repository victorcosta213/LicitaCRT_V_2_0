import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import { Outlet } from 'react-router-dom'

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Topbar />
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="relative flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at top left, rgba(14,165,233,0.09), transparent 30%), radial-gradient(circle at top right, rgba(20,184,166,0.08), transparent 24%)',
        }}
      />
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          onRefresh={() => setRefreshKey((prev) => prev + 1)}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px]" key={refreshKey}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

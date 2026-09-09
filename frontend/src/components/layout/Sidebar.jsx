import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Kanban, UserCircle, MessageSquare,
  Sparkles, Zap, Receipt, BarChart3, Shield, Settings, Link2, User,
  ChevronLeft, ChevronRight, X, ListTodo, Bell, ShieldCheck, Clock3
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { PERMISSIONS, hasPermission } from '../../utils/permissions'

const NAV_ITEMS = [
  { label: 'Dashboard',      icon: LayoutDashboard, path: '/dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
  { label: 'Leads',          icon: Users,           path: '/leads', permission: PERMISSIONS.LEADS_READ },
  { label: 'Pipeline',       icon: Kanban,          path: '/pipeline', permission: PERMISSIONS.DEALS_READ },
  { label: 'Tasks',          icon: ListTodo,        path: '/tasks', permission: PERMISSIONS.TASKS_READ },
  { label: 'Follow-ups',     icon: Clock3,          path: '/follow-ups', permission: PERMISSIONS.TASKS_READ },
  { label: 'Customers',      icon: UserCircle,      path: '/customers', permission: PERMISSIONS.CUSTOMERS_READ },
  { label: 'Communication',  icon: MessageSquare,   path: '/communication', permission: PERMISSIONS.COMMUNICATIONS_READ },
  { label: 'AI Engine',      icon: Sparkles,        path: '/ai-engine', permission: PERMISSIONS.AI_USE },
  { label: 'Automation',     icon: Zap,             path: '/automation', permission: PERMISSIONS.AUTOMATION_READ },
  { label: 'Invoices',       icon: Receipt,         path: '/invoices', permission: PERMISSIONS.INVOICES_READ },
  { label: 'Analytics',      icon: BarChart3,       path: '/analytics', permission: PERMISSIONS.REPORTS_READ },
  { label: 'Team',           icon: Shield,          path: '/team', permission: PERMISSIONS.TEAM_READ },
  { label: 'Notifications',  icon: Bell,            path: '/notifications', permission: PERMISSIONS.NOTIFICATIONS_READ },
  { label: 'My Profile',     icon: User,             path: '/profile' },
  { label: 'Integrations',   icon: Link2,           path: '/integrations', permission: PERMISSIONS.INTEGRATIONS_READ },
  { label: 'Settings',       icon: Settings,        path: '/settings', permission: PERMISSIONS.SETTINGS_VIEW },
  { label: 'SaaS Admin',     icon: ShieldCheck,     path: '/admin/saas', permission: null, superAdminOnly: true },
]
const AVATAR_STYLE_CLASS = {
  brand: 'from-brand-500 to-accent-500',
  ocean: 'from-cyan-500 to-blue-500',
  sunset: 'from-orange-500 to-rose-500',
  forest: 'from-emerald-500 to-teal-500',
  steel: 'from-slate-500 to-slate-700',
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user } = useAuthStore()
  const [avatarBroken, setAvatarBroken] = useState(false)
  const avatarStyle = AVATAR_STYLE_CLASS[user?.avatarStyle] ?? AVATAR_STYLE_CLASS.brand
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly) return user?.role === 'SUPER_ADMIN'
    return hasPermission(user, item.permission)
  })

  useEffect(() => {
    setAvatarBroken(false)
  }, [user?.avatarUrl])

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200/60 dark:border-slate-700/40 min-h-[64px] overflow-hidden">
        {/* Icon — always visible */}
        <img src="/favicon.svg" alt="N" className="w-10 h-10 flex-shrink-0" />
        {/* Full wordmark — visible when expanded */}
        {!collapsed && (
          <div className="overflow-hidden flex-shrink-0">
            <div className="flex items-baseline gap-0.5 leading-none">
              <span className="text-xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(90deg,#0ea5e9,#14b8a6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Nexa</span>
              <span className="text-xl font-extrabold tracking-wider" style={{ background: 'linear-gradient(90deg,#14b8a6,#0f766e)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>CRM</span>
            </div>
            <p className="text-[8px] font-semibold tracking-[0.2em] text-brand-500 dark:text-brand-400 mt-0.5 uppercase">Connect · Automate · Grow</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
        {visibleNavItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-3 px-1">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarStyle} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden`}>
            {user?.avatarUrl && !avatarBroken ? (
              <img
                src={user.avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              user?.name?.charAt(0) ?? 'U'
            )}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">{user?.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.role}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen bg-white dark:bg-[#0f172a] border-r border-slate-200/60 dark:border-slate-800 relative z-30 flex-shrink-0 ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow text-slate-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-[#0f172a] z-50 md:hidden">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, Component, Suspense, lazy } from 'react'
import MainLayout from './components/layout/MainLayout'
import AuthLayout from './components/layout/AuthLayout'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { authAPI } from './services/api'
import { PERMISSIONS, hasPermission } from './utils/permissions'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const LeadsPage = lazy(() => import('./pages/LeadsPage'))
const KanbanPage = lazy(() => import('./pages/KanbanPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const FollowUpsPage = lazy(() => import('./pages/FollowUpsPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const CommunicationPage = lazy(() => import('./pages/CommunicationPage'))
const AIEnginePage = lazy(() => import('./pages/AIEnginePage'))
const AutomationPage = lazy(() => import('./pages/AutomationPage'))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const NotificationCenterPage = lazy(() => import('./pages/NotificationCenterPage'))
const SaaSAdminPage = lazy(() => import('./pages/SaaSAdminPage'))

function RouteFallback() {
  return <div className="min-h-screen grid place-items-center text-slate-500">Loading...</div>
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      const showDebug = import.meta.env.DEV
      return (
        <div style={{ padding: 32, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ef4444' }}>Something went wrong</h2>
          <pre style={{ background: '#f1f5f9', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 13 }}>
            {showDebug ? `${this.state.error?.message}\n\n${this.state.error?.stack}` : 'An unexpected UI error occurred. Please reload and try again.'}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function PrivateRoute({ children }) {
  const { isAuthenticated, authBootstrapped } = useAuthStore()
  if (!authBootstrapped) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Checking session...</div>
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PermissionRoute({ permission, children }) {
  const { user, authBootstrapped } = useAuthStore()
  if (!authBootstrapped) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Checking session...</div>
  }
  if (hasPermission(user, permission)) return children

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Access denied</p>
        <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">You do not have access to this section</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your account is signed in, but this workspace role cannot open the requested module.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/dashboard')}
          className="btn-primary mt-5 w-full justify-center"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  )
}

function RoleRoute({ role, children }) {
  const { user, authBootstrapped } = useAuthStore()
  if (!authBootstrapped) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Checking session...</div>
  }
  if (user?.role === role) return children

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Access denied</p>
        <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">Super admin access required</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This section is reserved for platform operators.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/dashboard')}
          className="btn-primary mt-5 w-full justify-center"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { theme } = useThemeStore()
  const { authBootstrapped, isAuthenticated, token, setSessionFromUser, markAuthBootstrapped } = useAuthStore()
  const isDark = theme === 'dark'

  useEffect(() => {
    const supportedThemes = new Set(['light', 'dark', 'corporate'])
    if (!supportedThemes.has(theme)) {
      useThemeStore.getState().setTheme('corporate')
    }
  }, [theme])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme, isDark])

  useEffect(() => {
    const hasStoredSession = Boolean(token || isAuthenticated)
    if (!hasStoredSession) {
      if (!authBootstrapped) {
        markAuthBootstrapped()
      }
      return
    }

    const needsValidation = !authBootstrapped || (isAuthenticated && !token)
    if (!needsValidation) return
    let alive = true
    ;(async () => {
      try {
        const me = await authAPI.me()
        if (!alive) return
        if (useAuthStore.getState().authBootstrapped) return
        setSessionFromUser(me)
      } catch (err) {
        if (!alive) return
        if (useAuthStore.getState().authBootstrapped) return
        const state = useAuthStore.getState()
        const isNetworkError =
          err?.code === 'ERR_NETWORK' ||
          err?.code === 'ECONNABORTED' ||
          (typeof err?.message === 'string' && err.message.toLowerCase().includes('network'))
        if (isNetworkError && state.isAuthenticated) {
          markAuthBootstrapped()
          return
        }
        setSessionFromUser(null)
      }
    })()
    return () => { alive = false }
  }, [authBootstrapped, isAuthenticated, token, markAuthBootstrapped, setSessionFromUser])

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: isDark ? '#1e293b' : '#fff',
              color: isDark ? '#f1f5f9' : '#0f172a',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 500,
            },
          }}
        />
        <Routes>
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* App routes */}
          <Route
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PermissionRoute permission={PERMISSIONS.DASHBOARD_VIEW}><DashboardPage /></PermissionRoute>} />
            <Route path="/leads" element={<PermissionRoute permission={PERMISSIONS.LEADS_READ}><LeadsPage /></PermissionRoute>} />
            <Route path="/pipeline" element={<PermissionRoute permission={PERMISSIONS.DEALS_READ}><KanbanPage /></PermissionRoute>} />
            <Route path="/customers" element={<PermissionRoute permission={PERMISSIONS.CUSTOMERS_READ}><CustomersPage /></PermissionRoute>} />
            <Route path="/communication" element={<PermissionRoute permission={PERMISSIONS.COMMUNICATIONS_READ}><CommunicationPage /></PermissionRoute>} />
            <Route path="/ai-engine" element={<PermissionRoute permission={PERMISSIONS.AI_USE}><AIEnginePage /></PermissionRoute>} />
            <Route path="/automation" element={<PermissionRoute permission={PERMISSIONS.AUTOMATION_READ}><AutomationPage /></PermissionRoute>} />
            <Route path="/invoices" element={<PermissionRoute permission={PERMISSIONS.INVOICES_READ}><InvoicesPage /></PermissionRoute>} />
            <Route path="/analytics" element={<PermissionRoute permission={PERMISSIONS.REPORTS_READ}><AnalyticsPage /></PermissionRoute>} />
            <Route path="/tasks" element={<PermissionRoute permission={PERMISSIONS.TASKS_READ}><TasksPage /></PermissionRoute>} />
            <Route path="/follow-ups" element={<PermissionRoute permission={PERMISSIONS.TASKS_READ}><FollowUpsPage /></PermissionRoute>} />
            <Route path="/notifications" element={<PermissionRoute permission={PERMISSIONS.NOTIFICATIONS_READ}><NotificationCenterPage /></PermissionRoute>} />
            <Route path="/team" element={<PermissionRoute permission={PERMISSIONS.TEAM_READ}><TeamPage /></PermissionRoute>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/integrations" element={<PermissionRoute permission={PERMISSIONS.INTEGRATIONS_READ}><IntegrationsPage /></PermissionRoute>} />
            <Route path="/settings" element={<PermissionRoute permission={PERMISSIONS.SETTINGS_VIEW}><SettingsPage /></PermissionRoute>} />
            <Route path="/admin/saas" element={<RoleRoute role="SUPER_ADMIN"><SaaSAdminPage /></RoleRoute>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

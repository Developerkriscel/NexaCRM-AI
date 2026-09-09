import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000)
const LOGIN_TIMEOUT_MS = Number(import.meta.env.VITE_LOGIN_TIMEOUT_MS || 60000)

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
})

const authClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: LOGIN_TIMEOUT_MS,
  withCredentials: true,
})

const normalizeJwtToken = (token) => {
  if (typeof token !== 'string') return null
  const trimmed = token.trim()
  if (!trimmed) return null
  const raw = trimmed.toLowerCase().startsWith('bearer ') ? trimmed.slice(7).trim() : trimmed
  if (raw.split('.').length === 3 && !raw.includes(' ')) return raw
  return null
}

const readTokenFromAuthResponse = (payload) => {
  if (!payload || typeof payload !== 'object') return null
  return normalizeJwtToken(
    payload.accessToken ??
    payload.token ??
    payload.access_token ??
    payload.jwt ??
    null
  )
}

let refreshPromise = null

const buildNormalizedError = (err, { auth = false } = {}) => {
  const status = err?.response?.status
  const data = err?.response?.data
  const defaultMessage = auth
    ? 'Login failed. Please check your credentials and try again.'
    : 'Request failed. Please try again.'

  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data && typeof data === 'object') {
    const msg = data.message || data.error
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }

  if (auth) {
    if (status === 401) {
      return 'Invalid email or password.'
    }
    if (status === 403) {
      return 'Access denied. Check your workspace permissions or sign in again.'
    }
    if (status === 404) {
      return 'We could not find an account for that email. Check the email address or tenant.'
    }
    if (status === 422 || status === 400) {
      return 'Please enter a valid email and password.'
    }
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim()
  return defaultMessage
}

const refreshSession = async () => {
  const { refreshToken } = useAuthStore.getState()
  const jwt = normalizeJwtToken(refreshToken)
  if (!jwt) return null

  if (!refreshPromise) {
    refreshPromise = authClient
      .post('/auth/refresh', { refreshToken: jwt })
      .then((res) => res.data)
      .finally(() => {
        refreshPromise = null
      })
  }

  const refreshed = await refreshPromise
  const nextAccessToken = readTokenFromAuthResponse(refreshed)
  const nextRefreshToken = normalizeJwtToken(refreshed?.refreshToken) ?? jwt
  if (!nextAccessToken) return null

  useAuthStore.getState().setTokens(nextAccessToken, nextRefreshToken)
  return nextAccessToken
}

const parseApiError = (err, options = {}) => {
  const isTimeout =
    err?.code === 'ECONNABORTED' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('timeout'))
  if (isTimeout) {
    const configuredTimeout = Number(err?.config?.timeout || API_TIMEOUT_MS)
    return `Request timed out after ${configuredTimeout}ms. Please retry.`
  }

  if (options.auth) {
    return buildNormalizedError(err, { auth: true })
  }

  const status = err?.response?.status
  const data = err?.response?.data
  if (status === 403) {
    if (typeof data === 'string' && data.trim()) return data.trim()
    if (data && typeof data === 'object') {
      const msg = data.message || data.error
      if (typeof msg === 'string' && msg.trim()) return msg.trim()
    }
    return 'Access denied (403). You may not have permission for this action.'
  }
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data && typeof data === 'object') {
    const msg = data.message || data.error
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim()
  return 'Request failed. Please try again.'
}

authClient.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject({
    message: parseApiError(err, { auth: true }),
    status: err?.response?.status,
    data: err?.response?.data,
    code: err?.code,
  })
)

// Request interceptor — attach JWT
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    const jwt = normalizeJwtToken(token)

    if (jwt) {
      config.headers.Authorization = `Bearer ${jwt}`
    } else {
      delete config.headers.Authorization
    }
    return config
  },
  (err) => Promise.reject(err)
)

// Response interceptor — handle 401
api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const originalRequest = err.config || {}
    const isAuthEndpoint = err.config?.url?.includes('/auth/')
    if (err.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const nextToken = await refreshSession()
        if (nextToken) {
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${nextToken}`,
          }
          return api(originalRequest)
        }
      } catch {
        // fall through to logout below
      }

      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') window.location.assign('/login')
    }
    return Promise.reject({
      message: parseApiError(err),
      status: err?.response?.status,
      data: err?.response?.data,
      code: err?.code,
    })
  }
)

// ──────────────────────────────────────────
//  Auth
// ──────────────────────────────────────────
export const authAPI = {
  login:  (data) => authClient.post('/auth/login', data),
  logout: ()     => api.post('/auth/logout'),
  me:     ()     => api.get('/auth/me'),
  updateMe:(data)=> api.put('/auth/me', data),
  refresh:(refreshToken) => authClient.post('/auth/refresh', refreshToken ? { refreshToken } : {}),
}

// ──────────────────────────────────────────
//  Leads
// ──────────────────────────────────────────
export const leadsAPI = {
  getAll:    (params) => api.get('/leads', { params }),
  getById:   (id)     => api.get(`/leads/${id}`),
  findDuplicates: (params) => api.get('/leads/duplicates', { params }),
  create:    (data)   => api.post('/leads', data),
  update:    (id, d)  => api.put(`/leads/${id}`, d),
  delete:    (id)     => api.delete(`/leads/${id}`),
  bulkDelete:(ids)    => api.post('/leads/bulk-delete', { ids }),
  merge:     (id, duplicateId) => api.post(`/leads/${id}/merge`, { duplicateId }),
  reopen:    (id, data) => api.post(`/leads/${id}/reopen`, data ?? {}),
  getAging:  (id) => api.get(`/leads/${id}/aging`),
  getAssignmentHistory: (id) => api.get(`/leads/${id}/assignment-history`),
  import:    (file)   => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/leads/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  export:    (params) => api.get('/leads/export', { params, responseType: 'blob' }),
  score:     (id)     => api.post(`/leads/${id}/score`),
  convert:   (id, d)  => api.post(`/leads/${id}/convert`, d ?? {}),
  callNow:   (id, d)  => api.post(`/leads/${id}/call`, d ?? {}),
  getActivities:(id)   => api.get(`/leads/${id}/activities`),
  addActivity: (id, d) => api.post(`/leads/${id}/activities`, d),
}

// ──────────────────────────────────────────
//  Tasks / Follow-ups
// ──────────────────────────────────────────
export const tasksAPI = {
  getAll:      (params) => api.get('/tasks', { params }),
  getById:     (id)     => api.get(`/tasks/${id}`),
  getByLead:   (leadId) => api.get(`/tasks/lead/${leadId}`),
  dueToday:    ()       => api.get('/tasks/due-today'),
  dueTomorrow: ()       => api.get('/tasks/due-tomorrow'),
  overdue:     ()       => api.get('/tasks/overdue'),
  create:      (data)   => api.post('/tasks', data),
  update:      (id, d)  => api.put(`/tasks/${id}`, d),
  complete:    (id)     => api.patch(`/tasks/${id}/complete`),
  delete:      (id)     => api.delete(`/tasks/${id}`),
}

export const callsAPI = {
  trigger: (leadId, d) => api.post(`/calls/trigger/${leadId}`, d ?? {}),
  getByLead: (leadId) => api.get(`/calls/${leadId}`),
  getIntelligence: (leadId) => api.get(`/calls/${leadId}/intelligence`),
  retry: (callId) => api.post(`/calls/retry/${callId}`),
}

// ──────────────────────────────────────────
//  Deals / Pipeline
// ──────────────────────────────────────────
export const dealsAPI = {
  getAll:       (params)   => api.get('/deals', { params }),
  getBoard:     (params)   => api.get('/deals/board', { params, timeout: Number(import.meta.env.VITE_DEALS_BOARD_TIMEOUT_MS || 25000) }),
  getById:      (id)       => api.get(`/deals/${id}`),
  create:       (data)     => api.post('/deals', data),
  update:       (id, d)    => api.put(`/deals/${id}`, d),
  delete:       (id)       => api.delete(`/deals/${id}`),
  moveStage:    (id, stage)=> api.patch(`/deals/${id}/stage`, { stage }),
  getActivities:(id)       => api.get(`/deals/${id}/activities`),
  addActivity:  (id, d)    => api.post(`/deals/${id}/activities`, d),
}

// ──────────────────────────────────────────
//  Customers
// ──────────────────────────────────────────
export const customersAPI = {
  getAll:  (params) => api.get('/customers', { params }),
  getById: (id)     => api.get(`/customers/${id}`),
  create:  (data)   => api.post('/customers', data),
  update:  (id, d)  => api.put(`/customers/${id}`, d),
  delete:  (id)     => api.delete(`/customers/${id}`),
}

// ──────────────────────────────────────────
//  Communications
// ──────────────────────────────────────────
export const commsAPI = {
  sendEmail:        (data)   => api.post('/communications/email/send', data),
  sendChannel:      (data)   => api.post('/communications/send-channel', data),
  getWhatsAppConversations:  () => api.get('/communications/whatsapp/conversations'),
  getWhatsAppMessages:       (contact) => api.get('/communications/whatsapp/messages', { params: { contact } }),
  getFacebookConversations:  () => api.get('/communications/facebook/conversations'),
  getFacebookMessages:       (psid) => api.get('/communications/facebook/messages', { params: { psid } }),
  getInstagramConversations: () => api.get('/communications/instagram/conversations'),
  getInstagramMessages:      (igsid) => api.get('/communications/instagram/messages', { params: { igsid } }),
}

// ──────────────────────────────────────────
//  Integrations
// ──────────────────────────────────────────
export const integrationsAPI = {
  getAll:      ()           => api.get('/integrations'),
  getById:     (id)         => api.get(`/integrations/${id}`),
  save:        (id, values) => api.put(`/integrations/${id}`, { values }),
  test:        (id, values) => api.post(`/integrations/${id}/test`, { values }, { timeout: 30000 }),
  sync:        (id, values) => api.post(`/integrations/${id}/sync`, { values }, { timeout: 45000 }),
  disconnect:  (id)         => api.delete(`/integrations/${id}`),
}

// ──────────────────────────────────────────
//  AI Engine
// ──────────────────────────────────────────
export const aiAPI = {
  chat:          (messages) => api.post('/ai/chat', { messages }),
  scoreLead:     (leadId)   => api.post(`/ai/score/${leadId}`),
  predictDeal:   (dealId)   => api.post(`/ai/predict/${dealId}`),
  generateEmail: (data)     => api.post('/ai/generate-email', data),
  getInsights:   ()         => api.get('/ai/insights'),
  nextActions:   (leadId)   => api.get(`/ai/next-actions/${leadId}`),
}

// ──────────────────────────────────────────
//  Automation
// ──────────────────────────────────────────
export const automationAPI = {
  getAll:   ()     => api.get('/workflows'),
  create:   (data) => api.post('/workflows', data),
  update:   (id,d) => api.put(`/workflows/${id}`, d),
  delete:   (id)   => api.delete(`/workflows/${id}`),
  toggle:   (id)   => api.patch(`/workflows/${id}/toggle`),
  getLogs:  (id)   => api.get(`/workflows/${id}/logs`),
}

// ──────────────────────────────────────────
//  Invoices
// ──────────────────────────────────────────
export const invoicesAPI = {
  getAll:    (params) => api.get('/invoices', { params }),
  getById:   (id)     => api.get(`/invoices/${id}`),
  create:    (data)   => api.post('/invoices', data),
  update:    (id, d)  => api.put(`/invoices/${id}`, d),
  delete:    (id)     => api.delete(`/invoices/${id}`),
  markPaid:  (id)     => api.patch(`/invoices/${id}/mark-paid`),
  download:  (id)     => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  sendReminder: (id)  => api.post(`/invoices/${id}/reminder`),
}

// ──────────────────────────────────────────
//  Analytics
// ──────────────────────────────────────────
export const analyticsAPI = {
  getDashboard:   (params) => api.get('/analytics/dashboard', { params }),
  getDashboardWidgets: (params) => api.get('/analytics/dashboard/widgets', { params }),
  getRevenue:     (params) => api.get('/analytics/revenue', { params }),
  getConversion:  (params) => api.get('/analytics/conversion', { params }),
  getTeam:        (params) => api.get('/analytics/team', { params }),
  getCampaigns:   (params) => api.get('/analytics/campaigns', { params }),
  exportReport:   (params) => api.get('/analytics/export', { params, responseType: 'blob' }),
}

// ──────────────────────────────────────────
//  Workspace Settings
// ──────────────────────────────────────────
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
}

// ──────────────────────────────────────────
//  Super Admin / SaaS
// ──────────────────────────────────────────
export const superAdminAPI = {
  getTenants:       () => api.get('/admin/saas/tenants'),
  createTenant:     (data) => api.post('/admin/saas/tenants', data),
  updateTenant:     (id, data) => api.put(`/admin/saas/tenants/${id}`, data),
  activateTenant:   (id) => api.post(`/admin/saas/tenants/${id}/activate`),
  deactivateTenant: (id) => api.post(`/admin/saas/tenants/${id}/deactivate`),
  getPlans:         () => api.get('/admin/saas/plans'),
  getFeatureFlags:  () => api.get('/admin/saas/feature-flags'),
  getBilling:       () => api.get('/admin/saas/billing'),
  getAuditLogs:     () => api.get('/admin/saas/audit-logs'),
}

// ──────────────────────────────────────────
//  Dashboard / Lead Conversion
// ──────────────────────────────────────────
export const dashboardAPI = {
  getLeadConversionSummary:   (params) => api.get('/dashboard/lead-conversion/summary', { params }),
  getLeadConversionFunnel:    (params) => api.get('/dashboard/lead-conversion/funnel', { params }),
  getLeadConversionEmployees: (params) => api.get('/dashboard/lead-conversion/employees', { params }),
  getLeadConversionSources:   (params) => api.get('/dashboard/lead-conversion/sources', { params }),
  getLeadConversionActivities:(params) => api.get('/dashboard/lead-conversion/activities', { params }),
  getLeadConversionTrend:     (params) => api.get('/dashboard/lead-conversion/trend', { params }),
}

// ──────────────────────────────────────────
//  Team
// ──────────────────────────────────────────
export const teamAPI = {
  getAll:   ()     => api.get('/users'),
  getById:  (id)   => api.get(`/users/${id}`),
  invite:   (data) => api.post('/users/invite', data),
  update:   (id,d) => api.put(`/users/${id}`, d),
  delete:   (id)   => api.delete(`/users/${id}`),
  getRoles: ()     => api.get('/users/roles'),
}

// ──────────────────────────────────────────
//  Notifications
// ──────────────────────────────────────────
export const notificationsAPI = {
  getAll:    ()    => api.get('/notifications'),
  markRead:  (id)  => api.patch(`/notifications/${id}/read`),
  markAllRead:()   => api.patch('/notifications/mark-all-read'),
  delete:    (id)  => api.delete(`/notifications/${id}`),
}

export default api

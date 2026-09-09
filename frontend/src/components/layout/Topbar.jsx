import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Search, Sun, Moon, LogOut, User, ChevronDown, RefreshCw, AlertTriangle, Users, Building2, Kanban } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { useNotificationStore } from '../../store/notificationStore'
import { useLeadsStore } from '../../store/leadsStore'
import NotificationBell from '../notifications/NotificationBell'
import NotificationDropdown from '../notifications/NotificationDropdown'
import DelayAlertPanel from './DelayAlertPanel'
import { getLeadAgeMinutes } from '../../utils/leadSla'
import { connectWebSocket, disconnectWebSocket } from '../../services/websocket'
import { authAPI, customersAPI, dealsAPI, leadsAPI } from '../../services/api'

const AVATAR_STYLE_CLASS = {
  brand: 'from-brand-500 to-accent-500',
  ocean: 'from-cyan-500 to-blue-500',
  sunset: 'from-orange-500 to-rose-500',
  forest: 'from-emerald-500 to-teal-500',
  steel: 'from-slate-500 to-slate-700',
}

export default function Topbar({ onMenuClick, onRefresh }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const { unreadCount, addNotification, fetchNotifications } = useNotificationStore()
  const { leads, patchLeadLocal } = useLeadsStore()
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showDelayAlerts, setShowDelayAlerts] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchResults, setSearchResults] = useState({ leads: [], customers: [], deals: [] })
  const [searchLoading, setSearchLoading] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [timeTick, setTimeTick] = useState(Date.now())
  const searchRef = useRef(null)
  const notifRef = useRef(null)
  const delayRef = useRef(null)
  const userRef = useRef(null)
  const avatarStyle = AVATAR_STYLE_CLASS[user?.avatarStyle] ?? AVATAR_STYLE_CLASS.brand

  const SLA_MINUTES = 60

  const delayedLeads = useMemo(() => {
    const nowMs = timeTick
    return (leads ?? []).filter((lead) => {
      const isUnactioned = String(lead?.status ?? '').toLowerCase() === 'new'
      if (!isUnactioned) return false

      const leadSlaMinutes = Number(lead?.followUpSlaMinutes) > 0 ? Number(lead.followUpSlaMinutes) : SLA_MINUTES
      const ageMinutes = getLeadAgeMinutes(lead, nowMs)
      if (ageMinutes === null) return false
      return ageMinutes > leadSlaMinutes
    })
  }, [leads, timeTick])

  const totalDelayAlerts = delayedLeads.length

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false)
      if (delayRef.current && !delayRef.current.contains(e.target)) setShowDelayAlerts(false)
      if (userRef.current && !userRef.current.contains(e.target)) setShowUserMenu(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchResults(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults({ leads: [], customers: [], deals: [] })
      setSearchLoading(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const normalized = query.toLowerCase()
        const [leadPage, customerPage, dealPage] = await Promise.all([
          leadsAPI.getAll({ search: query, size: 5 }),
          customersAPI.getAll({ search: query, size: 5 }),
          dealsAPI.getAll({ page: 0, size: 100 }),
        ])

        if (!active) return

        const leadRows = Array.isArray(leadPage?.content) ? leadPage.content : []
        const customerRows = Array.isArray(customerPage?.content) ? customerPage.content : []
        const dealRows = Array.isArray(dealPage?.content) ? dealPage.content : []

        const filteredDeals = dealRows.filter((deal) => {
          const haystack = [
            deal?.title,
            deal?.name,
            deal?.company,
            deal?.ownerName,
            deal?.owner,
            deal?.stage,
          ].join(' ').toLowerCase()
          return haystack.includes(normalized)
        }).slice(0, 5)

        setSearchResults({
          leads: leadRows.slice(0, 5),
          customers: customerRows.slice(0, 5),
          deals: filteredDeals,
        })
        setShowSearchResults(true)
      } catch {
        if (active) {
          setSearchResults({ leads: [], customers: [], deals: [] })
          setShowSearchResults(true)
        }
      } finally {
        if (active) setSearchLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick(Date.now()), 60 * 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setAvatarBroken(false)
  }, [user?.avatarUrl])

  useEffect(() => {
      try {
        connectWebSocket((incoming) => {
          const type = String(incoming?.type ?? 'lead').toLowerCase()
          const title = incoming?.title ?? 'Notification'
          const message = incoming?.message ?? 'You have a new update'
          addNotification({
            type,
            direction: incoming?.direction,
            title,
            message,
            actionUrl: incoming?.actionUrl || incoming?.action_url || null,
          })
          toast.success(`${title}: ${message}`.slice(0, 120))
        })
      } catch {
        // WebSocket unavailable — real-time notifications disabled
    }

    return () => {
      try { disconnectWebSocket() } catch { /* ignore */ }
    }
  }, [addNotification])

  useEffect(() => {
    fetchNotifications().catch(() => {
      // Notification panel still works with live websocket updates.
    })
  }, [fetchNotifications])

  useEffect(() => {
    const nowIso = new Date(timeTick).toISOString()

    for (const lead of leads ?? []) {
      const isUnactioned = String(lead?.status ?? '').toLowerCase() === 'new'
      if (!isUnactioned) continue

      const ageMinutes = getLeadAgeMinutes(lead, timeTick)
      if (ageMinutes === null) continue

      const nextPatch = {}
      const reminders = []

      if (ageMinutes >= 15 && !lead.reminder15SentAt) {
        nextPatch.reminder15SentAt = nowIso
        reminders.push({
          type: 'task',
          title: 'Lead Reminder (15 min)',
          message: `${lead.name} has no response for 15+ minutes. Please follow up now.`,
        })
      }

      if (ageMinutes >= 45 && !lead.reminder45SentAt) {
        nextPatch.reminder45SentAt = nowIso
        reminders.push({
          type: 'task',
          title: 'Lead Reminder (45 min)',
          message: `${lead.name} is still unattended for 45+ minutes.`,
        })
      }

      if (ageMinutes >= 60 && !lead.reminder60SentAt) {
        nextPatch.reminder60SentAt = nowIso
        reminders.push({
          type: 'task',
          title: 'Lead Reminder (60 min)',
          message: `${lead.name} crossed 60 minutes with no action. Immediate response required.`,
        })
      }

      if (ageMinutes >= 60 && !lead.escalatedAt) {
        nextPatch.escalatedAt = nowIso
        reminders.push({
          type: 'task',
          title: 'Lead Escalated to Admin',
          message: `${lead.name} breached SLA. ${lead.assignedTo || 'Unassigned'} needs immediate review.`,
        })
      }

      if (ageMinutes >= 60 && !lead.reassignedAt) {
        nextPatch.reassignedAt = nowIso
        reminders.push({
          type: 'lead',
          title: 'Lead Needs Reassignment',
          message: `${lead.name} breached SLA and needs manual reassignment. Current owner: ${lead.assignedTo || 'Unassigned'}.`,
        })
      }

      if (Object.keys(nextPatch).length > 0) {
        patchLeadLocal(lead.id, (prev) => ({ ...prev, ...nextPatch }))
        reminders.forEach((notification) => addNotification(notification))
      }
    }
  }, [timeTick, leads, addNotification, patchLeadLocal])

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch {
      // Ignore API logout failure and clear local state anyway.
    }
    logout()
    navigate('/login')
  }

  const handleRefresh = () => {
    if (typeof onRefresh === 'function') {
      onRefresh()
      return
    }
    navigate(0)
  }

  const navigateToResult = (kind) => {
    const query = searchQuery.trim()
    if (!query) return

    const targetPath =
      kind === 'customer' ? `/customers?search=${encodeURIComponent(query)}` :
      kind === 'deal' ? `/pipeline?search=${encodeURIComponent(query)}` :
      `/leads?search=${encodeURIComponent(query)}`

    setShowSearchResults(false)
    setSearchQuery('')
    navigate(targetPath)
  }

  return (
    <header className="sticky top-0 z-20 min-h-16 flex flex-wrap sm:flex-nowrap items-center px-3 sm:px-4 py-2 sm:py-0 gap-2 sm:gap-4
                       bg-white/80 dark:bg-slate-950/90 backdrop-blur-md
                       border-b border-slate-200/60 dark:border-slate-800/60">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div ref={searchRef} className="relative order-3 w-full sm:order-none sm:w-auto flex-1 sm:max-w-md">
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200
                         ${searchFocused
                           ? 'bg-white dark:bg-slate-900/90 ring-2 ring-brand-500/40 shadow-sm'
                           : 'bg-slate-100 dark:bg-slate-900/60'}`}>
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSearchResults(true)
            }}
            onFocus={() => {
              setSearchFocused(true)
              if (searchQuery.trim().length >= 2) setShowSearchResults(true)
            }}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const firstResult =
                  searchResults.leads[0] ||
                  searchResults.customers[0] ||
                  searchResults.deals[0]
                if (firstResult) {
                  navigateToResult(
                    searchResults.leads[0] ? 'lead' :
                    searchResults.customers[0] ? 'customer' : 'deal'
                  )
                }
              }
              if (e.key === 'Escape') {
                setShowSearchResults(false)
              }
            }}
            placeholder="Search leads, customers, and pipeline…"
            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 rounded text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            ⌘K
          </kbd>
        </div>

        <AnimatePresence>
          {showSearchResults && searchQuery.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full mt-2 z-40 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search results</p>
                {searchLoading && <span className="text-[11px] text-slate-400">Searching…</span>}
              </div>

              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {(!searchLoading && !searchResults.leads.length && !searchResults.customers.length && !searchResults.deals.length) ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No matches for “{searchQuery.trim()}”.
                  </div>
                ) : (
                  <>
                    {searchResults.leads.length > 0 && (
                      <div className="px-2 py-2">
                        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Leads</p>
                        <div className="space-y-1">
                          {searchResults.leads.map((lead) => (
                            <button
                              key={`lead-${lead.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => navigateToResult('lead')}
                              className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center text-brand-600 dark:text-brand-300 flex-shrink-0">
                                <Users className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{lead.name || 'Untitled lead'}</p>
                                <p className="text-xs text-slate-500 truncate">{lead.company || lead.email || 'Lead record'}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.customers.length > 0 && (
                      <div className="px-2 py-2 border-t border-slate-100 dark:border-slate-800">
                        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Customers</p>
                        <div className="space-y-1">
                          {searchResults.customers.map((customer) => (
                            <button
                              key={`customer-${customer.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => navigateToResult('customer')}
                              className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-950/30 flex items-center justify-center text-accent-600 dark:text-accent-300 flex-shrink-0">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{customer.name || 'Untitled customer'}</p>
                                <p className="text-xs text-slate-500 truncate">{customer.company || customer.email || 'Customer record'}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.deals.length > 0 && (
                      <div className="px-2 py-2 border-t border-slate-100 dark:border-slate-800">
                        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Pipeline</p>
                        <div className="space-y-1">
                          {searchResults.deals.map((deal) => (
                            <button
                              key={`deal-${deal.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => navigateToResult('deal')}
                              className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 flex-shrink-0">
                                <Kanban className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{deal.title || 'Untitled deal'}</p>
                                <p className="text-xs text-slate-500 truncate">{deal.company || deal.ownerName || deal.owner || 'Pipeline record'}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="order-2 ml-auto flex items-center gap-1">
        <button
          onClick={handleRefresh}
          className="hidden sm:inline-flex p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          title="Refresh"
          aria-label="Refresh page"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        <div className="relative" ref={delayRef}>
          <button
            onClick={() => setShowDelayAlerts(!showDelayAlerts)}
            className="relative p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 transition-colors"
            title="Lead delay alert"
            aria-label="Lead delay alert"
          >
            <AlertTriangle className="w-5 h-5" />
            {totalDelayAlerts > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {totalDelayAlerts > 9 ? '9+' : totalDelayAlerts}
              </span>
            )}
          </button>
          <AnimatePresence>
            {showDelayAlerts && (
              <DelayAlertPanel
                delayedLeads={delayedLeads}
                onOpenPipeline={() => navigate('/pipeline')}
                slaMinutes={SLA_MINUTES}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <NotificationBell
            unreadCount={unreadCount}
            active={showNotifications}
            onClick={() => setShowNotifications((current) => !current)}
          />
          <AnimatePresence>
            {showNotifications && (
              <NotificationDropdown onClose={() => setShowNotifications(false)} />
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="Open user menu"
            aria-expanded={showUserMenu}
            className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarStyle} flex items-center justify-center text-white text-xs font-bold overflow-hidden`}>
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
            <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-300">
              {user?.name?.split(' ')[0]}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-2 w-52 glass-card py-1 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    navigate('/profile')
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <User className="w-4 h-4" />
                  My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

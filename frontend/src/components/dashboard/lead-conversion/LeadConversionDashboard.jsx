import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Area, AreaChart, Bar, BarChart, Cell, ComposedChart, Legend, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, FunnelChart, Funnel, LabelList
} from 'recharts'
import {
  Activity, CalendarDays, ChevronDown, Clock3, Filter, FolderClock,
  Globe2, Layers3, LineChart as LineChartIcon, Repeat2, Search, Sparkles,
  Target, TrendingDown, TrendingUp, Users, UserCheck
} from 'lucide-react'
import { dashboardAPI } from '../../../services/api'
import { useAuthStore } from '../../../store/authStore'

const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'LOST', label: 'Lost' },
]

const SOURCE_COLORS = [
  '#7c3aed',
  '#ec4899',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#6366f1',
]

const STAGE_COLORS = {
  NEW: '#8b5cf6',
  ASSIGNED: '#6366f1',
  CONTACTED: '#0ea5e9',
  INTERESTED: '#14b8a6',
  QUALIFIED: '#22c55e',
  PROPOSAL_SENT: '#f59e0b',
  CONVERTED: '#10b981',
  LOST: '#ef4444',
}

const CARD_CONFIG = [
  { key: 'totalLeads', title: 'Total Leads', helper: 'current period vs previous period', icon: Users, color: 'from-brand-500 to-accent-500', accent: 'text-brand-600' },
  { key: 'newLeads', title: 'New Leads', helper: 'new leads in selected range', icon: Sparkles, color: 'from-cyan-500 to-brand-500', accent: 'text-cyan-600' },
  { key: 'assignedLeads', title: 'Assigned Leads', helper: 'assigned and in progress', icon: Repeat2, color: 'from-cyan-500 to-sky-600', accent: 'text-cyan-600' },
  { key: 'contactedLeads', title: 'Contacted Leads', helper: 'contacted leads in selected range', icon: Activity, color: 'from-cyan-500 to-sky-600', accent: 'text-cyan-600' },
  { key: 'interestedLeads', title: 'Interested Leads', helper: 'showing buying intent', icon: Globe2, color: 'from-emerald-500 to-teal-600', accent: 'text-emerald-600' },
  { key: 'qualifiedLeads', title: 'Qualified Leads', helper: 'qualified leads in selected range', icon: Target, color: 'from-emerald-500 to-green-600', accent: 'text-emerald-600' },
  { key: 'proposalSentLeads', title: 'Proposal Sent', helper: 'proposals sent this period', icon: LineChartIcon, color: 'from-orange-500 to-amber-600', accent: 'text-orange-600' },
  { key: 'convertedLeads', title: 'Converted Leads', helper: 'won leads this period', icon: UserCheck, color: 'from-emerald-500 to-teal-600', accent: 'text-emerald-600' },
  { key: 'lostLeads', title: 'Lost Leads', helper: 'lost leads this period', icon: TrendingDown, color: 'from-rose-500 to-red-600', accent: 'text-rose-600' },
  { key: 'pendingFollowUps', title: 'Pending Follow-ups', helper: 'follow-ups awaiting action', icon: Clock3, color: 'from-amber-500 to-orange-600', accent: 'text-amber-600' },
  { key: 'conversionRate', title: 'Conversion Rate %', helper: 'won leads rate vs last period', icon: TrendingUp, color: 'from-emerald-500 to-teal-600', accent: 'text-emerald-600', percent: true },
  { key: 'revenueFromConvertedLeads', title: 'Revenue from Converted Leads', helper: 'won revenue this period', icon: FolderClock, color: 'from-cyan-500 to-blue-600', accent: 'text-cyan-600', currency: true },
]

const prettyNumber = (value) => {
  const n = Number(value || 0)
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`
  return Number.isInteger(n) ? `${n}` : n.toFixed(1)
}

const prettyCurrency = (value) => `₹${prettyNumber(Number(value || 0) / 100000)}L`

const prettyPercent = (value) => `${Number(value || 0).toFixed(1)}%`

const getTrendGranularity = (filter, startDate, endDate) => {
  if (filter === 'today' || filter === 'yesterday' || filter === 'thisWeek') return 'day'
  if (filter === 'thisMonth' || filter === 'lastMonth') return 'day'
  if (filter !== 'custom') return 'day'
  if (!startDate || !endDate) return 'day'
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'day'
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

const formatDateRangeLabel = (filter, startDate, endDate) => {
  const selected = DATE_FILTERS.find((opt) => opt.value === filter)?.label || 'This Month'
  if (filter !== 'custom') return selected
  if (!startDate && !endDate) return 'Custom Range'
  return `${startDate || 'Start'} → ${endDate || 'End'}`
}

const metricValue = (metric, { currency = false, percent = false } = {}) => {
  if (!metric) return currency ? '₹0.0L' : percent ? '0.0%' : '0'
  if (currency) return prettyCurrency(metric.value)
  if (percent) return prettyPercent(metric.value)
  return prettyNumber(metric.value)
}

function MetricCard({ item, metric }) {
  const Icon = item.icon
  const change = Number(metric?.changePercent || 0)
  const positive = change >= 0
  const changeLabel = positive ? 'Up' : 'Down'
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="flex aspect-[3/2] w-full flex-col overflow-hidden rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] dark:border-slate-700/60 dark:bg-slate-900/80 dark:shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className={`h-12 w-12 rounded-[18px] bg-gradient-to-br ${item.color} flex items-center justify-center shadow-[0_10px_20px_rgba(15,23,42,0.16)]`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${positive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-300'}`}>
            <span>{positive ? '↗' : '↘'}</span>
            <span>{changeLabel}</span>
            <span>{prettyPercent(Math.abs(change))}</span>
          </span>
        </div>
        <div className="pt-4">
          <p className="text-[2.1rem] font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50">
            {metricValue(metric, { currency: item.currency, percent: item.percent })}
          </p>
          <p className="mt-2.5 text-[15px] font-medium leading-snug text-slate-600 dark:text-slate-200">{item.title}</p>
          <p className="mt-1.5 text-[12px] leading-snug text-slate-400 dark:text-slate-400">{item.helper}</p>
        </div>
      </div>
    </motion.div>
  )
}

function SectionShell({ title, icon: Icon, subtitle, action }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        </div>
        {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function LoadingCard() {
  return <div className="aspect-[3/2] w-full rounded-[24px] border border-slate-200/70 bg-slate-100/50 dark:border-slate-700/60 dark:bg-slate-800/40 animate-pulse" />
}

function ChartEmptyState({ label }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
      {label}
    </div>
  )
}

export default function LeadConversionDashboard() {
  const { user } = useAuthStore()
  const isFullAccess = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)
  const dateFilterRef = useRef(null)
  const [filter, setFilter] = useState('thisMonth')
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [status, setStatus] = useState('all')
  const [sortBy, setSortBy] = useState('conversion')
  const [sortDir, setSortDir] = useState('desc')
  const [summary, setSummary] = useState(null)
  const [funnel, setFunnel] = useState([])
  const [employees, setEmployees] = useState([])
  const [sources, setSources] = useState([])
  const [activities, setActivities] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const trendGranularity = useMemo(() => getTrendGranularity(filter, startDate, endDate), [filter, startDate, endDate])

  const requestParams = useMemo(() => {
    const base = {
      filter,
      status: status === 'all' ? undefined : status,
      employeeId: employeeId || undefined,
    }
    if (filter === 'custom') {
      base.startDate = startDate || undefined
      base.endDate = endDate || undefined
    }
    return base
  }, [filter, startDate, endDate, employeeId, status])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target)) {
        setDateMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    const load = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const employeeParams = { ...requestParams, sortBy, sortDir }
        const [summaryRes, funnelRes, employeesRes, sourcesRes, activitiesRes, trendRes] = await Promise.all([
          dashboardAPI.getLeadConversionSummary(requestParams),
          dashboardAPI.getLeadConversionFunnel(requestParams),
          dashboardAPI.getLeadConversionEmployees(employeeParams),
          dashboardAPI.getLeadConversionSources(requestParams),
          dashboardAPI.getLeadConversionActivities({ ...requestParams, limit: 12 }),
          dashboardAPI.getLeadConversionTrend({ ...requestParams, granularity: trendGranularity }),
        ])

        if (!mounted || controller.signal.aborted) return
        setSummary(summaryRes)
        setFunnel(Array.isArray(funnelRes) ? funnelRes : [])
        setEmployees(Array.isArray(employeesRes) ? employeesRes : [])
        setSources(Array.isArray(sourcesRes) ? sourcesRes : [])
        setActivities(Array.isArray(activitiesRes) ? activitiesRes : [])
        setTrend(Array.isArray(trendRes) ? trendRes : [])
        setLastUpdated(new Date().toISOString())
      } catch (err) {
        if (!mounted || controller.signal.aborted) return
        setError(err?.message || 'Failed to load lead conversion dashboard')
      } finally {
        if (mounted && !controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    load()
    const id = window.setInterval(() => load({ silent: true }), 60 * 1000)

    return () => {
      mounted = false
      controller.abort()
      window.clearInterval(id)
    }
  }, [requestParams, sortBy, sortDir, trendGranularity, refreshTick])

  const employeeOptions = useMemo(() => {
    if (!isFullAccess) return []
    return employees.map((row) => ({ value: row.employeeId, label: row.employeeName }))
  }, [employees, isFullAccess])

  const summaryCards = useMemo(() => CARD_CONFIG.map((item) => ({
    ...item,
    metric: summary?.[item.key],
  })), [summary])

  const funnelData = useMemo(() => funnel.map((row, index) => ({
    ...row,
    color: STAGE_COLORS[row.key] || SOURCE_COLORS[index % SOURCE_COLORS.length],
    dropOffLabel: `${prettyPercent(row.dropOffPercent)} drop-off`,
    conversionLabel: `${prettyPercent(row.conversionPercent)} conversion`,
  })), [funnel])

  const sourcePieData = useMemo(() => sources.map((row, index) => ({
    name: row.sourceLabel,
    value: Number(row.totalLeads || 0),
    converted: Number(row.convertedLeads || 0),
    rate: Number(row.conversionRate || 0),
    color: SOURCE_COLORS[index % SOURCE_COLORS.length],
    bestPerforming: row.bestPerforming,
  })), [sources])

  const statusDonutData = useMemo(() => (summary?.statusBreakdown || []).map((row) => ({
    name: row.label,
    value: Number(row.count || 0),
    key: row.key,
    color: STAGE_COLORS[row.key] || '#8b5cf6',
  })), [summary])

  const bestSource = useMemo(() => sources.find((row) => row.bestPerforming) || sources[0] || null, [sources])

  const onSort = (key) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir(key === 'pending' ? 'asc' : 'desc')
      return key
    })
  }

  return (
    <section className="space-y-2.5 sm:space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-card p-2.5 sm:p-3.5"
      >
        <SectionShell
          title="Lead Conversion Dashboard"
          icon={Layers3}
          subtitle={`Realtime conversion analytics for ${formatDateRangeLabel(filter, startDate, endDate)}.`}
        />

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div ref={dateFilterRef} className="relative flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <button
              type="button"
              onClick={() => setDateMenuOpen((open) => !open)}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 bg-transparent text-left text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
            >
              <span className="truncate">{DATE_FILTERS.find((option) => option.value === filter)?.label || 'This Month'}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>

            {dateMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-950">
                {DATE_FILTERS.map((option) => {
                  const active = option.value === filter
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFilter(option.value)
                        setDateMenuOpen(false)
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900/70'
                      }`}
                    >
                      <span>{option.label}</span>
                      {active && <span className="text-[11px] font-semibold uppercase tracking-wide">Selected</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {isFullAccess && (
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="input w-full rounded-xl border-slate-200 bg-white/90 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/70 lg:w-44"
            >
              <option value="">All Employees</option>
              {employeeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input w-full rounded-xl border-slate-200 bg-white/90 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/70 lg:w-44"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 lg:w-40">
            <LineChartIcon className="h-4 w-4 shrink-0 text-brand-500" />
            <span>{trendGranularity.charAt(0).toUpperCase() + trendGranularity.slice(1)} trend</span>
          </div>
        </div>

        {filter === 'custom' && (
          <div className="mt-2 flex flex-col gap-2 lg:flex-row">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input w-full rounded-xl border-slate-200 bg-white/90 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/70 lg:w-44"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input w-full rounded-xl border-slate-200 bg-white/90 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/70 lg:w-44"
            />
          </div>
        )}

          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-brand-500" />
            Auto-refreshes every minute and updates the dashboard in real time.
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <LineChartIcon className="h-3.5 w-3.5 text-brand-500" />
            {trendGranularity.charAt(0).toUpperCase() + trendGranularity.slice(1)} trend view
          </span>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => <LoadingCard key={index} />)}
        </div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {summaryCards.map((item) => (
              <MetricCard key={item.key} item={item} metric={item.metric} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
            <div className="glass-card p-3 sm:p-4 xl:col-span-7">
              <SectionShell
                title="Lead Conversion Funnel"
                icon={Target}
                subtitle="Stage progression with drop-off between each step."
                action={bestSource ? <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300">Best source: {bestSource.sourceLabel}</span> : null}
              />
              {funnelData.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <FunnelChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const stage = payload[0].payload
                        return (
                          <div className="glass-card px-4 py-3 text-sm shadow-xl">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{stage.label}</p>
                            <p className="mt-1 text-slate-600 dark:text-slate-400">Count: <span className="font-semibold text-slate-800 dark:text-slate-200">{prettyNumber(stage.count)}</span></p>
                            <p className="text-slate-600 dark:text-slate-400">Drop-off: <span className="font-semibold text-slate-800 dark:text-slate-200">{stage.dropOffLabel}</span></p>
                            <p className="text-slate-600 dark:text-slate-400">Conversion: <span className="font-semibold text-slate-800 dark:text-slate-200">{stage.conversionLabel}</span></p>
                          </div>
                        )
                      }}
                    />
                    <Funnel dataKey="count" data={funnelData} isAnimationActive>
                      <LabelList position="right" fill="#475569" stroke="none" dataKey="label" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState label="No funnel data available for the selected range." />
              )}
            </div>

            <div className="glass-card p-3 sm:p-4 xl:col-span-5">
              <SectionShell
                title="Trend Line"
                icon={LineChartIcon}
                subtitle="Lead movement, conversion, and revenue over time."
              />
              {trend.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="glass-card px-4 py-3 text-sm shadow-xl">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{label}</p>
                            {payload.map((entry) => (
                              <p key={entry.dataKey} style={{ color: entry.color }}>
                                {entry.name}: <span className="font-semibold">{entry.dataKey === 'revenueGenerated' ? prettyCurrency(entry.value) : prettyNumber(entry.value)}</span>
                              </p>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="leadCount" name="Leads" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="convertedCount" name="Converted" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    <Area yAxisId="right" type="monotone" dataKey="revenueGenerated" name="Revenue" stroke="#f59e0b" fill="rgba(245,158,11,0.18)" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState label="No trend data available for the selected range." />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="glass-card p-4 sm:p-5 xl:col-span-7">
              <SectionShell
                title="Employee Performance"
                icon={Users}
                subtitle="Sort by conversion, pending leads, revenue, or name."
                action={(
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onSort('conversion')} className="badge bg-white/80 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">Top conversion</button>
                    <button type="button" onClick={() => onSort('pending')} className="badge bg-white/80 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">Lowest pending</button>
                    <button type="button" onClick={() => onSort('revenue')} className="badge bg-white/80 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">Revenue</button>
                  </div>
                )}
              />

              {employees.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={employees.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                    <XAxis dataKey="employeeName" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="glass-card px-4 py-3 text-sm shadow-xl">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{label}</p>
                            {payload.map((entry) => (
                              <p key={entry.dataKey} style={{ color: entry.color }}>
                                {entry.name}: <span className="font-semibold">{prettyNumber(entry.value)}</span>
                              </p>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend />
                    <Bar dataKey="assignedLeads" name="Assigned" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="convertedLeads" name="Converted" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="pendingLeads" name="Pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState label="No employee performance data yet." />
              )}

              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/70">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/90 dark:bg-slate-900/60">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Assigned</th>
                        <th className="px-4 py-3">Contacted</th>
                        <th className="px-4 py-3">Converted</th>
                        <th className="px-4 py-3">Lost</th>
                        <th className="px-4 py-3">Pending</th>
                        <th className="px-4 py-3">Follow-ups</th>
                        <th className="px-4 py-3">Conv. Rate</th>
                        <th className="px-4 py-3">Resp. Time</th>
                        <th className="px-4 py-3">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {employees.map((row) => (
                        <tr key={row.employeeId} className="bg-white/60 dark:bg-slate-950/20">
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{row.employeeName}</td>
                          <td className="px-4 py-3">{prettyNumber(row.assignedLeads)}</td>
                          <td className="px-4 py-3">{prettyNumber(row.contactedLeads)}</td>
                          <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">{prettyNumber(row.convertedLeads)}</td>
                          <td className="px-4 py-3 text-rose-600 dark:text-rose-400">{prettyNumber(row.lostLeads)}</td>
                          <td className="px-4 py-3 text-amber-600 dark:text-amber-400">{prettyNumber(row.pendingLeads)}</td>
                          <td className="px-4 py-3">{prettyNumber(row.followUpsDone)}</td>
                          <td className="px-4 py-3 font-semibold">{prettyPercent(row.conversionRate)}</td>
                          <td className="px-4 py-3">{prettyNumber(row.averageResponseMinutes)} min</td>
                          <td className="px-4 py-3 font-semibold">{prettyCurrency(row.revenueGenerated)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-5 xl:col-span-5 space-y-4">
              <div>
                <SectionShell
                  title="Lead Source Analytics"
                  icon={Globe2}
                  subtitle="Conversion rates and revenue by source."
                />
                {sourcePieData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sourcePieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                        {sourcePieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name, props) => [`${prettyNumber(value)} leads`, props.payload.name]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState label="No source analytics available." />
                )}
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-400">
                  {sourcePieData.map((row) => (
                    <div key={row.name} className="flex items-center justify-between rounded-xl border border-slate-200/70 px-3 py-2 dark:border-slate-700/70">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{row.name}</span>
                      </div>
                      <span>{prettyPercent(row.rate)} conversion</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <SectionShell
                  title="Status Donut"
                  icon={Repeat2}
                  subtitle="Current pipeline balance by status."
                />
                {statusDonutData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusDonutData} dataKey="value" cx="50%" cy="50%" innerRadius={54} outerRadius={78} paddingAngle={3}>
                        {statusDonutData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [`${prettyNumber(value)} leads`, props.payload.name]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState label="No status data available." />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <div className="glass-card p-3 sm:p-4 xl:col-span-7">
              <SectionShell
                title="Lead Activity Workflow"
                icon={CalendarDays}
                subtitle="Latest lifecycle events from the lead stream and activity logs."
              />
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                {activities.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No recent lead activities for the selected filters.
                  </div>
                )}
                {activities.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-700/70 dark:bg-slate-950/20">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.leadName || 'Unnamed lead'}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {item.employeeName || 'Unassigned'} · {item.source || 'Manual Entry'}
                        </p>
                      </div>
                      <span className="badge" style={{ backgroundColor: `${(STAGE_COLORS[item.newStatus] || '#7c3aed')}14`, color: STAGE_COLORS[item.newStatus] || '#7c3aed' }}>
                        {item.activityType}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.oldStatus || 'Unknown'}</span>
                      <span className="text-slate-400">→</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.newStatus || 'Unknown'}</span>
                      <span className="ml-auto flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Clock3 className="h-3 w-3" />
                        {item.occurredAt ? new Date(item.occurredAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Just now'}
                      </span>
                    </div>
                    {item.notes && <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.notes}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-3 sm:p-4 xl:col-span-5">
              <SectionShell
                title="Source Performance"
                icon={LineChartIcon}
                subtitle="Best performing source, conversion counts, and revenue."
              />
              <div className="space-y-3">
                {bestSource ? (
                  <div className="rounded-2xl border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-800/50 dark:bg-brand-950/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Best source</p>
                    <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">{bestSource.sourceLabel}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {prettyPercent(bestSource.conversionRate)} conversion · {prettyNumber(bestSource.convertedLeads)} converted
                    </p>
                  </div>
                ) : (
                  <ChartEmptyState label="No source data for this filter." />
                )}

                <div className="grid grid-cols-1 gap-2">
                  {sources.map((row) => (
                    <div key={row.sourceKey} className="rounded-2xl border border-slate-200/70 px-4 py-3 dark:border-slate-700/70">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{row.sourceLabel}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{prettyNumber(row.totalLeads)} leads · {prettyNumber(row.convertedLeads)} converted</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{prettyPercent(row.conversionRate)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{prettyCurrency(row.revenueGenerated)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

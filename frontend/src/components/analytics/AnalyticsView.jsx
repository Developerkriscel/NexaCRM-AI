import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { BarChart3, TrendingUp, Trophy, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { leadsAPI, dealsAPI, invoicesAPI, teamAPI, customersAPI } from '../../services/api'
import {
  buildLeadTrend,
  buildRevenueTrend,
  buildLeadSourceBreakdown,
  buildFunnelBreakdown,
  buildTeamLeaderboard,
  buildCustomerMetrics,
} from '../../utils/liveMetrics'
import { fetchAllPages } from '../../utils/pagination'

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6']

function downloadCSV(rows, filename) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [leads, setLeads] = useState([])
  const [deals, setDeals] = useState([])
  const [invoices, setInvoices] = useState([])
  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [leadRows, dealRows, invoiceRows, userRows, customerRows] = await Promise.all([
          fetchAllPages((params) => leadsAPI.getAll(params), 250).then((result) => result.rows),
          fetchAllPages((params) => dealsAPI.getAll(params), 200).then((result) => result.rows),
          fetchAllPages((params) => invoicesAPI.getAll(params), 200).then((result) => result.rows),
          teamAPI.getAll(),
          fetchAllPages((params) => customersAPI.getAll(params), 200).then((result) => result.rows),
        ])

        if (cancelled) return
        setLeads(Array.isArray(leadRows) ? leadRows : [])
        setDeals(Array.isArray(dealRows) ? dealRows : [])
        setInvoices(Array.isArray(invoiceRows) ? invoiceRows : [])
        setUsers(Array.isArray(userRows) ? userRows : [])
        setCustomers(Array.isArray(customerRows) ? customerRows : [])
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load analytics data')
          toast.error(err?.message || 'Failed to load analytics data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const leadTrend = useMemo(() => buildLeadTrend(leads), [leads])
  const revenueTrend = useMemo(() => buildRevenueTrend(invoices), [invoices])
  const sourceBreakdown = useMemo(() => buildLeadSourceBreakdown(leads), [leads])
  const funnelBreakdown = useMemo(() => buildFunnelBreakdown(leads), [leads])
  const teamLeaderboard = useMemo(() => buildTeamLeaderboard({ users, leads, deals }), [users, leads, deals])
  const customerMetrics = useMemo(() => buildCustomerMetrics({ customers, deals, invoices }), [customers, deals, invoices])

  const summary = useMemo(() => {
    const paidInvoices = invoices.filter((invoice) => String(invoice.status || '').toLowerCase() === 'paid')
    const totalRevenue = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? invoice.subtotal ?? 0), 0)
    const wonDeals = deals.filter((deal) => String(deal.stage || deal.status || '').toLowerCase() === 'won')
    const openDeals = deals.filter((deal) => !['won', 'lost'].includes(String(deal.stage || deal.status || '').toLowerCase())).length
    const activeCustomers = customers.filter((customer) => String(customer.status || '').toLowerCase() === 'active').length
    const avgHealth = customers.length
      ? Math.round(customers.reduce((sum, customer) => sum + Number(customer.healthScore ?? customer.health ?? 0), 0) / customers.length)
      : 0

    return [
      { label: 'Leads', value: leads.length.toLocaleString(), tone: 'brand' },
      { label: 'Open Deals', value: openDeals.toLocaleString(), tone: 'amber' },
      { label: 'Won Deals', value: wonDeals.length.toLocaleString(), tone: 'emerald' },
      { label: 'Paid Revenue', value: `₹${(totalRevenue / 100000).toFixed(1)}L`, tone: 'brand' },
      { label: 'Active Customers', value: activeCustomers.toLocaleString(), tone: 'sky' },
      { label: 'Avg Health', value: `${avgHealth}%`, tone: 'slate' },
    ]
  }, [leads.length, deals, invoices, customers])

  const exportReport = () => {
    const rows = [
      ['=== LEAD TREND ==='],
      ['Month', 'Leads'],
      ...leadTrend.map((row) => [row.month, row.leads]),
      [],
      ['=== REVENUE TREND ==='],
      ['Month', 'Revenue'],
      ...revenueTrend.map((row) => [row.month, row.revenue]),
      [],
      ['=== LEAD SOURCES ==='],
      ['Source', 'Leads'],
      ...sourceBreakdown.map((row) => [row.name, row.value]),
      [],
      ['=== TEAM LEADERBOARD ==='],
      ['Name', 'Leads', 'Deals', 'Revenue'],
      ...teamLeaderboard.map((member) => [member.name, member.leads, member.deals, member.revenue]),
    ]
    downloadCSV(rows, `nexacrm-analytics-${new Date().toISOString().slice(0, 10)}.csv`)
    toast.success('Live analytics report exported as CSV')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-6 animate-pulse">
          <div className="h-6 w-56 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
          <div className="h-4 w-80 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="glass-card p-4 h-24 animate-pulse bg-slate-100 dark:bg-slate-800/40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-500" /> Analytics & Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live operational reporting from leads, deals, invoices, customers, and team data
          </p>
        </div>
        <button onClick={exportReport} className="btn-secondary gap-1.5 text-sm">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      {error ? (
        <div className="glass-card p-4 border border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20 text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.map((item) => (
          <div key={item.label} className="glass-card p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">Monthly Lead Volume</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={leadTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="leads" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">Monthly Paid Revenue</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">Lead Sources</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={sourceBreakdown} dataKey="value" nameKey="name" innerRadius={56} outerRadius={90} paddingAngle={3}>
                {sourceBreakdown.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">Funnel Snapshot</h2>
          <div className="space-y-3">
            {funnelBreakdown.map((stage, index) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="w-28 text-sm text-slate-600 dark:text-slate-400">{stage.stage}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, stage.count * 8)}%` }}
                    transition={{ duration: 0.6, delay: index * 0.05 }}
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                  />
                </div>
                <span className="w-12 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">{stage.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Team Leaderboard</h2>
          </div>
          <div className="space-y-4">
            {teamLeaderboard.map((member) => (
              <div key={member.id} className="flex items-center gap-4">
                <span className="text-2xl w-8">{member.badge}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{member.name}</span>
                    <span className="text-slate-500">₹{(member.revenue / 100000).toFixed(1)}L</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, member.convRate)}%` }}
                      transition={{ duration: 0.7, delay: member.rank * 0.06 }}
                      className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                    />
                  </div>
                  <div className="flex gap-4 mt-1 text-[10px] text-slate-400">
                    <span>{member.leads} leads</span>
                    <span>{member.deals} deals</span>
                    <span>{member.convRate}% conversion</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">Customer Health</h2>
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {customers.slice(0, 8).map((customer, index) => {
              const metric = customerMetrics[index] || { revenue: 0, deals: 0 }
              const health = Number(customer.healthScore ?? customer.health ?? 0)
              return (
                <div key={customer.id} className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{customer.name || customer.company}</p>
                      <p className="text-xs text-slate-400">{customer.primaryContact || customer.contact || '—'}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{health}% health</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-500">
                    <span>Deals: {metric.deals}</span>
                    <span>Revenue: ₹{Number(metric.revenue || 0).toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

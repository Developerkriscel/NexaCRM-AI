import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { UserCircle, Phone, Mail, Activity, Plus, X } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import toast from 'react-hot-toast'
import { customersAPI, dealsAPI, invoicesAPI } from '../../services/api'
import PageHeading from '../ui/PageHeading'
import LoadingState from '../ui/LoadingState'
import { buildCustomerMetrics } from '../../utils/liveMetrics'
import { fetchAllPages } from '../../utils/pagination'

const INDUSTRIES = ['Finance', 'IT', 'SaaS', 'Manufacturing', 'Healthcare', 'E-commerce', 'Retail', 'Education', 'Other']
const HEALTH_COLOR = (h) => h >= 80 ? 'bg-emerald-500' : h >= 60 ? 'bg-amber-500' : 'bg-red-500'
const normalize = (value) => String(value ?? '').trim().toLowerCase()

function formatActivityTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Recently'
  try {
    return `${formatDistanceToNowStrict(date, { addSuffix: true })}`
  } catch {
    return date.toLocaleDateString('en-IN')
  }
}

function buildCustomerActivity(customer, deals = [], invoices = []) {
  if (!customer) return []
  const customerKey = normalize(customer.id || customer.name)
  const customerName = normalize(customer.name)

  const rows = []

  for (const invoice of invoices) {
    const matches = [invoice.customerId, invoice.customerName, invoice.company, invoice.customer]
      .map(normalize)
      .some((value) => value === customerKey || value === customerName)
    if (!matches) continue

    const issueDate = invoice.paidDate || invoice.issueDate || invoice.createdAt || invoice.updatedAt
    rows.push({
      id: `invoice-${invoice.id || invoice.invoiceNumber || issueDate}`,
      label: `Invoice ${String(invoice.invoiceNumber || invoice.id || 'record')} ${normalize(invoice.status) === 'paid' ? 'paid' : 'updated'}`,
      detail: `Total ${Number(invoice.total ?? invoice.subtotal ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`,
      time: formatActivityTime(issueDate),
      stamp: issueDate,
    })
  }

  for (const deal of deals) {
    const matches = [deal.customerId, deal.customerName, deal.company, deal.customer, deal.accountName]
      .map(normalize)
      .some((value) => value === customerKey || value === customerName)
    if (!matches) continue

    const updatedAt = deal.updatedAt || deal.createdAt || deal.actualCloseDate
    const stage = String(deal.stage || deal.status || 'updated').toLowerCase()
    rows.push({
      id: `deal-${deal.id || updatedAt}`,
      label: `Deal ${stage}`,
      detail: `${deal.name || 'Deal'} · ${Number(deal.dealValue ?? deal.value ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`,
      time: formatActivityTime(updatedAt),
      stamp: updatedAt,
    })
  }

  return rows
    .filter((item) => item.stamp)
    .sort((left, right) => new Date(right.stamp).getTime() - new Date(left.stamp).getTime())
    .slice(0, 4)
}

const EMPTY_FORM = { name: '', contact: '', email: '', phone: '', industry: 'IT', status: 'active', revenue: '' }

/* ── Add Customer Modal ─────────────────────────────────────────── */
function AddCustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name    = 'Company name is required'
    if (!form.contact.trim()) e.contact = 'Contact person is required'
    if (!form.email.trim())   e.email   = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.phone.trim())   e.phone   = 'Phone is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    const customer = {
      name: form.name.trim(),
      contact: form.contact.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      industry: form.industry,
      status: form.status,
      revenue: Number(form.revenue) || 0,
      deals: 0,
      since: new Date().toISOString().slice(0, 10),
      health: form.status === 'active' ? 75 : 40,
    }
    const saved = await onSave(customer)
    if (saved) {
      toast.success(`${customer.name} added as a customer`)
      onClose()
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label="Add customer"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        className="glass-card w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-brand-500" /> Add Customer
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Infosys Ltd."
              className={`input mt-1 w-full ${errors.name ? 'ring-2 ring-red-400' : ''}`} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Primary Contact *</label>
            <input value={form.contact} onChange={(e) => set('contact', e.target.value)}
              placeholder="Contact person name"
              className={`input mt-1 w-full ${errors.contact ? 'ring-2 ring-red-400' : ''}`} />
            {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email *</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="contact@company.com"
                className={`input mt-1 w-full ${errors.email ? 'ring-2 ring-red-400' : ''}`} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone *</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                placeholder="+91-98765-43210"
                className={`input mt-1 w-full ${errors.phone ? 'ring-2 ring-red-400' : ''}`} />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Industry</label>
              <select value={form.industry} onChange={(e) => set('industry', e.target.value)} className="input mt-1 w-full">
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input mt-1 w-full">
                <option value="active">Active</option>
                <option value="at-risk">At Risk</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue (₹)</label>
            <input type="number" min={0} value={form.revenue} onChange={(e) => set('revenue', e.target.value)}
              placeholder="0" className="input mt-1 w-full" />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1 text-sm">Add Customer</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function CustomersPage() {
  const [searchParams] = useSearchParams()
  const [customers, setCustomers] = useState([])
  const [dealRows, setDealRows] = useState([])
  const [invoiceRows, setInvoiceRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(4)
  const [pageMeta, setPageMeta] = useState({
    page: 0,
    totalPages: 0,
    total: 0,
    first: true,
    last: true,
  })
  const routeSearch = searchParams.get('search') ?? ''

  const mapCustomerFromApi = (customer, metrics = {}) => ({
    id: customer.id,
    name: customer.name || customer.company || 'Customer',
    contact: customer.primaryContact || 'N/A',
    email: customer.email || '',
    phone: customer.phone || '',
    industry: customer.industry || 'Other',
    revenue: Number(metrics.revenue ?? 0),
    deals: Number(metrics.deals ?? 0),
    status: String(customer.status || 'ACTIVE').toLowerCase().replace('_', '-'),
    since: customer.createdAt ? new Date(customer.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    health: Number(customer.healthScore ?? 75),
  })

  useEffect(() => {
    setSearch(routeSearch)
  }, [routeSearch])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setCurrentPage(0)
  }, [debouncedSearch])

  useEffect(() => {
    let cancelled = false
    const loadCustomers = async () => {
      setLoading(true)
      try {
        const [page, dealsPage, invoicesPage] = await Promise.all([
          customersAPI.getAll({ page: currentPage, size: pageSize, search: debouncedSearch || undefined }),
          fetchAllPages((params) => dealsAPI.getAll(params), 200),
          fetchAllPages((params) => invoicesAPI.getAll(params), 200),
        ])
        if (cancelled) return
        const rawCustomers = Array.isArray(page?.content) ? page.content : []
        const metrics = buildCustomerMetrics({
          customers: rawCustomers,
          deals: dealsPage.rows,
          invoices: invoicesPage.rows,
        })
        const rows = rawCustomers.map((customer, index) => mapCustomerFromApi(customer, metrics[index]))
        setCustomers(rows)
        setDealRows(dealsPage.rows)
        setInvoiceRows(invoicesPage.rows)
        setPageMeta({
          page: Number(page?.page ?? currentPage),
          totalPages: Number(page?.totalPages ?? 0),
          total: Number(page?.total ?? rows.length),
          first: Boolean(page?.first ?? currentPage === 0),
          last: Boolean(page?.last ?? true),
        })
        setSelected((prev) => {
          if (rows.length === 0) return null
          const stillVisible = prev && rows.some((c) => c.id === prev.id)
          return stillVisible ? prev : rows[0]
        })
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Failed to load customers')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadCustomers()
    return () => { cancelled = true }
  }, [currentPage, pageSize, debouncedSearch])

  const createCustomer = async (customer) => {
    try {
      const payload = {
        name: customer.name,
        company: customer.name,
        primaryContact: customer.contact,
        email: customer.email,
        phone: customer.phone,
        industry: customer.industry,
        healthScore: customer.health,
        status: customer.status === 'at-risk' ? 'AT_RISK' : 'ACTIVE',
      }
      const created = await customersAPI.create(payload)
      const mapped = mapCustomerFromApi(created)
      setCustomers((prev) => [mapped, ...prev].slice(0, pageSize))
      setPageMeta((prev) => ({ ...prev, total: prev.total + 1 }))
      setSelected(mapped)
      return mapped
    } catch (err) {
      toast.error(err?.message || 'Failed to create customer')
      return null
    }
  }

  const recentActivity = selected ? buildCustomerActivity(selected, dealRows, invoiceRows) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeading
          title="Customers"
          subtitle={`${pageMeta.total || customers.length} customers · ${customers.filter((c) => c.status === 'active').length} active${debouncedSearch ? ` · filtered by “${debouncedSearch}”` : ''}`}
        />
        <button onClick={() => setShowAdd(true)} className="btn-primary gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl px-3 py-2">
          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers by name, company, or email…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none flex-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="lg:col-span-1 space-y-3">
          {loading ? (
            <LoadingState text="Loading customers..." card />
          ) : customers.map((c) => (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`w-full glass-card p-4 text-left hover:shadow-card-hover transition-all
                ${selected?.id === c.id ? 'ring-2 ring-brand-500/50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.contact}</p>
                </div>
                <span className={`badge ${c.status === 'active' ? 'badge-won' : 'badge-warm'} flex-shrink-0`}>
                  {c.status === 'active' ? 'Active' : 'At Risk'}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Health Score</span><span>{c.health}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className={`h-1.5 rounded-full ${HEALTH_COLOR(c.health)}`} style={{ width: `${c.health}%` }} />
                </div>
              </div>
            </button>
          ))}
          {!loading && pageMeta.totalPages > 1 && (
            <div className="glass-card p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
                  disabled={loading || pageMeta.first}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <p className="text-xs text-slate-500">
                  Page {pageMeta.page + 1} of {pageMeta.totalPages}
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={loading || pageMeta.last}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 glass-card p-6">
          {selected ? (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-white text-xl font-bold">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{selected.name}</h2>
                  <p className="text-sm text-slate-500">{selected.industry} · Customer since {selected.since}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Primary Contact', value: selected.contact, icon: UserCircle },
                  { label: 'Email',           value: selected.email,   icon: Mail },
                  { label: 'Phone',           value: selected.phone,   icon: Phone },
                  { label: 'Total Revenue',   value: `₹${(selected.revenue/1000).toFixed(0)}k`, icon: Activity },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent Activity</p>
                {recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {recentActivity.map((act) => (
                      <div key={act.id} className="flex items-start gap-3 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-slate-700 dark:text-slate-300">{act.label}</p>
                          <p className="text-slate-500 dark:text-slate-400">{act.detail}</p>
                          <p className="text-slate-400">{act.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
                    No recent activity yet for this customer.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              <div className="text-center">
                <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Select a customer to view their profile</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddCustomerModal
            onClose={() => setShowAdd(false)}
            onSave={createCustomer}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, Building2, CheckCircle2, CircleOff, RefreshCw, Shield, Sparkles, BarChart3, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeading from '../components/ui/PageHeading'
import { superAdminAPI } from '../services/api'

const EMPTY_FORM = {
  id: '',
  name: '',
  slug: '',
  plan: 'TRIAL',
  billingStatus: 'TRIAL',
  isActive: true,
  maxUsers: 5,
  logoUrl: '',
  trialEndsAt: '',
  subscriptionStartedAt: '',
  subscriptionEndsAt: '',
  featureFlagsJson: '{}',
  usageLimitsJson: '{}',
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const stringifyJson = (value) => {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

const parseJson = (value) => {
  if (!value || !value.trim()) return {}
  return JSON.parse(value)
}

export default function SaaSAdminPage() {
  const [tenants, setTenants] = useState([])
  const [plans, setPlans] = useState([])
  const [featureFlags, setFeatureFlags] = useState([])
  const [billing, setBilling] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const loadData = async () => {
    setLoading(true)
    try {
      const [tenantRows, planRows, flagRows, billingSummary, auditRows] = await Promise.all([
        superAdminAPI.getTenants(),
        superAdminAPI.getPlans(),
        superAdminAPI.getFeatureFlags(),
        superAdminAPI.getBilling(),
        superAdminAPI.getAuditLogs(),
      ])
      setTenants(Array.isArray(tenantRows) ? tenantRows : [])
      setPlans(Array.isArray(planRows) ? planRows : [])
      setFeatureFlags(Array.isArray(flagRows) ? flagRows : [])
      setBilling(billingSummary || null)
      setAuditLogs(Array.isArray(auditRows) ? auditRows : [])
      if (!selectedTenant && Array.isArray(tenantRows) && tenantRows.length > 0) {
        selectTenant(tenantRows[0])
      }
    } catch (error) {
      toast.error(error?.message || 'Unable to load SaaS admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectTenant = (tenant) => {
    setSelectedTenant(tenant)
    setForm({
      id: tenant?.id || '',
      name: tenant?.name || '',
      slug: tenant?.slug || '',
      plan: tenant?.plan || 'TRIAL',
      billingStatus: tenant?.billingStatus || 'TRIAL',
      isActive: Boolean(tenant?.isActive),
      maxUsers: tenant?.maxUsers ?? 5,
      logoUrl: tenant?.logoUrl || '',
      trialEndsAt: tenant?.trialEndsAt ? String(tenant.trialEndsAt).slice(0, 16) : '',
      subscriptionStartedAt: tenant?.subscriptionStartedAt ? String(tenant.subscriptionStartedAt).slice(0, 16) : '',
      subscriptionEndsAt: tenant?.subscriptionEndsAt ? String(tenant.subscriptionEndsAt).slice(0, 16) : '',
      featureFlagsJson: stringifyJson(tenant?.featureFlags),
      usageLimitsJson: stringifyJson(tenant?.usageLimits),
    })
  }

  const updateForm = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const submitTenant = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        plan: form.plan,
        billingStatus: form.billingStatus,
        isActive: form.isActive,
        maxUsers: Number(form.maxUsers) || 5,
        logoUrl: form.logoUrl || null,
        trialEndsAt: form.trialEndsAt || null,
        subscriptionStartedAt: form.subscriptionStartedAt || null,
        subscriptionEndsAt: form.subscriptionEndsAt || null,
        featureFlags: parseJson(form.featureFlagsJson),
        usageLimits: parseJson(form.usageLimitsJson),
      }

      if (form.id) {
        await superAdminAPI.updateTenant(form.id, payload)
        toast.success('Tenant updated')
      } else {
        await superAdminAPI.createTenant(payload)
        toast.success('Tenant created')
      }
      await loadData()
    } catch (error) {
      toast.error(error?.message || 'Unable to save tenant')
    } finally {
      setSaving(false)
    }
  }

  const toggleTenant = async (tenant, active) => {
    try {
      if (active) {
        await superAdminAPI.activateTenant(tenant.id)
      } else {
        await superAdminAPI.deactivateTenant(tenant.id)
      }
      toast.success(active ? 'Tenant activated' : 'Tenant deactivated')
      await loadData()
    } catch (error) {
      toast.error(error?.message || 'Unable to update tenant state')
    }
  }

  const billingCards = useMemo(() => [
    { label: 'Total Tenants', value: billing?.totalTenants ?? 0 },
    { label: 'Active', value: billing?.activeTenants ?? 0 },
    { label: 'Trials', value: billing?.trialTenants ?? 0 },
    { label: 'Expiring Soon', value: billing?.expiringSoon ?? 0 },
  ], [billing])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeading
          title="SaaS Admin"
          subtitle="Manage tenants, plans, feature flags, usage limits, and the global audit trail."
          icon={<Shield className="h-5 w-5" />}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadData} className="btn-secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button type="button" onClick={() => selectTenant(null)} className="btn-primary">
            <Plus className="h-4 w-4" />
            New tenant
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {billingCards.map((card) => (
          <div key={card.label} className="kpi-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{card.label}</p>
            <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <div className="glass-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tenants</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tenants.length} tenant{tenants.length === 1 ? '' : 's'} total</p>
              </div>
              <Building2 className="h-5 w-5 text-brand-500" />
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {tenants.map((tenant) => {
                  const isSelected = selectedTenant?.id === tenant.id
                  return (
                    <div
                      key={tenant.id}
                      className={`rounded-2xl border p-4 transition ${
                        isSelected
                          ? 'border-brand-300 bg-brand-50/40 dark:border-brand-900/50 dark:bg-brand-950/20'
                          : 'border-slate-200/70 bg-white/70 dark:border-slate-800/70 dark:bg-slate-950/40'
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <button type="button" onClick={() => selectTenant(tenant)} className="min-w-0 flex-1 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tenant.name}</h3>
                            <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{tenant.plan}</span>
                            {tenant.isActive ? (
                              <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Active
                              </span>
                            ) : (
                              <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                                <CircleOff className="mr-1 h-3.5 w-3.5" />
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {tenant.slug} · {tenant.billingStatus || 'TRIAL'} · Trial ends {formatDate(tenant.trialEndsAt)}
                          </p>
                          <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                            <span>Users: {tenant.userCount ?? 0}/{tenant.maxUsers ?? 0}</span>
                            <span>Leads: {tenant.leadCount ?? 0}</span>
                            <span>Deals: {tenant.dealCount ?? 0}</span>
                            <span>Invoices: {tenant.invoiceCount ?? 0}</span>
                          </div>
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => selectTenant(tenant)} className="btn-ghost h-9 px-3 text-xs">
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                          {tenant.isActive ? (
                            <button type="button" onClick={() => toggleTenant(tenant, false)} className="btn-ghost h-9 px-3 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30">
                              <Trash2 className="h-4 w-4" />
                              Deactivate
                            </button>
                          ) : (
                            <button type="button" onClick={() => toggleTenant(tenant, true)} className="btn-secondary h-9 px-3 text-xs">
                              <CheckCircle2 className="h-4 w-4" />
                              Activate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="glass-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Subscription Plans</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pricing and limit presets</p>
              </div>
              <BadgeDollarSign className="h-5 w-5 text-emerald-500" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((plan) => (
                <div key={plan.name} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800/70 dark:bg-slate-950/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{plan.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">₹{plan.priceInRupees || 0} / month</p>
                    </div>
                    <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">{plan.maxUsers} users</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{plan.features}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Trial {plan.trialDays} days</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{form.id ? 'Edit tenant' : 'Create tenant'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage plan, limits, flags and lifecycle</p>
              </div>
              <Sparkles className="h-5 w-5 text-brand-500" />
            </div>

            <form onSubmit={submitTenant} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Tenant name</label>
                  <input name="name" value={form.name} onChange={updateForm} className="input" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Slug</label>
                  <input name="slug" value={form.slug} onChange={updateForm} className="input" placeholder="acme-crm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Plan</label>
                  <select name="plan" value={form.plan} onChange={updateForm} className="input">
                    {['TRIAL', 'STARTER', 'BUSINESS', 'ENTERPRISE'].map((plan) => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Billing Status</label>
                  <input name="billingStatus" value={form.billingStatus} onChange={updateForm} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Max Users</label>
                  <input name="maxUsers" type="number" min="1" value={form.maxUsers} onChange={updateForm} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Logo URL</label>
                  <input name="logoUrl" value={form.logoUrl} onChange={updateForm} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Trial ends</label>
                  <input name="trialEndsAt" type="datetime-local" value={form.trialEndsAt} onChange={updateForm} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Subscription starts</label>
                  <input name="subscriptionStartedAt" type="datetime-local" value={form.subscriptionStartedAt} onChange={updateForm} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Subscription ends</label>
                  <input name="subscriptionEndsAt" type="datetime-local" value={form.subscriptionEndsAt} onChange={updateForm} className="input" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Feature flags JSON</label>
                  <textarea name="featureFlagsJson" rows={10} value={form.featureFlagsJson} onChange={updateForm} className="input font-mono text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Usage limits JSON</label>
                  <textarea name="usageLimitsJson" rows={10} value={form.usageLimitsJson} onChange={updateForm} className="input font-mono text-xs" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={updateForm} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                Active tenant
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" onClick={() => selectTenant(null)} className="btn-secondary flex-1">
                  New blank tenant
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving...' : form.id ? 'Update tenant' : 'Create tenant'}
                </button>
              </div>
            </form>
          </div>

          <div className="glass-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Feature Flags</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Platform capabilities available to all tenants</p>
              </div>
              <BarChart3 className="h-5 w-5 text-cyan-500" />
            </div>
            <div className="space-y-3">
              {featureFlags.map((flag) => (
                <div key={flag.key} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{flag.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{flag.description}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">{flag.key}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Global Audit Logs</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Delete, export, admin and compliance events</p>
              </div>
              <FileText className="h-5 w-5 text-slate-500" />
            </div>
            <div className="max-h-[28rem] overflow-y-auto custom-scrollbar space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 text-sm dark:border-slate-800/70 dark:bg-slate-950/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{log.action}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{log.entityType} · {log.entityId || 'n/a'}</p>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{formatDate(log.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Tenant {log.tenantId || 'global'} · User {log.userId || 'system'} · {log.ipAddress || 'unknown IP'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

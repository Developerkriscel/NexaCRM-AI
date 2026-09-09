import { Fragment, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Download, Upload, Trash2,
  Edit, ChevronUp, ChevronDown, Flame, Thermometer,
  Snowflake, ExternalLink, X, History,
  PhoneCall, Mail, MessageSquare, UserCheck,
  FileText, DollarSign, AlertCircle, Building2, MoreVertical,
  Tag, Calendar, User, Phone, AtSign, TrendingUp, ClipboardList, MessageCircle, Sparkles, BadgeCheck, Brain
} from 'lucide-react'
import toast from 'react-hot-toast'
import LeadActivitiesModal from '../../components/LeadActivitiesModal'
import { sendWhatsApp } from '../../utils/whatsapp'
import { useLeadsStore } from '../../store/leadsStore'
import { useAuthStore } from '../../store/authStore'
import { getLeadAgingMeta, getLeadAgeMinutes } from '../../utils/leadSla'
import { callsAPI, leadsAPI, teamAPI } from '../../services/api'
import { PERMISSIONS, hasPermission } from '../../utils/permissions'

const SCORE_BADGE = {
  hot:  { label: 'Hot',  icon: Flame,       cls: 'badge-hot' },
  warm: { label: 'Warm', icon: Thermometer, cls: 'badge-warm' },
  cold: { label: 'Cold', icon: Snowflake,   cls: 'badge-cold' },
}

const STATUS_BADGE = {
  new:          { label: 'New',          cls: 'badge-new' },
  contacted:    { label: 'Contacted',    cls: 'badge bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  qualified:    { label: 'Qualified',    cls: 'badge bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300' },
  proposal:     { label: 'Proposal',     cls: 'badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  negotiation:  { label: 'Negotiation',  cls: 'badge bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  won:          { label: 'Won',          cls: 'badge-won' },
  lost:         { label: 'Lost',         cls: 'badge-lost' },
}

const LEAD_SOURCES = [
  'Facebook', 'Instagram', 'LinkedIn', 'Website', 'WhatsApp',
  'Google Ads', 'Meta Ads', 'Referral', 'Email', 'Other',
]

function AddLeadModal({ onClose, onAdd, teamMembers }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', service: '', specialization: '',
    source: 'Website', score: 'warm', status: 'new',
    assignedToId: '', value: '', tags: '', lostReason: ''
  })
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    const now = new Date()
    onAdd({
      ...form,
      id: Date.now(),
      createdAt: now.toISOString().split('T')[0],
      createdAtTs: now.toISOString(),
      followUpSlaMinutes: 60,
      value: Number(form.value) || 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Add lead">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative glass-card w-full max-w-lg p-6 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Add New Lead</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Full Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required className="input" placeholder="Ramesh Patel" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Company</label>
              <input name="company" value={form.company} onChange={handleChange} className="input" placeholder="Tech Corp" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Email *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required className="input" placeholder="ramesh@techcorp.in" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="input" placeholder="+91-98765-43210" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Service</label>
              <input name="service" value={form.service} onChange={handleChange} className="input" placeholder="CRM Setup" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Specialization</label>
              <input name="specialization" value={form.specialization} onChange={handleChange} className="input" placeholder="Lead Automation" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Source</label>
              <select name="source" value={form.source} onChange={handleChange} className="input">
                {LEAD_SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Deal Value (₹)</label>
              <input name="value" type="number" value={form.value} onChange={handleChange} className="input" placeholder="100000" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">AI Score</label>
              <select name="score" value={form.score} onChange={handleChange} className="input">
                <option value="hot">🔥 Hot</option>
                <option value="warm">🌡️ Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="input">
                {['new','contacted','qualified','proposal','negotiation','won','lost'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {form.status === 'lost' && (
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Lost Reason *</label>
                <textarea
                  name="lostReason"
                  value={form.lostReason}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="input resize-none"
                  placeholder="Budget, timing, competitor, or other reason"
                />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Assigned To</label>
            <select name="assignedToId" value={form.assignedToId} onChange={handleChange} className="input">
              <option value="">Unassigned</option>
              {(teamMembers || []).map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Tags (comma separated)</label>
            <input name="tags" value={form.tags} onChange={handleChange} className="input" placeholder="enterprise, priority" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Add Lead</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/* ── Edit Lead Modal ─────────────────────────────────────────────── */
function EditLeadModal({ lead, onClose, onSave, teamMembers }) {
  const [form, setForm] = useState({ ...lead, assignedToId: lead?.assignedToId || '' })
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({ ...form, value: Number(form.value) || 0 })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Edit lead">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative glass-card w-full max-w-lg p-6 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Edit Lead</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Full Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Company</label>
              <input name="company" value={form.company} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Email *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Phone</label>
              <input name="phone" value={form.phone || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Service</label>
              <input name="service" value={form.service || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Specialization</label>
              <input name="specialization" value={form.specialization || ''} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Source</label>
              <select name="source" value={form.source} onChange={handleChange} className="input">
                {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Deal Value (₹)</label>
              <input name="value" type="number" value={form.value} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">AI Score</label>
              <select name="score" value={form.score} onChange={handleChange} className="input">
                <option value="hot">🔥 Hot</option>
                <option value="warm">🌡️ Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="input">
                {['new','contacted','qualified','proposal','negotiation','won','lost'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {form.status === 'lost' && (
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Lost Reason *</label>
                <textarea
                  name="lostReason"
                  value={form.lostReason || ''}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="input resize-none"
                  placeholder="Budget, timing, competitor, or other reason"
                />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Assigned To</label>
            <select name="assignedToId" value={form.assignedToId || ''} onChange={handleChange} className="input">
              <option value="">Unassigned</option>
              {(teamMembers || []).map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 gap-2"><Edit className="w-3.5 h-3.5" /> Save Changes</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/* ── Lead Detail Modal ───────────────────────────────────────────── */
function LeadDetailModal({ lead, onClose, onEdit, onDelete, canEdit, canDelete }) {
  const scoreCfg  = SCORE_BADGE[lead.score]
  const statusCfg = STATUS_BADGE[lead.status] ?? { label: lead.status, cls: 'badge' }
  const ScoreIcon = scoreCfg?.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Lead details">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative glass-card w-full max-w-lg p-0 z-10 overflow-hidden">

        {/* Header banner */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{lead.name}</h2>
              <p className="text-brand-200 text-sm mt-0.5">{lead.company}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`${scoreCfg?.cls} text-xs`}>{ScoreIcon && <ScoreIcon className="w-3 h-3" />} {scoreCfg?.label}</span>
                <span className={`${statusCfg.cls} text-xs`}>{statusCfg.label}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Details grid */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: AtSign,    label: 'Email',    value: lead.email },
              { icon: Phone,     label: 'Phone',    value: lead.phone || '—' },
              { icon: Building2, label: 'Company',  value: lead.company },
              { icon: Tag,       label: 'Service',  value: lead.service || '—' },
              { icon: Tag,       label: 'Specialization', value: lead.specialization || '—' },
              { icon: Tag,       label: 'Source',   value: lead.source },
              { icon: DollarSign,label: 'Value',    value: `₹${(lead.value/1000).toFixed(0)}k` },
              { icon: User,      label: 'Owner',    value: lead.assignedTo || 'Unassigned' },
              { icon: TrendingUp,label: 'AI Score', value: scoreCfg?.label },
              { icon: Calendar,  label: 'Added',    value: lead.createdAt },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {lead.tags && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {String(lead.tags).split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {canEdit && (
              <button onClick={() => { onClose(); onEdit(lead) }}
                className="btn-secondary flex-1 justify-center gap-2 text-xs">
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {canDelete && (
              <button onClick={() => { onDelete([lead.id]); onClose() }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-500 text-xs font-semibold transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

const HISTORY_STYLE = {
  activity: { icon: ClipboardList, color: 'text-brand-500 bg-brand-100 dark:bg-brand-950/40' },
  call: { icon: PhoneCall, color: 'text-blue-500 bg-blue-100 dark:bg-blue-950/40' },
  email: { icon: Mail, color: 'text-brand-500 bg-brand-100 dark:bg-brand-950/40' },
  message: { icon: MessageSquare, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950/40' },
  status: { icon: UserCheck, color: 'text-amber-500 bg-amber-100 dark:bg-amber-950/40' },
  note: { icon: FileText, color: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
  deal: { icon: DollarSign, color: 'text-green-500 bg-green-100 dark:bg-green-950/40' },
  alert: { icon: AlertCircle, color: 'text-red-500 bg-red-100 dark:bg-red-950/40' },
}

const ACTIVITY_STYLE_BY_INDEX = {
  0: { type: 'call', icon: PhoneCall, color: 'text-blue-500 bg-blue-100 dark:bg-blue-950/40' },
  1: { type: 'email', icon: Mail, color: 'text-brand-500 bg-brand-100 dark:bg-brand-950/40' },
  2: { type: 'meeting', icon: UserCheck, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-950/40' },
  3: { type: 'outcome', icon: TrendingUp, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950/40' },
}

const CALL_OUTCOME_BADGE = {
  connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'non connected': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'no answer': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  busy: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'callback requested': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  'wrong number': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'not interested': 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const getCallOutcomeBadgeClass = (outcome) => {
  const key = String(outcome || '').trim().toLowerCase()
  return CALL_OUTCOME_BADGE[key] || 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
}

const normalizeCallOutcome = (value) => String(value || '').trim().toLowerCase()

function LeadHistoryPanel({ lead, onClose, onLogActivity, historyEvents = [] }) {
  const [callIntel, setCallIntel] = useState(null)
  const [intelLoading, setIntelLoading] = useState(false)
  const [intelError, setIntelError] = useState('')
  const events = historyEvents
  const calls = events.filter(e => String(e.type || '').toLowerCase().includes('call')).length
  const emails = events.filter(e => String(e.type || '').toLowerCase().includes('email')).length

  useEffect(() => {
    let alive = true
    if (!lead?.id) {
      setCallIntel(null)
      setIntelError('')
      setIntelLoading(false)
      return undefined
    }

    setIntelLoading(true)
    setIntelError('')

    callsAPI.getIntelligence(lead.id)
      .then((response) => {
        if (!alive) return
        setCallIntel(response || null)
      })
      .catch((err) => {
        if (!alive) return
        setCallIntel(null)
        setIntelError(err?.message || 'Failed to load call intelligence')
      })
      .finally(() => {
        if (alive) setIntelLoading(false)
      })

    return () => {
      alive = false
    }
  }, [lead?.id])

  const analysis = callIntel?.analysis || {}
  const verdict = String(analysis.leadVerdict || '').toUpperCase()
  const verdictMeta = {
    GENUINE: { label: 'Genuine lead', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    NOT_GENUINE: { label: 'Not genuine', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    UNCERTAIN: { label: 'Uncertain', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  }[verdict] || { label: 'Pending', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
  const currentStatus = String(callIntel?.lead?.status || lead?.status || '').toUpperCase()
  const suggestedStatus = String(analysis.suggestedLeadStatus || '').toUpperCase()
  const confidence = Number(analysis.confidence || 0)
  const remoteCalls = Array.isArray(callIntel?.calls) ? callIntel.calls : []
  const totalCalls = remoteCalls.length || calls

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end" role="dialog" aria-modal="true" aria-label="Lead history and call intelligence">
      {/* Backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Drawer */}
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative z-10 w-full max-w-sm h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-950/40 flex items-center justify-center flex-shrink-0">
              <History className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{lead.name}</p>
              <p className="text-xs text-slate-400">{lead.company} · Call Intelligence & Activity History</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-scroll custom-scrollbar pr-2"
          style={{ scrollbarGutter: 'stable' }}
        >
          {/* AI intelligence */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950/40 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-brand-600 dark:text-brand-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Call Intelligence</p>
                  <p className="text-[11px] text-slate-500">Bolna transcript + conversation history analysis</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${verdictMeta.cls}`}>
                {intelLoading ? 'Analyzing…' : verdictMeta.label}
              </span>
            </div>

            {intelError && (
              <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                {intelError}
              </div>
            )}

            {!intelError && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Current Status</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{currentStatus || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">AI Suggested</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{suggestedStatus || '—'}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Confidence</p>
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-300">{confidence}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${Math.min(100, confidence)}%` }} />
                  </div>
                </div>

                {analysis.summary && (
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">AI Summary</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{analysis.summary}</p>
                  </div>
                )}

                {analysis.nextBestAction && (
                  <div className="rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 p-3">
                    <p className="text-[10px] font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wide mb-1">Next Best Action</p>
                    <p className="text-xs text-brand-800 dark:text-brand-200 leading-relaxed">{analysis.nextBestAction}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 p-3">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-2">Positive Signals</p>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {(analysis.positiveSignals || []).slice(0, 4).map((signal, index) => (
                        <li key={index} className="flex gap-2">
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{signal}</span>
                        </li>
                      ))}
                      {(!analysis.positiveSignals || analysis.positiveSignals.length === 0) && (
                        <li className="text-slate-400">No positive signals extracted yet.</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 p-3">
                    <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-2">Risk Signals</p>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {(analysis.riskSignals || []).slice(0, 4).map((signal, index) => (
                        <li key={index} className="flex gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                          <span>{signal}</span>
                        </li>
                      ))}
                      {(!analysis.riskSignals || analysis.riskSignals.length === 0) && (
                        <li className="text-slate-400">No risk signals extracted yet.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-px bg-slate-200 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-700">
            {[
              { label: 'Activities', value: events.length },
              { label: 'Calls',      value: totalCalls },
              { label: 'Emails',     value: emails },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-slate-900 px-4 py-3 text-center">
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="px-5 py-4 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Timeline</p>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-4">
              {events.length === 0 && (
                <p className="text-xs text-slate-400">No saved activities yet.</p>
              )}
              {events.map((event, i) => {
                const keyType = String(event.type || '').toLowerCase()
                const style = HISTORY_STYLE[keyType] || HISTORY_STYLE.note
                const Icon = event.icon || style.icon
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex gap-4 relative">
                    {/* Icon dot */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 ${event.color || style.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{event.label}</p>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{event.time}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{event.note}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

            {remoteCalls.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Call Records</p>
              {remoteCalls.map((call, index) => (
                <details key={call.id || index} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <summary className="cursor-pointer list-none px-4 py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Call #{index + 1} · {call.status || 'Unknown'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {call.createdAt ? new Date(call.createdAt).toLocaleString() : 'No timestamp'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {call.outcome && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          {call.outcome}
                        </span>
                      )}
                      {call.recordingUrl && (
                        <span className="text-[10px] text-brand-600 dark:text-brand-300">Recording attached</span>
                      )}
                    </div>
                  </summary>
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-slate-700">
                    {call.summary && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Summary</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{call.summary}</p>
                      </div>
                    )}
                    {call.transcript && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Transcript</p>
                        <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-scroll p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 custom-scrollbar">
                          {call.transcript}
                        </pre>
                      </div>
                    )}
                    {call.recordingUrl && (
                      <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                        Open recording <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {call.rawPayload && (
                      <details className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                        <summary className="cursor-pointer text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                          Raw call payload
                        </summary>
                        <pre className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap overflow-y-scroll max-h-48 custom-scrollbar">
                          {call.rawPayload}
                        </pre>
                      </details>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => {
              onClose()
              onLogActivity?.(lead)
            }}
            className="btn-primary w-full justify-center gap-2 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Log Activity
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const WA_TEMPLATES = [
  { label: '👋 Welcome', text: 'Hi {name}! Welcome to our services. We\'re excited to connect with you. How can we help you today?' },
  { label: '📞 Follow Up', text: 'Hi {name}, this is a quick follow-up from our earlier conversation. Are you available for a brief call to discuss your requirements?' },
  { label: '💼 Proposal', text: 'Hi {name}, we\'ve prepared a customized proposal based on your needs. Would you like to schedule a meeting to walk you through the details?' },
  { label: '🎉 Thank You', text: 'Hi {name}, thank you for your time today! It was great speaking with you. We\'ll send over the next steps shortly.' },
]

function WhatsAppModal({ lead, onClose }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const applyTemplate = (tpl) => {
    setMessage(tpl.text.replace('{name}', lead.name?.split(' ')[0] || 'there'))
  }

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Please enter a message'); return }
    const phone = lead.phone || ''
    if (!phone) { toast.error('No phone number for this lead'); return }
    setSending(true)
    try {
      await sendWhatsApp(phone, message)
      setSent(true)
      toast.success(`WhatsApp sent to ${lead.name}!`)
      setTimeout(onClose, 1500)
    } catch (err) {
      toast.error(err.message || 'Failed to send WhatsApp message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Send WhatsApp message">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-green-500 to-emerald-600">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">{lead.name}</p>
            <p className="text-green-100 text-xs">{lead.phone || 'No phone on file'}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Quick Templates */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Quick Templates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WA_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  onClick={() => applyTemplate(tpl)}
                  className="text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-xs text-slate-700 dark:text-slate-300 font-medium"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Message</p>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message here..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            />
            <p className="text-right text-[10px] text-slate-400 mt-1">{message.length} chars</p>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending || sent || !lead.phone}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
              sent
                ? 'bg-green-500 text-white cursor-default'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Sending…
              </>
            ) : sent ? (
              <>✓ Sent!</>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                Send WhatsApp
              </>
            )}
          </button>

          {!lead.phone && (
            <p className="text-center text-xs text-amber-500 dark:text-amber-400">
              ⚠️ This lead has no phone number saved. Add a phone number first.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function CallOutcomeModal({ lead, user, onClose, onSave }) {
  const [outcome, setOutcome] = useState('Connected')
  const [note, setNote] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [saving, setSaving] = useState(false)

  const assignee = user?.name || user?.email || 'Sales Team'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!outcome) {
      toast.error('Please choose call outcome.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        lead,
        outcome,
        note: note.trim(),
        callbackAt: callbackAt || null,
        assignedTo: assignee,
      })
      toast.success('Call outcome saved')
      onClose()
    } catch (err) {
      toast.error(err?.message || 'Failed to save call outcome')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Call outcome">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative glass-card w-full max-w-lg p-6 z-10"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Call Outcome</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lead?.name} · {lead?.phone || 'No number'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Outcome *</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="input"
            >
              <option value="Connected">Connected</option>
              <option value="No Answer">No Answer</option>
              <option value="Busy">Busy</option>
              <option value="Callback Requested">Callback Requested</option>
              <option value="Wrong Number">Wrong Number</option>
              <option value="Not Interested">Not Interested</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Callback Time (optional)</label>
            <input
              type="datetime-local"
              value={callbackAt}
              onChange={(e) => setCallbackAt(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Notes</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened on this call?"
              className="input resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Assigned To</label>
            <input value={assignee} readOnly className="input bg-slate-50 dark:bg-slate-800/60" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Skip</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 gap-2 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Outcome'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function LeadsPage() {
  const PAGE_SIZE = 50
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const {
    leads,
    pagination,
    fetchLeads,
    createLead,
    updateLead,
    deleteLead,
    bulkDelete,
    patchLeadLocal,
  } = useLeadsStore()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [lastCallFilter, setLastCallFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(0)
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selected, setSelected]         = useState([])
  const [historyLead, setHistoryLead]       = useState(null)
  const [editLead, setEditLead]             = useState(null)
  const [detailLead, setDetailLead]         = useState(null)
  const [activitiesLead, setActivitiesLead] = useState(null)
  const [waLead, setWaLead]                 = useState(null)
  const [callOutcomeLead, setCallOutcomeLead] = useState(null)
  const [teamMembers, setTeamMembers]       = useState([])
  const [leadActivitiesByLeadId, setLeadActivitiesByLeadId] = useState({})
  const [callOutcomeByLeadId, setCallOutcomeByLeadId] = useState({})
  const [activityTabByLeadId, setActivityTabByLeadId] = useState({})
  const [expandedLeadId, setExpandedLeadId] = useState(null)
  const [openActionsLeadId, setOpenActionsLeadId] = useState(null)
  const [callingLeadId, setCallingLeadId] = useState(null)
  const [timeTick, setTimeTick]             = useState(Date.now())
  const importRef                           = useRef(null)
  const canCreate = hasPermission(user, PERMISSIONS.LEADS_CREATE)
  const canUpdate = hasPermission(user, PERMISSIONS.LEADS_UPDATE)
  const canDelete = hasPermission(user, PERMISSIONS.LEADS_DELETE)
  const canImport = hasPermission(user, PERMISSIONS.LEADS_IMPORT)
  const canExport = hasPermission(user, PERMISSIONS.LEADS_EXPORT)
  const canAiScore = hasPermission(user, PERMISSIONS.AI_USE)
  const canConvert = hasPermission(user, PERMISSIONS.CUSTOMERS_CREATE) && hasPermission(user, PERMISSIONS.DEALS_CREATE)
  const canViewTeam = hasPermission(user, PERMISSIONS.TEAM_VIEW)
  const canCall = hasPermission(user, PERMISSIONS.COMMUNICATIONS_SEND)
  const routeSearch = searchParams.get('search') ?? ''

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick(Date.now()), 60 * 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setSearch(routeSearch)
  }, [routeSearch])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setCurrentPage(0)
  }, [debouncedSearch, scoreFilter, statusFilter, lastCallFilter])

  useEffect(() => {
    fetchLeads({
      page: currentPage,
      size: PAGE_SIZE,
      search: debouncedSearch || undefined,
      score: scoreFilter === 'all' ? undefined : scoreFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }).catch((err) => {
      toast.error(err?.message || 'Failed to load leads')
    })
  }, [fetchLeads, currentPage, debouncedSearch, scoreFilter, statusFilter])

  useEffect(() => {
    setSelected([])
    setExpandedLeadId(null)
    setOpenActionsLeadId(null)
  }, [currentPage, debouncedSearch, scoreFilter, statusFilter, lastCallFilter])

  const reloadCurrentPage = async () => {
    return fetchLeads({
      page: currentPage,
      size: PAGE_SIZE,
      search: debouncedSearch || undefined,
      score: scoreFilter === 'all' ? undefined : scoreFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
  }

  useEffect(() => {
    if (!canViewTeam) {
      setTeamMembers([])
      return
    }
    teamAPI.getAll()
      .then((rows) => {
        const members = (rows || [])
          .filter((row) => row && row.id && row.name && row.isActive !== false)
          .map((row) => ({ id: row.id, name: row.name }))
        setTeamMembers(members)
      })
      .catch(() => {
        setTeamMembers([])
      })
  }, [canViewTeam])

  useEffect(() => {
    const handleOutside = (e) => {
      if (e.target instanceof Element && e.target.closest('.lead-actions-dropdown')) return
      setOpenActionsLeadId(null)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const toggleExpandedLead = (leadId) => {
    setExpandedLeadId((prev) => (prev === leadId ? null : leadId))
  }

  const filtered = leads
    .filter((lead) => {
      if (lastCallFilter === 'all') return true
      const outcome = normalizeCallOutcome(callOutcomeByLeadId[lead.id])
      if (lastCallFilter === 'not_logged') return !outcome
      return outcome === lastCallFilter
    })
    .sort((a, b) => {
      let va
      let vb
      if (sortField === 'activity' || sortField === 'aging') {
        va = getLeadAgeMinutes(a, timeTick) ?? -1
        vb = getLeadAgeMinutes(b, timeTick) ?? -1
      } else {
        va = a[sortField]
        vb = b[sortField]
      }
      if (typeof va === 'string') va = va.toLowerCase(), vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const totalCount = Number(pagination?.total ?? 0)
  const pageSize = Number(pagination?.size ?? PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const SortIcon = ({ field }) =>
    sortField === field ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null

  const toggleSelect = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((l) => l.id))

  const handleAdd = async (lead) => {
    if (!canCreate) {
      toast.error('You do not have permission to add leads.')
      return
    }
    try {
      await createLead(lead)
      toast.success('Lead added successfully!')
    } catch (err) {
      toast.error(err?.message || 'Failed to add lead')
    }
  }

  const handleSave = async (updated) => {
    if (!canUpdate) {
      toast.error('You do not have permission to edit leads.')
      return
    }
    try {
      await updateLead(updated.id, updated)
      toast.success('Lead updated successfully!')
    } catch (err) {
      toast.error(err?.message || 'Failed to update lead')
    }
  }

  const handleDelete = async (ids) => {
    if (!canDelete) {
      toast.error('You do not have permission to delete leads.')
      return
    }
    try {
      if (ids.length === 1) {
        await deleteLead(ids[0])
      } else {
        await bulkDelete(ids)
      }
      setSelected([])
      toast.success(`${ids.length} lead(s) deleted`)
    } catch (err) {
      toast.error(err?.message || 'Failed to delete lead(s)')
    }
  }

  const handleExport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export leads.')
      return
    }
    leadsAPI.export({ format: 'csv', status: statusFilter === 'all' ? undefined : statusFilter })
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
        toast.success('Leads exported successfully.')
      })
      .catch((err) => {
        toast.error(err?.message || 'Failed to export leads')
      })
  }

  const handleImport = async (e) => {
    if (!canImport) {
      toast.error('You do not have permission to import leads.')
      e.target.value = ''
      return
    }
    const file = e.target.files?.[0]; if (!file) return
    try {
      await leadsAPI.import(file)
      await reloadCurrentPage()
      toast.success('Leads imported.')
    } catch (err) {
      toast.error(err?.message || 'Failed to import leads')
    }
    e.target.value = ''
  }

  const handleScoreLead = async (lead) => {
    if (!canAiScore) {
      toast.error('You do not have permission to use AI scoring.')
      return
    }
    try {
      const res = await leadsAPI.score(lead.id)
      const nextScore = String(res?.score || '').toLowerCase()
      if (nextScore === 'hot' || nextScore === 'warm' || nextScore === 'cold') {
        patchLeadLocal(lead.id, { score: nextScore })
      }
      toast.success(res?.message || 'Lead scored by AI')
    } catch (err) {
      toast.error(err?.message || 'Failed to score lead')
    }
  }

  const handleConvertLead = async (lead) => {
    if (!canConvert) {
      toast.error('You do not have permission to convert leads.')
      return
    }
    try {
      const res = await leadsAPI.convert(lead.id, {})
      await reloadCurrentPage()
      toast.success(res?.message || 'Lead converted successfully')
    } catch (err) {
      toast.error(err?.message || 'Failed to convert lead')
    }
  }

  const handleCallLead = async (lead) => {
    if (!canCall) {
      toast.error('You do not have permission to place calls.')
      return
    }
    if (!lead?.phone) {
      toast.error('This lead has no phone number.')
      return
    }

    try {
      setCallingLeadId(lead.id)
      const res = await leadsAPI.callNow(lead.id, {})
      const nowIso = new Date().toISOString()
      patchLeadLocal(lead.id, {
        lastContactedAtTs: nowIso,
        lastActivityAtTs: nowIso,
      })
      toast.success(res?.message || 'Call queued successfully')
      setCallOutcomeLead(lead)
    } catch (err) {
      toast.error(err?.message || 'Failed to place call')
    } finally {
      setCallingLeadId((prev) => (prev === lead.id ? null : prev))
    }
  }

  const handleSaveCallOutcome = async ({ lead, outcome, note, callbackAt, assignedTo }) => {
    if (!canUpdate) {
      throw new Error('You do not have permission to save lead activities.')
    }
    const summary = [
      `Call outcome: ${outcome}`,
      note ? `Note: ${note}` : null,
      callbackAt ? `Callback: ${callbackAt}` : null,
    ].filter(Boolean).join(' | ')

    const payload = {
      activityIndex: 0,
      activityId: 'act01',
      activityLabel: 'Activity 01',
      activityTitle: 'Call Outcome',
      assignedTo,
      values: {
        assignedTo,
        callOutcome: outcome,
        note: note || '',
        callbackAt: callbackAt || '',
        channel: 'voice_call_agent',
        phone: lead?.phone || '',
      },
      summary,
    }

    const savedRow = await leadsAPI.addActivity(lead.id, payload)
    const event = mapLeadActivityToHistoryEvent(savedRow)
    setLeadActivitiesByLeadId((prev) => {
      const existing = prev[lead.id] || []
      return { ...prev, [lead.id]: [event, ...existing] }
    })

    const touchedAt = savedRow?.savedAt || savedRow?.createdAt || new Date().toISOString()
    patchLeadLocal(lead.id, {
      lastActivityAtTs: touchedAt,
      lastContactedAtTs: touchedAt,
      status: lead?.status === 'new' ? 'contacted' : lead?.status,
    })
  }

  const formatActivityTime = (value) => {
    if (!value) return 'Just now'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleString()
  }

  const mapLeadActivityToHistoryEvent = (row) => {
    const idx = Number(row?.activityIndex ?? -1)
    const style = ACTIVITY_STYLE_BY_INDEX[idx] || HISTORY_STYLE.activity
    return {
      id: row?.id || `${idx}-${row?.savedAt || row?.createdAt || Date.now()}`,
      type: style.type || 'activity',
      icon: style.icon || HISTORY_STYLE.activity.icon,
      color: style.color || HISTORY_STYLE.activity.color,
      label: row?.activityLabel || row?.activityTitle || `Activity ${idx + 1}`,
      note: row?.summary || row?.activityTitle || 'Saved activity',
      time: formatActivityTime(row?.savedAt || row?.createdAt),
      raw: row,
    }
  }

  const extractCallOutcome = (row) => {
    const values = row?.values || {}
    const raw = values?.callOutcome || values?.connectionStatus || values?.status || ''
    const outcome = String(raw || '').trim()
    if (!outcome) return null
    const idx = Number(row?.activityIndex ?? -1)
    if (idx !== 0) return null
    return outcome
  }

  const loadLeadActivities = async (leadId) => {
    if (!leadId) return []
    try {
      const rows = await leadsAPI.getActivities(leadId)
      const events = (rows || []).map(mapLeadActivityToHistoryEvent)
      setLeadActivitiesByLeadId((prev) => ({ ...prev, [leadId]: events }))
      const latestCallRow = (rows || []).find((row) => extractCallOutcome(row))
      if (latestCallRow) {
        setCallOutcomeByLeadId((prev) => ({ ...prev, [leadId]: extractCallOutcome(latestCallRow) }))
      }
      return events
    } catch (err) {
      toast.error(err?.message || 'Failed to load lead activities')
      return []
    }
  }

  const openHistoryLead = (lead) => {
    setHistoryLead(lead)
    loadLeadActivities(lead?.id)
  }

  const openActivitiesLead = async (lead) => {
    await loadLeadActivities(lead?.id)
    setActivitiesLead(lead)
  }

  const handleActivityTabChange = (leadId, tabIndex) => {
    if (!leadId && leadId !== 0) return
    setActivityTabByLeadId((prev) => {
      if (prev[leadId] === tabIndex) return prev
      return { ...prev, [leadId]: tabIndex }
    })
  }

  const getActivityModalState = (leadId) => {
    const events = leadActivitiesByLeadId[leadId] || []
    const data = [{}, {}, {}, {}]
    const saved = [false, false, false, false]
    const seen = new Set()

    for (const ev of events) {
      const row = ev?.raw || {}
      const idx = Number(row?.activityIndex)
      if (!(idx >= 0 && idx < 4) || seen.has(idx)) continue
      seen.add(idx)
      data[idx] = {
        ...(row?.values || {}),
        assignedTo: row?.assignedTo || row?.values?.assignedTo || '',
      }
      saved[idx] = true
    }

    return { data, saved }
  }

  const handlePersistActivity = async ({ lead, activityIndex, activity, values }) => {
    if (!canUpdate) {
      throw new Error('You do not have permission to edit leads.')
    }
    const normalizedOutcome = normalizeCallOutcome(values?.callOutcome || values?.connectionStatus || values?.status)
    const summary = activityIndex === 0
      ? [
          normalizedOutcome ? `Status: ${normalizedOutcome}` : null,
          lead?.source ? `Source: ${lead.source}` : null,
          lead?.service ? `Service: ${lead.service}` : lead?.specialization ? `Service: ${lead.specialization}` : null,
          lead?.createdAt ? `Planned: ${lead.createdAt}` : null,
          `Actual: ${new Date().toISOString()}`,
          values?.nextFollowUpDate || values?.followUpDate ? `Next follow-up: ${values.nextFollowUpDate || values.followUpDate}` : null,
          values?.remark || values?.remarks || values?.note ? `Remarks: ${values.remark || values.remarks || values.note}` : null,
        ].filter(Boolean).join(' | ') || 'Lead activity recorded'
      : Object.entries(values || {})
          .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | ') || 'No extra details'
    const payload = {
      activityIndex,
      activityId: activity?.id || null,
      activityLabel: activity?.label || `Activity ${Number(activityIndex) + 1}`,
      activityTitle: activity?.title || '',
      assignedTo: values?.assignedTo || lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || null,
      values: values || {},
      summary,
    }
    const savedRow = await leadsAPI.addActivity(lead.id, payload)
    const event = mapLeadActivityToHistoryEvent(savedRow)
    setLeadActivitiesByLeadId((prev) => {
      const existing = prev[lead.id] || []
      return { ...prev, [lead.id]: [event, ...existing] }
    })
    const persistedOutcome = normalizeCallOutcome(values?.callOutcome || values?.connectionStatus || values?.status)
    if (persistedOutcome) {
      setCallOutcomeByLeadId((prev) => ({ ...prev, [lead.id]: persistedOutcome }))
    }

    const touchedAt = savedRow?.savedAt || savedRow?.createdAt || new Date().toISOString()
    patchLeadLocal(lead.id, {
      lastActivityAtTs: touchedAt,
      lastContactedAtTs: touchedAt,
      status: lead?.status === 'new' ? 'contacted' : lead?.status,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">{totalCount} leads total · {leads.filter((l) => l.score === 'hot').length} hot on this page</p>
        </div>
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
          {selected.length > 0 && canDelete && (
            <button onClick={() => handleDelete(selected)} className="btn-danger text-xs gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Delete ({selected.length})
            </button>
          )}
          {canImport && (
            <>
              <input ref={importRef} type="file" accept=".csv,.xlsx" onChange={handleImport} className="hidden" />
              <button onClick={() => importRef.current?.click()} className="btn-secondary text-xs gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
            </>
          )}
          {canExport && (
            <button onClick={handleExport} className="btn-secondary text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Lead
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl px-3 py-2 w-full sm:flex-1 sm:min-w-[12rem]">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, company…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none flex-1"
          />
        </div>
        <select
          value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}
          className="input w-full sm:w-auto text-xs"
        >
          <option value="all">All Scores</option>
          <option value="hot">🔥 Hot</option>
          <option value="warm">🌡️ Warm</option>
          <option value="cold">❄️ Cold</option>
        </select>
        <select
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full sm:w-auto text-xs"
        >
          <option value="all">All Status</option>
          {['new','contacted','qualified','proposal','negotiation','won','lost'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          value={lastCallFilter}
          onChange={(e) => setLastCallFilter(e.target.value)}
          className="input w-full sm:w-auto text-xs"
        >
          <option value="all">Last Call: Any</option>
          <option value="connected">Last Call: Connected</option>
          <option value="non connected">Last Call: Non Connected</option>
          <option value="no answer">Last Call: No Answer</option>
          <option value="busy">Last Call: Busy</option>
          <option value="callback requested">Last Call: Callback Requested</option>
          <option value="wrong number">Last Call: Wrong Number</option>
          <option value="not interested">Last Call: Not Interested</option>
          <option value="not_logged">Last Call: Not Logged</option>
        </select>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="glass-card py-12 text-center text-slate-400">
            <p className="text-lg">No leads found</p>
            <p className="text-sm mt-1">Try adjusting your filters or add a new lead</p>
          </div>
        ) : (
          filtered.map((lead) => {
            const scoreCfg = SCORE_BADGE[lead.score]
            const statusCfg = STATUS_BADGE[lead.status] ?? { label: lead.status, cls: 'badge' }
            const ScoreIcon = scoreCfg?.icon
            const aging = getLeadAgingMeta(lead, timeTick)
            const ageMin = getLeadAgeMinutes(lead, timeTick)
            const lastCallOutcome = callOutcomeByLeadId[lead.id]
            return (
              <div key={lead.id} className="glass-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{lead.name}</p>
                    <p className="text-xs text-slate-500 truncate">{lead.email}</p>
                    <p className="text-xs text-slate-500 truncate">{lead.phone || 'No mobile'}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{lead.company}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selected.includes(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                    className="mt-1 rounded border-slate-300 text-brand-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={scoreCfg?.cls}>
                    {ScoreIcon && <ScoreIcon className="w-3 h-3" />} {scoreCfg?.label}
                  </span>
                  <span className={statusCfg.cls}>{statusCfg.label}</span>
                  <span className={`badge ${aging.badge}`}>{aging.label}</span>
                  {lastCallOutcome && (
                    <span className={`badge ${getCallOutcomeBadgeClass(lastCallOutcome)}`}>
                      Last Call: {lastCallOutcome}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <p><span className="text-slate-400">Source:</span> {lead.source}</p>
                  <p><span className="text-slate-400">Value:</span> ₹{(lead.value / 1000).toFixed(0)}k</p>
                  <p><span className="text-slate-400">Service:</span> {lead.service || '—'}</p>
                  <p><span className="text-slate-400">Specialization:</span> {lead.specialization || '—'}</p>
                  <p><span className="text-slate-400">Owner:</span> {lead.assignedTo || 'Unassigned'}</p>
                  <p><span className="text-slate-400">Date:</span> {lead.createdAt}</p>
                </div>

                <p className="text-[11px] text-slate-400">
                  {ageMin === null ? 'No activity timer' : `${ageMin} min since last activity`}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {canUpdate && (
                    <button
                      onClick={() => setEditLead(lead)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      title="Edit lead"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {canCall && (
                    <button
                      onClick={() => handleCallLead(lead)}
                      disabled={callingLeadId === lead.id || !lead.phone}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!lead.phone ? 'No phone number' : (callingLeadId === lead.id ? 'Calling…' : 'Call now')}
                    >
                      <PhoneCall className={`w-3.5 h-3.5 ${callingLeadId === lead.id ? 'animate-pulse' : ''}`} /> Call
                    </button>
                  )}
                  <button
                    onClick={() => setWaLead(lead)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title="Send WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button
                    onClick={() => openHistoryLead(lead)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title="Call Intelligence"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Intelligence
                  </button>
                  <button
                    onClick={() => openActivitiesLead(lead)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title="Lead Activities"
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> Activity
                  </button>
                  {canAiScore && (
                    <button
                      onClick={() => handleScoreLead(lead)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      title="AI Score Lead"
                    >
                      <TrendingUp className="w-3.5 h-3.5" /> Score
                    </button>
                  )}
                  {canConvert && (
                    <button
                      onClick={() => handleConvertLead(lead)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      title="Convert to Customer"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Convert
                    </button>
                  )}
                  <button
                    onClick={() => setDetailLead(lead)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title="View details"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Details
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete([lead.id])}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Delete lead"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Table */}
      <div className="hidden sm:block glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-700/40 bg-white/50 dark:bg-slate-900/20">
                <th className="py-3 px-4 text-left w-10">
                  <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll}
                    className="rounded border-slate-300 text-brand-600" />
                </th>
                {[
                  { key: 'name',      label: 'Name', cls: 'w-[220px]' },
                  { key: 'company',   label: 'Company', cls: 'w-[78px]' },
                  { key: 'service',   label: 'Service', cls: 'w-[78px]' },
                  { key: 'score',     label: 'AI Score', cls: 'w-[84px]' },
                  { key: 'status',    label: 'Status', cls: 'w-[84px]' },
                  { key: 'source',    label: 'Source', cls: 'w-[78px]' },
                  { key: 'activity',  label: 'Activity', cls: 'w-[88px]' },
                  { key: 'aging',     label: 'Aging', cls: 'w-[88px]' },
                  { key: 'createdAt', label: 'Date', cls: 'w-[74px]' },
                ].map(({ key, label, cls }) => (
                  <th key={key} className={`py-2.5 px-1.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 ${cls}`}
                    onClick={() => handleSort(key)}>
                    <span className="flex items-center gap-1">{label} <SortIcon field={key} /></span>
                  </th>
                ))}
                <th className="py-2.5 px-1 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 w-[54px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/30">
              <AnimatePresence>
                {filtered.map((lead) => {
                  const scoreCfg = SCORE_BADGE[lead.score]
                  const statusCfg = STATUS_BADGE[lead.status] ?? { label: lead.status, cls: 'badge' }
                  const ScoreIcon = scoreCfg?.icon
                  const aging = getLeadAgingMeta(lead, timeTick)
                  const ageMin = getLeadAgeMinutes(lead, timeTick)
                  const isExpandedRow = expandedLeadId === lead.id
                  const lastCallOutcome = callOutcomeByLeadId[lead.id]
                  return (
                    <Fragment key={lead.id}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/25 transition-colors
                          ${selected.includes(lead.id) ? 'bg-brand-50/40 dark:bg-brand-950/10' : ''}`}
                      >
                        <td className="py-2.5 px-3 align-top">
                          <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelect(lead.id)}
                            className="rounded border-slate-300 text-brand-600" />
                        </td>
                        <td className="py-2.5 px-3 cursor-pointer align-top" onClick={() => toggleExpandedLead(lead.id)}>
                          <div className="max-w-[300px]">
                            <p className="font-semibold text-[15px] leading-snug text-slate-800 dark:text-slate-200 break-words">{lead.name}</p>
                            <p className="mt-0.5 text-xs leading-snug text-slate-500 break-words whitespace-normal">{lead.email || 'N/A'}</p>
                            <p className={`mt-1 text-xs leading-snug break-words whitespace-normal ${lead.phone ? 'text-slate-500' : 'text-slate-400 italic'}`}>
                              {lead.phone || 'No mobile'}
                            </p>
                            {lastCallOutcome && (
                              <span className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${getCallOutcomeBadgeClass(lastCallOutcome)}`}>
                                Last Call: {lastCallOutcome}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 max-w-[110px] cursor-pointer align-top" onClick={() => toggleExpandedLead(lead.id)}>
                          <p className="truncate">
                            {lead.company
                              ? <span className="text-slate-600 dark:text-slate-400">{lead.company}</span>
                              : <span className="text-slate-400 italic">—</span>}
                          </p>
                        </td>
                        <td className="py-2.5 px-2 max-w-[110px] cursor-pointer align-top" onClick={() => toggleExpandedLead(lead.id)}>
                          <p className="truncate">
                            {lead.service
                              ? <span className="text-slate-600 dark:text-slate-400">{lead.service}</span>
                              : <span className="text-slate-400 italic">—</span>}
                          </p>
                        </td>
                        <td className="py-2.5 px-2 cursor-pointer align-top" onClick={() => toggleExpandedLead(lead.id)}>
                          <span className={scoreCfg?.cls}>
                            {ScoreIcon && <ScoreIcon className="w-3 h-3" />} {scoreCfg?.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 cursor-pointer align-top" onClick={() => toggleExpandedLead(lead.id)}>
                          <span className={statusCfg.cls}>{statusCfg.label}</span>
                        </td>
                        <td className="py-2.5 px-2 max-w-[95px] cursor-pointer align-top" onClick={() => toggleExpandedLead(lead.id)}>
                          <p className="truncate text-slate-600 dark:text-slate-400">{lead.source || '—'}</p>
                        </td>
                        <td className="py-2.5 px-2 max-w-[100px] cursor-pointer align-top" onClick={() => toggleExpandedLead(lead.id)}>
                          <span className={`badge ${aging.badge}`}>
                            {ageMin === null ? 'No timer' : `${ageMin} min`}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 align-top cursor-pointer" onClick={() => toggleExpandedLead(lead.id)}>
                          <span className={`badge ${aging.badge}`}>{aging.label}</span>
                        </td>
                        <td className="py-2.5 px-1 text-slate-500 text-xs w-[74px] cursor-pointer truncate align-top" onClick={() => toggleExpandedLead(lead.id)}>{lead.createdAt}</td>
                        <td className="py-2.5 px-1 align-top w-[54px]">
                          <div className="relative flex items-start justify-end gap-1 lead-actions-dropdown">
                            {canCall && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCallLead(lead)
                                }}
                                disabled={callingLeadId === lead.id || !lead.phone}
                                className="p-1 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!lead.phone ? 'No phone number' : (callingLeadId === lead.id ? 'Calling…' : 'Call now')}
                              >
                                <PhoneCall className={`w-4 h-4 ${callingLeadId === lead.id ? 'animate-pulse' : ''}`} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenActionsLeadId((prev) => (prev === lead.id ? null : lead.id))
                              }}
                              className="p-1 rounded-md border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openActionsLeadId === lead.id && (
                              <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
                                {canUpdate && (
                                  <button onClick={() => { setEditLead(lead); setOpenActionsLeadId(null) }}
                                    className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                    <Edit className="w-3.5 h-3.5" /> Edit Lead
                                  </button>
                                )}
                                <button onClick={() => { openHistoryLead(lead); setOpenActionsLeadId(null) }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                  <Sparkles className="w-3.5 h-3.5" /> Call Intelligence
                                </button>
                                <button onClick={() => { openActivitiesLead(lead); setOpenActionsLeadId(null) }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                  <ClipboardList className="w-3.5 h-3.5" /> Lead Activities
                                </button>
                                <button onClick={() => { setWaLead(lead); setOpenActionsLeadId(null) }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                  <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp
                                </button>
                                {canCall && (
                                  <button
                                    onClick={() => { handleCallLead(lead); setOpenActionsLeadId(null) }}
                                    disabled={callingLeadId === lead.id || !lead.phone}
                                    className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <PhoneCall className={`w-3.5 h-3.5 ${callingLeadId === lead.id ? 'animate-pulse' : ''}`} />
                                    {callingLeadId === lead.id ? 'Calling…' : 'Call Now'}
                                  </button>
                                )}
                                {canAiScore && (
                                  <button onClick={() => { handleScoreLead(lead); setOpenActionsLeadId(null) }}
                                    className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                    <TrendingUp className="w-3.5 h-3.5" /> AI Score
                                  </button>
                                )}
                                {canConvert && (
                                  <button onClick={() => { handleConvertLead(lead); setOpenActionsLeadId(null) }}
                                    className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                    <UserCheck className="w-3.5 h-3.5" /> Convert Lead
                                  </button>
                                )}
                                <button onClick={() => { setDetailLead(lead); setOpenActionsLeadId(null) }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                  <ExternalLink className="w-3.5 h-3.5" /> View Details
                                </button>
                                {canDelete && (
                                  <button onClick={() => { handleDelete([lead.id]); setOpenActionsLeadId(null) }}
                                    className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2">
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Lead
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                      {isExpandedRow && (
                        <motion.tr
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="bg-slate-50/60 dark:bg-slate-900/20"
                        >
                          <td colSpan={11} className="px-3 pb-3 pt-0">
                            <div className="ml-9 rounded-lg border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/30 px-3 py-2">
                              <div className="grid grid-cols-[1fr_1.3fr_1fr_.8fr_1.1fr] gap-x-4 text-sm leading-snug text-slate-600 dark:text-slate-400">
                                <p className="truncate">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Source:</span>{' '}
                                  {lead.source || '—'}
                                </p>
                                <p className="truncate">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Activity:</span>{' '}
                                  {ageMin === null ? 'No timer' : `${ageMin} min since activity`}
                                </p>
                                <p className="truncate">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Spec:</span>{' '}
                                  {lead.specialization || '—'}
                                </p>
                                <p className="truncate">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Value:</span>{' '}
                                  ₹{(lead.value / 1000).toFixed(0)}k
                                </p>
                                <p className="truncate">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Owner:</span>{' '}
                                  {lead.assignedTo || 'Unassigned'}
                                </p>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </Fragment>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              <p className="text-lg">No leads found</p>
              <p className="text-sm mt-1">Try adjusting your filters or add a new lead</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-200/60 dark:border-slate-700/40">
          <p className="text-xs text-slate-500">
            Showing page {currentPage + 1} of {totalPages} · {filtered.length} leads on this page · {totalCount} total
          </p>
          <div className="flex gap-1">
            <button
              disabled={currentPage <= 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              className="px-3 h-8 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Prev
            </button>
            <button className="px-3 h-8 rounded-lg text-xs font-medium bg-brand-600 text-white">
              {currentPage + 1}
            </button>
            <button
              disabled={currentPage + 1 >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 h-8 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Lead Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddLeadModal
            onClose={() => setShowAddModal(false)}
            onAdd={handleAdd}
            teamMembers={teamMembers}
          />
        )}
      </AnimatePresence>

      {/* Edit Lead Modal */}
      <AnimatePresence>
        {editLead && (
          <EditLeadModal
            lead={editLead}
            onClose={() => setEditLead(null)}
            onSave={handleSave}
            teamMembers={teamMembers}
          />
        )}
      </AnimatePresence>

      {/* Lead Detail Modal */}
      <AnimatePresence>
        {detailLead && (
          <LeadDetailModal
            lead={detailLead}
            onClose={() => setDetailLead(null)}
            onEdit={(l) => setEditLead(l)}
            onDelete={handleDelete}
            canEdit={canUpdate}
            canDelete={canDelete}
          />
        )}
      </AnimatePresence>

      {/* Lead History Drawer */}
      <AnimatePresence>
        {historyLead && (
          <LeadHistoryPanel
            lead={historyLead}
            onClose={() => setHistoryLead(null)}
            onLogActivity={openActivitiesLead}
            historyEvents={leadActivitiesByLeadId[historyLead.id] || []}
          />
        )}
      </AnimatePresence>

      {/* Lead Activities Modal */}
      <AnimatePresence>
        {activitiesLead && (
          <LeadActivitiesModal
            lead={activitiesLead}
            onClose={() => setActivitiesLead(null)}
            onPersist={handlePersistActivity}
            initialData={getActivityModalState(activitiesLead.id).data}
            initialSaved={getActivityModalState(activitiesLead.id).saved}
            initialActiveTab={activityTabByLeadId[activitiesLead.id] ?? 0}
            onActiveTabChange={handleActivityTabChange}
          />
        )}
      </AnimatePresence>

      {/* WhatsApp Modal */}
      <AnimatePresence>
        {waLead && <WhatsAppModal lead={waLead} onClose={() => setWaLead(null)} />}
      </AnimatePresence>

      {/* Call Outcome Modal */}
      <AnimatePresence>
        {callOutcomeLead && (
          <CallOutcomeModal
            lead={callOutcomeLead}
            user={user}
            onSave={handleSaveCallOutcome}
            onClose={() => setCallOutcomeLead(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

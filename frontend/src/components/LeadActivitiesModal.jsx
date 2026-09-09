import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, Clock, Phone, Users, Trophy, ChevronRight, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Activity definitions matching your Excel workflow ── */
const ACTIVITIES = [
  {
    id: 'act01',
    label: 'Activity 01',
    title: 'Welcome Call',
    description: 'Call With Client and Fix meeting if interested',
    hours: 1,
    icon: Phone,
    color: { bg: '#fff0f0', border: '#fca5a5', header: '#ef4444', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', step: 'bg-red-500' },
    fields: [
      { key: 'type',               label: 'Type',                        type: 'select', options: ['Inbound','Outbound','Referral','Walk-in'] },
      { key: 'source',             label: 'Source',                      type: 'select', options: ['Facebook','Instagram','LinkedIn','Website','WhatsApp','Cold Call','Other'] },
      { key: 'date',               label: 'Date',                        type: 'date' },
      { key: 'serviceRequirement', label: 'Which Type of Service Requirement', type: 'text' },
      { key: 'whatsappMessage',    label: 'WhatsApp Message',            type: 'textarea' },
      { key: 'plannedDate',        label: 'Planned / Click Date for Link', type: 'datetime-local' },
      { key: 'actual',             label: 'Actual Date',                 type: 'datetime-local' },
      { key: 'delay',              label: 'Delay (hrs)',                 type: 'number' },
      { key: 'status',             label: 'Status',                      type: 'select', options: ['Pending','In Progress','Done','Not Interested','No Answer','Callback'] },
      { key: 'remark',             label: 'Remark if any',               type: 'textarea' },
      { key: 'actualDateStatus',   label: 'Actual Date Status',          type: 'select', options: ['On Time','Delayed','Early','Missed'] },
    ],
  },
  {
    id: 'act02',
    label: 'Activity 02',
    title: 'Follow Up for Meeting',
    description: 'Follow up Client for meeting and fill Follow up forms',
    hours: 2,
    icon: Clock,
    color: { bg: '#eff6ff', border: '#93c5fd', header: '#3b82f6', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', step: 'bg-blue-500' },
    fields: [
      { key: 'plannedDate',      label: 'Planned Date',     type: 'datetime-local' },
      { key: 'status',           label: 'Status',           type: 'select', options: ['Not Interested', 'Meeting', 'Follow Up'] },
      { key: 'nextFollowUpDate', label: 'Next Follow-Up Date', type: 'date' },
      { key: 'remark',           label: 'Remark',           type: 'textarea' },
    ],
  },
  {
    id: 'act03',
    label: 'Activity 03',
    title: 'Allowed Person for Meeting',
    description: 'Fill Details for Meeting person and share details',
    hours: null,
    icon: Users,
    color: { bg: '#eff6ff', border: '#93c5fd', header: '#0ea5e9', badge: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300', step: 'bg-brand-500' },
    fields: [
      { key: 'personName',       label: 'Person Name',                   type: 'text' },
      { key: 'personDesignation',label: 'Designation',                   type: 'text' },
      { key: 'meetingDate',      label: 'Meeting Date',                 type: 'datetime-local' },
      { key: 'meetingMode',      label: 'Meeting Mode',                  type: 'select', options: ['In-Person','Video Call','Phone Call'] },
      { key: 'status',           label: 'Meeting Status',               type: 'select', options: ['Successful', 'Failed'] },
      { key: 'remark',           label: 'Remark',                        type: 'textarea' },
    ],
  },
  {
    id: 'act04',
    label: 'Activity 04',
    title: 'Meeting Outcome',
    description: 'Fill Meeting Outcome and Requirement Details',
    hours: null,
    icon: Trophy,
    color: { bg: '#f0fdf4', border: '#86efac', header: '#16a34a', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', step: 'bg-green-500' },
    fields: [
      { key: 'plannedDate',      label: 'Planned / Click Date for Link', type: 'datetime-local' },
      { key: 'actual',           label: 'Actual Date',                   type: 'datetime-local' },
      { key: 'delay',            label: 'Delay (hrs)',                   type: 'number' },
      { key: 'status',           label: 'Status',                        type: 'select', options: ['Won','Lost','Follow-Up Required','Pending Decision','No Response'] },
      { key: 'followUpDate',     label: 'Follow-Up Date',                type: 'date' },
      { key: 'meetingPriceFinal',label: 'Meeting Price Final (₹)',        type: 'number' },
      { key: 'remarkFollowUp',   label: 'Remark of Follow-Up',           type: 'textarea' },
      { key: 'remarkWon',        label: 'Remark of Won',                 type: 'textarea' },
      { key: 'lostCategory',     label: 'Lost Category',                 type: 'select', options: ['Price','Competition','No Need','Timing','Budget','Other'] },
      { key: 'remarkLost',       label: 'Remark of Lost',                type: 'textarea' },
      { key: 'actualDateStatus', label: 'Actual Date Status',            type: 'select', options: ['On Time','Delayed','Early','Missed'] },
      { key: 'calendarStatus',   label: 'Calendar Status',               type: 'select', options: ['Scheduled','Completed','Cancelled','Rescheduled'] },
    ],
  },
]

function FieldInput({ field, value, onChange }) {
  const base = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition'
  if (field.type === 'textarea')
    return <textarea rows={2} value={value||''} onChange={e=>onChange(e.target.value)} className={base + ' resize-none'} />
  if (field.type === 'select')
    return (
      <select value={value||''} onChange={e=>onChange(e.target.value)} className={base}>
        <option value=''>— select —</option>
        {field.options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    )
  return <input type={field.type} value={value||''} onChange={e=>onChange(e.target.value)} className={base} />
}

const normalizeOutcome = (value) => String(value || '').trim().toLowerCase()

const canonicalConnectionStatus = (value) => {
  const normalized = normalizeOutcome(value)
  if (!normalized) return ''
  if (normalized === 'connected') return 'Connected'
  if (['non connected', 'no answer', 'busy', 'callback requested', 'wrong number', 'not interested'].includes(normalized)) {
    return 'Non Connected'
  }
  return ''
}

const canonicalActivityTwoStatus = (value) => {
  const normalized = normalizeOutcome(value)
  if (!normalized) return ''
  if (normalized === 'meeting') return 'Meeting'
  if (normalized === 'follow up' || normalized === 'follow-up' || normalized === 'followup') return 'Follow Up'
  if (normalized === 'not interested' || normalized === 'not_interested') return 'Not Interested'
  return ''
}

const canonicalActivityThreeStatus = (value) => {
  const normalized = normalizeOutcome(value)
  if (!normalized) return ''
  if (normalized === 'successful' || normalized === 'success') return 'Successful'
  if (normalized === 'failed' || normalized === 'failure') return 'Failed'
  return ''
}

const canonicalActivityFourStatus = (value) => {
  const normalized = normalizeOutcome(value)
  if (!normalized) return ''
  if (normalized === 'negotiation') return 'Negotiation'
  if (normalized === 'pending') return 'Pending'
  if (normalized === 'won' || normalized === 'win' || normalized === 'closed won') return 'Won'
  if (normalized === 'lost' || normalized === 'close lost' || normalized === 'closed lost') return 'Lost'
  if (normalized === 'hold' || normalized === 'follow up' || normalized === 'follow-up') return 'Hold'
  return ''
}

const formatDateTime = (value) => {
  if (!value) return 'Auto'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const computeDelayMeta = (plannedValue, actualValue) => {
  const planned = new Date(plannedValue)
  const actual = new Date(actualValue)
  if (Number.isNaN(planned.getTime()) || Number.isNaN(actual.getTime())) {
    return { label: 'Auto', status: 'On Time' }
  }

  const diffMs = actual.getTime() - planned.getTime()
  const hours = Math.abs(diffMs) / (1000 * 60 * 60)
  const rounded = hours.toFixed(1)

  if (Math.abs(diffMs) < 60 * 1000) {
    return { label: '0.0 hrs', status: 'On Time' }
  }
  if (diffMs > 0) {
    return { label: `${rounded} hrs`, status: 'Delayed' }
  }
  return { label: `${rounded} hrs`, status: 'Early' }
}

const humanizeLabel = (value) => {
  const text = String(value || '').replace(/_/g, ' ').trim()
  if (!text) return '—'
  return text
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export default function LeadActivitiesModal({ lead, onClose, onPersist, initialData, initialSaved, initialActiveTab = 0, onActiveTabChange }) {
  const [activeTab, setActiveTab] = useState(initialActiveTab || 0)
  const [saved, setSaved] = useState(initialSaved || [false, false, false, false])
  const [data, setData] = useState(initialData || [{},{},{},{}])
  const [saving, setSaving] = useState(false)
  const leadIdRef = useRef(lead?.id)

  useEffect(() => {
    if (leadIdRef.current === lead?.id) return
    leadIdRef.current = lead?.id
    setActiveTab(initialActiveTab || 0)
    setSaved(initialSaved || [false, false, false, false])
    setData(initialData || [{},{},{},{}])
  }, [lead?.id, initialActiveTab, initialData, initialSaved])

  useEffect(() => {
    if (typeof onActiveTabChange === 'function') {
      onActiveTabChange(lead?.id, activeTab)
    }
  }, [activeTab, lead?.id, onActiveTabChange])

  const act = ACTIVITIES[activeTab]
  const Icon = act.icon
  const activityOneValues = data[0] || {}
  const activityTwoValues = data[1] || {}
  const activityThreeValues = data[2] || {}
  const activityFourValues = data[3] || {}
  const activityOneStatus = normalizeOutcome(canonicalConnectionStatus(activityOneValues.connectionStatus || activityOneValues.callOutcome || activityOneValues.status))
  const activityTwoStatus = canonicalActivityTwoStatus(activityTwoValues.status)
  const activityThreeStatus = canonicalActivityThreeStatus(activityThreeValues.status)
  const activityFourStatus = canonicalActivityFourStatus(activityFourValues.status)
  const isActivityOneConnected = activityOneStatus === 'connected'
  const isActivityOneNonConnected = activityOneStatus === 'non connected'
  const leadSource = humanizeLabel(lead?.source || activityOneValues.source)
  const serviceRequirement = humanizeLabel(lead?.service || lead?.specialization || activityOneValues.serviceRequirement)
  const plannedDate = lead?.createdAt || activityOneValues.plannedDate || lead?.followUpDate || null
  const actualDate = new Date().toISOString()
  const delayMeta = computeDelayMeta(plannedDate, actualDate)
  const assignedTeamMember = humanizeLabel(lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || activityOneValues.assignedTo || 'Auto assigned')
  const remarksValue = activityOneValues.remark || activityOneValues.remarks || activityOneValues.note || ''
  const activityTwoPlannedDate = activityOneValues.actualDate || activityOneValues.actual || activityOneValues.savedAt || lead?.followUpDate || lead?.createdAt || null
  const activityTwoActualDate = new Date().toISOString()
  const activityTwoDelayMeta = computeDelayMeta(activityTwoPlannedDate, activityTwoActualDate)
  const activityTwoAssignedTeamMember = humanizeLabel(activityOneValues.assignedTo || lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || 'Auto assigned')
  const activityTwoRemark = activityTwoValues.remark || activityTwoValues.remarks || activityTwoValues.note || ''
  const isActivityTwoMeeting = normalizeOutcome(activityTwoStatus) === 'meeting'
  const isActivityTwoFollowUp = normalizeOutcome(activityTwoStatus) === 'follow up'
  const isActivityTwoNotInterested = normalizeOutcome(activityTwoStatus) === 'not interested'

  const updateField = (key, val) => {
    setData(prev => {
      const next = [...prev]
      next[activeTab] = { ...next[activeTab], [key]: val }
      return next
    })
  }

  const patchCurrentActivity = (patch) => {
    setData(prev => {
      const next = [...prev]
      next[activeTab] = { ...next[activeTab], ...patch }
      return next
    })
  }

  const handleSave = async () => {
    if (activeTab === 0) {
      if (!activityOneStatus) {
        toast.error('Please select Connected or Non Connected.')
        return false
      }
      if (isActivityOneNonConnected && !String(activityOneValues.nextFollowUpDate || activityOneValues.followUpDate || '').trim()) {
        toast.error('Please select a follow-up date for the non-connected lead.')
        return false
      }
    }
    if (activeTab === 1) {
      if (!activityTwoStatus) {
        toast.error('Please select Meeting, Follow Up, or Not Interested.')
        return false
      }
      if (isActivityTwoFollowUp && !String(activityTwoValues.nextFollowUpDate || activityTwoValues.followUpDate || '').trim()) {
        toast.error('Please select a next follow-up date.')
        return false
      }
    }
    if (activeTab === 3) {
      if (!activityFourStatus) {
        toast.error('Please select a status for Activity 04.')
        return false
      }
      if (isActivityFourLost && !String(activityFourLostCategory).trim()) {
        toast.error('Please select a lost category.')
        return false
      }
      if (isActivityFourWon) {
        if (!String(activityFourMeetingPriceFinal).trim()) {
          toast.error('Please enter the meeting price final.')
          return false
        }
        if (!String(activityFourPaymentReceived).trim()) {
          toast.error('Please select payment received yes or no.')
          return false
        }
      }
      if (isActivityFourHold && !String(activityFourFollowUpDate).trim()) {
        toast.error('Please select a follow-up date.')
        return false
      }
    }
    if (activeTab === 2) {
      if (!String(activityThreePersonName).trim()) {
        toast.error('Please enter the person name.')
        return false
      }
      if (!String(activityThreePersonDesignation).trim()) {
        toast.error('Please enter the designation.')
        return false
      }
      if (!String(activityThreeMeetingDate).trim()) {
        toast.error('Please select the meeting date.')
        return false
      }
      if (!String(activityThreeMeetingMode).trim()) {
        toast.error('Please select the meeting mode.')
        return false
      }
    }
    setSaving(true)
    try {
      if (onPersist) {
        await onPersist({
          lead,
          activityIndex: activeTab,
          activity: ACTIVITIES[activeTab],
          values: data[activeTab] || {},
          allValues: data,
        })
      }
      setSaved(prev => { const n=[...prev]; n[activeTab]=true; return n })
      toast.success(`${ACTIVITIES[activeTab].label} saved`)
      return true
    } catch (err) {
      toast.error(err?.message || 'Failed to save activity')
      return false
    } finally {
      setSaving(false)
    }
  }

  const isComplete = (idx) => saved[idx]

  const handleActivityOneChange = (key, val) => {
    if (key === 'connectionStatus') {
      patchCurrentActivity({
        connectionStatus: val,
        callOutcome: val,
        ...(normalizeOutcome(val) === 'connected' ? { nextFollowUpDate: '', followUpDate: '' } : {}),
      })
      return
    }
    if (key === 'nextFollowUpDate') {
      patchCurrentActivity({ nextFollowUpDate: val, followUpDate: val })
      return
    }
    if (key === 'remark') {
      patchCurrentActivity({ remark: val, remarks: val })
      return
    }
    updateField(key, val)
  }

  const handleActivityTwoChange = (key, val) => {
    if (key === 'status') {
      patchCurrentActivity({
        status: val,
        remark: '',
        remarks: '',
        note: '',
        nextFollowUpDate: normalizeOutcome(val) === 'follow up' ? (activityTwoValues.nextFollowUpDate || '') : '',
        followUpDate: normalizeOutcome(val) === 'follow up' ? (activityTwoValues.nextFollowUpDate || '') : '',
      })
      return
    }
    if (key === 'nextFollowUpDate') {
      patchCurrentActivity({ nextFollowUpDate: val, followUpDate: val })
      return
    }
    if (key === 'remark') {
      patchCurrentActivity({ remark: val, remarks: val, note: val })
      return
    }
    updateField(key, val)
  }

  const handleActivityTwoPrimaryAction = async () => {
    const ok = await handleSave()
    if (!ok) return
    if (isActivityTwoMeeting) {
      setActiveTab(2)
      return
    }
    if (isActivityTwoNotInterested) {
      onClose()
      return
    }
  }

  const activityTwoPrimaryLabel = isActivityTwoMeeting
    ? 'Next Activity →'
    : isActivityTwoFollowUp
      ? 'Save Follow Up'
      : isActivityTwoNotInterested
        ? 'Close Lead'
        : 'Save & Continue'

  const activityThreePlannedDate = activityTwoValues.actualDate || activityTwoValues.actual || activityTwoValues.savedAt || activityTwoValues.plannedDate || lead?.createdAt || null
  const activityThreeActualDate = new Date().toISOString()
  const activityThreeDelayMeta = computeDelayMeta(activityThreePlannedDate, activityThreeActualDate)
  const activityThreeAssignedTeamMember = humanizeLabel(activityTwoValues.assignedTo || activityOneValues.assignedTo || lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || 'Auto assigned')
  const activityThreePersonName = activityThreeValues.personName || ''
  const activityThreePersonDesignation = activityThreeValues.personDesignation || ''
  const activityThreeMeetingDate = activityThreeValues.meetingDate || activityThreeActualDate
  const activityThreeMeetingMode = activityThreeValues.meetingMode || ''
  const activityThreeRemark = activityThreeValues.remark || activityThreeValues.remarks || activityThreeValues.note || ''
  const isActivityThreeSuccessful = normalizeOutcome(activityThreeStatus) === 'successful'
  const isActivityThreeFailed = normalizeOutcome(activityThreeStatus) === 'failed'
  const activityFourPlannedDate = activityThreeValues.actualDate || activityThreeValues.actual || activityThreeValues.savedAt || activityThreeValues.plannedDate || lead?.createdAt || null
  const activityFourActualDate = new Date().toISOString()
  const activityFourDelayMeta = computeDelayMeta(activityFourPlannedDate, activityFourActualDate)
  const activityFourAssignedTeamMember = humanizeLabel(activityThreeValues.assignedTo || activityTwoValues.assignedTo || activityOneValues.assignedTo || lead?.assignedToName || lead?.assignedTo?.name || lead?.assignedTo || 'Auto assigned')
  const activityFourFollowUpDate = activityFourValues.followUpDate || activityFourValues.nextFollowUpDate || ''
  const activityFourMeetingPriceFinal = activityFourValues.meetingPriceFinal || ''
  const activityFourPaymentReceived = activityFourValues.paymentReceived || ''
  const activityFourLostCategory = activityFourValues.lostCategory || ''
  const activityFourCalendarStatus = activityFourValues.calendarStatus || ''
  const activityFourRemark = activityFourValues.remark || activityFourValues.remarks || activityFourValues.note || ''
  const activityFourRemarkFollowUp = activityFourValues.remarkFollowUp || activityFourRemark
  const activityFourRemarkWon = activityFourValues.remarkWon || activityFourRemark
  const activityFourRemarkLost = activityFourValues.remarkLost || activityFourRemark
  const isActivityFourNegotiation = normalizeOutcome(activityFourStatus) === 'negotiation'
  const isActivityFourLost = normalizeOutcome(activityFourStatus) === 'lost'
  const isActivityFourWon = normalizeOutcome(activityFourStatus) === 'won'
  const isActivityFourHold = normalizeOutcome(activityFourStatus) === 'hold'
  const isActivityFourPending = normalizeOutcome(activityFourStatus) === 'pending'

  const handleActivityThreeChange = (key, val) => {
    if (key === 'status') {
      patchCurrentActivity({
        status: val,
        remark: '',
        remarks: '',
        note: '',
      })
      return
    }
    if (key === 'remark') {
      patchCurrentActivity({ remark: val, remarks: val, note: val })
      return
    }
    updateField(key, val)
  }

  const handleActivityThreePrimaryAction = async () => {
    const ok = await handleSave()
    if (!ok) return
    if (isActivityThreeSuccessful) {
      setActiveTab(3)
      return
    }
    if (isActivityThreeFailed) {
      setActiveTab(1)
    }
  }

  const activityThreePrimaryLabel = isActivityThreeSuccessful
    ? 'Next Activity →'
    : isActivityThreeFailed
      ? 'Back to Follow Up'
      : 'Save & Continue'

  const handleActivityFourChange = (key, val) => {
    if (key === 'status') {
      patchCurrentActivity({
        status: val,
        remark: '',
        remarks: '',
        note: '',
      })
      return
    }
    if (key === 'remark' || key === 'remarkFollowUp' || key === 'remarkWon' || key === 'remarkLost') {
      patchCurrentActivity({ [key]: val, remark: val, remarks: val, note: val })
      return
    }
    updateField(key, val)
  }

  const handleActivityFourPrimaryAction = async () => {
    const ok = await handleSave()
    if (!ok) return
    if (isActivityFourNegotiation) {
      setActiveTab(2)
      return
    }
    if (isActivityFourHold) {
      setActiveTab(1)
      return
    }
    if (isActivityFourLost || isActivityFourWon) {
      onClose()
    }
  }

  const activityFourPrimaryLabel = isActivityFourNegotiation
    ? 'Go to Meeting →'
    : isActivityFourLost
      ? 'Close Lead'
      : isActivityFourWon
        ? 'Complete Lead'
        : isActivityFourHold
          ? 'Back to Follow Up'
          : isActivityFourPending
            ? 'Save Pending'
          : 'Save & Continue'

  const handleCurrentPrimaryAction = async () => {
    if (activeTab === 1) {
      await handleActivityTwoPrimaryAction()
      return
    }
    if (activeTab === 2) {
      await handleActivityThreePrimaryAction()
      return
    }
    if (activeTab === 3) {
      await handleActivityFourPrimaryAction()
      return
    }
    const ok = await handleSave()
    if (!ok) return
    if (activeTab === 0 && !isActivityOneConnected) return
    if (activeTab < ACTIVITIES.length - 1) {
      setActiveTab(t => t + 1)
      return
    }
    onClose()
  }

  const currentPrimaryLabel = activeTab === 1
    ? activityTwoPrimaryLabel
    : activeTab === 2
      ? activityThreePrimaryLabel
      : activeTab === 3
        ? activityFourPrimaryLabel
        : activeTab === 0 && !isActivityOneConnected
          ? 'Save Follow-Up'
          : 'Next Activity →'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Lead activities">
      <motion.div
        initial={{ opacity:0, scale:0.95, y:20 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.95, y:20 }}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Lead Activities</h2>
            <p className="text-xs text-slate-500 mt-0.5">{lead?.name} · {lead?.company}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-0 overflow-x-auto custom-scrollbar pb-1">
            {ACTIVITIES.map((a, i) => {
              const AIcon = a.icon
              const done = isComplete(i)
              const active = i === activeTab
              return (
                <div key={a.id} className="flex items-center min-w-[140px] sm:min-w-0 flex-1">
                  <button
                    onClick={() => setActiveTab(i)}
                    className={`flex flex-col items-center gap-1 flex-1 px-2 py-2 rounded-xl transition-all ${active ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-all ${done ? 'bg-emerald-500' : active ? a.color.step : 'bg-slate-300 dark:bg-slate-600'}`}>
                      {done ? <CheckCircle2 className="w-5 h-5" /> : <AIcon className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>{a.label}</span>
                    <span className={`text-xs hidden sm:block text-center leading-tight ${active ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'}`}>{a.title}</span>
                  </button>
                  {i < ACTIVITIES.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity:0, x:20 }}
              animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:-20 }}
              transition={{ duration:0.18 }}
            >
              {/* Activity Excel-style Header */}
              <div className="mx-4 sm:mx-6 mt-5 rounded-xl overflow-hidden border" style={{ borderColor: act.color.border }}>
                <div className="px-4 py-2 text-white text-sm font-bold flex items-center justify-between" style={{ background: act.color.header }}>
                  <span>{act.label} — {act.title}</span>
                  {act.hours && <span className="text-xs font-normal opacity-80">{act.hours} Hour{act.hours>1?'s':''}</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x text-xs" style={{ background: act.color.bg, borderColor: act.color.border }}>
                  <div className="px-3 py-1.5">
                    <span className="text-slate-500">What has to be done</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{act.title}</p>
                  </div>
                  <div className="px-3 py-1.5">
                    <span className="text-slate-500">Who will do it</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{data[activeTab].assignedTo || <span className="text-slate-400 font-normal">Not assigned</span>}</p>
                  </div>
                  <div className="px-3 py-1.5">
                    <span className="text-slate-500">How will it be done</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{act.description}</p>
                  </div>
                </div>
              </div>

              {/* Fields Grid */}
              {activeTab === 0 ? (
                <div className="px-4 sm:px-6 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Source', value: leadSource },
                      { label: 'Service Requirement', value: serviceRequirement },
                      { label: 'Planned Date', value: formatDateTime(plannedDate) },
                      { label: 'Actual Date', value: formatDateTime(actualDate) },
                      { label: 'Delay', value: delayMeta.label },
                      { label: 'Actual Date Status', value: delayMeta.status },
                      { label: 'Team Member', value: assignedTeamMember },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Status <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={canonicalConnectionStatus(activityOneValues.connectionStatus || activityOneValues.callOutcome || activityOneValues.status)}
                        onChange={e => handleActivityOneChange('connectionStatus', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      >
                        <option value="">— Select status —</option>
                        <option value="Connected">Connected</option>
                        <option value="Non Connected">Non Connected</option>
                      </select>
                    </div>

                    {isActivityOneNonConnected && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Next Follow-Up Date <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={activityOneValues.nextFollowUpDate || activityOneValues.followUpDate || ''}
                          onChange={e => handleActivityOneChange('nextFollowUpDate', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {isActivityOneConnected ? 'Remarks for Connected Lead' : 'Remarks for Non Connected Lead'}
                      </label>
                      <textarea
                        rows={3}
                        value={remarksValue}
                        onChange={e => handleActivityOneChange('remark', e.target.value)}
                        placeholder={
                          isActivityOneConnected
                            ? 'Add next steps or the conversation summary'
                            : 'Add the reason and next follow-up context'
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className={`rounded-xl border px-4 py-3 text-sm ${isActivityOneConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                    {isActivityOneConnected
                      ? 'Connected leads become eligible for the next activity.'
                      : 'Non connected leads should be scheduled for the next follow-up date.'}
                  </div>
                </div>
              ) : activeTab === 1 ? (
                <div className="px-4 sm:px-6 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Planned Date', value: formatDateTime(activityTwoPlannedDate) },
                      { label: 'Actual Date', value: formatDateTime(activityTwoActualDate) },
                      { label: 'Delay', value: activityTwoDelayMeta.label },
                      { label: 'Actual Date Status', value: activityTwoDelayMeta.status },
                      { label: 'Assigned To', value: activityTwoAssignedTeamMember },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Status <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={activityTwoStatus}
                        onChange={e => handleActivityTwoChange('status', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      >
                        <option value="">— Select status —</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Follow Up">Follow Up</option>
                      </select>
                    </div>

                    {isActivityTwoFollowUp && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Next Follow-Up Date <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={activityTwoValues.nextFollowUpDate || activityTwoValues.followUpDate || ''}
                          onChange={e => handleActivityTwoChange('nextFollowUpDate', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {isActivityTwoMeeting
                          ? 'Meeting Remarks'
                          : isActivityTwoFollowUp
                            ? 'Follow Up Remarks'
                            : 'Reason for Not Interested'}
                      </label>
                      <textarea
                        rows={3}
                        value={activityTwoRemark}
                        onChange={e => handleActivityTwoChange('remark', e.target.value)}
                        placeholder={
                          isActivityTwoMeeting
                            ? 'Add meeting context or outcome'
                            : isActivityTwoFollowUp
                              ? 'Add next-step notes for the follow-up'
                              : 'Add the reason for closing this lead'
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className={`rounded-xl border px-4 py-3 text-sm ${
                    isActivityTwoMeeting
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : isActivityTwoFollowUp
                        ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}>
                    {isActivityTwoMeeting && 'Meeting selected. This lead can move to the next activity.'}
                    {isActivityTwoFollowUp && 'Follow Up selected. This lead stays here until the next follow-up is completed.'}
                    {isActivityTwoNotInterested && 'Not Interested selected. Saving this will close the flow for this lead.'}
                  </div>
                </div>
              ) : activeTab === 2 ? (
                <div className="px-4 sm:px-6 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Planned Date', value: formatDateTime(activityThreePlannedDate) },
                      { label: 'Actual Date', value: formatDateTime(activityThreeActualDate) },
                      { label: 'Delay', value: activityThreeDelayMeta.label },
                      { label: 'Actual Date Status', value: activityThreeDelayMeta.status },
                      { label: 'Assigned To', value: activityThreeAssignedTeamMember },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-4 py-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Meeting Details</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Person name, designation, meeting date, and mode are captured here.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Person Name
                        </label>
                        <input
                          type="text"
                          value={activityThreePersonName}
                          onChange={e => handleActivityThreeChange('personName', e.target.value)}
                          placeholder="Enter person name"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Designation
                        </label>
                        <input
                          type="text"
                          value={activityThreePersonDesignation}
                          onChange={e => handleActivityThreeChange('personDesignation', e.target.value)}
                          placeholder="Enter designation"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Meeting Date
                        </label>
                        <input
                          type="datetime-local"
                          value={activityThreeMeetingDate}
                          onChange={e => handleActivityThreeChange('meetingDate', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Meeting Mode
                        </label>
                        <select
                          value={activityThreeMeetingMode}
                          onChange={e => handleActivityThreeChange('meetingMode', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        >
                          <option value="">— Select meeting mode —</option>
                          <option value="In-Person">In-Person</option>
                          <option value="Video Call">Video Call</option>
                          <option value="Phone Call">Phone Call</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Meeting Status <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={activityThreeStatus}
                        onChange={e => handleActivityThreeChange('status', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      >
                        <option value="">— Select status —</option>
                        <option value="Successful">Successful</option>
                        <option value="Failed">Failed</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {isActivityThreeSuccessful ? 'Successful Meeting Remarks' : 'Failed Meeting Remarks'}
                      </label>
                      <textarea
                        rows={3}
                        value={activityThreeRemark}
                        onChange={e => handleActivityThreeChange('remark', e.target.value)}
                        placeholder={
                          isActivityThreeSuccessful
                            ? 'Add meeting success notes or next step'
                            : 'Add the reason the meeting failed and what to do next'
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className={`rounded-xl border px-4 py-3 text-sm ${
                    isActivityThreeSuccessful
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300'
                  }`}>
                    {isActivityThreeSuccessful && 'Meeting successful. This lead can move to the next activity.'}
                    {isActivityThreeFailed && 'Meeting failed. Saving this will send the flow back to Activity 02 follow up.'}
                  </div>
                </div>
              ) : activeTab === 3 ? (
                <div className="px-4 sm:px-6 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Planned Date', value: formatDateTime(activityFourPlannedDate) },
                      { label: 'Actual Date', value: formatDateTime(activityFourActualDate) },
                      { label: 'Delay', value: activityFourDelayMeta.label },
                      { label: 'Actual Date Status', value: activityFourDelayMeta.status },
                      { label: 'Assigned To', value: activityFourAssignedTeamMember },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Status <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={activityFourStatus}
                        onChange={e => handleActivityFourChange('status', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      >
                        <option value="">— Select status —</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Lost">Lost</option>
                        <option value="Won">Won</option>
                        <option value="Hold">Hold</option>
                        <option value="Pending">Pending Review</option>
                        </select>
                      </div>

                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                      {isActivityFourHold && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300">
                          <Clock className="w-3.5 h-3.5" /> Hold routing
                        </span>
                      )}
                      {isActivityFourPending && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                          <AlertCircle className="w-3.5 h-3.5" /> Pending review
                        </span>
                      )}
                      {isActivityFourNegotiation && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Negotiation
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Calendar Status
                      </label>
                      <select
                        value={activityFourCalendarStatus}
                        onChange={e => handleActivityFourChange('calendarStatus', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      >
                        <option value="">— Select calendar status —</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Rescheduled">Rescheduled</option>
                      </select>
                    </div>

                    {(isActivityFourHold || isActivityFourNegotiation) && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Follow-Up Date {isActivityFourHold ? <span className="text-red-400">*</span> : null}
                        </label>
                        <input
                          type="date"
                          value={activityFourFollowUpDate}
                          onChange={e => handleActivityFourChange('followUpDate', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        />
                      </div>
                    )}

                    {isActivityFourWon && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Meeting Price Final (₹) <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            value={activityFourMeetingPriceFinal}
                            onChange={e => handleActivityFourChange('meetingPriceFinal', e.target.value)}
                            placeholder="Enter final meeting price"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Payment Received <span className="text-red-400">*</span>
                          </label>
                          <select
                            value={activityFourPaymentReceived}
                            onChange={e => handleActivityFourChange('paymentReceived', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                          >
                            <option value="">— Select payment received —</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                      </>
                    )}

                    {isActivityFourLost && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Lost Category <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={activityFourLostCategory}
                          onChange={e => handleActivityFourChange('lostCategory', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                        >
                          <option value="">— Select lost category —</option>
                          <option value="Price">Price</option>
                          <option value="Competition">Competition</option>
                          <option value="No Need">No Need</option>
                          <option value="Timing">Timing</option>
                          <option value="Budget">Budget</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {isActivityFourWon
                          ? 'Won Remarks'
                          : isActivityFourLost
                            ? 'Lost Remarks'
                            : isActivityFourHold
                              ? 'Follow Up Remarks'
                              : 'Negotiation Remarks'}
                      </label>
                      <textarea
                        rows={3}
                        value={
                          isActivityFourWon
                            ? activityFourRemarkWon
                            : isActivityFourLost
                              ? activityFourRemarkLost
                              : isActivityFourHold
                                ? activityFourRemarkFollowUp
                                : activityFourRemark
                        }
                        onChange={e => handleActivityFourChange(
                          isActivityFourWon
                            ? 'remarkWon'
                            : isActivityFourLost
                              ? 'remarkLost'
                              : isActivityFourHold
                                ? 'remarkFollowUp'
                                : 'remark',
                          e.target.value
                        )}
                        placeholder={
                          isActivityFourWon
                            ? 'Add win summary, payment notes, or next step'
                            : isActivityFourLost
                              ? 'Add the reason the lead was lost'
                              : isActivityFourHold
                                ? 'Add follow-up notes and next touchpoint'
                                : 'Add negotiation notes and next step'
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className={`rounded-xl border px-4 py-3 text-sm ${
                    isActivityFourWon
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : isActivityFourLost
                        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300'
                        : isActivityFourHold
                          ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300'
                          : isActivityFourPending
                            ? 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}>
                    {isActivityFourNegotiation && 'Negotiation selected. This lead can move to Activity 03 meeting.'}
                    {isActivityFourLost && 'Lost selected. Saving this will close the activity after capturing the lost category.'}
                    {isActivityFourWon && 'Won selected. Capture final price and payment received, then complete the lead.'}
                    {isActivityFourHold && 'Hold selected. Saving this will send the flow back to Activity 02 follow up.'}
                    {isActivityFourPending && 'Pending review selected. This stays neutral until the next routing step.'}
                    {!isActivityFourNegotiation && !isActivityFourLost && !isActivityFourWon && !isActivityFourHold && !isActivityFourPending && 'Select a status to continue.'}
                  </div>
                </div>
              ) : (
                <div className="px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {act.fields.map(field => (
                    <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{field.label}</label>
                      <FieldInput field={field} value={data[activeTab][field.key]} onChange={val => updateField(field.key, val)} />
                    </div>
                  ))}
                </div>
              )}

              {/* Saved banner */}
              {saved[activeTab] && (
                <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Activity saved successfully!
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {activeTab > 0 && (
              <button onClick={() => setActiveTab(t => t - 1)} className="btn-secondary text-xs">← Prev</button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCurrentPrimaryAction}
              disabled={saving || (activeTab === 3 && !activityFourStatus) || (activeTab === 2 && !activityThreeStatus) || (activeTab === 1 && !activityTwoStatus)}
              className={`btn-primary text-xs gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
                activeTab === 3
                  ? isActivityFourWon
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : isActivityFourLost
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : isActivityFourHold
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : isActivityFourPending
                          ? 'bg-slate-600 hover:bg-slate-700'
                        : 'bg-brand-600 hover:bg-brand-700'
                  : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {currentPrimaryLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

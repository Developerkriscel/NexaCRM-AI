import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Plus, Play, Pause, Trash2, ChevronRight, CheckCircle2, Clock, AlertTriangle, X, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { automationAPI } from '../../services/api'
import PageHeading from '../ui/PageHeading'
import LoadingState from '../ui/LoadingState'

const CATEGORY_COLORS = {
  'Lead Management': 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400',
  Sales: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  Invoices: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  Finance: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  AI: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400',
  Communication: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
  Operations: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

const STEP_TYPES = ['IF', 'THEN', 'WAIT', 'CONDITION']

const STEP_COLORS = {
  IF: 'bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400',
  THEN: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400',
  WAIT: 'bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400',
  CONDITION: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400',
}

const ADVANCED_TEMPLATES = [
  {
    id: 'sla-breach',
    name: 'Lead SLA Breach Automation',
    category: 'Lead Management',
    priority: 'critical',
    steps: [
      { type: 'IF', text: 'Lead not contacted in 1 hour' },
      { type: 'THEN', text: 'Mark SLA breached' },
      { type: 'THEN', text: 'Notify admin' },
      { type: 'THEN', text: 'Reassign lead using smart logic' },
    ],
  },
  {
    id: 'smart-reassign',
    name: 'Smart Reassignment Logic',
    category: 'Operations',
    steps: [
      { type: 'IF', text: 'Lead requires assignment or reassignment' },
      { type: 'THEN', text: 'Rank reps by least busy load' },
      { type: 'THEN', text: 'Boost score by performer rank + online status + skill match' },
      { type: 'THEN', text: 'Assign lead to highest score rep' },
    ],
  },
  {
    id: 'ai-scoring',
    name: 'AI Lead Scoring Automation',
    category: 'AI',
    steps: [
      { type: 'IF', text: 'Lead created' },
      { type: 'THEN', text: 'Analyze source, budget, and activity signals' },
      { type: 'THEN', text: 'Assign score: Hot / Warm / Cold' },
      { type: 'CONDITION', text: 'If Hot => move to priority queue; if Cold => start nurture flow' },
    ],
  },
  {
    id: 'hot-call-scheduler',
    name: 'Auto Call / Meeting Scheduler',
    category: 'Sales',
    steps: [
      { type: 'IF', text: 'Lead marked Hot' },
      { type: 'THEN', text: 'Auto-schedule call based on rep availability' },
      { type: 'THEN', text: 'Send calendar invite (Google Calendar)' },
      { type: 'THEN', text: 'Generate Zoom / Meet link and attach to lead timeline' },
    ],
  },
  {
    id: 'whatsapp-conversation',
    name: 'WhatsApp Conversation Automation',
    category: 'Communication',
    steps: [
      { type: 'IF', text: 'Lead created' },
      { type: 'THEN', text: 'Send welcome WhatsApp message' },
      { type: 'WAIT', text: '30 minutes' },
      { type: 'CONDITION', text: 'If reply received => move to Active Lead; else send follow-up message' },
    ],
  },
  {
    id: 'multi-step-chain',
    name: 'Multi-Step Follow-up Chain',
    category: 'Lead Management',
    steps: [
      { type: 'IF', text: 'Lead created' },
      { type: 'THEN', text: 'Assign representative' },
      { type: 'WAIT', text: '1 hour' },
      { type: 'CONDITION', text: 'If no response => send reminder' },
      { type: 'WAIT', text: '30 minutes' },
      { type: 'CONDITION', text: 'If still no response => reassign lead' },
    ],
  },
  {
    id: 'behavior-based',
    name: 'Behavior-Based Interest Automation',
    category: 'AI',
    steps: [
      { type: 'IF', text: 'Customer opens the same email 3 times' },
      { type: 'THEN', text: 'Mark lead as interested' },
      { type: 'THEN', text: 'Notify assigned sales rep instantly' },
    ],
  },
  {
    id: 'revenue-automation',
    name: 'Revenue Automation Flow',
    category: 'Invoices',
    steps: [
      { type: 'IF', text: 'Deal moved to Won' },
      { type: 'THEN', text: 'Generate invoice' },
      { type: 'THEN', text: 'Send payment link' },
      { type: 'THEN', text: 'Start payment tracking and reminders' },
    ],
  },
  {
    id: 'risk-detection',
    name: 'Sales Rep Risk Detection',
    category: 'Operations',
    steps: [
      { type: 'IF', text: 'Employee ignores 5 leads in a day' },
      { type: 'THEN', text: 'Alert admin with rep summary' },
      { type: 'THEN', text: 'Reduce new lead assignment for that rep' },
    ],
  },
  {
    id: 'custom-rule-builder',
    name: 'Custom Rule Builder Template',
    category: 'Lead Management',
    steps: [
      { type: 'IF', text: 'Source = Instagram AND budget > 50k' },
      { type: 'THEN', text: 'Assign to senior rep' },
      { type: 'THEN', text: 'Tag as High Intent Social Lead' },
    ],
  },
]

const WORKFLOW_FORM_INITIAL = {
  name: '',
  category: 'Lead Management',
  status: 'active',
  steps: [
    { type: 'IF', text: '' },
    { type: 'THEN', text: '' },
  ],
}

const RULE_EXAMPLES = [
  { label: 'Trigger: Lead Created', type: 'IF', text: 'trigger: LEAD_CREATED' },
  { label: 'Trigger: Deal Stage Changed', type: 'IF', text: 'trigger: DEAL_STAGE_CHANGED' },
  { label: 'If Stage = WON', type: 'CONDITION', text: 'stage is won' },
  { label: 'Set Deal Stage WON', type: 'THEN', text: 'set_deal_stage:WON' },
  { label: 'Set Lead Status QUALIFIED', type: 'THEN', text: 'set_lead_status:QUALIFIED' },
  { label: 'Set Lead Score HOT', type: 'THEN', text: 'set_lead_score:HOT' },
  { label: 'Assign Lead', type: 'THEN', text: 'assign_lead:user@email.com' },
  { label: 'Broadcast Notify', type: 'THEN', text: 'notify:Lead requires immediate follow-up' },
  { label: 'Send Email', type: 'THEN', text: 'send_email:ops@example.com|Workflow Alert|Lead entered high-priority stage' },
  { label: 'Send Call', type: 'THEN', text: 'send_call:+919876543210|Hi, this is NexaCRM calling about your enquiry.' },
]

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState([])
  const [loadingWorkflows, setLoadingWorkflows] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWorkflow, setNewWorkflow] = useState(WORKFLOW_FORM_INITIAL)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const stepsScrollRef = useRef(null)

  const mapWorkflowFromApi = (workflow) => ({
    ...workflow,
    status: String(workflow.status || 'ACTIVE').toLowerCase(),
    runs: Number(workflow.runs || 0),
    lastRun: workflow.lastRun || 'Never',
    steps: Array.isArray(workflow.steps) ? workflow.steps : [],
  })

  const mapWorkflowToApi = (workflow) => ({
    name: workflow.name,
    category: workflow.category,
    status: String(workflow.status || 'active').toUpperCase(),
    runs: Number(workflow.runs || 0),
    lastRun: workflow.lastRun || 'Never',
    priority: workflow.priority || null,
    steps: (workflow.steps || []).map((step) => ({ type: step.type, text: step.text })),
  })

  useEffect(() => {
    let cancelled = false
    const loadWorkflows = async () => {
      setLoadingWorkflows(true)
      try {
        const rows = await automationAPI.getAll()
        if (cancelled) return
        setWorkflows(Array.isArray(rows) ? rows.map(mapWorkflowFromApi) : [])
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Failed to load workflows')
      } finally {
        if (!cancelled) setLoadingWorkflows(false)
      }
    }

    loadWorkflows()
    return () => { cancelled = true }
  }, [])

  const toggleStatus = async (id) => {
    try {
      const updated = await automationAPI.toggle(id)
      const mapped = mapWorkflowFromApi(updated)
      setWorkflows((prev) => prev.map((workflow) => (workflow.id === id ? mapped : workflow)))
      toast.success(`Workflow ${mapped.status === 'active' ? 'activated' : 'paused'}`)
    } catch (err) {
      toast.error(err?.message || 'Failed to toggle workflow')
    }
  }

  const deleteWorkflow = async (id) => {
    try {
      await automationAPI.delete(id)
      setWorkflows((prev) => prev.filter((workflow) => workflow.id !== id))
      toast.success('Workflow deleted')
    } catch (err) {
      toast.error(err?.message || 'Failed to delete workflow')
    }
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setSelectedTemplateId('')
    setNewWorkflow(WORKFLOW_FORM_INITIAL)
  }

  const openCreateModal = () => {
    setShowCreateModal(true)
  }

  const loadTemplate = () => {
    const template = ADVANCED_TEMPLATES.find((item) => item.id === selectedTemplateId)
    if (!template) {
      toast.error('Select a template first.')
      return
    }
    setNewWorkflow({
      name: template.name,
      category: template.category,
      status: 'active',
      steps: template.steps.map((step) => ({ ...step })),
    })
    toast.success('Template loaded into builder')
  }

  const updateStep = (index, key, value) => {
    setNewWorkflow((prev) => ({
      ...prev,
      steps: prev.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [key]: value } : step
      ),
    }))
  }

  const addStep = () => {
    setNewWorkflow((prev) => ({
      ...prev,
      steps: [...prev.steps, { type: 'THEN', text: '' }],
    }))
    requestAnimationFrame(() => {
      if (stepsScrollRef.current) {
        stepsScrollRef.current.scrollTop = stepsScrollRef.current.scrollHeight
      }
    })
  }

  const removeStep = (index) => {
    setNewWorkflow((prev) => {
      if (prev.steps.length <= 2) {
        toast.error('At least 2 steps are required.')
        return prev
      }
      return {
        ...prev,
        steps: prev.steps.filter((_, stepIndex) => stepIndex !== index),
      }
    })
  }

  const addExampleStep = (example) => {
    setNewWorkflow((prev) => ({
      ...prev,
      steps: [...prev.steps, { type: example.type, text: example.text }],
    }))
    requestAnimationFrame(() => {
      if (stepsScrollRef.current) {
        stepsScrollRef.current.scrollTop = stepsScrollRef.current.scrollHeight
      }
    })
  }

  const createWorkflow = async (e) => {
    e.preventDefault()
    const name = newWorkflow.name.trim()
    const cleanedSteps = newWorkflow.steps
      .map((step) => ({ type: step.type, text: step.text.trim() }))
      .filter((step) => step.text)

    if (!name) {
      toast.error('Workflow name is required.')
      return
    }
    if (!CATEGORY_COLORS[newWorkflow.category]) {
      toast.error('Select a valid category.')
      return
    }
    if (cleanedSteps.length < 2) {
      toast.error('Add at least 2 valid steps.')
      return
    }
    if (!cleanedSteps.some((step) => step.type === 'IF')) {
      toast.error('Workflow must include an IF step.')
      return
    }
    if (!cleanedSteps.some((step) => step.type === 'THEN')) {
      toast.error('Workflow must include a THEN step.')
      return
    }

    const workflowToAdd = {
      name,
      status: newWorkflow.status,
      runs: 0,
      lastRun: 'Never',
      category: newWorkflow.category,
      priority: null,
      steps: cleanedSteps,
    }

    try {
      const created = await automationAPI.create(mapWorkflowToApi(workflowToAdd))
      setWorkflows((prev) => [mapWorkflowFromApi(created), ...prev])
      toast.success('Workflow created')
      closeCreateModal()
    } catch (err) {
      toast.error(err?.message || 'Failed to create workflow')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeading
          title="Automation Engine"
          subtitle={`${workflows.filter((workflow) => workflow.status === 'active').length} active workflows · ${workflows.reduce((sum, workflow) => sum + workflow.runs, 0)} total runs`}
          icon={<Zap className="w-6 h-6 text-amber-500" />}
        />
        <button onClick={openCreateModal} className="btn-primary gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> New Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[
          { label: 'Active Workflows', value: workflows.filter((workflow) => workflow.status === 'active').length, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Total Automations Run', value: workflows.reduce((sum, workflow) => sum + workflow.runs, 0), icon: Zap, color: 'text-amber-500' },
          { label: 'Paused Workflows', value: workflows.filter((workflow) => workflow.status === 'paused').length, icon: AlertTriangle, color: 'text-red-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-5 flex items-center gap-4">
            <Icon className={`w-8 h-8 ${color}`} />
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {loadingWorkflows && (
          <LoadingState text="Loading workflows..." card className="p-5" />
        )}
        {workflows.map((workflow) => (
          <motion.div key={workflow.id} layout className="glass-card p-5">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                  ${workflow.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <Zap className={`w-5 h-5 ${workflow.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{workflow.name}</h3>
                    <span className={`badge text-[10px] ${CATEGORY_COLORS[workflow.category] ?? 'badge'}`}>{workflow.category}</span>
                    {workflow.priority === 'critical' && (
                      <span className="badge text-[10px] bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">CRITICAL</span>
                    )}
                    <span className={`badge text-[10px] ${workflow.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                      {workflow.status === 'active' ? '● Active' : '⏸ Paused'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {workflow.steps.map((step, index) => (
                      <div key={`${step.type}-${index}`} className="contents">
                        {index > 0 && <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${STEP_COLORS[step.type] ?? 'bg-slate-50 text-slate-700'}`}>
                          {step.type}: {step.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {workflow.runs} runs</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last: {workflow.lastRun}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => toggleStatus(workflow.id)}
                  className={`p-2 rounded-xl transition-colors ${workflow.status === 'active'
                    ? 'hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-400 hover:text-amber-500'
                    : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-400 hover:text-emerald-500'}`}
                >
                  {workflow.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteWorkflow(workflow.id)}
                  className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create new workflow">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCreateModal}
              className="absolute inset-0 bg-slate-950/70"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-2xl z-10 max-h-[88vh] overflow-hidden rounded-3xl border border-slate-200 dark:border-cyan-300/20 shadow-2xl bg-gradient-to-br from-white via-slate-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40"
            >
              <div className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />

              <div className="relative px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-cyan-50 via-indigo-50 to-transparent dark:from-cyan-500/10 dark:via-indigo-500/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/40 dark:border-cyan-300/20 bg-cyan-100 dark:bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-200">
                      <Sparkles className="w-3.5 h-3.5" />
                      Automation Studio
                    </span>
                    <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">Create New Workflow</h2>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Build rule chains that trigger actions across your CRM funnel.</p>
                  </div>
                  <button
                    onClick={closeCreateModal}
                    className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={createWorkflow} className="relative flex flex-col min-h-0 max-h-[calc(88vh-96px)]">
                <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 pb-6 custom-scrollbar space-y-4 bg-gradient-to-b from-white/60 to-slate-100/60 dark:from-slate-950/35 dark:to-slate-900/25">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/70">
                    <p className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300 mb-2">Load Advanced Template</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="input text-sm py-2.5 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600"
                      >
                        <option value="">Select template...</option>
                        {ADVANCED_TEMPLATES.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={loadTemplate}
                        className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold rounded-xl text-cyan-700 dark:text-cyan-100 border border-cyan-300/50 dark:border-cyan-300/30 bg-cyan-100 dark:bg-cyan-400/10 hover:bg-cyan-200 dark:hover:bg-cyan-400/20 transition-colors"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/70">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">Rule Examples</p>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Click to add as new step</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {RULE_EXAMPLES.map((example) => (
                        <button
                          key={example.label}
                          type="button"
                          onClick={() => addExampleStep(example)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-cyan-400 dark:hover:border-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                          title={`${example.type}: ${example.text}`}
                        >
                          {example.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">Workflow Name *</label>
                      <input
                        value={newWorkflow.name}
                        onChange={(e) => setNewWorkflow((prev) => ({ ...prev, name: e.target.value }))}
                        className="input py-2.5 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600"
                        placeholder="Instagram High Budget Assignment"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">Category</label>
                      <select
                        value={newWorkflow.category}
                        onChange={(e) => setNewWorkflow((prev) => ({ ...prev, category: e.target.value }))}
                        className="input py-2.5 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600"
                      >
                        {Object.keys(CATEGORY_COLORS).map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">Initial Status</label>
                      <select
                        value={newWorkflow.status}
                        onChange={(e) => setNewWorkflow((prev) => ({ ...prev, status: e.target.value }))}
                        className="input py-2.5 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600"
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">Workflow Chain Steps *</label>
                      <button
                        type="button"
                        onClick={addStep}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 dark:text-slate-100 border border-indigo-300/50 dark:border-indigo-300/30 bg-indigo-100 dark:bg-indigo-500/25 hover:bg-indigo-200 dark:hover:bg-indigo-500/35 transition-colors"
                      >
                        Add Step
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Build your sequence from trigger to action.</p>
                    <div
                      ref={stepsScrollRef}
                      className="space-y-2 max-h-[42vh] overflow-y-auto pr-2 custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-600/60 p-2.5 bg-white dark:bg-slate-800/65"
                    >
                      {newWorkflow.steps.map((step, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl border border-slate-200 dark:border-slate-500/40 bg-slate-50 dark:bg-slate-900/50 p-2"
                        >
                          <div className="hidden sm:flex sm:col-span-1 h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            {index + 1}
                          </div>
                          <select
                            value={step.type}
                            onChange={(e) => updateStep(index, 'type', e.target.value)}
                            className="input col-span-1 sm:col-span-3 py-2 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600 font-semibold"
                          >
                            {STEP_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <input
                            value={step.text}
                            onChange={(e) => updateStep(index, 'text', e.target.value)}
                            className="input col-span-1 sm:col-span-7 py-2 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600"
                            placeholder={
                              step.type === 'WAIT'
                                ? 'e.g. 30 minutes'
                                : step.type === 'CONDITION'
                                ? 'e.g. If no response then reassign'
                                : 'Describe this step'
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="col-span-1 sm:col-span-1 p-1.5 rounded-lg border border-transparent hover:border-red-300/40 hover:bg-red-500/10 text-slate-400 hover:text-red-300 transition-colors justify-self-start sm:justify-self-auto"
                            title="Remove step"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-4 sm:px-5 pt-3 pb-4 border-t border-slate-200 dark:border-slate-700 bg-gradient-to-t from-slate-100 to-white dark:from-slate-900 dark:to-slate-900/80">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/75 backdrop-blur px-3 py-3">
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={closeCreateModal}
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 hover:from-indigo-400 hover:via-blue-400 hover:to-cyan-400 shadow-lg shadow-blue-500/25 transition-all"
                    >
                      Create Workflow
                    </button>
                  </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

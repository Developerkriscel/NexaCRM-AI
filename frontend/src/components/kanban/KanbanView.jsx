import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCorners,
  useDroppable,
  KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Filter, Search, IndianRupee, Calendar,
  User, Flame, Thermometer, Snowflake, MoreHorizontal, Trash2, X, ExternalLink, PlayCircle, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useLeadsStore } from '../../store/leadsStore'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { getLeadAgingMeta } from '../../utils/leadSla'
import { dealsAPI } from '../../services/api'
import PageHeading from '../ui/PageHeading'
import { PERMISSIONS, hasPermission } from '../../utils/permissions'

const STAGES = [
  { key: 'new',         label: 'New',         color: 'bg-slate-400' },
  { key: 'contacted',   label: 'Contacted',   color: 'bg-brand-400' },
  { key: 'qualified',   label: 'Qualified',   color: 'bg-brand-400' },
  { key: 'proposal',    label: 'Proposal',    color: 'bg-amber-400' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-orange-400' },
  { key: 'won',         label: 'Won',         color: 'bg-emerald-400' },
  { key: 'lost',        label: 'Lost',        color: 'bg-red-400' },
]

const PRIORITY_COLOR = {
  high:   'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low:    'text-slate-400',
}

const SCORE_CONFIG = {
  hot:  { icon: Flame,        color: 'text-red-500',  label: 'Hot' },
  warm: { icon: Thermometer,  color: 'text-amber-500',label: 'Warm' },
  cold: { icon: Snowflake,    color: 'text-sky-500',  label: 'Cold' },
}

const EMPTY_STAGE_MAP = STAGES.reduce((acc, stage) => {
  acc[stage.key] = []
  return acc
}, {})
const STAGE_DROP_PREFIX = 'stage:'
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const parsePrefixedValue = (text, key) => {
  const value = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith(`${key.toLowerCase()}:`))
  return value ? value.slice(key.length + 1).trim() : ''
}

const mapDealFromApi = (deal) => ({
  id: String(deal.id),
  title: deal.title || 'Untitled Deal',
  company: deal.company || parsePrefixedValue(deal.description, 'Company'),
  value: Number(deal.dealValue || 0),
  leadId: deal.leadId || null,
  owner: deal.ownerName || parsePrefixedValue(deal.notes, 'Owner') || 'Unassigned',
  dueDate: deal.expectedCloseDate || '',
  priority: String(deal.priority || 'MEDIUM').toLowerCase(),
  score: String(deal.aiScore || 'WARM').toLowerCase(),
  stage: String(deal.stage || 'NEW').toLowerCase(),
  activities: Number(deal.activitiesCount || 0),
  latestCallRecordingUrl: deal.latestCallRecordingUrl || '',
  latestCallSummary: deal.latestCallSummary || '',
  latestCallAt: deal.latestCallAt || '',
})

function DealCard({
  deal,
  stage,
  isDragging,
  isMenuOpen,
  onToggleMenu,
  onMoveDeal,
  onDeleteDeal,
  agingMeta,
  canMoveDeal,
  canDeleteDeal,
}) {
  const ScoreIcon = SCORE_CONFIG[deal.score]?.icon ?? Flame
  const scoreColor = SCORE_CONFIG[deal.score]?.color ?? 'text-slate-400'

  return (
    <div className={`deal-card select-none relative ${isDragging ? 'opacity-50 rotate-2 shadow-2xl' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight pr-2 line-clamp-2">
          {deal.title}
        </p>
        {(canMoveDeal || canDeleteDeal) && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu(deal.id)
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
            data-deal-menu
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-8 z-40 w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden"
            data-deal-menu
          >
            {canMoveDeal && STAGES.filter((s) => s.key !== stage).map((s) => (
              <button
                key={s.key}
                onClick={() => onMoveDeal(deal.id, s.key)}
                className="w-full px-3 py-2 text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Move to {s.label}
              </button>
            ))}
            {canMoveDeal && canDeleteDeal && <div className="h-px bg-slate-200 dark:bg-slate-700" />}
            {canDeleteDeal && (
              <button
                onClick={() => onDeleteDeal(deal.id)}
                className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Deal
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{deal.company}</p>

      {agingMeta && (
        <div className="mb-2">
          <span className={`badge ${agingMeta.badge}`}>{agingMeta.label}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-0.5 font-bold text-slate-700 dark:text-slate-300">
          <IndianRupee className="w-3 h-3" />
          {(deal.value / 1000).toFixed(0)}k
        </span>
        <ScoreIcon className={`w-3.5 h-3.5 ${scoreColor}`} />
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <User className="w-3 h-3" /> {deal.owner}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Calendar className="w-3 h-3" /> {deal.dueDate}
        </div>
      </div>

      <div className={`mt-2 text-[10px] font-semibold ${PRIORITY_COLOR[deal.priority] ?? 'text-slate-400'}`}>
        ● {deal.priority?.toUpperCase()} PRIORITY
      </div>

      {(deal.latestCallRecordingUrl || deal.latestCallSummary) && (
        <div className="mt-2 rounded-xl border border-brand-200/80 dark:border-brand-800/50 bg-brand-50/80 dark:bg-brand-950/15 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wide">
              Latest call
            </p>
            {deal.latestCallRecordingUrl && (
              <a
                href={deal.latestCallRecordingUrl}
                target="_blank"
                rel="noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                title="Open recording"
              >
                <PlayCircle className="w-3 h-3" /> Recording
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {deal.latestCallSummary && (
            <p className="mt-1 text-[10px] text-brand-800/80 dark:text-brand-100/80 leading-relaxed line-clamp-2">
              {deal.latestCallSummary}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function SortableDealCard({
  deal,
  stage,
  isMenuOpen,
  onToggleMenu,
  onMoveDeal,
  onDeleteDeal,
  agingMeta,
  canMoveDeal,
  canDeleteDeal,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    disabled: !canMoveDeal,
    data: { stage },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isMenuOpen ? 'relative z-30' : 'relative'}
      {...attributes}
      {...listeners}
    >
      <DealCard
        deal={deal}
        stage={stage}
        isDragging={isDragging}
        isMenuOpen={isMenuOpen}
        onToggleMenu={onToggleMenu}
        onMoveDeal={onMoveDeal}
        onDeleteDeal={onDeleteDeal}
        agingMeta={agingMeta}
        canMoveDeal={canMoveDeal}
        canDeleteDeal={canDeleteDeal}
      />
    </div>
  )
}

function KanbanColumn({
  stage,
  deals,
  onAddDeal,
  openDealMenuId,
  onToggleDealMenu,
  onMoveDeal,
  onDeleteDeal,
  getAgingMetaForDeal,
  canCreateDeal,
  canMoveDeal,
  canDeleteDeal,
}) {
  const totalValue = deals.reduce((s, d) => s + d.value, 0)
  const dropId = `${STAGE_DROP_PREFIX}${stage.key}`
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { stage: stage.key, type: 'stage' },
  })
  return (
    <div
      ref={setNodeRef}
      className={`kanban-column transition-colors ${isOver ? 'ring-2 ring-brand-300 dark:ring-brand-500/60' : ''}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{stage.label}</span>
          <span className="badge bg-white/80 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400">
            {deals.length}
          </span>
        </div>
        {canCreateDeal && (
          <button
            onClick={() => onAddDeal(stage.key)}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Column value */}
      {totalValue > 0 && (
        <div className="text-xs text-slate-500 dark:text-slate-400 px-1 mb-2">
          ₹{(totalValue / 100000).toFixed(1)}L total
        </div>
      )}

      {/* Deal cards */}
      <SortableContext id={stage.key} items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1">
          {deals.map((deal) => (
            <SortableDealCard
              key={deal.id}
              deal={deal}
              stage={stage.key}
              isMenuOpen={openDealMenuId === deal.id}
              onToggleMenu={onToggleDealMenu}
              onMoveDeal={onMoveDeal}
              onDeleteDeal={onDeleteDeal}
              agingMeta={getAgingMetaForDeal(deal)}
              canMoveDeal={canMoveDeal}
              canDeleteDeal={canDeleteDeal}
            />
          ))}
        </div>
      </SortableContext>

      {deals.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-400 text-center py-8">Drop deals here</p>
        </div>
      )}
    </div>
  )
}

export default function KanbanPage() {
  const { user } = useAuthStore()
  const { leads } = useLeadsStore()
  const { notifications } = useNotificationStore()
  const [searchParams] = useSearchParams()
  const [deals, setDeals] = useState(EMPTY_STAGE_MAP)
  const [loadingDeals, setLoadingDeals] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [search, setSearch] = useState('')
  const [openDealMenuId, setOpenDealMenuId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterScore, setFilterScore] = useState('all')
  const [filterOwner, setFilterOwner] = useState('all')
  const [filterStage, setFilterStage] = useState('all')
  const [newDeal, setNewDeal] = useState({
    title: '',
    company: '',
    value: '',
    owner: '',
    dueDate: new Date().toISOString().slice(0, 10),
    priority: 'medium',
    score: 'warm',
    stage: 'new',
  })
  const canCreateDeal = hasPermission(user, PERMISSIONS.DEALS_CREATE)
  const canUpdateDeal = hasPermission(user, PERMISSIONS.DEALS_UPDATE)
  const canMoveDeal = hasPermission(user, PERMISSIONS.DEALS_MOVE_STAGE)
  const canDeleteDeal = hasPermission(user, PERMISSIONS.DEALS_DELETE)
  const filterRef = useRef(null)
  const boardScrollRef = useRef(null)
  const mountedRef = useRef(true)
  const loadSeqRef = useRef(0)
  const lastNotificationIdRef = useRef(null)
  const routeSearch = searchParams.get('search') ?? ''

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const owners = useMemo(() => {
    const allOwners = Object.values(deals).flat().map((d) => d.owner)
    return [...new Set(allOwners)]
  }, [deals])

  useEffect(() => {
    setSearch(routeSearch)
  }, [routeSearch])

  const leadByCompany = useMemo(() => {
    const map = new Map()
    for (const lead of leads ?? []) {
      const key = String(lead.company ?? '').trim().toLowerCase()
      if (key && !map.has(key)) map.set(key, lead)
    }
    return map
  }, [leads])

  const getAgingMetaForDeal = useCallback((deal) => {
    const key = String(deal?.company ?? '').trim().toLowerCase()
    const lead = leadByCompany.get(key)
    return lead ? getLeadAgingMeta(lead) : null
  }, [leadByCompany])

  const loadBoard = useCallback(async ({ silent = false } = {}) => {
    const requestId = loadSeqRef.current + 1
    loadSeqRef.current = requestId

    if (!silent && mountedRef.current) {
      setLoadingDeals(true)
    }

    let lastError = null

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const board = await dealsAPI.getBoard()
        if (!mountedRef.current || loadSeqRef.current !== requestId) return
        const next = { ...EMPTY_STAGE_MAP }
        for (const stage of STAGES) {
          const rows = Array.isArray(board?.[stage.key]) ? board[stage.key] : []
          next[stage.key] = rows.map(mapDealFromApi)
        }
        setDeals(next)
        setLastRefreshedAt(new Date().toISOString())
        return
      } catch (err) {
        lastError = err
        if (err?.code !== 'ECONNABORTED' || attempt === 2) break
        await wait(600)
      }
    }

    if (mountedRef.current && !silent) {
      const message = lastError?.code === 'ECONNABORTED'
        ? 'Pipeline load timed out. Backend may be slow right now, please retry.'
        : (lastError?.message || 'Failed to load pipeline')
      toast.error(message)
    }
  }, [])

  useEffect(() => {
    const closeOnOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilters(false)
      }
      if (!e.target.closest('[data-deal-menu]')) {
        setOpenDealMenuId(null)
      }
    }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadBoard().finally(() => {
      if (mountedRef.current) setLoadingDeals(false)
    })

    const intervalId = window.setInterval(() => {
      loadBoard({ silent: true })
    }, 60 * 1000)

    return () => {
      mountedRef.current = false
      window.clearInterval(intervalId)
    }
  }, [loadBoard])

  useEffect(() => {
    const latest = notifications?.[0]
    if (!latest?.id || latest.id === lastNotificationIdRef.current) return
    lastNotificationIdRef.current = latest.id

    const type = String(latest.type || '').toLowerCase()
    if (type === 'deal' || type === 'lead') {
      loadBoard({ silent: true })
    }
  }, [notifications, loadBoard])

  const findDealAndStage = useCallback((id) => {
    for (const stage of Object.keys(deals)) {
      const deal = deals[stage].find((d) => d.id === id)
      if (deal) return { deal, stage }
    }
    return null
  }, [deals])

  const handleDragStart = ({ active }) => setActiveId(active.id)

  const handleDragEnd = async ({ active, over }) => {
    if (!canMoveDeal) return
    setActiveId(null)
    if (!over || active.id === over.id) return

    const source = findDealAndStage(active.id)
    if (!source) return

    // Resolve target stage from column drop zone id, then sortable metadata, then hovered deal id.
    const overId = over?.id
    const stageFromDropId =
      typeof overId === 'string' && overId.startsWith(STAGE_DROP_PREFIX)
        ? overId.slice(STAGE_DROP_PREFIX.length)
        : null
    const stageFromItem = over?.data?.current?.stage
    const stageFromSortable = over?.data?.current?.sortable?.containerId
    const targetStage = (
      stageFromDropId ||
      stageFromItem ||
      (typeof stageFromSortable === 'string' && deals[stageFromSortable] ? stageFromSortable : null) ||
      Object.keys(deals).find((s) => deals[s].some((d) => d.id === overId))
    )
    if (!targetStage || targetStage === source.stage) return

    try {
      await dealsAPI.moveStage(active.id, targetStage.toUpperCase())
      setDeals((prev) => {
        const sourceDeals = prev[source.stage].filter((d) => d.id !== active.id)
        const moved = { ...source.deal, stage: targetStage }
        const targetDeals = [...prev[targetStage], moved]
        return { ...prev, [source.stage]: sourceDeals, [targetStage]: targetDeals }
      })
    } catch (err) {
      toast.error(err?.message || 'Failed to move deal')
    }
  }

  const activeDeal = activeId ? findDealAndStage(activeId)?.deal : null

  const toggleDealMenu = (dealId) => {
    setOpenDealMenuId((prev) => (prev === dealId ? null : dealId))
  }

  const moveDeal = async (dealId, targetStage) => {
    if (!canMoveDeal) {
      toast.error('You do not have permission to move deals.')
      return
    }
    try {
      await dealsAPI.moveStage(dealId, targetStage.toUpperCase())
      setDeals((prev) => {
        let sourceStage = null
        let dealToMove = null

        for (const stage of Object.keys(prev)) {
          const found = prev[stage].find((d) => d.id === dealId)
          if (found) {
            sourceStage = stage
            dealToMove = found
            break
          }
        }
        if (!sourceStage || !dealToMove || sourceStage === targetStage) return prev

        return {
          ...prev,
          [sourceStage]: prev[sourceStage].filter((d) => d.id !== dealId),
          [targetStage]: [...prev[targetStage], { ...dealToMove, stage: targetStage }],
        }
      })
      setOpenDealMenuId(null)
    } catch (err) {
      toast.error(err?.message || 'Failed to move deal')
    }
  }

  const deleteDeal = async (dealId) => {
    if (!canDeleteDeal) {
      toast.error('You do not have permission to delete deals.')
      return
    }
    try {
      await dealsAPI.delete(dealId)
      setDeals((prev) => {
        const next = { ...prev }
        for (const stage of Object.keys(next)) {
          next[stage] = next[stage].filter((d) => d.id !== dealId)
        }
        return next
      })
      setOpenDealMenuId(null)
      toast.success('Deal deleted')
    } catch (err) {
      toast.error(err?.message || 'Failed to delete deal')
    }
  }

  const openAddDealModal = (stage = 'new') => {
    if (!canCreateDeal) {
      toast.error('You do not have permission to create deals.')
      return
    }
    setNewDeal({
      title: '',
      company: '',
      value: '',
      owner: '',
      dueDate: new Date().toISOString().slice(0, 10),
      priority: 'medium',
      score: 'warm',
      stage,
    })
    setShowAddModal(true)
  }

  const createDeal = async (e) => {
    e.preventDefault()
    if (!canCreateDeal) {
      toast.error('You do not have permission to create deals.')
      return
    }
    const value = Number(newDeal.value)
    if (!newDeal.title.trim() || !newDeal.company.trim() || !value) return

    const matchedLead = (leads || []).find(
      (lead) => String(lead.company || '').trim().toLowerCase() === newDeal.company.trim().toLowerCase()
    )

    const payload = {
      title: newDeal.title.trim(),
      description: `Company: ${newDeal.company.trim()}`,
      stage: newDeal.stage.toUpperCase(),
      priority: newDeal.priority.toUpperCase(),
      dealValue: value,
      expectedCloseDate: newDeal.dueDate,
      aiScore: newDeal.score.toUpperCase(),
      leadId: matchedLead?.id || null,
      notes: newDeal.owner.trim() ? `Owner: ${newDeal.owner.trim()}` : null,
    }

    try {
      const created = await dealsAPI.create(payload)
      const mapped = mapDealFromApi(created)
      setDeals((prev) => ({
        ...prev,
        [newDeal.stage]: [...(prev[newDeal.stage] ?? []), { ...mapped, stage: newDeal.stage }],
      }))
      setShowAddModal(false)
      toast.success('Deal created')
    } catch (err) {
      toast.error(err?.message || 'Failed to create deal')
    }
  }

  const filteredDeals = (stage) => {
    if (filterStage !== 'all' && stage !== filterStage) return []

    const q = search.toLowerCase()
    return (deals[stage] ?? []).filter((d) => {
      const matchesSearch = !search || d.title.toLowerCase().includes(q) || d.company.toLowerCase().includes(q)
      const matchesPriority = filterPriority === 'all' || d.priority === filterPriority
      const matchesScore = filterScore === 'all' || d.score === filterScore
      const matchesOwner = filterOwner === 'all' || d.owner === filterOwner
      return matchesSearch && matchesPriority && matchesScore && matchesOwner
    })
  }

  const totalPipelineValue = Object.values(deals).flat().reduce((s, d) => s + d.value, 0)

  const scrollBoard = (direction) => {
    const node = boardScrollRef.current
    if (!node) return
    const delta = direction === 'left' ? -420 : 420
    node.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="space-y-4" onClick={() => setOpenDealMenuId(null)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading
          title="Sales Pipeline"
          subtitle={loadingDeals
            ? 'Loading deals...'
            : `${Object.values(deals).flat().length} deals · ₹${(totalPipelineValue / 100000).toFixed(1)}L pipeline`}
        />
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
          {lastRefreshedAt && (
            <span className="hidden sm:inline-flex text-[11px] text-slate-500 dark:text-slate-400">
              Updated {new Date(lastRefreshedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadBoard()}
            disabled={loadingDeals}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
            title="Refresh pipeline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDeals ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 w-full sm:w-auto">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none w-full sm:w-40"
            />
          </div>

          <div className="relative" ref={filterRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowFilters((prev) => !prev)
              }}
              className="btn-secondary gap-1.5 text-xs"
            >
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -6 }}
                  transition={{ duration: 0.12 }}
                  onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-10 z-30 w-56 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-2"
                >
                  <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="input text-xs py-2">
                    <option value="all">All stages</option>
                    {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="input text-xs py-2">
                    <option value="all">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select value={filterScore} onChange={(e) => setFilterScore(e.target.value)} className="input text-xs py-2">
                    <option value="all">All scores</option>
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                  </select>
                  <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="input text-xs py-2">
                    <option value="all">All owners</option>
                    {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      setFilterStage('all')
                      setFilterPriority('all')
                      setFilterScore('all')
                      setFilterOwner('all')
                    }}
                    className="w-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 py-1"
                  >
                    Clear Filters
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {canCreateDeal && (
            <button onClick={() => openAddDealModal('new')} className="btn-primary gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Deal
            </button>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="mb-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => scrollBoard('left')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label="Scroll board left"
            title="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
            Left
          </button>
          <button
            type="button"
            onClick={() => scrollBoard('right')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label="Scroll board right"
            title="Scroll right"
          >
            Right
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={boardScrollRef}
          className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar scroll-smooth"
        >
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              deals={filteredDeals(stage.key)}
              onAddDeal={openAddDealModal}
              openDealMenuId={openDealMenuId}
              onToggleDealMenu={toggleDealMenu}
              onMoveDeal={canMoveDeal ? moveDeal : () => {}}
              onDeleteDeal={canDeleteDeal ? deleteDeal : () => {}}
              getAgingMetaForDeal={getAgingMetaForDeal}
              canCreateDeal={canCreateDeal}
              canMoveDeal={canMoveDeal}
              canDeleteDeal={canDeleteDeal}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealCard
              deal={activeDeal}
              stage={findDealAndStage(activeId)?.stage ?? 'new'}
              isDragging={false}
              isMenuOpen={false}
              onToggleMenu={() => {}}
              onMoveDeal={() => {}}
              onDeleteDeal={() => {}}
              agingMeta={getAgingMetaForDeal(activeDeal)}
              canMoveDeal={false}
              canDeleteDeal={false}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Add deal"
            onClick={() => setShowAddModal(false)}
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              onSubmit={createDeal}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Deal</h2>
                <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                required
                value={newDeal.title}
                onChange={(e) => setNewDeal((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Deal title"
                className="input"
              />
              <input
                required
                value={newDeal.company}
                onChange={(e) => setNewDeal((prev) => ({ ...prev, company: e.target.value }))}
                placeholder="Company"
                className="input"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  required
                  type="number"
                  min="1"
                  value={newDeal.value}
                  onChange={(e) => setNewDeal((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder="Value (₹)"
                  className="input"
                />
                <input
                  value={newDeal.owner}
                  onChange={(e) => setNewDeal((prev) => ({ ...prev, owner: e.target.value }))}
                  placeholder="Owner"
                  className="input"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={newDeal.stage} onChange={(e) => setNewDeal((prev) => ({ ...prev, stage: e.target.value }))} className="input">
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <input type="date" value={newDeal.dueDate} onChange={(e) => setNewDeal((prev) => ({ ...prev, dueDate: e.target.value }))} className="input" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={newDeal.priority} onChange={(e) => setNewDeal((prev) => ({ ...prev, priority: e.target.value }))} className="input">
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
                <select value={newDeal.score} onChange={(e) => setNewDeal((prev) => ({ ...prev, score: e.target.value }))} className="input">
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Create Deal</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { Fragment, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, Bot, User, Flame, Thermometer, Snowflake,
  TrendingUp, Brain, MessageSquare, Wand2, RefreshCw, Copy,
  Target, Mail, BarChart3, CheckCircle2, AlertCircle, Check, ChevronDown
} from 'lucide-react'
import { aiAPI, customersAPI, leadsAPI, dealsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { Listbox, Transition } from '@headlessui/react'

const SCORE_STYLE = {
  hot: { icon: Flame, cls: 'text-red-600 bg-red-50 dark:bg-red-900/20', bar: 'bg-red-500' },
  warm: { icon: Thermometer, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', bar: 'bg-amber-500' },
  cold: { icon: Snowflake, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', bar: 'bg-blue-500' },
}

const TABS = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'score', label: 'Lead Scoring', icon: Target },
  { id: 'email', label: 'Email Writer', icon: Mail },
  { id: 'predict', label: 'Deal Predictor', icon: TrendingUp },
  { id: 'insights', label: 'AI Insights', icon: BarChart3 },
]

function ChatBubble({ message }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-brand-600' : 'bg-gradient-to-br from-brand-500 to-accent-500'}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`group relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm rounded-tl-sm border border-slate-100 dark:border-slate-700'}`}>
        {message.loading
          ? <div className="flex gap-1.5 items-center py-1">{[0, 150, 300].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
          : <>
              <div className="whitespace-pre-wrap">{message.content}</div>
              {!isUser && (
                <button onClick={copy} className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg bg-slate-100 dark:bg-slate-700 transition-opacity">
                  {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
              )}
            </>}
      </div>
    </motion.div>
  )
}

function AIChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi, I'm NexaAI. Ask me anything about your CRM and pipeline." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const QUICK = [
    'Which leads should I prioritize today?',
    'Write a follow-up email for my hottest lead',
    "What's blocking my pipeline?",
    'Give me 3 tips to close more deals this week',
  ]

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages((p) => [...p, { role: 'user', content: msg }, { role: 'assistant', loading: true, content: '' }])
    setLoading(true)
    try {
      const history = messages.filter((m) => !m.loading).map((m) => ({ role: m.role, content: m.content }))
      const res = await aiAPI.chat([...history, { role: 'user', content: msg }])
      const reply = res?.response || 'No response.'
      setMessages((p) => [...p.slice(0, -1), { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages((p) => [...p.slice(0, -1), { role: 'assistant', content: `Error: ${e.message}` }])
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[min(600px,calc(100vh-240px))] min-h-[360px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((m, i) => <ChatBubble key={i} message={m} />)}
        <div ref={bottomRef} />
      </div>
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} className="text-xs px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask NexaAI anything..."
            rows={2}
            className="flex-1 input resize-none text-sm"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} className="btn-primary p-3 rounded-xl disabled:opacity-50 flex-shrink-0"><Send className="w-4 h-4" /></button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">Powered by backend AI service</p>
      </div>
    </div>
  )
}

function LeadScoring() {
  const [scores, setScores] = useState([])
  const [allLeads, setAllLeads] = useState([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [loading, setLoading] = useState(false)
  const [scorePage, setScorePage] = useState(0)
  const pageSize = 4
  const totalPages = Math.ceil(scores.length / pageSize)
  const visibleScores = scores.slice(scorePage * pageSize, (scorePage + 1) * pageSize)

  useEffect(() => {
    let cancelled = false
    const loadLeads = async () => {
      setLoadingLeads(true)
      try {
        const all = []
        let page = 0
        let total = 1
        while (page < total) {
          const response = await leadsAPI.getAll({ page, size: 50 })
          const rows = Array.isArray(response?.content) ? response.content : []
          all.push(...rows)
          total = Number(response?.totalPages || 1)
          page += 1
        }
        if (!cancelled) setAllLeads(all)
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Failed to load leads')
      } finally {
        if (!cancelled) setLoadingLeads(false)
      }
    }
    loadLeads()
    return () => { cancelled = true }
  }, [])

  const run = async () => {
    if (!allLeads.length) {
      toast.error('No leads found to score')
      return
    }
    setLoading(true)
    setScores([])
    setScorePage(0)
    try {
      const next = await Promise.all(allLeads.map(async (lead) => {
        const response = await aiAPI.scoreLead(String(lead.id))
        const scoreLabel = String(response?.score || 'WARM').toLowerCase()
        return {
          id: lead.id,
          name: lead.name || lead.company || 'Lead',
          aiScore: scoreLabel === 'hot' || scoreLabel === 'warm' || scoreLabel === 'cold' ? scoreLabel : 'warm',
          confidence: Number(response?.scoreValue ?? lead.aiScoreValue ?? 50),
          reason: response?.reasoning || 'AI analysis completed.',
          nextAction: response?.nextAction || 'Follow up with this lead.',
        }
      }))
      setScores(next)
      toast.success('AI scoring complete.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200">AI Lead Scoring</h3>
          <p className="text-xs text-slate-500 mt-0.5">Live AI scoring with confidence and next action</p>
        </div>
        <button onClick={run} disabled={loading || loadingLeads || !allLeads.length} className="btn-primary text-xs gap-2 disabled:opacity-60">
          <Brain className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? 'Scoring...' : scores.length ? 'Re-score' : 'Score All Leads'}
        </button>
      </div>
      {!scores.length && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4"><Target className="w-8 h-8 text-brand-500" /></div><p className="text-slate-500 text-sm">{loadingLeads ? 'Loading leads...' : allLeads.length ? 'Click "Score All Leads" to evaluate leads' : 'No leads available to score'}</p></div>}
      {loading && <div className="flex flex-col items-center justify-center py-16"><RefreshCw className="w-8 h-8 text-brand-500 animate-spin mb-3" /><p className="text-sm text-slate-500">Analyzing your leads...</p></div>}
      {scores.length > 0 && (
        <div className="space-y-3">
          {visibleScores.map((s, i) => {
            const st = SCORE_STYLE[s.aiScore] || SCORE_STYLE.warm
            const Icon = st.icon
            return (
              <motion.div key={s.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass-card p-4 flex items-start gap-4">
                <div className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold flex-shrink-0 ${st.cls}`}>
                  <Icon className="w-3.5 h-3.5" /> {(s.aiScore || '').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name}</p>
                    <span className="text-xs font-bold text-slate-500">{s.confidence}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-1.5 mb-2">
                    <div className={`h-1.5 rounded-full ${st.bar}`} style={{ width: `${s.confidence}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">{s.reason}</p>
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-1">Next: {s.nextAction}</p>
                </div>
              </motion.div>
            )
          })}
          {totalPages > 1 && (
            <div className="glass-card p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setScorePage((prev) => Math.max(prev - 1, 0))}
                  disabled={loading || scorePage === 0}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <p className="text-xs text-slate-500">
                  Page {scorePage + 1} of {totalPages}
                </p>
                <button
                  type="button"
                  onClick={() => setScorePage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={loading || scorePage >= totalPages - 1}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LeadSelect({ value, onChange, options, loading }) {
  const selected = options.find((o) => String(o.id) === String(value))
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Lead</label>
      <Listbox value={value} onChange={onChange} disabled={loading || options.length === 0}>
        <div className="relative">
          <Listbox.Button className="input text-sm w-full flex items-center justify-between disabled:opacity-60">
            <span className="truncate">
              {loading ? 'Loading customers...' : selected ? `${selected.name} - ${selected.company}` : 'No customers found'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg custom-scrollbar">
              {options.map((option) => (
                <Listbox.Option
                  key={option.id}
                  value={String(option.id)}
                  className={({ active }) => `cursor-pointer select-none px-3 py-2 text-sm ${active ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}
                >
                  {({ selected: isSelected }) => (
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{option.name} - {option.company}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />}
                    </div>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}

function EmailWriter() {
  const [lead, setLead] = useState('')
  const [type, setType] = useState('follow-up')
  const [tone, setTone] = useState('professional')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [customerLeads, setCustomerLeads] = useState([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const leadOptions = customerLeads
  const selectedLead = leadOptions.find((l) => String(l.id) === String(lead)) || null

  useEffect(() => {
    let cancelled = false
    const loadCustomers = async () => {
      setLoadingLeads(true)
      try {
        const all = []
        let page = 0
        let totalPages = 1
        while (page < totalPages) {
          const response = await customersAPI.getAll({ page, size: 100 })
          const rows = Array.isArray(response?.content) ? response.content : []
          all.push(...rows.map((c) => ({
            id: c.id,
            name: c.primaryContact || c.name || c.company || 'Customer',
            company: c.company || c.name || 'Company',
            status: String(c.status || 'ACTIVE').toLowerCase(),
            source: 'CRM',
            value: Number(c.revenue || 0),
          })))
          totalPages = Number(response?.totalPages || 1)
          page += 1
        }
        if (cancelled) return
        setCustomerLeads(all)
        setLead(all.length > 0 ? String(all[0].id) : '')
      } catch {
        if (!cancelled) {
          setCustomerLeads([])
          setLead('')
          toast.error('Failed to load customers for AI Email Writer')
        }
      } finally {
        if (!cancelled) setLoadingLeads(false)
      }
    }
    loadCustomers()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!lead && leadOptions.length > 0) {
      setLead(String(leadOptions[0].id))
    }
  }, [lead, leadOptions])

  const generate = async () => {
    if (!selectedLead) {
      toast.error('Select a customer first')
      return
    }
    setLoading(true)
    setResult('')
    try {
      const response = await aiAPI.generateEmail({
        leadName: selectedLead?.name,
        company: selectedLead?.company,
        emailType: type,
        tone,
        keyPoints: `Customer status: ${selectedLead?.status}; Source: ${selectedLead?.source}; Estimated value: ₹${selectedLead?.value?.toLocaleString()}`
      })
      setResult(response?.email || '')
      toast.success('Email generated.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    navigator.clipboard?.writeText(result)
    toast.success('Copied.')
  }

  return (
    <div className="p-6 space-y-5">
      <div><h3 className="font-bold text-slate-800 dark:text-slate-200">AI Email Writer</h3><p className="text-xs text-slate-500 mt-0.5">Generates personalized emails for any lead</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LeadSelect value={lead} onChange={setLead} options={leadOptions} loading={loadingLeads} />
        <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Type</label><select value={type} onChange={(e) => setType(e.target.value)} className="input text-sm w-full">{['follow-up', 'introduction', 'proposal', 're-engagement', 'meeting request', 'thank you', 'closing'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
        <div><label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Tone</label><select value={tone} onChange={(e) => setTone(e.target.value)} className="input text-sm w-full">{['professional', 'friendly', 'urgent', 'formal', 'casual'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
      </div>
      <button onClick={generate} disabled={loading} className="btn-primary text-xs gap-2 disabled:opacity-60"><Wand2 className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />{loading ? 'Writing...' : 'Generate Email'}</button>
      {result && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative"><pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 font-sans leading-relaxed max-h-72 overflow-y-auto custom-scrollbar">{result}</pre><button onClick={copy} className="absolute top-3 right-3 btn-secondary text-xs gap-1.5 py-1"><Copy className="w-3 h-3" /> Copy</button></motion.div>}
    </div>
  )
}

function DealPredictor() {
  const [deal, setDeal] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deals, setDeals] = useState([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const dealOptions = deals
  const selectedDeal = dealOptions.find((d) => String(d.id) === String(deal)) || null

  useEffect(() => {
    let cancelled = false
    const loadDeals = async () => {
      setLoadingLeads(true)
      try {
        const all = []
        let page = 0
        let totalPages = 1
        while (page < totalPages) {
          const response = await dealsAPI.getAll({ page, size: 100 })
          const rows = Array.isArray(response?.content) ? response.content : []
          all.push(...rows.map((d) => ({
            id: d.id,
            title: d.title || d.leadName || 'Deal',
            company: d.company || d.leadName || 'Company',
            value: Number(d.dealValue || 0),
          })))
          totalPages = Number(response?.totalPages || 1)
          page += 1
        }
        if (cancelled) return
        setDeals(all)
        setDeal(all.length > 0 ? String(all[0].id) : '')
      } catch {
        if (!cancelled) {
          setDeals([])
          setDeal('')
          toast.error('Failed to load deals for Deal Predictor')
        }
      } finally {
        if (!cancelled) setLoadingLeads(false)
      }
    }
    loadDeals()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!deal && dealOptions.length > 0) {
      setDeal(String(dealOptions[0].id))
    }
  }, [deal, dealOptions])

  const predict = async () => {
    if (!selectedDeal) {
      toast.error('Select a deal first')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const response = await aiAPI.predictDeal(String(selectedDeal?.id || '0'))
      setResult(response)
      toast.success('Prediction ready.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div><h3 className="font-bold text-slate-800 dark:text-slate-200">Deal Success Predictor</h3><p className="text-xs text-slate-500 mt-0.5">Predicts win probability and risk factors</p></div>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Select Deal</label>
          <Listbox value={deal} onChange={setDeal} disabled={loadingLeads || dealOptions.length === 0}>
            <div className="relative">
              <Listbox.Button className="input text-sm w-full flex items-center justify-between disabled:opacity-60">
                <span className="truncate">
                  {loadingLeads
                    ? 'Loading deals...'
                    : selectedDeal
                    ? `${selectedDeal.title} - ${selectedDeal.company} (₹${selectedDeal.value?.toLocaleString()})`
                    : 'No deals found'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg custom-scrollbar">
                  {dealOptions.map((option) => (
                    <Listbox.Option
                      key={option.id}
                      value={String(option.id)}
                      className={({ active }) => `cursor-pointer select-none px-3 py-2 text-sm ${active ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}
                    >
                      {({ selected: isSelected }) => (
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{option.title} - {option.company} (₹{option.value?.toLocaleString()})</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />}
                        </div>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>
        <button onClick={predict} disabled={loading || loadingLeads || !selectedDeal} className="btn-primary text-xs gap-2 disabled:opacity-60 flex-shrink-0"><TrendingUp className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />{loading ? 'Analyzing...' : 'Predict'}</button>
      </div>
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass-card p-5 text-center">
            <p className="text-xs text-slate-500 mb-1">Win Probability</p>
            <div className="text-5xl font-black mb-2" style={{ color: result.winProbability >= 70 ? '#10b981' : result.winProbability >= 40 ? '#f59e0b' : '#ef4444' }}>{result.winProbability}%</div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3">
              <motion.div className="h-3 rounded-full" initial={{ width: 0 }} animate={{ width: `${result.winProbability}%` }} transition={{ duration: 1, ease: 'easeOut' }} style={{ background: result.winProbability >= 70 ? '#10b981' : result.winProbability >= 40 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass-card p-4"><p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Key Factors</p>{result.keyFactors?.map((s, i) => <p key={i} className="text-xs text-slate-600 dark:text-slate-400 mt-1">- {s}</p>)}</div>
            <div className="glass-card p-4"><p className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />Risks</p>{result.riskFactors?.map((r, i) => <p key={i} className="text-xs text-slate-600 dark:text-slate-400 mt-1">- {r}</p>)}</div>
          </div>
          <div className="glass-card p-4"><p className="text-xs font-bold text-brand-600 dark:text-brand-400 mb-1">Recommendation</p><p className="text-sm text-slate-700 dark:text-slate-300">{result.recommendation}</p></div>
        </motion.div>
      )}
    </div>
  )
}

function AIInsights() {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(false)
  const STYLE = {
    opportunity: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    prediction: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    insight: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400',
  }

  const generate = async () => {
    setLoading(true)
    setInsights([])
    try {
      const response = await aiAPI.getInsights()
      setInsights(Array.isArray(response) ? response : [])
      toast.success('Insights ready.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h3 className="font-bold text-slate-800 dark:text-slate-200">AI Business Insights</h3><p className="text-xs text-slate-500 mt-0.5">Pattern highlights from CRM data</p></div>
        <button onClick={generate} disabled={loading} className="btn-primary text-xs gap-2 disabled:opacity-60"><Sparkles className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />{loading ? 'Analyzing...' : insights.length ? 'Refresh' : 'Generate Insights'}</button>
      </div>
      {!insights.length && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4"><BarChart3 className="w-8 h-8 text-brand-500" /></div><p className="text-slate-500 text-sm">Click "Generate Insights" to analyze your CRM</p></div>}
      {loading && <div className="flex flex-col items-center justify-center py-16"><Brain className="w-8 h-8 text-brand-500 animate-pulse mb-3" /><p className="text-sm text-slate-500">Analyzing...</p></div>}
      {insights.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {insights.map((a) => (
            <div key={a.id} className={`p-4 rounded-xl border ${STYLE[a.type] || STYLE.insight}`}>
              <p className="text-sm font-bold">{a.title}</p>
              <p className="text-xs mt-0.5 opacity-80">{a.body}</p>
              <p className="text-xs font-semibold mt-2">Action: {a.action}</p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

export default function AIEnginePage() {
  const [activeTab, setActiveTab] = useState('chat')
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Sparkles className="w-6 h-6 text-brand-500" /> AI Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">Backend AI features for CRM intelligence</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          AI Service Connected
        </div>
      </div>
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="inline-flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl min-w-full sm:min-w-0">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          )
        })}
        </div>
      </div>
      <div className="glass-card overflow-visible">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
            {activeTab === 'chat' && <AIChat />}
            {activeTab === 'score' && <LeadScoring />}
            {activeTab === 'email' && <EmailWriter />}
            {activeTab === 'predict' && <DealPredictor />}
            {activeTab === 'insights' && <AIInsights />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

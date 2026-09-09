import { Outlet } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-slate-900 to-slate-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">NexaCRM</p>
              <p className="text-brand-400 text-xs font-semibold tracking-widest uppercase">AI Platform</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Your AI-Powered<br />
            <span className="text-brand-400">Sales Command Center</span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed">
            Capture leads, close deals, and grow revenue with intelligent automation and real-time insights.
          </p>
          <div className="flex gap-6 pt-4">
            {[
              { value: '10x', label: 'Lead Conversion' },
              { value: '2.5h', label: 'Saved Daily' },
              { value: '98%', label: 'Customer Satisfaction' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-500 text-sm relative">© 2026 NexaCRM AI. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

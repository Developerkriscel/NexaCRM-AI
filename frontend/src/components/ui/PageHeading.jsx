export default function PageHeading({ title, subtitle, icon = null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-sm">
            {icon}
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {title}
          </h1>
          {subtitle ? <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  )
}

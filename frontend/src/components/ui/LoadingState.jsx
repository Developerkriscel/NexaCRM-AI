export default function LoadingState({ text = 'Loading...', card = false, className = '' }) {
  const baseClass = card
    ? 'glass-card p-4 text-sm text-slate-500'
    : 'p-4 text-sm text-slate-500'

  return <div className={`${baseClass} ${className}`.trim()}>{text}</div>
}


import { Bell } from 'lucide-react'

export default function NotificationBell({ unreadCount = 0, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative btn-ghost h-10 w-10 rounded-full p-0 ${active ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-300' : ''}`}
      aria-label="Notifications"
      aria-expanded={active}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

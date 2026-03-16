'use client'

import { useEffect, useState, useRef } from 'react'

interface NotificationEvent {
  type: string
  message: string
  time: string
}

export default function NotificationBell() {
  const [events, setEvents] = useState<NotificationEvent[]>([])
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const check = async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      const newEvents: NotificationEvent[] = data.events || []
      setEvents(newEvents)

      // Browser notifications for new events
      if (newEvents.length > seen && 'Notification' in window && Notification.permission === 'granted') {
        for (let i = seen; i < newEvents.length; i++) {
          new Notification('らくーん🍊', { body: newEvents[i].message, icon: '/favicon.ico' })
        }
      }
    } catch {}
  }

  useEffect(() => {
    // Request permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    check()
    const interval = setInterval(check, 5 * 60 * 1000) // every 5 min
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = Math.max(0, events.length - seen)

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) setSeen(events.length)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white transition-colors hover:bg-white/[0.06]"
        title="通知"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50 shadow-2xl"
          style={{
            background: 'rgba(8,9,18,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-sm font-bold text-white">通知</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {events.length > 0 ? (
              events.map((ev, i) => (
                <div key={i} className="px-4 py-3 hover:bg-white/[0.04] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-sm text-slate-200 leading-snug">{ev.message}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(ev.time).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-slate-500 text-sm">新しい通知はありません</p>
                <p className="text-slate-600 text-xs mt-1">5分ごとに自動チェックします</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

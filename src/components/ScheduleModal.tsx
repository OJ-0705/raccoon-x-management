'use client'

import { useState, useEffect } from 'react'

interface ScheduleModalProps {
  postId: string; postType: string; defaultScheduledAt?: string | null
  onClose: () => void; onScheduled: () => void
  confirmLabel?: string
}

const TIME_SLOTS = [
  { hour: 7,  icon: '🌅', label: '朝 7:00',  desc: '起床後のSNSタイム' },
  { hour: 12, icon: '🌞', label: '昼 12:00', desc: 'ランチ・情報収集' },
  { hour: 21, icon: '🌙', label: '夜 21:00', desc: '就寝前・エンゲージ最大' },
]

const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const DAY_NAMES  = ['月','火','水','木','金','土','日']

function pad(n: number) { return n.toString().padStart(2, '0') }
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function toKey(d: Date, hour: number) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${hour}`
}
/** Convert a Date to the "YYYY-MM-DDTHH:MM" format used by datetime-local inputs */
function toDtLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ScheduleModal({ postId, defaultScheduledAt, onClose, onScheduled, confirmLabel }: ScheduleModalProps) {
  const today = startOfDay(new Date())

  // ── Core state ───────────────────────────────────────────────────────────
  // `customDt` ("YYYY-MM-DDTHH:MM") is the single source of truth.
  // Calendar + slot buttons are shortcuts that write into customDt.
  const [customDt,       setCustomDt]       = useState('')
  const [selectedDate,   setSelectedDate]   = useState<Date | null>(null)
  const [selectedHour,   setSelectedHour]   = useState<number | null>(null)
  const [selectedMinute, setSelectedMinute] = useState(0)
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set())
  const [nextSlot,   setNextSlot]  = useState<{ date: Date; hour: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // ── Apply a Date to ALL state at once ────────────────────────────────────
  const apply = (d: Date) => {
    setSelectedDate(startOfDay(d))
    setSelectedHour(d.getHours())
    setSelectedMinute(d.getMinutes())
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    setCustomDt(toDtLocal(d))
  }

  // ── Bootstrap: fetch booked slots + pre-select ───────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/posts?status=予約済み&limit=200').then(r => r.json()),
      fetch('/api/posts/next-slot').then(r => r.json()),
    ]).then(([postsData, nextSlotData]) => {
      const keys = new Set<string>()
      for (const p of (postsData.posts || [])) {
        if (!p.scheduledAt) continue
        const d = new Date(p.scheduledAt)
        keys.add(toKey(d, d.getHours()))
      }
      setBookedKeys(keys)

      if (nextSlotData.scheduledAt) {
        const d = new Date(nextSlotData.scheduledAt)
        setNextSlot({ date: startOfDay(d), hour: d.getHours() })
      }

      // Pre-select: defaultScheduledAt takes priority over next-slot
      if (defaultScheduledAt) {
        const d = new Date(defaultScheduledAt)
        setSelectedDate(startOfDay(d))
        setSelectedHour(d.getHours())
        setSelectedMinute(d.getMinutes())
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
        setCustomDt(toDtLocal(d))
      } else if (nextSlotData.scheduledAt) {
        const d = new Date(nextSlotData.scheduledAt)
        setSelectedDate(startOfDay(d))
        setSelectedHour(d.getHours())
        setSelectedMinute(d.getMinutes())
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
        setCustomDt(toDtLocal(d))
      }

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [defaultScheduledAt])

  // ── Handlers ─────────────────────────────────────────────────────────────

  /** Typing directly in the datetime-local input — update all state */
  const handleCustomDtChange = (value: string) => {
    setCustomDt(value)
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setSelectedDate(startOfDay(d))
        setSelectedHour(d.getHours())
        setSelectedMinute(d.getMinutes())
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }
    } else {
      setSelectedDate(null)
      setSelectedHour(null)
      setSelectedMinute(0)
    }
  }

  /** Calendar day click — keep current hour:minute, change only date */
  const handleDayClick = (date: Date) => {
    const h = selectedHour ?? 7
    const m = selectedMinute
    const d = new Date(date)
    d.setHours(h, m, 0, 0)
    apply(d)
  }

  /** Quick time slot click — keep current date, set hour (minute → 0) */
  const handleSlotClick = (hour: number) => {
    const base = selectedDate ? new Date(selectedDate) : new Date()
    base.setHours(hour, 0, 0, 0)
    apply(base)
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────
  const isBooked = (date: Date, hour: number) => bookedKeys.has(toKey(date, hour))

  const getDayStatus = (date: Date): 'past' | 'full' | 'partial' | 'available' => {
    if (date < today) return 'past'
    const booked = TIME_SLOTS.filter(s => isBooked(date, s.hour)).length
    if (booked === TIME_SLOTS.length) return 'full'
    if (booked > 0) return 'partial'
    return 'available'
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedDate || selectedHour === null) return
    setSaving(true)
    const dt = new Date(selectedDate)
    dt.setHours(selectedHour, selectedMinute, 0, 0)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '予約済み', scheduledAt: dt.toISOString() }),
      })
      if (res.ok) { onScheduled(); onClose() }
    } finally { setSaving(false) }
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow     = new Date(viewYear, viewMonth, 1).getDay()
  const startOffset  = (firstDow + 6) % 7 // 0=Mon

  const selectedDt = selectedDate && selectedHour !== null
    ? new Date(new Date(selectedDate).setHours(selectedHour, selectedMinute, 0, 0))
    : null

  const isPastDt = selectedDt !== null && selectedDt < new Date()

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'rgba(8,9,18,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">📅 投稿スケジュール設定</h3>
            {nextSlot && !defaultScheduledAt && (
              <p className="text-xs text-green-400 mt-0.5">
                💡 次の空きスロット: {nextSlot.date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })} {nextSlot.hour}:00
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{ background: 'rgba(255,255,255,0.07)' }}>✕</button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-400 text-sm">読み込み中...</div>
        ) : (
          <>
            {/* ── datetime-local: primary input (always synced) ── */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1.5">📅 日付と時間（直接入力・変更可能）</label>
              <input
                type="datetime-local"
                value={customDt}
                onChange={e => handleCustomDtChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: `1px solid ${isPastDt ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.14)'}`,
                }}
              />
              {isPastDt && <p className="text-xs text-red-400 mt-1">⚠️ 過去の日時は選択できません</p>}
            </div>

            {/* ── Quick time slots ── */}
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">⚡ おすすめ時間帯（クリックで時間を自動入力）</p>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map(slot => {
                  const chosen = selectedHour === slot.hour && selectedMinute === 0
                  return (
                    <button
                      key={slot.hour}
                      onClick={() => handleSlotClick(slot.hour)}
                      className="flex flex-col items-center py-2 px-1 rounded-xl text-xs font-medium transition-all"
                      style={
                        chosen
                          ? { background: 'rgba(249,115,22,0.2)', border: '1px solid #f97316', color: '#fb923c' }
                          : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }
                      }
                    >
                      <span className="text-base mb-0.5">{slot.icon}</span>
                      <span className="font-bold">{slot.label}</span>
                      <span className="text-[10px] opacity-70 mt-0.5">{slot.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Calendar ── */}
            <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.08)' }}>‹</button>
                <span className="text-sm font-bold text-white">{viewYear}年 {MONTH_NAMES[viewMonth]}</span>
                <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.08)' }}>›</button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_NAMES.map((d, i) => (
                  <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-slate-500'}`}>{d}</div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day   = i + 1
                  const date  = new Date(viewYear, viewMonth, day)
                  const status    = getDayStatus(date)
                  const isToday   = sameDay(date, today)
                  const isSel     = selectedDate !== null && sameDay(date, selectedDate)
                  const dow       = date.getDay()
                  const isPast    = status === 'past'
                  const isFull    = status === 'full'
                  const clickable = !isPast && !isFull

                  let bg   = 'transparent'
                  let text = isPast ? 'text-slate-700' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-200'
                  if (isSel)       { bg = '#f97316'; text = 'text-white' }
                  else if (isToday) bg = 'rgba(249,115,22,0.22)'

                  const dotColor = isPast || isSel ? '' :
                    status === 'available' ? '#10b981' :
                    status === 'partial'   ? '#fbbf24' : '#4b5563'

                  return (
                    <button
                      key={day}
                      onClick={() => clickable && handleDayClick(date)}
                      disabled={!clickable}
                      className={`relative flex flex-col items-center justify-center h-8 rounded-lg text-xs font-medium transition-all ${text} ${clickable && !isSel ? 'hover:bg-white/10' : ''}`}
                      style={{ background: bg }}
                    >
                      {day}
                      {dotColor && <span className="absolute bottom-0.5 w-1 h-1 rounded-full" style={{ backgroundColor: dotColor }} />}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mt-3 justify-center">
                {[['#10b981', '空きあり'], ['#fbbf24', '一部予約済み'], ['#4b5563', '満杯']].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />{l}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Confirmed datetime display ── */}
            {selectedDt && !isPastDt && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <p className="text-[10px] text-orange-400 font-medium uppercase tracking-wide">予約日時</p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {selectedDt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}{' '}
                  {pad(selectedHour!)}:{pad(selectedMinute)}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-slate-300 transition-all" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !selectedDate || selectedHour === null || isPastDt}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-orange-500/20"
              >
                {saving ? '処理中...' : (confirmLabel || '予約する')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

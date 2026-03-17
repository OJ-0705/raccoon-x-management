'use client'

import { useState, useEffect } from 'react'

interface ScheduleModalProps {
  postId: string; postType: string; defaultScheduledAt?: string | null
  onClose: () => void; onScheduled: () => void
  confirmLabel?: string
}

const TIME_SLOTS = [
  { hour: 7, icon: '🌅', label: '朝 7:00', desc: '起床後のSNSタイム' },
  { hour: 12, icon: '🌞', label: '昼 12:00', desc: 'ランチ・情報収集' },
  { hour: 21, icon: '🌙', label: '夜 21:00', desc: '就寝前・エンゲージ最大' },
]

const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const DAY_NAMES = ['月','火','水','木','金','土','日']

function toKey(d: Date, hour: number) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${hour}`
}
function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function ScheduleModal({ postId, defaultScheduledAt, onClose, onScheduled, confirmLabel }: ScheduleModalProps) {
  const today = startOfDay(new Date())

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set())
  const [nextSlot, setNextSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [customTime, setCustomTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

      // Pre-select: defaultScheduledAt or next slot
      if (defaultScheduledAt) {
        const d = new Date(defaultScheduledAt)
        setSelectedDate(startOfDay(d))
        setSelectedHour(d.getHours())
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      } else if (nextSlotData.scheduledAt) {
        const d = new Date(nextSlotData.scheduledAt)
        setSelectedDate(startOfDay(d))
        setSelectedHour(d.getHours())
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [defaultScheduledAt])

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

  const handleSubmit = async () => {
    if (!selectedDate || selectedHour === null) return
    setSaving(true)
    const dt = new Date(selectedDate)
    dt.setHours(selectedHour, 0, 0, 0)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '予約済み', scheduledAt: dt.toISOString() }),
      })
      if (res.ok) { onScheduled(); onClose() }
    } finally { setSaving(false) }
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = new Date(viewYear, viewMonth, 1).getDay() // 0=Sun
  const startOffset = (firstDow + 6) % 7 // 0=Mon

  const selectedDt = selectedDate && selectedHour !== null
    ? new Date(new Date(selectedDate).setHours(selectedHour, 0, 0, 0))
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
            {/* Calendar */}
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
                  const day = i + 1
                  const date = new Date(viewYear, viewMonth, day)
                  const status = getDayStatus(date)
                  const isToday = sameDay(date, today)
                  const isSel = selectedDate !== null && sameDay(date, selectedDate)
                  const dow = date.getDay()
                  const isPast = status === 'past'
                  const isFull = status === 'full'
                  const clickable = !isPast && !isFull

                  let bg = 'transparent'
                  let text = isPast ? 'text-slate-700' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-200'
                  if (isSel) { bg = '#f97316'; text = 'text-white' }
                  else if (isToday) bg = 'rgba(249,115,22,0.22)'

                  const dotColor = isPast || isSel ? '' :
                    status === 'available' ? '#10b981' :
                    status === 'partial' ? '#fbbf24' : '#4b5563'

                  return (
                    <button
                      key={day}
                      onClick={() => clickable && setSelectedDate(startOfDay(date))}
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

            {/* Time slot buttons */}
            {selectedDate && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">
                  {selectedDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })} の投稿時間
                </p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {TIME_SLOTS.map(slot => {
                    const booked = isBooked(selectedDate, slot.hour)
                    const chosen = selectedHour === slot.hour
                    return (
                      <button
                        key={slot.hour}
                        onClick={() => !booked && setSelectedHour(slot.hour)}
                        disabled={booked}
                        className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-medium transition-all ${!booked && !chosen ? 'hover:border-orange-500/50' : ''}`}
                        style={
                          chosen
                            ? { background: 'rgba(249,115,22,0.2)', border: '1px solid #f97316', color: '#fb923c' }
                            : booked
                              ? { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#4b5563', cursor: 'not-allowed' }
                              : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }
                        }
                      >
                        <span className="text-lg mb-0.5">{slot.icon}</span>
                        <span className="font-bold">{slot.label}</span>
                        <span className="text-[10px] opacity-70 mt-0.5">{booked ? '予約済み' : slot.desc}</span>
                      </button>
                    )
                  })}
                </div>
                {/* Custom time */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">カスタム時間:</span>
                  <input
                    type="time"
                    value={customTime}
                    onChange={e => {
                      setCustomTime(e.target.value)
                      if (e.target.value) {
                        const h = parseInt(e.target.value.split(':')[0], 10)
                        setSelectedHour(h)
                      }
                    }}
                    className="flex-1 px-2 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>
            )}

            {/* Past date error */}
            {isPastDt && (
              <p className="text-xs text-red-400 mb-3">⚠️ 過去の日時は選択できません</p>
            )}

            {/* Selected display */}
            {selectedDt && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <p className="text-[10px] text-orange-400 font-medium uppercase tracking-wide">予約日時</p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {selectedDt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} {selectedHour}:00
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

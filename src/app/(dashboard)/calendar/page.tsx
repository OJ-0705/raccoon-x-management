'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Post {
  id: string; content: string; postType: string; status: string
  scheduledAt?: string | null; postedAt?: string | null; createdAt: string
}

const POST_TYPE_COLORS: Record<string, string> = {
  'コンビニまとめ型': '#10B981', '数値比較型': '#3B82F6', '地雷暴露型': '#EF4444',
  'プロセス共有型': '#8B5CF6', 'あるある共感型': '#F97316', 'チェックリスト保存型': '#06B6D4',
  'Instagram連携型': '#EC4899', 'その他': '#6B7280',
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
}

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/posts?limit=200').then(r => r.json()).then(data => setPosts(data.posts || []))
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const startDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const postsByDate: Record<string, Post[]> = {}
  posts.forEach(p => {
    const ds = p.scheduledAt || p.postedAt
    if (ds) {
      const k = new Date(ds).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
      if (!postsByDate[k]) postsByDate[k] = []
      postsByDate[k].push(p)
    }
  })

  const getDayKey = (d: number) => new Date(year, month, d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const selectedPosts = selectedDate ? (postsByDate[selectedDate] || []) : []

  // Weekly balance
  const now = new Date()
  const ws = new Date(now)
  ws.setDate(now.getDate() - now.getDay())
  ws.setHours(0, 0, 0, 0)
  const we = new Date(ws)
  we.setDate(ws.getDate() + 7)
  const weekPosts = posts.filter(p => {
    const d = p.scheduledAt || p.postedAt
    if (!d) return false
    const dt = new Date(d)
    return dt >= ws && dt < we
  })
  const typeCount: Record<string, number> = {}
  weekPosts.forEach(p => { typeCount[p.postType] = (typeCount[p.postType] || 0) + 1 })
  const totalWeek = weekPosts.length
  const maxTypeCount = Math.max(...Object.values(typeCount), 1)
  const isUnbalanced = totalWeek > 0 && Object.values(typeCount).some(c => c / totalWeek > 0.5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">カレンダー</h1>
          <p className="text-slate-400 text-sm mt-1">投稿スケジュールの管理</p>
        </div>
        <Link href="/posts/new" className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-orange-500/20">
          ✏️ 新規投稿
        </Link>
      </div>

      {/* Weekly Balance */}
      <div className="rounded-2xl p-5" style={glass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">📊 今週の投稿バランス診断</h2>
          <span className="text-sm font-medium" style={{ color: totalWeek === 0 ? '#6b7280' : isUnbalanced ? '#f97316' : '#10b981' }}>
            {totalWeek === 0 ? 'データなし' : isUnbalanced ? '⚠️ 偏りあり' : '✅ バランス良好'}
          </span>
        </div>
        {totalWeek > 0 ? (
          <div className="space-y-2.5">
            {Object.entries(typeCount).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const pct = Math.round((count / totalWeek) * 100)
              const over = pct > 50
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: POST_TYPE_COLORS[type] || '#6b7280' }} />
                      <span className="text-sm text-slate-300">{type}</span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: over ? '#f97316' : '#94a3b8' }}>{count}件 ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxTypeCount) * 100}%`, backgroundColor: over ? '#f97316' : (POST_TYPE_COLORS[type] || '#6b7280') }} />
                  </div>
                </div>
              )
            })}
            {isUnbalanced && (
              <div className="mt-2 rounded-xl p-3" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <p className="text-sm text-orange-300">💡 1タイプが50%超。他のタイプも追加してエンゲージメントを分散させましょう。</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-3">今週の投稿データなし</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={glass}>
          <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-white/[0.08] rounded-xl text-slate-300 transition-all">←</button>
            <h2 className="text-lg font-bold text-white">{year}年{month + 1}月</h2>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-white/[0.08] rounded-xl text-slate-300 transition-all">→</button>
          </div>
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-sm font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: startDow }).map((_, i) => (
              <div key={`e-${i}`} className="min-h-[80px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dk = getDayKey(day)
              const dp = postsByDate[dk] || []
              const isToday = dk === today
              const isSel = dk === selectedDate
              const dow = (startDow + i) % 7
              return (
                <div key={day} onClick={() => setSelectedDate(isSel ? null : dk)}
                  className={`min-h-[80px] p-1.5 cursor-pointer transition-all ${isSel ? 'bg-orange-500/10' : 'hover:bg-white/[0.04]'}`}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className={`text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-500 text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-300'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dp.slice(0, 2).map(p => (
                      <div key={p.id} className="truncate text-xs px-1 py-0.5 rounded text-white" style={{ backgroundColor: POST_TYPE_COLORS[p.postType] || '#6b7280', opacity: 0.8 }}>
                        {p.content.slice(0, 12)}…
                      </div>
                    ))}
                    {dp.length > 2 && <div className="text-xs text-slate-500 px-1">+{dp.length - 2}件</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {selectedDate && (
            <div className="rounded-2xl p-4" style={glass}>
              <h3 className="text-sm font-bold text-white mb-3">{selectedDate.replace(/\//g, '年').replace('/', '月') + '日'}</h3>
              {selectedPosts.length > 0 ? (
                <div className="space-y-3">
                  {selectedPosts.map(p => (
                    <div key={p.id} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: POST_TYPE_COLORS[p.postType] || '#6b7280' }}>{p.postType}</span>
                        <span className="text-xs text-slate-400">{p.status}</span>
                      </div>
                      <p className="text-sm text-slate-300 line-clamp-3">{p.content}</p>
                      <Link href={`/posts/${p.id}/edit`} className="text-sm text-orange-400 hover:text-orange-300 mt-2 inline-block">編集する →</Link>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">この日の投稿はありません</p>}
              <Link href="/posts/new" className="block w-full text-center mt-3 py-2 rounded-xl text-sm transition-all" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#fb923c' }}>
                + この日に投稿を追加
              </Link>
            </div>
          )}
          <div className="rounded-2xl p-4" style={glass}>
            <h3 className="text-sm font-bold text-white mb-3">投稿タイプ</h3>
            <div className="space-y-2">
              {Object.entries(POST_TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm text-slate-300">{type}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4" style={glass}>
            <h3 className="text-sm font-bold text-white mb-3">今月の統計</h3>
            <div className="space-y-2">
              {[
                { l: '予約済み', s: '予約済み', c: '#93c5fd' },
                { l: '投稿済み', s: '投稿済み', c: '#86efac' },
                { l: '下書き', s: '下書き', c: '#94a3b8' },
              ].map(({ l, s, c }) => (
                <div key={s} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: c }}>{l}</span>
                  <span className="text-sm text-slate-400">{posts.filter(p => p.status === s).length}件</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

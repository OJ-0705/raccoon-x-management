'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Post {
  id: string
  content: string
  postType: string
  status: string
  scheduledAt?: string | null
  postedAt?: string | null
  createdAt: string
}

const POST_TYPE_COLORS: Record<string, string> = {
  'コンビニまとめ型': '#10B981',
  '数値比較型': '#3B82F6',
  '地雷暴露型': '#EF4444',
  'プロセス共有型': '#8B5CF6',
  'あるある共感型': '#F97316',
  'チェックリスト保存型': '#06B6D4',
  'Instagram連携型': '#EC4899',
  'その他': '#6B7280',
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/posts?limit=100').then(r => r.json()).then(data => {
      setPosts(data.posts || [])
    })
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  // Group posts by date
  const postsByDate: Record<string, Post[]> = {}
  posts.forEach(post => {
    const dateStr = post.scheduledAt || post.postedAt
    if (dateStr) {
      const d = new Date(dateStr).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
      if (!postsByDate[d]) postsByDate[d] = []
      postsByDate[d].push(post)
    }
  })

  const getDayKey = (day: number) => {
    return new Date(year, month, day).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })

  const selectedPosts = selectedDate ? (postsByDate[selectedDate] || []) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">カレンダー</h1>
          <p className="text-gray-400 text-sm mt-1">投稿スケジュールの管理</p>
        </div>
        <Link
          href="/posts/new"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          ✏️ 新規投稿
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {/* Month Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
            >
              ←
            </button>
            <h2 className="text-lg font-bold text-white">
              {year}年{month + 1}月
            </h2>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
            >
              →
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-gray-700">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={`py-2 text-center text-xs font-medium ${
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: startDow }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-700/50" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayKey = getDayKey(day)
              const dayPosts = postsByDate[dayKey] || []
              const isToday = dayKey === today
              const isSelected = dayKey === selectedDate
              const dow = (startDow + i) % 7

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dayKey)}
                  className={`min-h-[80px] p-1.5 border-b border-r border-gray-700/50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-orange-500/10' : 'hover:bg-gray-700/50'
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-orange-500 text-white'
                      : dow === 0
                      ? 'text-red-400'
                      : dow === 6
                      ? 'text-blue-400'
                      : 'text-gray-300'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 2).map(post => (
                      <div
                        key={post.id}
                        className="truncate text-xs px-1 py-0.5 rounded text-white"
                        style={{ backgroundColor: POST_TYPE_COLORS[post.postType] || '#6B7280', opacity: 0.85 }}
                        title={post.content.slice(0, 50)}
                      >
                        {post.content.slice(0, 12)}...
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <div className="text-xs text-gray-500 px-1">+{dayPosts.length - 2}件</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Selected Date Posts */}
          {selectedDate && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-sm font-bold text-white mb-3">
                {selectedDate.replace(/\//g, '年').replace('/', '月') + '日'}
              </h3>
              {selectedPosts.length > 0 ? (
                <div className="space-y-3">
                  {selectedPosts.map(post => (
                    <div key={post.id} className="bg-gray-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: POST_TYPE_COLORS[post.postType] || '#6B7280' }}
                        >
                          {post.postType}
                        </span>
                        <span className="text-xs text-gray-400">{post.status}</span>
                      </div>
                      <p className="text-xs text-gray-300 line-clamp-3">{post.content}</p>
                      <Link
                        href={`/posts/${post.id}/edit`}
                        className="text-xs text-orange-400 hover:text-orange-300 mt-2 inline-block"
                      >
                        編集する →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">この日の投稿はありません</p>
              )}
              <Link
                href="/posts/new"
                className="block w-full text-center mt-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-xs transition-colors"
              >
                + この日に投稿を追加
              </Link>
            </div>
          )}

          {/* Legend */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-sm font-bold text-white mb-3">投稿タイプ</h3>
            <div className="space-y-2">
              {Object.entries(POST_TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-300">{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-sm font-bold text-white mb-3">今月の統計</h3>
            <div className="space-y-2">
              {[
                { label: '予約済み', status: '予約済み', color: 'text-blue-400' },
                { label: '投稿済み', status: '投稿済み', color: 'text-green-400' },
                { label: '下書き', status: '下書き', color: 'text-gray-400' },
              ].map(({ label, status, color }) => {
                const count = posts.filter(p => p.status === status).length
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className={`text-xs ${color}`}>{label}</span>
                    <span className="text-xs text-gray-400">{count}件</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

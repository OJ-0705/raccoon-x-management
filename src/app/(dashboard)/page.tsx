'use client'

import { useEffect, useState, useCallback } from 'react'
import PostCard from '@/components/PostCard'
import Link from 'next/link'

interface AnalyticsData {
  analytics: { date: string; followers?: number; totalImpressions?: number; totalEngagements?: number }[]
  postStats: { impressions?: number; likes?: number; retweets?: number; replies?: number; bookmarks?: number }
  postCount: number
  postsByType: {
    postType: string
    _count: { id: number }
    _sum: { impressions: number | null; likes: number | null; retweets: number | null; replies: number | null; bookmarks: number | null }
  }[]
}

interface Post {
  id: string; content: string; postType: string; formatType: string; status: string
  scheduledAt?: string | null; impressions: number; likes: number; retweets: number
  replies: number; bookmarks: number; platform?: string; createdAt: string
}

const POST_TYPE_COLORS: Record<string, string> = {
  'コンビニまとめ型': '#10B981', '数値比較型': '#3B82F6', '地雷暴露型': '#EF4444',
  'プロセス共有型': '#8B5CF6', 'あるある共感型': '#F97316', 'チェックリスト保存型': '#06B6D4',
  'Instagram連携型': '#EC4899', 'その他': '#6B7280',
}

function StatBig({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    orange: 'text-orange-400 bg-orange-500/10', blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10', green: 'text-green-400 bg-green-500/10',
  }
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">{title}</p>
        <span className={`text-lg p-1.5 rounded-lg ${colors[color]}`}>{icon}</span>
      </div>
      <p className="text-4xl font-bold text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [highEngPosts, setHighEngPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)
  const [optimalHours, setOptimalHours] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    try {
      const [analytics, posts, optimal] = await Promise.all([
        fetch('/api/analytics?days=7').then(r => r.json()),
        fetch('/api/posts?sort=engagement&status=投稿済み&limit=5').then(r => r.json()),
        fetch('/api/analytics/optimal-times').then(r => r.json()),
      ])
      setAnalyticsData(analytics)
      setHighEngPosts(posts.posts || [])
      if (optimal.learned) setOptimalHours(optimal.optimalHours || {})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const generateReport = async () => {
    setReportLoading(true)
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      })
      const data = await res.json()
      setReport(data.report || '')
      setReportGenerated(true)
    } finally {
      setReportLoading(false)
    }
  }

  const latestAnalytics = analyticsData?.analytics?.[analyticsData.analytics.length - 1]

  const engRates = (analyticsData?.postsByType || [])
    .map(t => {
      const imp = t._sum.impressions || 0
      const eng = (t._sum.likes || 0) + (t._sum.retweets || 0) + (t._sum.replies || 0) + (t._sum.bookmarks || 0)
      return { postType: t.postType, count: t._count.id, rate: imp > 0 ? (eng / imp) * 100 : 0 }
    })
    .sort((a, b) => b.rate - a.rate)

  const maxRate = Math.max(...engRates.map(r => r.rate), 0.01)

  // Follower growth chart data
  const followerData = analyticsData?.analytics || []
  const maxFollowers = Math.max(...followerData.map(a => a.followers || 0), 1)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">読み込み中...</div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">ダッシュボード — X</h1>
          {Object.keys(optimalHours).length > 0 && (
            <p className="text-xs text-green-400 mt-0.5">✅ 最適投稿時間を学習済み</p>
          )}
        </div>
        <Link href="/posts/new" className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-medium transition-colors">
          ✏️ 新規投稿
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBig title="フォロワー" value={latestAnalytics?.followers || 0} icon="👥" color="orange" />
        <StatBig title="総インプレッション" value={analyticsData?.postStats?.impressions || 0} icon="👀" color="blue" />
        <StatBig title="総いいね" value={analyticsData?.postStats?.likes || 0} icon="❤️" color="red" />
        <StatBig title="総投稿数" value={analyticsData?.postCount || 0} icon="📝" color="green" />
      </div>

      {/* Main: left 2/3 (analytics) + right 1/3 (high-eng posts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT */}
        <div className="lg:col-span-2 space-y-4">

          {/* Follower growth chart (D) */}
          {followerData.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h2 className="text-sm font-bold text-white mb-4">📈 フォロワー推移</h2>
              <div className="flex items-end gap-1.5 h-20">
                {followerData.map((item, i) => {
                  const height = maxFollowers > 0 ? ((item.followers || 0) / maxFollowers) * 100 : 0
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-xs text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                        {(item.followers || 0).toLocaleString()}人
                      </div>
                      <div
                        className="w-full bg-orange-500 rounded-t transition-all hover:bg-orange-400"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-gray-500 text-[9px] truncate w-full text-center">
                        {new Date(item.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>最小: {Math.min(...followerData.map(a => a.followers || 0)).toLocaleString()}</span>
                <span>最大: {maxFollowers.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Engagement rate by type */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-white mb-4">📊 投稿タイプ別エンゲージメント率</h2>
            {engRates.length > 0 ? (
              <div className="space-y-3">
                {engRates.map(item => (
                  <div key={item.postType}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }} />
                        <span className="text-sm text-gray-200">{item.postType}</span>
                        <span className="text-xs text-gray-500">（{item.count}件）</span>
                        {optimalHours[item.postType] !== undefined && (
                          <span className="text-xs text-green-400">🕐 {optimalHours[item.postType]}時推奨</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white">{item.rate.toFixed(2)}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(item.rate / maxRate) * 100}%`, backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">投稿済みデータなし</p>
            )}
          </div>

          {/* 7-day trend */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-white mb-4">📋 7日間トレンド</h2>
            <div className="space-y-2">
              {analyticsData?.analytics?.map(item => (
                <div key={item.date} className="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0">
                  <span className="text-sm text-gray-300 w-20">
                    {new Date(item.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex gap-5 text-sm">
                    <span className="text-orange-400">👥 {(item.followers || 0).toLocaleString()}</span>
                    <span className="text-blue-400">👀 {(item.totalImpressions || 0).toLocaleString()}</span>
                    <span className="text-green-400">💡 {(item.totalEngagements || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {!analyticsData?.analytics?.length && <p className="text-sm text-gray-500 text-center py-4">データなし</p>}
            </div>
          </div>

          {/* AI Performance Report (A) */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">🤖 AIパフォーマンスレポート</h2>
              <button
                onClick={generateReport}
                disabled={reportLoading}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-xs transition-colors"
              >
                {reportLoading ? '生成中...' : reportGenerated ? '🔄 再生成' : '📋 レポートを生成'}
              </button>
            </div>
            {report ? (
              <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                {report}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">
                ボタンを押すとAIが過去7日間のパフォーマンスを分析してレポートを生成します
              </p>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-white mb-3">⚡ クイックアクション</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/top" className="flex items-center gap-2 px-4 py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm transition-colors">
                🏠 承認待ち投稿を確認
              </Link>
              <Link href="/posts/new" className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">
                ✏️ 新規投稿作成
              </Link>
              <Link href="/dashboard/threads" className="flex items-center gap-2 px-4 py-3 bg-purple-700/30 hover:bg-purple-700/50 text-purple-400 rounded-lg text-sm transition-colors">
                🧵 Threadsダッシュボード
              </Link>
              <Link href="/calendar" className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">
                📅 カレンダーを見る
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT: high engagement posts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">🔥 高エンゲージメント投稿</h2>
            <Link href="/posts?status=投稿済み" className="text-xs text-orange-400 hover:text-orange-300">すべて →</Link>
          </div>
          {highEngPosts.length > 0 ? (
            <div className="space-y-3">
              {highEngPosts.map(post => (
                <PostCard key={post.id} post={post} onRefresh={load} />
              ))}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700">
              <div className="text-3xl mb-2">📝</div>
              <p className="text-gray-400 text-xs">投稿済みの投稿がありません</p>
              <Link href="/posts/new" className="inline-block mt-3 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs transition-colors">
                最初の投稿を作成
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

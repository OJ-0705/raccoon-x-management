'use client'

import { useEffect, useState, useCallback } from 'react'
import PostCard from '@/components/PostCard'
import NotificationBell from '@/components/NotificationBell'
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

const glassCard = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
}

function StatBig({ title, value, icon, accent }: { title: string; value: string | number; icon: string; accent: string }) {
  return (
    <div className="rounded-2xl p-3 md:p-5" style={glassCard}>
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <p className="text-xs md:text-sm text-slate-400">{title}</p>
        <span className="text-lg md:text-xl p-1.5 md:p-2 rounded-xl" style={{ background: accent + '20' }}>{icon}</span>
      </div>
      <p className="text-2xl md:text-4xl font-bold text-white tracking-tight">
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
  const followerData = analyticsData?.analytics || []
  const maxFollowers = Math.max(...followerData.map(a => a.followers || 0), 1)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400">読み込み中...</div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">ダッシュボード — X</h1>
          {Object.keys(optimalHours).length > 0 && (
            <p className="text-xs md:text-sm text-green-400 mt-0.5">✅ 最適投稿時間を学習済み</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Link href="/posts/new" className="hidden md:flex px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-orange-500/20">
            ✏️ 新規投稿
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBig title="フォロワー" value={latestAnalytics?.followers || 0} icon="👥" accent="#F97316" />
        <StatBig title="総インプレッション" value={analyticsData?.postStats?.impressions || 0} icon="👀" accent="#3B82F6" />
        <StatBig title="総いいね" value={analyticsData?.postStats?.likes || 0} icon="❤️" accent="#EF4444" />
        <StatBig title="総投稿数" value={analyticsData?.postCount || 0} icon="📝" accent="#10B981" />
      </div>

      {/* Main */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-5">

          {/* Follower chart */}
          {followerData.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <h2 className="text-base font-bold text-white mb-5">📈 フォロワー推移</h2>
              <div className="flex items-end gap-2 h-24">
                {followerData.map((item, i) => {
                  const height = maxFollowers > 0 ? ((item.followers || 0) / maxFollowers) * 100 : 0
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-xs text-white px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none border border-white/10">
                        {(item.followers || 0).toLocaleString()}人
                      </div>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{ height: `${Math.max(height, 4)}%`, background: 'linear-gradient(to top, #F97316, #fb923c)' }}
                      />
                      <span className="text-slate-600 text-[9px] truncate w-full text-center">
                        {new Date(item.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>最小: {Math.min(...followerData.map(a => a.followers || 0)).toLocaleString()}</span>
                <span>最大: {maxFollowers.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Engagement rate by type */}
          <div className="rounded-2xl p-5" style={glassCard}>
            <h2 className="text-base font-bold text-white mb-5">📊 投稿タイプ別エンゲージメント率</h2>
            {engRates.length > 0 ? (
              <div className="space-y-4">
                {engRates.map(item => (
                  <div key={item.postType}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }} />
                        <span className="text-sm text-slate-200">{item.postType}</span>
                        <span className="text-xs text-slate-500">({item.count}件)</span>
                        {optimalHours[item.postType] !== undefined && (
                          <span className="text-xs text-green-400">🕐 {optimalHours[item.postType]}時推奨</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white">{item.rate.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(item.rate / maxRate) * 100}%`, backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-6">投稿済みデータなし</p>
            )}
          </div>

          {/* 7-day trend */}
          <div className="rounded-2xl p-5" style={glassCard}>
            <h2 className="text-base font-bold text-white mb-4">📋 7日間トレンド</h2>
            <div className="space-y-1">
              {analyticsData?.analytics?.map(item => (
                <div key={item.date} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-sm text-slate-300 w-20">
                    {new Date(item.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex gap-2 md:gap-5 text-xs md:text-sm">
                    <span className="text-orange-400">👥 {(item.followers || 0).toLocaleString()}</span>
                    <span className="text-blue-400">👀 {(item.totalImpressions || 0).toLocaleString()}</span>
                    <span className="text-green-400 hidden sm:inline">💡 {(item.totalEngagements || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {!analyticsData?.analytics?.length && <p className="text-sm text-slate-500 text-center py-4">データなし</p>}
            </div>
          </div>

          {/* AI Performance Report */}
          <div className="rounded-2xl p-5" style={glassCard}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">🤖 AIパフォーマンスレポート</h2>
              <button
                onClick={generateReport}
                disabled={reportLoading}
                className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
              >
                {reportLoading ? '生成中...' : reportGenerated ? '🔄 再生成' : '📋 レポートを生成'}
              </button>
            </div>
            {report ? (
              <div className="rounded-xl p-4 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {report}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                ボタンを押すとAIが過去7日間のパフォーマンスを分析します
              </p>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl p-5" style={glassCard}>
            <h2 className="text-base font-bold text-white mb-3">⚡ クイックアクション</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/top" className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-all" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#fb923c' }}>
                🏠 承認待ち投稿を確認
              </Link>
              <Link href="/posts/new" className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-all text-slate-300 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ✏️ 新規投稿作成
              </Link>
              <Link href="/dashboard/threads" className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-all" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
                🧵 Threadsダッシュボード
              </Link>
              <Link href="/calendar" className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-all text-slate-300 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                📅 カレンダーを見る
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">🔥 高エンゲージメント投稿</h2>
            <Link href="/posts?status=投稿済み" className="text-sm text-orange-400 hover:text-orange-300">すべて →</Link>
          </div>
          {highEngPosts.length > 0 ? (
            <div className="space-y-3">
              {highEngPosts.map(post => (
                <PostCard key={post.id} post={post} onRefresh={load} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl p-6 text-center" style={glassCard}>
              <div className="text-4xl mb-2">📝</div>
              <p className="text-slate-400 text-sm">投稿済みの投稿がありません</p>
              <Link href="/posts/new" className="inline-block mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20">
                最初の投稿を作成
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

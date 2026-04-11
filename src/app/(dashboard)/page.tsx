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

interface SummaryData {
  x: { impressions: number; likes: number; retweets: number; replies: number; postCount: number }
  threads: { impressions: number; likes: number; replies: number; reposts: number; postCount: number }
  topPosts: { id: string; content: string; postType: string; impressions: number; likes: number; retweets: number; replies: number; engagementRate: number }[]
  byType: { postType: string; count: number; impressions: number; engagementRate: number }[]
  apiUsage: { todayCalls: number; todayCost: number; monthlyCost: number; maxCallsPerDay: number; lastFetchAt: string | null; eligibleXPosts: number }
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

const MEDALS = ['🥇', '🥈', '🥉', '4位', '5位']

export default function DashboardPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [highEngPosts, setHighEngPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [optimalHours, setOptimalHours] = useState<Record<string, number>>({})
  const [fetchingMetrics, setFetchingMetrics] = useState(false)
  const [fetchResult, setFetchResult] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [platformTab, setPlatformTab] = useState<'x' | 'threads'>('x')

  const load = useCallback(async () => {
    try {
      const [analytics, posts, optimal, summary] = await Promise.all([
        fetch('/api/analytics?days=7').then(r => r.json()),
        fetch('/api/posts?sort=engagement&status=投稿済み&limit=5').then(r => r.json()),
        fetch('/api/analytics/optimal-times').then(r => r.json()),
        fetch('/api/analytics/summary').then(r => r.json()),
      ])
      setAnalyticsData(analytics)
      setHighEngPosts(posts.posts || [])
      if (optimal.learned) setOptimalHours(optimal.optimalHours || {})
      if (!summary.error) setSummaryData(summary)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const fetchMetrics = async () => {
    setShowConfirmDialog(false)
    setFetchingMetrics(true)
    setFetchResult(null)
    try {
      const res = await fetch('/api/analytics/fetch', { method: 'POST' })
      const data = await res.json()
      if (res.status === 429) {
        setFetchResult(`⚠️ ${data.error}`)
      } else if (res.ok) {
        setFetchResult(`✅ X: ${data.x}件・Threads: ${data.threads}件更新（$${(data.costUsd || 0).toFixed(3)}）`)
        await load()
      } else {
        setFetchResult(`❌ エラー: ${data.error || '取得失敗'}`)
      }
    } catch (err) {
      setFetchResult(`❌ ${String(err)}`)
    } finally {
      setFetchingMetrics(false)
    }
  }

  const latestAnalytics = analyticsData?.analytics?.[analyticsData.analytics.length - 1]

  const engRates = (summaryData?.byType || analyticsData?.postsByType?.map(t => {
    const imp = t._sum.impressions || 0
    const eng = (t._sum.likes || 0) + (t._sum.retweets || 0) + (t._sum.replies || 0)
    return { postType: t.postType, count: t._count.id, impressions: imp, engagementRate: imp > 0 ? (eng / imp) * 100 : 0 }
  }) || []).sort((a, b) => b.engagementRate - a.engagementRate)

  const maxRate = Math.max(...engRates.map(r => r.engagementRate), 0.01)
  const followerData = analyticsData?.analytics || []
  const maxFollowers = Math.max(...followerData.map(a => a.followers || 0), 1)

  const apiUsage = summaryData?.apiUsage
  const topPosts = summaryData?.topPosts || []

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
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={fetchingMetrics || (apiUsage?.todayCalls || 0) >= (apiUsage?.maxCallsPerDay || 3)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}
              title={`本日 ${apiUsage?.todayCalls || 0}/${apiUsage?.maxCallsPerDay || 3} 回使用`}
            >
              {fetchingMetrics ? '取得中...' : '📊 アナリティクスを反映'}
            </button>
            <span className="text-[10px] text-slate-500">
              {apiUsage?.lastFetchAt
                ? `最終更新: ${new Date(apiUsage.lastFetchAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'まだ取得されていません'}
            </span>
          </div>
          <Link href="/posts/new" className="hidden md:flex px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-orange-500/20">
            ✏️ 新規投稿
          </Link>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-80 space-y-4" style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <h3 className="text-base font-bold text-white">📊 アナリティクスを取得</h3>
            <div className="text-sm text-slate-300 space-y-2">
              <p>X APIのクレジットを消費します。</p>
              <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">対象投稿数</span>
                  <span className="text-white font-medium">{apiUsage?.eligibleXPosts ?? '—'} 件</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">推定コスト</span>
                  <span className="text-blue-300 font-bold">${((apiUsage?.eligibleXPosts ?? 0) * 0.005).toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">本日残り取得回数</span>
                  <span className="text-white">{(apiUsage?.maxCallsPerDay || 3) - (apiUsage?.todayCalls || 0)} 回</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
              >
                キャンセル
              </button>
              <button
                onClick={fetchMetrics}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }}
              >
                取得する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fetch result toast */}
      {fetchResult && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {fetchResult}
        </div>
      )}

      {/* Platform tab + Stats */}
      <div className="space-y-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlatformTab('x')}
            className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={platformTab === 'x'
              ? { background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
          >
            𝕏 X
          </button>
          <button
            onClick={() => setPlatformTab('threads')}
            className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={platformTab === 'threads'
              ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
          >
            🧵 Threads
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBig title="フォロワー" value={latestAnalytics?.followers || 0} icon="👥" accent="#F97316" />
          {platformTab === 'x' ? (
            <>
              <StatBig title="総インプレッション" value={summaryData?.x.impressions ?? analyticsData?.postStats?.impressions ?? 0} icon="👀" accent="#3B82F6" />
              <StatBig title="総いいね" value={summaryData?.x.likes ?? analyticsData?.postStats?.likes ?? 0} icon="❤️" accent="#EF4444" />
              <StatBig title="X投稿数" value={summaryData?.x.postCount ?? analyticsData?.postCount ?? 0} icon="📝" accent="#10B981" />
            </>
          ) : (
            <>
              <StatBig title="総ビュー" value={summaryData?.threads.impressions ?? 0} icon="👀" accent="#8B5CF6" />
              <StatBig title="総いいね" value={summaryData?.threads.likes ?? 0} icon="❤️" accent="#EC4899" />
              <StatBig title="Threads投稿数" value={summaryData?.threads.postCount ?? 0} icon="🧵" accent="#10B981" />
            </>
          )}
        </div>
        {platformTab === 'threads' && summaryData && (
          <div className="grid grid-cols-2 gap-4">
            <StatBig title="リポスト" value={summaryData.threads.reposts} icon="🔁" accent="#8B5CF6" />
            <StatBig title="リプライ" value={summaryData.threads.replies} icon="💬" accent="#8B5CF6" />
          </div>
        )}
        {platformTab === 'x' && summaryData && (
          <div className="grid grid-cols-2 gap-4">
            <StatBig title="総リツイート" value={summaryData.x.retweets} icon="🔁" accent="#3B82F6" />
            <StatBig title="総リプライ" value={summaryData.x.replies} icon="💬" accent="#3B82F6" />
          </div>
        )}
      </div>

      {/* Main */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-5">

          {/* API Usage */}
          {apiUsage && (
            <div className="rounded-2xl p-4" style={glassCard}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">📊 X APIクレジット状況</h2>
                <span className="text-xs text-slate-500">
                  最終取得: {apiUsage.lastFetchAt ? new Date(apiUsage.lastFetchAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'なし'}
                </span>
              </div>
              <div className="flex gap-6 mt-3">
                <div>
                  <p className="text-xs text-slate-400">本日の取得回数</p>
                  <p className="text-lg font-bold text-white mt-0.5">{apiUsage.todayCalls} <span className="text-sm font-normal text-slate-400">/ {apiUsage.maxCallsPerDay} 回</span></p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">本日の消費</p>
                  <p className="text-lg font-bold text-white mt-0.5">${apiUsage.todayCost.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">今月の累計</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    <span style={{ color: apiUsage.monthlyCost > 4 ? '#f87171' : '#4ade80' }}>
                      ${apiUsage.monthlyCost.toFixed(2)}
                    </span>
                    <span className="text-sm font-normal text-slate-400"> / $5.00</span>
                  </p>
                </div>
              </div>
              {/* Cost bar */}
              <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((apiUsage.monthlyCost / 5) * 100, 100)}%`,
                    background: apiUsage.monthlyCost > 4 ? '#ef4444' : 'linear-gradient(to right, #3b82f6, #06b6d4)',
                  }}
                />
              </div>
            </div>
          )}

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

          {/* Top Posts Ranking */}
          {topPosts.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <h2 className="text-base font-bold text-white mb-4">🏆 トップ投稿ランキング（エンゲージメント率順）</h2>
              <div className="space-y-3">
                {topPosts.map((post, i) => (
                  <div key={post.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">{MEDALS[i]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 line-clamp-2 leading-relaxed">{post.content}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-400">
                          <span>👀 {post.impressions.toLocaleString()}</span>
                          <span>❤️ {post.likes.toLocaleString()}</span>
                          <span>🔁 {post.retweets.toLocaleString()}</span>
                          <span>💬 {post.replies.toLocaleString()}</span>
                          <span className="font-bold" style={{ color: post.engagementRate > 2 ? '#4ade80' : '#94a3b8' }}>
                            ENG {post.engagementRate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* X vs Threads comparison */}
          {summaryData && (summaryData.x.impressions > 0 || summaryData.threads.impressions > 0) && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <h2 className="text-base font-bold text-white mb-4">📊 X vs Threads パフォーマンス比較</h2>
              <div className="space-y-3">
                {[
                  { label: 'インプレ / ビュー', x: summaryData.x.impressions, threads: summaryData.threads.impressions, icon: '👀' },
                  { label: 'いいね', x: summaryData.x.likes, threads: summaryData.threads.likes, icon: '❤️' },
                  { label: 'リポスト / RT', x: summaryData.x.retweets, threads: summaryData.threads.reposts, icon: '🔁' },
                  { label: 'リプライ', x: summaryData.x.replies, threads: summaryData.threads.replies, icon: '💬' },
                ].map(row => {
                  const total = row.x + row.threads
                  const xPct = total > 0 ? (row.x / total) * 100 : 50
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="text-slate-400">{row.icon} {row.label}</span>
                        <div className="flex gap-4">
                          <span className="text-blue-300">𝕏 {row.x.toLocaleString()}</span>
                          <span className="text-purple-300">🧵 {row.threads.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full transition-all" style={{ width: `${xPct}%`, background: 'linear-gradient(to right, #3b82f6, #60a5fa)' }} />
                        <div className="h-full transition-all" style={{ width: `${100 - xPct}%`, background: 'linear-gradient(to right, #7c3aed, #a78bfa)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#3b82f6' }} />X ({summaryData.x.postCount}件)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#7c3aed' }} />Threads ({summaryData.threads.postCount}件)</span>
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
                      <span className="text-sm font-bold text-white">{item.engagementRate.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(item.engagementRate / maxRate) * 100}%`, backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }} />
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

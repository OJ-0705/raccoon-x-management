'use client'

import { useEffect, useState, useCallback } from 'react'
import StatsCard from '@/components/StatsCard'
import PostCard from '@/components/PostCard'
import Link from 'next/link'

interface AnalyticsData {
  analytics: { date: string; followers?: number; totalImpressions?: number }[]
  postStats: { impressions?: number; likes?: number; retweets?: number; replies?: number; bookmarks?: number }
  postCount: number
  postsByType: {
    postType: string
    _count: { id: number }
    _sum: { impressions: number | null; likes: number | null; retweets: number | null; replies: number | null; bookmarks: number | null }
  }[]
}

interface Post {
  id: string
  content: string
  postType: string
  formatType: string
  status: string
  scheduledAt?: string | null
  impressions: number
  likes: number
  retweets: number
  replies: number
  bookmarks: number
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

export default function DashboardPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [highEngPosts, setHighEngPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [analytics, posts] = await Promise.all([
        fetch('/api/analytics?days=7').then(r => r.json()),
        fetch('/api/posts?sort=engagement&status=投稿済み&limit=5').then(r => r.json()),
      ])
      setAnalyticsData(analytics)
      setHighEngPosts(posts.posts || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const latestAnalytics = analyticsData?.analytics?.[analyticsData.analytics.length - 1]

  // Compute engagement rate per type
  const engRates = (analyticsData?.postsByType || [])
    .map(t => {
      const imp = t._sum.impressions || 0
      const eng = (t._sum.likes || 0) + (t._sum.retweets || 0) + (t._sum.replies || 0) + (t._sum.bookmarks || 0)
      return { postType: t.postType, count: t._count.id, rate: imp > 0 ? (eng / imp) * 100 : 0, eng }
    })
    .sort((a, b) => b.rate - a.rate)

  const maxRate = engRates.length > 0 ? Math.max(...engRates.map(r => r.rate), 0.01) : 0.01

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">ダッシュボード</h1>
        <Link
          href="/posts/new"
          className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-medium transition-colors"
        >
          ✏️ 新規投稿
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="フォロワー" value={latestAnalytics?.followers || 0} icon="👥" color="orange" />
        <StatsCard title="総インプレッション" value={analyticsData?.postStats?.impressions || 0} icon="👀" color="blue" />
        <StatsCard title="総いいね" value={analyticsData?.postStats?.likes || 0} icon="❤️" color="red" />
        <StatsCard title="総投稿数" value={analyticsData?.postCount || 0} icon="📝" color="green" />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* High engagement posts (left 2/3) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">🔥 高エンゲージメント投稿</h2>
            <Link href="/posts?status=投稿済み" className="text-xs text-orange-400 hover:text-orange-300">
              すべて見る →
            </Link>
          </div>
          {highEngPosts.length > 0 ? (
            <div className="space-y-3">
              {highEngPosts.map(post => (
                <PostCard key={post.id} post={post} onRefresh={load} />
              ))}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
              <div className="text-3xl mb-2">📝</div>
              <p className="text-gray-400 text-xs">投稿済みの投稿がありません</p>
              <Link href="/posts/new" className="inline-block mt-3 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs transition-colors">
                最初の投稿を作成
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Engagement rate by type */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h2 className="text-xs font-bold text-white mb-3">📊 投稿タイプ別エンゲージメント率</h2>
            {engRates.length > 0 ? (
              <div className="space-y-2.5">
                {engRates.map(item => (
                  <div key={item.postType}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }}
                        />
                        <span className="text-xs text-gray-300 truncate max-w-[110px]">{item.postType}</span>
                      </div>
                      <span className="text-xs text-gray-400 ml-1">{item.rate.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(item.rate / maxRate) * 100}%`,
                          backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-3">投稿済みデータなし</p>
            )}
          </div>

          {/* 7-day trend */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h2 className="text-xs font-bold text-white mb-3">📈 7日間トレンド</h2>
            <div className="space-y-1.5">
              {analyticsData?.analytics?.slice(-5).map(item => (
                <div key={item.date} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {new Date(item.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-orange-400">👥 {(item.followers || 0).toLocaleString()}</span>
                    <span className="text-blue-400">👀 {(item.totalImpressions || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {!analyticsData?.analytics?.length && (
                <p className="text-xs text-gray-500 text-center py-2">データなし</p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h2 className="text-xs font-bold text-white mb-3">⚡ クイックアクション</h2>
            <div className="space-y-1.5">
              <Link href="/top" className="flex items-center gap-2 w-full px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-xs transition-colors">
                🏠 承認待ち投稿を確認
              </Link>
              <Link href="/posts/new" className="flex items-center gap-2 w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors">
                ✏️ 新規投稿作成
              </Link>
              <Link href="/posts?status=下書き" className="flex items-center gap-2 w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors">
                📋 下書き一覧
              </Link>
              <Link href="/calendar" className="flex items-center gap-2 w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors">
                📅 カレンダーを見る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

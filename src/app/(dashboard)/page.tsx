'use client'

import { useEffect, useState } from 'react'
import StatsCard from '@/components/StatsCard'
import PostCard from '@/components/PostCard'
import Link from 'next/link'

interface Analytics {
  date: string
  followers?: number
  totalImpressions?: number
  totalEngagements?: number
}

interface AnalyticsData {
  analytics: Analytics[]
  postStats: {
    impressions?: number
    likes?: number
    retweets?: number
    replies?: number
    bookmarks?: number
  }
  postCount: number
  postsByStatus: { status: string; _count: { id: number } }[]
  postsByType: { postType: string; _count: { id: number }; _sum: { impressions: number | null; likes: number | null } }[]
}

interface Post {
  id: string
  content: string
  postType: string
  formatType: string
  status: string
  scheduledAt?: string | null
  postedAt?: string | null
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
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics?days=7').then(r => r.json()),
      fetch('/api/posts?limit=5').then(r => r.json()),
    ]).then(([analytics, posts]) => {
      setAnalyticsData(analytics)
      setRecentPosts(posts.posts || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const latestAnalytics = analyticsData?.analytics?.[analyticsData.analytics.length - 1]
  const statusCount = (status: string) =>
    analyticsData?.postsByStatus?.find(s => s.status === status)?._count?.id || 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ダッシュボード</h1>
          <p className="text-gray-400 text-sm mt-1">X自動運用管理システム概要</p>
        </div>
        <Link
          href="/posts/new"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          ✏️ 新規投稿
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="フォロワー"
          value={latestAnalytics?.followers || 0}
          icon="👥"
          color="orange"
        />
        <StatsCard
          title="総インプレッション"
          value={analyticsData?.postStats?.impressions || 0}
          icon="👀"
          color="blue"
        />
        <StatsCard
          title="総いいね"
          value={analyticsData?.postStats?.likes || 0}
          icon="❤️"
          color="red"
        />
        <StatsCard
          title="総投稿数"
          value={analyticsData?.postCount || 0}
          icon="📝"
          color="green"
        />
      </div>

      {/* Post Status Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { status: '下書き', icon: '📋', color: 'gray' },
          { status: '予約済み', icon: '⏰', color: 'blue' },
          { status: '投稿済み', icon: '✅', color: 'green' },
          { status: '失敗', icon: '❌', color: 'red' },
        ].map(({ status, icon, color }) => (
          <StatsCard
            key={status}
            title={status}
            value={statusCount(status)}
            icon={icon}
            color={color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Posts */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">最近の投稿</h2>
            <Link href="/posts" className="text-sm text-orange-400 hover:text-orange-300">
              すべて見る →
            </Link>
          </div>
          <div className="space-y-3">
            {recentPosts.length > 0 ? (
              recentPosts.map(post => (
                <PostCard key={post.id} post={post} />
              ))
            ) : (
              <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-gray-400 text-sm">まだ投稿がありません</p>
                <Link
                  href="/posts/new"
                  className="inline-block mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm transition-colors"
                >
                  最初の投稿を作成
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Post Type Breakdown */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-white mb-4">投稿タイプ別</h2>
            <div className="space-y-2">
              {analyticsData?.postsByType?.length ? (
                analyticsData.postsByType.map((item) => (
                  <div key={item.postType} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }}
                      />
                      <span className="text-xs text-gray-300 truncate max-w-[120px]">{item.postType}</span>
                    </div>
                    <span className="text-xs text-gray-400">{item._count.id}件</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">データなし</p>
              )}
            </div>
          </div>

          {/* Analytics Trend */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-white mb-4">7日間のトレンド</h2>
            <div className="space-y-2">
              {analyticsData?.analytics?.slice(-5).map((item) => (
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

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-white mb-4">クイックアクション</h2>
            <div className="space-y-2">
              <Link
                href="/posts/new"
                className="flex items-center gap-2 w-full px-3 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm transition-colors"
              >
                ✏️ 新規投稿作成
              </Link>
              <Link
                href="/posts?status=下書き"
                className="flex items-center gap-2 w-full px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                📋 下書き一覧
              </Link>
              <Link
                href="/calendar"
                className="flex items-center gap-2 w-full px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                📅 カレンダーを見る
              </Link>
              <Link
                href="/research"
                className="flex items-center gap-2 w-full px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                🔍 リサーチ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface ThreadsPost {
  id: string
  content: string
  postType: string
  status: string
  threadsPostId?: string | null
  threadsImp: number
  threadsLikes: number
  threadsReplies: number
  threadsReposts: number
  likes: number
  retweets: number
  replies: number
  bookmarks: number
  platform: string
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

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    purple: 'text-purple-400 bg-purple-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-green-400 bg-green-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
  }
  return (
    <div className="rounded-xl p-5" style={glass}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">{title}</p>
        <span className={`text-lg p-1.5 rounded-lg ${colors[color]}`}>{icon}</span>
      </div>
      <p className="text-4xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  )
}

export default function ThreadsDashboardPage() {
  const [posts, setPosts] = useState<ThreadsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [threadsConfigured, setThreadsConfigured] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    try {
      const [postsRes, accountsRes] = await Promise.all([
        fetch('/api/posts?platform=threads&status=投稿済み&limit=20'),
        fetch('/api/accounts'),
      ])
      const postsData = await postsRes.json()
      const accountsData = await accountsRes.json()
      setPosts(postsData.posts || [])
      setThreadsConfigured(accountsData.threads?.configured ?? false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalImp = posts.reduce((s, p) => s + (p.threadsImp || 0), 0)
  const totalLikes = posts.reduce((s, p) => s + (p.threadsLikes || 0), 0)
  const totalReplies = posts.reduce((s, p) => s + (p.threadsReplies || 0), 0)

  const engRates = Object.entries(
    posts.reduce<Record<string, { imp: number; eng: number; count: number }>>((acc, p) => {
      if (!acc[p.postType]) acc[p.postType] = { imp: 0, eng: 0, count: 0 }
      acc[p.postType].imp += p.threadsImp || 0
      acc[p.postType].eng += (p.threadsLikes || 0) + (p.threadsReplies || 0) + (p.threadsReposts || 0)
      acc[p.postType].count += 1
      return acc
    }, {})
  ).map(([postType, d]) => ({ postType, rate: d.imp > 0 ? (d.eng / d.imp) * 100 : 0, count: d.count }))
    .sort((a, b) => b.rate - a.rate)

  const maxRate = Math.max(...engRates.map(r => r.rate), 0.01)

  const topPosts = [...posts]
    .sort((a, b) => {
      const sa = a.threadsLikes + a.threadsReplies * 2 + a.threadsReposts * 3
      const sb = b.threadsLikes + b.threadsReplies * 2 + b.threadsReposts * 3
      return sb - sa
    })
    .slice(0, 5)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">読み込み中...</div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ダッシュボード — Threads</h1>
          <p className="text-slate-400 text-xs mt-0.5">Threadsのパフォーマンス分析</p>
        </div>
        <Link href="/posts/new" className="px-3 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-orange-500/20">
          ✏️ 新規投稿
        </Link>
      </div>

      {/* Threads connection status */}
      {threadsConfigured === true ? (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <span className="text-xl">✅</span>
          <div>
            <p className="text-sm font-bold text-green-300">Threads連携済み</p>
            <p className="text-xs text-slate-400">投稿時に「Threadsにも投稿」をONにすると自動投稿されます。</p>
          </div>
        </div>
      ) : threadsConfigured === false ? (
        <div className="rounded-xl p-5" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
          <h3 className="text-sm font-bold text-purple-300 mb-2">🧵 Threads連携の設定が必要です</h3>
          <p className="text-xs text-slate-300 mb-3">
            Threadsに投稿するには、Vercelの環境変数に以下を追加してください：
          </p>
          <div className="rounded-lg p-3 font-mono text-xs text-green-400 space-y-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div>THREADS_USER_ID=<span className="text-slate-400">（あなたのThreadsユーザーID）</span></div>
            <div>THREADS_ACCESS_TOKEN=<span className="text-slate-400">（アクセストークン）</span></div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            設定方法は下部の「Threads API設定手順」を参照してください。
          </p>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Threads投稿数" value={posts.length} icon="🧵" color="purple" />
        <StatCard title="総インプレッション" value={totalImp} icon="👀" color="blue" />
        <StatCard title="総いいね" value={totalLikes} icon="❤️" color="orange" />
        <StatCard title="総リプライ" value={totalReplies} icon="💬" color="green" />
      </div>

      {/* Main */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Engagement rate + comparison */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl p-5" style={glass}>
            <h2 className="text-sm font-bold text-white mb-4">📊 投稿タイプ別エンゲージメント率 (Threads)</h2>
            {engRates.length > 0 ? (
              <div className="space-y-3">
                {engRates.map(item => (
                  <div key={item.postType}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }} />
                        <span className="text-sm text-slate-200">{item.postType}</span>
                        <span className="text-xs text-slate-500">（{item.count}件）</span>
                      </div>
                      <span className="text-sm font-bold text-white">{item.rate.toFixed(2)}%</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(item.rate / maxRate) * 100}%`, backgroundColor: POST_TYPE_COLORS[item.postType] || '#6B7280' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">Threads投稿済みデータがありません</p>
                <p className="text-slate-600 text-xs mt-1">投稿時にThreads連携をONにしてください</p>
              </div>
            )}
          </div>

          {/* Threads vs X comparison */}
          <div className="rounded-xl p-5" style={glass}>
            <h2 className="text-sm font-bold text-white mb-4">⚔️ Threads vs X エンゲージメント比較</h2>
            {posts.length > 0 ? (
              <div className="space-y-3">
                {topPosts.slice(0, 3).map(post => {
                  const xEng = post.likes + post.retweets + post.replies + post.bookmarks
                  const tEng = post.threadsLikes + post.threadsReplies + post.threadsReposts
                  const winner = tEng >= xEng ? 'threads' : 'x'
                  return (
                    <div key={post.id} className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-xs text-slate-400 mb-2 line-clamp-1">{post.content.slice(0, 50)}...</p>
                      <div className="flex gap-4 text-xs">
                        <span className={`flex items-center gap-1 ${winner === 'x' ? 'text-blue-300 font-bold' : 'text-slate-500'}`}>
                          𝕏 エンゲージメント: {xEng.toLocaleString()}
                          {winner === 'x' && ' 🏆'}
                        </span>
                        <span className={`flex items-center gap-1 ${winner === 'threads' ? 'text-purple-300 font-bold' : 'text-slate-500'}`}>
                          🧵 {tEng.toLocaleString()}
                          {winner === 'threads' && ' 🏆'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-sm text-center py-4">比較データなし</p>
            )}
          </div>
        </div>

        {/* Right: top posts */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white">🔥 高エンゲージメント投稿 (Threads)</h2>
          {topPosts.length > 0 ? (
            topPosts.map(post => (
              <div key={post.id} className="rounded-xl p-4" style={glass}>
                <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: POST_TYPE_COLORS[post.postType] || '#6B7280' }}>
                  {post.postType}
                </span>
                <p className="text-xs text-slate-200 mt-2 whitespace-pre-wrap">{post.content}</p>
                <div className="flex gap-3 mt-2 text-xs text-slate-400">
                  <span>❤️ {post.threadsLikes}</span>
                  <span>💬 {post.threadsReplies}</span>
                  <span>🔁 {post.threadsReposts}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl p-6 text-center" style={glass}>
              <div className="text-3xl mb-2">🧵</div>
              <p className="text-slate-400 text-xs">投稿済みデータなし</p>
            </div>
          )}
        </div>
      </div>

      {/* Threads API setup guide */}
      <div className="rounded-xl p-5" style={glass}>
        <h2 className="text-sm font-bold text-white mb-4">🛠️ Threads API 設定手順</h2>
        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex gap-3">
            <span className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">1</span>
            <div>
              <p className="font-medium text-white">Meta Developersアカウントを作成</p>
              <p className="text-slate-400">https://developers.facebook.com にアクセスして、アカウント登録またはログイン</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">2</span>
            <div>
              <p className="font-medium text-white">Threadsアプリを作成</p>
              <p className="text-slate-400">「アプリを作成」→「Threads」を選択 → アプリ名を設定（例: raccoon-x-management）</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">3</span>
            <div>
              <p className="font-medium text-white">Threads APIを有効化</p>
              <p className="text-slate-400">アプリダッシュボード → 「Threads API」→ 「セットアップ」→ InstagramビジネスアカウントをThreadsと連携</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">4</span>
            <div>
              <p className="font-medium text-white">アクセストークンを取得</p>
              <p className="text-slate-400">Graph APIエクスプローラー → threads_publish権限を選択 → 「アクセストークンを生成」</p>
              <p className="text-slate-500 mt-1">ユーザーIDの取得: GET https://graph.threads.net/v1.0/me?access_token=&#123;token&#125;</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">5</span>
            <div>
              <p className="font-medium text-white">Vercelに環境変数を追加</p>
              <div className="rounded p-2 mt-1 font-mono space-y-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-green-400">THREADS_USER_ID=123456789</div>
                <div className="text-green-400">THREADS_ACCESS_TOKEN=EAA...</div>
              </div>
              <p className="text-slate-400 mt-1">Vercel → プロジェクト → Settings → Environment Variables</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

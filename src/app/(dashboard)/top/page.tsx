'use client'

import { useEffect, useState, useCallback } from 'react'
import ScheduleModal from '@/components/ScheduleModal'

interface Post {
  id: string
  content: string
  postType: string
  status: string
  scheduledAt?: string | null
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

export default function TopPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [schedulePost, setSchedulePost] = useState<Post | null>(null)
  const [approving, setApproving] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/top')
      const data = await res.json()
      setPosts(data.posts || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      await fetch('/api/top', { method: 'POST' })
      await loadPosts()
    } finally {
      setGenerating(false)
    }
  }, [loadPosts])

  useEffect(() => {
    loadPosts().then(() => {
      // Auto-generate if needed
      generate()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (post: Post) => {
    // Open schedule modal with pre-filled optimal time
    setSchedulePost(post)
  }

  const handleApproveDirectly = async (postId: string) => {
    setApproving(postId)
    try {
      const post = posts.find(p => p.id === postId)
      if (!post) return
      await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: '予約済み',
          scheduledAt: post.scheduledAt || new Date(Date.now() + 86400000).toISOString(),
        }),
      })
      await loadPosts()
      // Generate a replacement
      generate()
    } finally {
      setApproving(null)
    }
  }

  const handleReject = async (postId: string) => {
    try {
      await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      await loadPosts()
      generate()
    } catch (err) {
      console.error(err)
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '未設定'
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">🏠 トップ</h1>
          <p className="text-gray-400 text-xs mt-0.5">AIが生成した承認待ち投稿案</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-xl text-xs transition-colors"
        >
          {generating ? '生成中...' : '🔄 再生成'}
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-2.5 border border-gray-700">
        <div className={`w-2 h-2 rounded-full ${posts.length >= 10 ? 'bg-green-400' : posts.length > 0 ? 'bg-yellow-400' : 'bg-red-400'}`} />
        <span className="text-xs text-gray-300">
          承認待ち: <span className="text-white font-bold">{posts.length}</span> / 10件
        </span>
        {generating && <span className="text-xs text-orange-400 ml-auto">投稿案を生成中...</span>}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-400 text-sm">読み込み中...</div>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post, i) => {
            const typeColor = POST_TYPE_COLORS[post.postType] || '#6B7280'
            return (
              <div key={post.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {/* Post header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-700 bg-gray-750">
                  <span className="text-xs text-gray-500 font-mono">#{i + 1}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                    style={{ backgroundColor: typeColor }}
                  >
                    {post.postType}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-blue-400">
                    <span>⏰</span>
                    <span>推奨: {formatDate(post.scheduledAt)}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-700 bg-gray-900/30">
                  <button
                    onClick={() => handleApprove(post)}
                    disabled={approving === post.id}
                    className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    ✅ 投稿を承認しますか？
                  </button>
                  <button
                    onClick={() => handleApproveDirectly(post.id)}
                    disabled={approving === post.id}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg text-xs transition-colors"
                    title="推奨時刻のまま承認"
                  >
                    {approving === post.id ? '...' : '⚡ 即承認'}
                  </button>
                  <button
                    onClick={() => handleReject(post.id)}
                    className="px-3 py-2 bg-red-900/60 hover:bg-red-900 text-red-300 rounded-lg text-xs transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-10 text-center border border-gray-700">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-gray-400 text-sm mb-3">承認待ちの投稿案がありません</p>
          <button
            onClick={generate}
            disabled={generating}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm transition-colors"
          >
            {generating ? '生成中...' : 'AIで投稿案を生成'}
          </button>
        </div>
      )}

      {/* Schedule Modal */}
      {schedulePost && (
        <ScheduleModal
          postId={schedulePost.id}
          postType={schedulePost.postType}
          defaultScheduledAt={schedulePost.scheduledAt}
          onClose={() => setSchedulePost(null)}
          onScheduled={() => {
            setSchedulePost(null)
            loadPosts()
            generate()
          }}
        />
      )}
    </div>
  )
}

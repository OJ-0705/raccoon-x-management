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
  // Edit modal state
  const [editPost, setEditPost] = useState<Post | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

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
    loadPosts().then(() => generate())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = (post: Post) => setSchedulePost(post)

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

  const openEdit = (post: Post) => {
    setEditPost(post)
    setEditContent(post.content)
  }

  const handleSave = async () => {
    if (!editPost) return
    setSaving(true)
    try {
      await fetch(`/api/posts/${editPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      await loadPosts()
      setEditPost(null)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '未設定'
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-5">
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

      {/* Posts — 3-column grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-400 text-sm">読み込み中...</div>
        </div>
      ) : posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post, i) => {
            const typeColor = POST_TYPE_COLORS[post.postType] || '#6B7280'
            return (
              <div key={post.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
                {/* Card header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
                  <span className="text-xs text-gray-500 font-mono">#{i + 1}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium text-white truncate"
                    style={{ backgroundColor: typeColor }}
                  >
                    {post.postType}
                  </span>
                </div>

                {/* Content */}
                <div className="px-3 py-3 flex-1">
                  <p className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </div>

                {/* Recommended time */}
                <div className="px-3 pb-2 text-xs text-blue-400">
                  ⏰ {formatDate(post.scheduledAt)}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-1 px-3 pb-3">
                  <button
                    onClick={() => handleApprove(post)}
                    disabled={approving === post.id}
                    className="col-span-2 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    ✅ 承認する
                  </button>
                  <button
                    onClick={() => openEdit(post)}
                    className="py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors"
                  >
                    ✏️ 編集
                  </button>
                  <button
                    onClick={() => handleApproveDirectly(post.id)}
                    disabled={approving === post.id}
                    className="py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg text-xs transition-colors"
                    title="推奨時刻のまま即承認"
                  >
                    {approving === post.id ? '...' : '⚡ 即承認'}
                  </button>
                  <button
                    onClick={() => handleReject(post.id)}
                    className="col-span-2 py-1 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg text-xs transition-colors"
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
          onScheduled={() => { setSchedulePost(null); loadPosts(); generate() }}
        />
      )}

      {/* Edit Modal */}
      {editPost && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setEditPost(null)}
        >
          <div
            className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg border border-gray-700 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white">✏️ 投稿を編集</h3>
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: POST_TYPE_COLORS[editPost.postType] || '#6B7280' }}
              >
                {editPost.postType}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">ハッシュタグは最大2つまで。内容を自由に編集してください。</p>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={10}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-sm text-white resize-none focus:outline-none focus:border-orange-500 transition-colors leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1 mb-4">
              <span className="text-xs text-gray-500">{editContent.length}文字</span>
              <span className={`text-xs ${editContent.length > 140 ? 'text-red-400' : 'text-gray-500'}`}>
                推奨: 140文字以内
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditPost(null)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

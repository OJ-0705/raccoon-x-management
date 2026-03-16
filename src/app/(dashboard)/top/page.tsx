'use client'

import { useEffect, useState, useCallback } from 'react'
import ScheduleModal from '@/components/ScheduleModal'

interface Post {
  id: string
  content: string
  postType: string
  platform?: string
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

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
}

function PlatformBadges({ platform }: { platform?: string }) {
  const showX = !platform || platform === 'x' || platform === 'both'
  const showT = !platform || platform === 'threads' || platform === 'both'
  return (
    <div className="flex items-center gap-1">
      {showX && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold text-white" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)' }}>
          𝕏
        </span>
      )}
      {showT && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold text-white" style={{ background: 'rgba(139,92,246,0.4)', border: '1px solid rgba(139,92,246,0.4)' }}>
          🧵
        </span>
      )}
    </div>
  )
}

/** Propose the next scheduled datetime based on existing scheduled posts.
 *  Strategy: 2 posts/day — 7:00 and 21:00.
 *  Find the latest scheduled post, then propose the next available slot.
 */
function proposeNextSchedule(posts: Post[]): string {
  const SLOTS = [7, 12, 21] // 朝7時・昼12時・夜21時
  const scheduled = posts
    .filter(p => p.scheduledAt)
    .map(p => new Date(p.scheduledAt!).getTime())

  const base = scheduled.length > 0 ? new Date(Math.max(...scheduled)) : new Date()
  // Try to find the next slot on the same day or the day after
  const candidate = new Date(base)
  candidate.setSeconds(0)
  candidate.setMinutes(0)

  for (let d = 0; d < 14; d++) {
    for (const hour of SLOTS) {
      candidate.setDate(base.getDate() + d)
      candidate.setHours(hour, 0, 0, 0)
      if (candidate.getTime() > Date.now() + 60000 && !scheduled.includes(candidate.getTime())) {
        // Format for datetime-local input
        const pad = (n: number) => n.toString().padStart(2, '0')
        return `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}T${pad(hour)}:00`
      }
    }
  }
  // fallback: tomorrow 21:00
  const fallback = new Date()
  fallback.setDate(fallback.getDate() + 1)
  fallback.setHours(21, 0, 0, 0)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}T21:00`
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
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriting, setRewriting] = useState(false)

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
    // Pre-fill with proposed next schedule
    if (post.scheduledAt) {
      const d = new Date(post.scheduledAt)
      const pad = (n: number) => n.toString().padStart(2, '0')
      setEditScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
    } else {
      setEditScheduledAt(proposeNextSchedule(posts))
    }
  }

  const handleRewrite = async () => {
    if (!rewriteInstruction.trim() || !editPost) return
    setRewriting(true)
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, instruction: rewriteInstruction, postType: editPost.postType }),
      })
      const data = await res.json()
      if (data.result) { setEditContent(data.result); setRewriteInstruction('') }
    } finally { setRewriting(false) }
  }

  const handleSave = async () => {
    if (!editPost) return
    setSaving(true)
    try {
      await fetch(`/api/posts/${editPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          scheduledAt: editScheduledAt || null,
        }),
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
          <h1 className="text-2xl font-bold text-white">🏠 トップ</h1>
          <p className="text-slate-400 text-xs mt-0.5">AIが生成した承認待ち投稿案 — 1日3投稿（朝7時・昼12時・夜21時）推奨</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="px-3 py-1.5 disabled:opacity-50 text-slate-300 rounded-xl text-xs transition-all"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {generating ? '生成中...' : '🔄 再生成'}
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={glass}>
        <div className={`w-2 h-2 rounded-full ${posts.length >= 15 ? 'bg-green-400' : posts.length > 0 ? 'bg-yellow-400' : 'bg-red-400'}`} />
        <span className="text-xs text-slate-300">
          承認待ち: <span className="text-white font-bold">{posts.length}</span> / 15件
        </span>
        {generating && <span className="text-xs text-orange-400 ml-auto">投稿案を生成中...</span>}
      </div>

      {/* Posts — 3-column grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-slate-400 text-sm">読み込み中...</div>
        </div>
      ) : posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post, i) => {
            const typeColor = POST_TYPE_COLORS[post.postType] || '#6B7280'
            return (
              <div key={post.id} className="rounded-xl overflow-hidden flex flex-col" style={glass}>
                {/* Card header */}
                <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-xs text-slate-500 font-mono">#{i + 1}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium text-white truncate"
                    style={{ backgroundColor: typeColor }}
                  >
                    {post.postType}
                  </span>
                  <div className="ml-auto">
                    <PlatformBadges platform={post.platform} />
                  </div>
                </div>

                {/* Content — 150% bigger text */}
                <div className="px-3 py-3 flex-1">
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed" style={{ fontSize: '15px' }}>
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
                    className="col-span-2 py-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all"
                  >
                    ✅ 承認する
                  </button>
                  <button
                    onClick={() => openEdit(post)}
                    className="py-1.5 text-slate-300 rounded-lg text-xs transition-all"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    ✏️ 編集
                  </button>
                  <button
                    onClick={() => handleApproveDirectly(post.id)}
                    disabled={approving === post.id}
                    className="py-1.5 disabled:opacity-50 text-slate-300 rounded-lg text-xs transition-all"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                    title="推奨時刻のまま即承認"
                  >
                    {approving === post.id ? '...' : '⚡ 即承認'}
                  </button>
                  <button
                    onClick={() => handleReject(post.id)}
                    className="col-span-2 py-1 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg text-xs transition-all"
                  >
                    削除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl p-10 text-center" style={glass}>
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-slate-400 text-sm mb-3">承認待ちの投稿案がありません</p>
          <button
            onClick={generate}
            disabled={generating}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-sm transition-all"
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

      {/* Edit Modal — with datetime picker */}
      {editPost && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setEditPost(null)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            style={{ background: 'rgba(8,9,18,0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }}
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
            <p className="text-xs text-slate-400 mb-3">ハッシュタグは最大2つまで。内容を自由に編集してください。</p>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={10}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white resize-none focus:outline-none transition-all leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            <div className="flex items-center justify-between mt-1 mb-4">
              <span className="text-xs text-slate-500">{editContent.length}文字</span>
              <span className={`text-xs ${editContent.length > 280 ? 'text-red-400' : 'text-slate-500'}`}>
                推奨: 280文字以内
              </span>
            </div>

            {/* DateTime picker */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1.5">📅 投稿日時（推奨: 朝7時 / 昼12時 / 夜21時）</label>
              <input
                type="datetime-local"
                value={editScheduledAt}
                onChange={e => setEditScheduledAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              <p className="text-[11px] text-slate-500 mt-1">最適投稿時間: 🌅 朝7:00 / 🌞 昼12:00 / 🌙 夜21:00（木曜21時は特に効果的）</p>
            </div>

            {/* AI Rewrite */}
            <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <p className="text-xs text-purple-300 font-medium mb-2">🤖 AIに書き換えを依頼</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rewriteInstruction}
                  onChange={e => setRewriteInstruction(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRewrite()}
                  placeholder="例: もっと短く / 数値を強調 / フックを強くして"
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <button
                  onClick={handleRewrite}
                  disabled={rewriting || !rewriteInstruction.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all whitespace-nowrap"
                  style={{ background: 'rgba(139,92,246,0.4)', border: '1px solid rgba(139,92,246,0.5)' }}
                >
                  {rewriting ? '...' : '書き換え'}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditPost(null)}
                className="flex-1 py-2.5 text-slate-300 rounded-xl text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all"
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

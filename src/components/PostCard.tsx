'use client'

import { useState } from 'react'
import Link from 'next/link'
import ScheduleModal from './ScheduleModal'

interface Post {
  id: string
  content: string
  postType: string
  formatType: string
  status: string
  platform?: string
  scheduledAt?: string | null
  postedAt?: string | null
  impressions: number
  likes: number
  retweets: number
  replies: number
  bookmarks: number
  threadsImp?: number
  threadsLikes?: number
  threadsReplies?: number
  threadsReposts?: number
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

const STATUS_COLORS: Record<string, string> = {
  '下書き': 'bg-gray-600 text-gray-200',
  '承認待ち': 'bg-yellow-600 text-yellow-100',
  '予約済み': 'bg-blue-600 text-blue-100',
  '投稿済み': 'bg-green-600 text-green-100',
  '失敗': 'bg-red-600 text-red-100',
}

interface PostCardProps {
  post: Post
  onDelete?: (id: string) => void
  onRefresh?: () => void
}

export default function PostCard({ post, onDelete, onRefresh }: PostCardProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showImprove, setShowImprove] = useState(false)
  const [improveVariants, setImproveVariants] = useState<string[]>([])
  const [improving, setImproving] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [savingVariant, setSavingVariant] = useState(false)
  // Platform toggle
  const [platform, setPlatform] = useState(post.platform || 'x')
  const [updatingPlatform, setUpdatingPlatform] = useState(false)

  const typeColor = POST_TYPE_COLORS[post.postType] || '#6B7280'
  const statusClass = STATUS_COLORS[post.status] || 'bg-gray-600 text-gray-200'

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  const canSchedule = post.status === '下書き' || post.status === '承認待ち'

  const togglePlatform = async () => {
    const next = platform === 'x' ? 'both' : 'x'
    setUpdatingPlatform(true)
    try {
      await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: next }),
      })
      setPlatform(next)
    } finally {
      setUpdatingPlatform(false)
    }
  }

  const handleImprove = async () => {
    setShowImprove(true)
    if (improveVariants.length > 0) return
    setImproving(true)
    try {
      const res = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: post.content, postType: post.postType }),
      })
      const data = await res.json()
      setImproveVariants(data.variants || [])
    } finally {
      setImproving(false)
    }
  }

  const applyVariant = async (content: string) => {
    setSavingVariant(true)
    try {
      await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      onRefresh?.()
      setShowImprove(false)
    } finally {
      setSavingVariant(false)
    }
  }

  return (
    <>
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-1 rounded-full font-medium text-white" style={{ backgroundColor: typeColor }}>
              {post.postType}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass}`}>
              {post.status}
            </span>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
            {formatDate(post.createdAt)}
          </span>
        </div>

        {/* Content — full text */}
        <p className="text-sm text-gray-200 whitespace-pre-wrap mb-3 leading-relaxed">
          {post.content}
        </p>

        {/* Stats (posted) */}
        {post.status === '投稿済み' && (
          <div className="mb-3 space-y-1">
            <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
              <span className="text-blue-400 text-xs font-medium">𝕏</span>
              <span>👀 {post.impressions.toLocaleString()}</span>
              <span>❤️ {post.likes.toLocaleString()}</span>
              <span>🔁 {post.retweets.toLocaleString()}</span>
              <span>💬 {post.replies.toLocaleString()}</span>
              <span>🔖 {post.bookmarks.toLocaleString()}</span>
            </div>
            {(post.threadsImp || 0) > 0 && (
              <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                <span className="text-purple-400 text-xs font-medium">🧵</span>
                <span>👀 {(post.threadsImp || 0).toLocaleString()}</span>
                <span>❤️ {(post.threadsLikes || 0).toLocaleString()}</span>
                <span>💬 {(post.threadsReplies || 0).toLocaleString()}</span>
                <span>🔁 {(post.threadsReposts || 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Scheduled */}
        {post.scheduledAt && (
          <div className="text-xs text-blue-400 mb-3">⏰ 予約: {formatDate(post.scheduledAt)}</div>
        )}

        {/* Platform toggle (for drafts/pending) */}
        {(post.status === '下書き' || post.status === '承認待ち') && (
          <div className="flex items-center gap-2 mb-3 py-2 border-t border-gray-700">
            <span className="text-xs text-gray-400">Threadsにも投稿</span>
            <button
              onClick={togglePlatform}
              disabled={updatingPlatform}
              className={`relative w-10 h-5 rounded-full transition-colors ${platform === 'both' ? 'bg-purple-500' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${platform === 'both' ? 'translate-x-5' : ''}`} />
            </button>
            <span className={`text-xs ${platform === 'both' ? 'text-purple-400' : 'text-gray-500'}`}>
              {platform === 'both' ? 'ON' : 'OFF'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-700 flex-wrap">
          <Link href={`/posts/${post.id}/edit`} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors">
            編集
          </Link>
          {canSchedule && (
            <button onClick={() => setShowScheduleModal(true)} className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors">
              スケジュールを設定
            </button>
          )}
          <button onClick={handleImprove} className="text-xs px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg transition-colors">
            ✨ AI改善
          </button>
          {onDelete && (
            <button
              onClick={() => { if (confirm('この投稿を削除しますか？')) onDelete(post.id) }}
              className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 hover:text-red-100 rounded-lg transition-colors ml-auto"
            >
              削除
            </button>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          postId={post.id}
          postType={post.postType}
          defaultScheduledAt={post.scheduledAt}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => onRefresh?.()}
        />
      )}

      {/* AI Improve Modal */}
      {showImprove && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowImprove(false)}>
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-1">✨ AI改善提案</h3>
            <p className="text-xs text-gray-400 mb-4">採用したいバリアントを選んで「適用する」を押してください</p>
            {improving ? (
              <div className="text-center py-8 text-gray-400">AIが改善中...</div>
            ) : (
              <div className="space-y-4">
                {improveVariants.map((v, i) => (
                  <div key={i} className={`bg-gray-900 rounded-xl p-4 border-2 transition-colors cursor-pointer ${selectedVariant === v ? 'border-purple-500' : 'border-gray-700 hover:border-gray-500'}`} onClick={() => setSelectedVariant(v)}>
                    <p className="text-xs text-purple-400 font-bold mb-2">バリアント {i + 1}</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{v}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowImprove(false)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition-colors">
                閉じる
              </button>
              {selectedVariant && (
                <button
                  onClick={() => applyVariant(selectedVariant)}
                  disabled={savingVariant}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {savingVariant ? '適用中...' : '✅ 適用する'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

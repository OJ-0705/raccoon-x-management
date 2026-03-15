'use client'

import Link from 'next/link'

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
  onPost?: (id: string) => void
}

export default function PostCard({ post, onDelete, onPost }: PostCardProps) {
  const typeColor = POST_TYPE_COLORS[post.postType] || '#6B7280'
  const statusClass = STATUS_COLORS[post.status] || 'bg-gray-600 text-gray-200'

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs px-2 py-1 rounded-full font-medium text-white"
            style={{ backgroundColor: typeColor }}
          >
            {post.postType}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass}`}>
            {post.status}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">
            {post.formatType}
          </span>
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatDate(post.createdAt)}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-gray-200 whitespace-pre-wrap line-clamp-4 mb-3 leading-relaxed">
        {post.content}
      </p>

      {/* Stats (only for posted) */}
      {post.status === '投稿済み' && (
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
          <span>👀 {post.impressions.toLocaleString()}</span>
          <span>❤️ {post.likes.toLocaleString()}</span>
          <span>🔁 {post.retweets.toLocaleString()}</span>
          <span>💬 {post.replies.toLocaleString()}</span>
          <span>🔖 {post.bookmarks.toLocaleString()}</span>
        </div>
      )}

      {/* Scheduled */}
      {post.scheduledAt && (
        <div className="text-xs text-blue-400 mb-3">
          ⏰ 予約: {formatDate(post.scheduledAt)}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
        <Link
          href={`/posts/${post.id}/edit`}
          className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
        >
          編集
        </Link>
        {post.status === '下書き' && onPost && (
          <button
            onClick={() => onPost(post.id)}
            className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            投稿する
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 hover:text-red-100 rounded-lg transition-colors ml-auto"
          >
            削除
          </button>
        )}
      </div>
    </div>
  )
}

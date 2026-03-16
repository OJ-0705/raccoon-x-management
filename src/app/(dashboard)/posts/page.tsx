'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import PostCard from '@/components/PostCard'
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

const STATUSES = ['すべて', '下書き', '承認待ち', '予約済み', '投稿済み', '失敗']
const POST_TYPES = ['すべて', 'コンビニまとめ型', '数値比較型', '地雷暴露型', 'プロセス共有型', 'あるある共感型', 'チェックリスト保存型', 'Instagram連携型', 'その他']

function PostsContent() {
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '承認待ち')
  const [typeFilter, setTypeFilter] = useState('すべて')
  const [page, setPage] = useState(1)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'すべて') params.set('status', statusFilter)
    if (typeFilter !== 'すべて') params.set('postType', typeFilter)
    params.set('page', page.toString())
    params.set('limit', '12')

    try {
      const res = await fetch(`/api/posts?${params}`)
      const data = await res.json()
      setPosts(data.posts || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, page])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleDelete = async (id: string) => {
    if (!confirm('この投稿を削除しますか？')) return
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' })
      fetchPosts()
    } catch (error) {
      console.error(error)
    }
  }

  const totalPages = Math.ceil(total / 12)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">投稿管理</h1>
          <p className="text-slate-400 text-sm mt-1">全{total}件</p>
        </div>
        <Link
          href="/posts/new"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-medium transition-colors"
        >
          ✏️ 新規投稿
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400'
              }`}
              style={statusFilter === s ? {} : { background: 'rgba(255,255,255,0.08)' }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {POST_TYPES.map(t => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'text-white'
                  : 'text-slate-400'
              }`}
              style={typeFilter === t
                ? { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }
                : { background: 'rgba(255,255,255,0.08)' }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-slate-400">読み込み中...</div>
        </div>
      ) : posts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={handleDelete}
                onRefresh={fetchPosts}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 disabled:opacity-50 text-slate-300 rounded-lg text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                ←
              </button>
              <span className="text-sm text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 disabled:opacity-50 text-slate-300 rounded-lg text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                →
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="text-5xl mb-4">📭</div>
          <p className="text-slate-400">投稿が見つかりません</p>
          <Link
            href="/posts/new"
            className="inline-block mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm transition-colors"
          >
            新規投稿を作成
          </Link>
        </div>
      )}
    </div>
  )
}

export default function PostsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">読み込み中...</div>
      </div>
    }>
      <PostsContent />
    </Suspense>
  )
}

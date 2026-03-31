'use client'

import { useState } from 'react'
import ScheduleModal from './ScheduleModal'

interface Post {
  id: string; content: string; postType: string; formatType: string; status: string
  platform?: string; scheduledAt?: string | null; postedAt?: string | null
  impressions: number; likes: number; retweets: number; replies: number; bookmarks: number
  threadsImp?: number; threadsLikes?: number; threadsReplies?: number; threadsReposts?: number
  createdAt: string; abGroupId?: string | null; abVariant?: string | null
  qualityScore?: number | null; qualityDetail?: string | null; qualityFeedback?: string | null
  isFavorite?: boolean
}

const POST_TYPE_COLORS: Record<string, string> = {
  'コンビニまとめ型': '#10B981', '数値比較型': '#3B82F6', '地雷暴露型': '#EF4444',
  'プロセス共有型': '#8B5CF6', 'あるある共感型': '#F97316', 'チェックリスト保存型': '#06B6D4',
  'Instagram連携型': '#EC4899', 'その他': '#6B7280',
}

const STATUS_COLORS: Record<string, string> = {
  '下書き': 'rgba(75,85,99,0.4)', '承認待ち': 'rgba(161,98,7,0.4)',
  '予約済み': 'rgba(29,78,216,0.4)', '投稿済み': 'rgba(21,128,61,0.4)', '失敗': 'rgba(185,28,28,0.4)',
}

const STATUS_TEXT: Record<string, string> = {
  '下書き': '#9ca3af', '承認待ち': '#fbbf24', '予約済み': '#93c5fd', '投稿済み': '#86efac', '失敗': '#fca5a5',
}

const glassCard = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
}

interface PostCardProps {
  post: Post; onDelete?: (id: string) => void; onRefresh?: () => void
}

export default function PostCard({ post, onDelete, onRefresh }: PostCardProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [publishing, setPublishing] = useState(false)
  // Inline edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [editPlatform, setEditPlatform] = useState(post.platform || 'both')
  const [editNextSlot, setEditNextSlot] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [rewriting, setRewriting] = useState(false)
  const [showImprove, setShowImprove] = useState(false)
  const [improveVariants, setImproveVariants] = useState<string[]>([])
  const [improving, setImproving] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [savingVariant, setSavingVariant] = useState(false)
  const [platform, setPlatform] = useState(post.platform || 'both')
  const [updatingPlatform, setUpdatingPlatform] = useState(false)
  // Score (engagement prediction)
  const [score, setScore] = useState<{ score: number; predictedEngagement: number; feedback: string } | null>(null)
  const [scoring, setScoring] = useState(false)
  const [showScore, setShowScore] = useState(false)
  // Quality score (7-item)
  const [showQualityDetail, setShowQualityDetail] = useState(false)
  // isFavorite
  const [isFavorite, setIsFavorite] = useState(post.isFavorite ?? false)
  const [togglingFav, setTogglingFav] = useState(false)
  // A/B test
  const [showAB, setShowAB] = useState(false)
  const [abLoading, setAbLoading] = useState(false)
  const [abResult, setAbResult] = useState<{ groupId: string; postA: Post; postB: Post } | null>(null)

  const typeColor = POST_TYPE_COLORS[post.postType] || '#6B7280'
  const canSchedule = post.status === '下書き' || post.status === '承認待ち'

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

  const openEditModal = async () => {
    setEditContent(post.content)
    setEditPlatform(post.platform || 'both')
    if (post.scheduledAt) {
      const d = new Date(post.scheduledAt)
      const pad = (n: number) => n.toString().padStart(2, '0')
      setEditScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`)
      setEditNextSlot('')
    } else {
      try {
        const res = await fetch('/api/posts/next-slot')
        const data = await res.json()
        if (data.scheduledAt) {
          const d = new Date(data.scheduledAt)
          const pad = (n: number) => n.toString().padStart(2, '0')
          setEditScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`)
          setEditNextSlot(data.display || '')
        }
      } catch { /* ignore */ }
    }
    setShowEdit(true)
  }

  const applySlot = (hour: number) => {
    if (!editScheduledAt) {
      const d = new Date()
      d.setHours(hour, 0, 0, 0)
      if (d <= new Date()) d.setDate(d.getDate() + 1)
      const pad = (n: number) => n.toString().padStart(2, '0')
      setEditScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`)
    } else {
      const base = editScheduledAt.slice(0, 11)
      setEditScheduledAt(`${base}${String(hour).padStart(2, '0')}:00`)
    }
  }

  const handleRewrite = async () => {
    if (!rewriteInstruction.trim()) return
    setRewriting(true)
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, instruction: rewriteInstruction, postType: post.postType, formatType: post.formatType }),
      })
      const data = await res.json()
      if (data.result) { setEditContent(data.result); setRewriteInstruction('') }
    } finally { setRewriting(false) }
  }

  const handleEditSave = async () => {
    setEditSaving(true)
    try {
      await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null, platform: editPlatform }),
      })
      onRefresh?.()
      setShowEdit(false)
    } finally { setEditSaving(false) }
  }

  const togglePlatform = async () => {
    const next = platform === 'x' ? 'both' : 'x'
    setUpdatingPlatform(true)
    try {
      await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: next }),
      })
      setPlatform(next)
    } finally { setUpdatingPlatform(false) }
  }

  const handleImprove = async () => {
    setShowImprove(true)
    if (improveVariants.length > 0) return
    setImproving(true)
    try {
      const res = await fetch('/api/ai/improve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: post.content, postType: post.postType, formatType: post.formatType }),
      })
      const data = await res.json()
      setImproveVariants(data.variants || [])
    } finally { setImproving(false) }
  }

  const applyVariant = async (content: string) => {
    setSavingVariant(true)
    try {
      await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      onRefresh?.()
      setShowImprove(false)
    } finally { setSavingVariant(false) }
  }

  const handleScore = async () => {
    setShowScore(true)
    if (score) return
    setScoring(true)
    try {
      const res = await fetch('/api/ai/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: post.content, postType: post.postType, formatType: post.formatType }),
      })
      const data = await res.json()
      setScore(data)
    } finally { setScoring(false) }
  }

  const handleABTest = async () => {
    setShowAB(true)
    if (abResult) return
    setAbLoading(true)
    try {
      const res = await fetch('/api/ai/ab-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: post.content, postType: post.postType, scheduledAt: post.scheduledAt }),
      })
      const data = await res.json()
      setAbResult(data)
    } finally { setAbLoading(false) }
  }

  const toggleFavorite = async () => {
    setTogglingFav(true)
    try {
      await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      })
      setIsFavorite(!isFavorite)
    } finally { setTogglingFav(false) }
  }

  const handlePublishNow = async () => {
    if (!confirm('今すぐ投稿しますか？')) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!data.success && !data.partial) {
        alert(data.errors?.join('\n') || '投稿に失敗しました')
      } else {
        onRefresh?.()
      }
    } catch {
      alert('投稿エラーが発生しました')
    } finally {
      setPublishing(false)
    }
  }

  const scoreColor = !score ? '#6b7280'
    : score.score >= 80 ? '#10b981'
    : score.score >= 60 ? '#f97316'
    : '#ef4444'

  return (
    <>
      <div className="rounded-2xl p-4 transition-all hover:border-white/[0.14]" style={glassCard}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm px-2.5 py-1 rounded-full font-medium text-white" style={{ backgroundColor: typeColor }}>
              {post.postType}
            </span>
            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: STATUS_COLORS[post.status] || 'rgba(75,85,99,0.4)', color: STATUS_TEXT[post.status] || '#9ca3af' }}>
              {post.status}
            </span>
            {post.abVariant && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(6,182,212,0.2)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)' }}>
                A/B {post.abVariant}
              </span>
            )}
            {post.qualityScore != null && (
              <button
                onClick={() => setShowQualityDetail(v => !v)}
                className="text-xs px-2 py-0.5 rounded-full font-bold transition-opacity hover:opacity-80"
                style={{
                  background: post.qualityScore >= 8.5 ? 'rgba(16,185,129,0.2)' : post.qualityScore >= 7.0 ? 'rgba(249,115,22,0.2)' : 'rgba(239,68,68,0.2)',
                  color: post.qualityScore >= 8.5 ? '#6ee7b7' : post.qualityScore >= 7.0 ? '#fb923c' : '#fca5a5',
                  border: `1px solid ${post.qualityScore >= 8.5 ? 'rgba(16,185,129,0.3)' : post.qualityScore >= 7.0 ? 'rgba(249,115,22,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}
                title="品質スコアの詳細を見る"
              >
                ⭐ {post.qualityScore.toFixed(1)}
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">{formatDate(post.createdAt)}</span>
        </div>

        {/* Quality score detail panel */}
        {showQualityDetail && post.qualityScore != null && (
          <div className="mb-3 rounded-xl p-3 text-xs" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium">品質スコア詳細</span>
              <span className="font-bold" style={{ color: post.qualityScore >= 8.5 ? '#6ee7b7' : post.qualityScore >= 7.0 ? '#fb923c' : '#fca5a5' }}>
                平均 {post.qualityScore.toFixed(1)} / 10
              </span>
            </div>
            {post.qualityDetail && (() => {
              try {
                const d = JSON.parse(post.qualityDetail)
                const labels: Record<string, string> = {
                  naturalness: '自然さ', specificity: '具体性', empathy: '感情移入',
                  persona: 'ペルソナ', tempo: 'テンポ', experience: '体験語り', authenticity: '業者臭のなさ',
                }
                return (
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {Object.entries(d).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-1">
                        <span className="text-slate-400">{labels[k] || k}</span>
                        <span className="font-medium" style={{ color: (v as number) >= 8 ? '#6ee7b7' : (v as number) >= 6 ? '#fb923c' : '#fca5a5' }}>
                          {v as number}/10
                        </span>
                      </div>
                    ))}
                  </div>
                )
              } catch { return null }
            })()}
            {post.qualityFeedback && (
              <p className="text-slate-400 italic border-t border-white/5 pt-2 mt-1">{post.qualityFeedback}</p>
            )}
          </div>
        )}

        {/* Content */}
        <p className="text-sm text-slate-200 whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>

        {/* Stats */}
        {post.status === '投稿済み' && (
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center gap-3 text-sm text-slate-400 flex-wrap">
              <span className="text-blue-400 font-medium text-xs" title="X (Twitter)">𝕏</span>
              <span>👀 {post.impressions.toLocaleString()}</span>
              <span>❤️ {post.likes.toLocaleString()}</span>
              <span>🔁 {post.retweets.toLocaleString()}</span>
              <span>💬 {post.replies.toLocaleString()}</span>
              <span>🔖 {post.bookmarks.toLocaleString()}</span>
            </div>
            {(post.threadsImp || 0) > 0 && (
              <div className="flex items-center gap-3 text-sm text-slate-400 flex-wrap">
                <span className="text-purple-400 font-medium text-xs" title="Threads">🧵</span>
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
          <div className="text-sm text-blue-400 mb-3">⏰ 予約: {formatDate(post.scheduledAt)}</div>
        )}

        {/* Platform toggle */}
        {canSchedule && (
          <div className="flex items-center gap-2 mb-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-sm text-slate-400">Threadsにも投稿</span>
            <button
              onClick={togglePlatform}
              disabled={updatingPlatform}
              className={`relative w-10 h-5 rounded-full transition-colors ${platform === 'both' ? 'bg-purple-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${platform === 'both' ? 'translate-x-5' : ''}`} />
            </button>
            <span className={`text-sm ${platform === 'both' ? 'text-purple-400' : 'text-slate-500'}`}>
              {platform === 'both' ? 'ON' : 'OFF'}
            </span>
          </div>
        )}

        {/* Score display */}
        {showScore && score && (
          <div className="mb-3 rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold" style={{ color: scoreColor }}>スコア {score.score}</span>
                <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: `${score.score}%`, backgroundColor: scoreColor }} />
                </div>
              </div>
              <span className="text-sm text-slate-400">予測EG: {score.predictedEngagement.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-slate-400">{score.feedback}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={openEditModal} className="text-sm px-3 py-1.5 rounded-xl text-slate-300 hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
            編集
          </button>
          {canSchedule && (
            <button onClick={() => setShowScheduleModal(true)} className="text-sm px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl transition-all shadow-sm shadow-orange-500/20">
              スケジュール設定
            </button>
          )}
          {post.status === '予約済み' && (
            <button
              onClick={handlePublishNow}
              disabled={publishing}
              className="text-sm px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' }}
            >
              {publishing ? '投稿中...' : '🚀 今すぐ投稿'}
            </button>
          )}
          <button onClick={handleImprove} className="text-sm px-3 py-1.5 rounded-xl text-purple-300 hover:text-purple-200 transition-all" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
            ✨ AI改善
          </button>
          {canSchedule && (
            <button onClick={handleScore} className="text-sm px-3 py-1.5 rounded-xl transition-all" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.22)', color: '#67e8f9' }}>
              🎯 スコア診断
            </button>
          )}
          {canSchedule && (
            <button onClick={handleABTest} className="text-sm px-3 py-1.5 rounded-xl transition-all" style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.22)', color: '#fde047' }}>
              🆎 A/Bテスト
            </button>
          )}
          <button
            onClick={toggleFavorite}
            disabled={togglingFav}
            className="text-sm px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
            style={{
              background: isFavorite ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.06)',
              border: isFavorite ? '1px solid rgba(234,179,8,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: isFavorite ? '#fde047' : '#6b7280',
            }}
            title={isFavorite ? 'お気に入り解除' : 'お気に入りにマーク（次の生成に活用）'}
          >
            {isFavorite ? '👍 良い投稿' : '👍'}
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(post.id)}
              className="text-sm px-3 py-1.5 rounded-xl ml-auto transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
            >
              削除
            </button>
          )}
        </div>
      </div>

      {/* Inline Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEdit(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'rgba(8,9,18,0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">✏️ 投稿を編集</h3>
              <button onClick={() => setShowEdit(false)} className="text-slate-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.07)' }}>✕</button>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full text-white mb-4 inline-block" style={{ backgroundColor: typeColor }}>{post.postType}</span>

            {/* Content */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1.5">投稿内容</label>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={8}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-slate-200 resize-none focus:outline-none leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              <p className="text-right text-xs text-slate-500 mt-0.5">{editContent.length}文字</p>
            </div>

            {/* Schedule */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1.5">
                📅 投稿日時
                {editNextSlot && <span className="text-green-400 ml-2">💡 次の空き: {editNextSlot}</span>}
              </label>
              <div className="flex gap-2 mb-2">
                {[{h: 7, icon: '🌅', label: '朝7時'}, {h: 12, icon: '🌞', label: '昼12時'}, {h: 21, icon: '🌙', label: '夜21時'}].map(s => (
                  <button key={s.h} onClick={() => applySlot(s.h)}
                    className="flex-1 py-1.5 rounded-lg text-xs transition-all"
                    style={editScheduledAt.includes(`T${String(s.h).padStart(2, '0')}`)
                      ? { background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', color: '#fb923c' }
                      : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }
                    }
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
              <input
                type="datetime-local"
                value={editScheduledAt}
                onChange={e => setEditScheduledAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
            </div>

            {/* Platform */}
            <div className="mb-5">
              <label className="block text-xs text-slate-400 mb-1.5">投稿先</label>
              <div className="flex gap-2">
                {([['both', '𝕏 + 🧵 両方'], ['x', '𝕏 Xのみ']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setEditPlatform(val)}
                    className="flex-1 py-2 rounded-lg text-xs transition-all"
                    style={editPlatform === val
                      ? { background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', color: '#fb923c' }
                      : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Rewrite */}
            <div className="mb-5 rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
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
              <button onClick={() => setShowEdit(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-300 transition-all" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                キャンセル
              </button>
              <button onClick={handleEditSave} disabled={editSaving || !editContent} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all">
                {editSaving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal postId={post.id} postType={post.postType} defaultScheduledAt={post.scheduledAt}
          onClose={() => setShowScheduleModal(false)} onScheduled={() => onRefresh?.()} />
      )}

      {/* AI Improve Modal */}
      {showImprove && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowImprove(false)}>
          <div className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(8,9,18,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">✨ AI改善提案</h3>
            <p className="text-sm text-slate-400 mb-4">採用したいバリアントを選んで「適用する」を押してください</p>
            {improving ? (
              <div className="text-center py-8 text-slate-400">AIが改善中...</div>
            ) : (
              <div className="space-y-4">
                {improveVariants.map((v, i) => (
                  <div key={i} className={`rounded-xl p-4 cursor-pointer transition-all ${selectedVariant === v ? 'border-purple-500' : 'hover:border-white/20'}`}
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${selectedVariant === v ? '#8b5cf6' : 'rgba(255,255,255,0.08)'}` }}
                    onClick={() => setSelectedVariant(v)}>
                    <p className="text-sm text-purple-400 font-bold mb-2">バリアント {i + 1}</p>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{v}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowImprove(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-300" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                閉じる
              </button>
              {selectedVariant && (
                <button onClick={() => applyVariant(selectedVariant)} disabled={savingVariant} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
                  {savingVariant ? '適用中...' : '✅ 適用する'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* A/B Test Modal */}
      {showAB && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAB(false)}>
          <div className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(8,9,18,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">🆎 A/Bテスト生成</h3>
            <p className="text-sm text-slate-400 mb-4">2つのバリアントを自動生成して承認待ちキューに追加します</p>
            {abLoading ? (
              <div className="text-center py-8 text-slate-400">AIがバリアントを生成中...</div>
            ) : abResult ? (
              <div className="space-y-4">
                {[{ label: 'A — フック強化型', content: abResult.postA.content }, { label: 'B — 共感訴求型', content: abResult.postB.content }].map((v, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-sm font-bold mb-2" style={{ color: i === 0 ? '#67e8f9' : '#86efac' }}>{v.label}</p>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{v.content}</p>
                  </div>
                ))}
                <div className="rounded-xl p-3" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
                  <p className="text-sm text-yellow-300">✅ 承認待ちキューに追加されました。投稿後のエンゲージメントを比較してください。</p>
                  <p className="text-xs text-slate-500 mt-1">グループID: {abResult.groupId.slice(0, 8)}...</p>
                </div>
              </div>
            ) : null}
            <button onClick={() => setShowAB(false)} className="w-full mt-4 py-2.5 rounded-xl text-sm text-slate-300" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}

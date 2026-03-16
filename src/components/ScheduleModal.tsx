'use client'

import { useState } from 'react'

interface ScheduleModalProps {
  postId: string
  postType: string
  defaultScheduledAt?: string | null
  onClose: () => void
  onScheduled: () => void
}

const OPTIMAL_HOURS: Record<string, number> = {
  'コンビニまとめ型': 21,
  '数値比較型': 12,
  '地雷暴露型': 20,
  'プロセス共有型': 7,
  'あるある共感型': 22,
  'チェックリスト保存型': 21,
  'Instagram連携型': 18,
  'その他': 12,
}

const OPTIMAL_REASONS: Record<string, string> = {
  'コンビニまとめ型': '21時 — 夕食後のリラックスタイム、保存率が高い',
  '数値比較型': '12時 — ランチタイム、情報収集が活発',
  '地雷暴露型': '20時 — 帰宅後の時間、エンゲージメントが高い',
  'プロセス共有型': '7時 — 朝の通勤時間、情報感度が高い',
  'あるある共感型': '22時 — 就寝前のSNSタイム、共感いいねが多い',
  'チェックリスト保存型': '21時 — 夕食後、ブックマーク率が最高',
  'Instagram連携型': '18時 — ゴールデンアワー、エンゲージメント最大',
  'その他': '12時 — ランチタイム推奨',
}

function getOptimalDateTime(postType: string, existingScheduledAt?: string | null): string {
  if (existingScheduledAt) {
    return new Date(existingScheduledAt).toISOString().slice(0, 16)
  }
  const hour = OPTIMAL_HOURS[postType] || 12
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(hour, 0, 0, 0)
  // Format as JST-aware local string for datetime-local input
  const offset = tomorrow.getTimezoneOffset() * 60000
  return new Date(tomorrow.getTime() - offset).toISOString().slice(0, 16)
}

export default function ScheduleModal({
  postId,
  postType,
  defaultScheduledAt,
  onClose,
  onScheduled,
}: ScheduleModalProps) {
  const [dateTime, setDateTime] = useState(getOptimalDateTime(postType, defaultScheduledAt))
  const [loading, setLoading] = useState(false)
  const reason = OPTIMAL_REASONS[postType] || OPTIMAL_REASONS['その他']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '予約済み', scheduledAt: new Date(dateTime).toISOString() }),
      })
      if (res.ok) {
        onScheduled()
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white mb-1">⏰ 投稿スケジュール設定</h3>
        <p className="text-xs text-gray-400 mb-4">AIが最適な投稿日時を自動提案しています</p>

        <div className="bg-gray-900 rounded-lg p-3 mb-4 border border-gray-700">
          <p className="text-xs text-orange-400 font-medium mb-1">推奨理由</p>
          <p className="text-xs text-gray-300">{reason}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">投稿日時</label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={e => setDateTime(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {loading ? '予約中...' : '予約する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

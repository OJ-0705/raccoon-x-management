'use client'

import { useState, useEffect } from 'react'
import PostPreview from './PostPreview'
import { useRouter } from 'next/navigation'

interface PostEditorProps {
  initialData?: {
    id?: string
    content?: string
    postType?: string
    formatType?: string
    status?: string
    scheduledAt?: string | null
    hashtags?: string | null
  }
  mode?: 'create' | 'edit'
}

const POST_TYPES = [
  'コンビニまとめ型',
  '数値比較型',
  '地雷暴露型',
  'プロセス共有型',
  'あるある共感型',
  'チェックリスト保存型',
  'Instagram連携型',
  'その他',
]

const FORMAT_TYPES = ['テキスト', '画像付き', 'スレッド', '引用RT', 'リプライ']
const STATUSES = ['下書き', '承認待ち', '予約済み']

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

interface Template {
  id: string
  name: string
  postType: string
  templateContent: string
}

export default function PostEditor({ initialData, mode = 'create' }: PostEditorProps) {
  const router = useRouter()
  const [content, setContent] = useState(initialData?.content || '')
  const [postType, setPostType] = useState(initialData?.postType || 'コンビニまとめ型')
  const [formatType, setFormatType] = useState(initialData?.formatType || 'テキスト')
  const [status, setStatus] = useState(initialData?.status || '下書き')
  const [scheduledAt, setScheduledAt] = useState(initialData?.scheduledAt || '')
  const [hashtags, setHashtags] = useState<string[]>(() => {
    if (initialData?.hashtags) {
      try { return JSON.parse(initialData.hashtags) } catch { return [] }
    }
    return []
  })
  const [hashtagInput, setHashtagInput] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/templates').then(r => r.json()),
      fetch('/api/keywords').then(r => r.json()),
    ]).then(([tmpl, kw]) => {
      setTemplates(tmpl)
      setKeywords(kw.map((k: { keyword: string }) => k.keyword))
    })
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postType, keywords, additionalContext: '' }),
      })
      const data = await res.json()
      if (data.content) {
        setContent(data.content)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setGenerating(false)
    }
  }

  const handleTemplateSelect = (tmpl: Template) => {
    setContent(tmpl.templateContent)
    setPostType(tmpl.postType)
  }

  const handleAddHashtag = () => {
    const tag = hashtagInput.replace('#', '').trim()
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag])
      setHashtagInput('')
    }
  }

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter(h => h !== tag))
  }

  const handleSave = async (targetStatus?: string) => {
    setSaving(true)
    const saveStatus = targetStatus || status
    try {
      const body = {
        content,
        postType,
        formatType,
        status: saveStatus,
        scheduledAt: scheduledAt || null,
        hashtags: hashtags.length ? hashtags : null,
      }

      let res
      if (mode === 'edit' && initialData?.id) {
        res = await fetch(`/api/posts/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        router.push('/posts')
        router.refresh()
      } else {
        alert('保存に失敗しました')
      }
    } catch (error) {
      console.error(error)
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const charCount = content.length
  const isOverLimit = charCount > 140

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Editor */}
      <div className="space-y-5">
        {/* Post Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">投稿タイプ</label>
          <div className="grid grid-cols-2 gap-2">
            {POST_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setPostType(type)}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border ${
                  postType === type
                    ? 'text-white border-transparent'
                    : 'text-gray-400 border-gray-700 bg-gray-800 hover:border-gray-500'
                }`}
                style={postType === type ? { backgroundColor: POST_TYPE_COLORS[type], borderColor: POST_TYPE_COLORS[type] } : {}}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Format Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">フォーマット</label>
          <div className="flex gap-2 flex-wrap">
            {FORMAT_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setFormatType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                  formatType === type
                    ? 'bg-gray-600 text-white border-gray-500'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Templates */}
        {templates.filter(t => t.postType === postType).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">テンプレート</label>
            <div className="space-y-2">
              {templates.filter(t => t.postType === postType).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateSelect(t)}
                  className="w-full text-left px-3 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  📋 {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Generate */}
        <div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {generating ? (
              <>⏳ AI生成中...</>
            ) : (
              <>🤖 AIで投稿文を生成</>
            )}
          </button>
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">投稿内容</label>
            <span className={`text-xs font-mono ${isOverLimit ? 'text-red-400' : charCount > 120 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {charCount}/140
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-600 focus:border-orange-500 rounded-xl text-gray-200 text-sm resize-none focus:outline-none transition-colors leading-relaxed"
            placeholder="投稿内容を入力してください..."
          />
          {isOverLimit && (
            <p className="text-xs text-red-400 mt-1">140文字を超えています（{charCount - 140}文字オーバー）</p>
          )}
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">ハッシュタグ</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddHashtag()}
              placeholder="#タグを入力"
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleAddHashtag}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
            >
              追加
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {hashtags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/50 text-blue-300 rounded-full text-xs border border-blue-800"
              >
                #{tag}
                <button onClick={() => handleRemoveHashtag(tag)} className="hover:text-red-400">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Status & Schedule */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-orange-500"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">予約日時</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleSave('下書き')}
            disabled={saving || !content}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded-xl text-sm font-medium transition-colors"
          >
            下書き保存
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving || !content}
            className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
          >
            {saving ? '保存中...' : mode === 'edit' ? '更新する' : '保存する'}
          </button>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="lg:sticky lg:top-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">プレビュー</h3>
        <PostPreview content={content} postType={postType} />
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import PostPreview from './PostPreview'
import { useRouter } from 'next/navigation'
import { resizeImage, GIF_SIZE_LIMIT } from '@/lib/resizeImage'

interface PostEditorProps {
  initialData?: {
    id?: string
    content?: string
    postType?: string
    formatType?: string
    status?: string
    scheduledAt?: string | null
    hashtags?: string | null
    imageUrls?: string | null
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

const FORMAT_TYPES = ['テキスト', '画像付き', 'スレッド', '引用RT', 'リプライ', '長文投稿']

// X Premium: all plans allow up to 25,000 chars. 140 is only the timeline preview cutoff.
const HARD_LIMIT = 25000
const RECOMMENDED_MIN = 300
const RECOMMENDED_MAX = 500
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
  const [platform, setPlatform] = useState<'both' | 'x'>('both')
  const [templates, setTemplates] = useState<Template[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [mediaUrls, setMediaUrls] = useState<string[]>(() => {
    if (initialData?.imageUrls) {
      try { return JSON.parse(initialData.imageUrls) } catch { return [] }
    }
    return []
  })
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        body: JSON.stringify({ postType, formatType, keywords, additionalContext: '' }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else if (data.content) {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const remaining = 4 - mediaUrls.length
    const filesToUpload = Array.from(files).slice(0, remaining)
    setUploading(true)
    for (const file of filesToUpload) {
      let uploadBlob: Blob = file
      if (file.type === 'image/gif') {
        if (file.size > GIF_SIZE_LIMIT) {
          alert('GIFファイルのサイズが大きすぎます（4.5MB以下にしてください）')
          continue
        }
      } else {
        const resized = await resizeImage(file)
        if (resized) uploadBlob = resized
      }
      const formData = new FormData()
      formData.append('file', uploadBlob, 'image.jpg')
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.url) {
          setMediaUrls(prev => [...prev, data.url])
        } else {
          alert(data.error || 'アップロードに失敗しました')
        }
      } catch {
        alert('アップロードに失敗しました')
      }
    }
    setUploading(false)
    e.target.value = ''
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
        platform,
        imageUrls: mediaUrls.length ? mediaUrls : null,
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
  const isOverLimit = charCount > HARD_LIMIT
  const inRecommended = charCount >= RECOMMENDED_MIN && charCount <= RECOMMENDED_MAX
  const isLongForm = formatType === '長文投稿'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Editor */}
      <div className="space-y-5">
        {/* Post Type */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">投稿タイプ</label>
          <div className="grid grid-cols-2 gap-2">
            {POST_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setPostType(type)}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border ${
                  postType === type
                    ? 'text-white border-transparent'
                    : 'text-slate-400'
                }`}
                style={postType === type
                  ? { backgroundColor: POST_TYPE_COLORS[type], borderColor: POST_TYPE_COLORS[type] }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Format Type */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">フォーマット</label>
          <div className="flex gap-2 flex-wrap">
            {FORMAT_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setFormatType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                  formatType === type
                    ? 'text-white border-transparent'
                    : 'text-slate-400 border-transparent'
                }`}
                style={formatType === type
                  ? { background: 'rgba(255,255,255,0.12)' }
                  : { background: 'rgba(255,255,255,0.04)' }
                }
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Templates */}
        {templates.filter(t => t.postType === postType).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">テンプレート</label>
            <div className="space-y-2">
              {templates.filter(t => t.postType === postType).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateSelect(t)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs text-slate-300 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
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
            <label className="text-sm font-medium text-slate-300">投稿内容</label>
            <span className={`text-xs font-mono ${
              isOverLimit ? 'text-red-400'
              : (inRecommended || charCount > RECOMMENDED_MAX) ? 'text-green-400'
              : charCount === 140 ? 'text-blue-400'
              : charCount > 140 ? 'text-yellow-400'
              : 'text-slate-400'
            }`}>
              {charCount.toLocaleString()} / 25,000
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={isLongForm ? 20 : 10}
            className="w-full px-4 py-3 rounded-xl text-slate-200 text-sm resize-none focus:outline-none focus:border-orange-500/50 transition-colors leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            placeholder={isLongForm ? '長文投稿（最大25,000文字）を入力してください...' : '投稿内容を入力してください...'}
          />

          {/* Char range indicators — per spec color table */}
          <div className="mt-2 space-y-1">
            {charCount === 0 && (
              <p className="text-xs text-slate-500">📱 タイムライン表示範囲: 0〜139文字</p>
            )}
            {charCount > 0 && charCount < 140 && (
              <p className="text-xs text-slate-400">
                📱 タイムライン表示範囲 — あと<span className="text-white font-medium">{140 - charCount}</span>文字で「さらに表示」ライン
              </p>
            )}
            {charCount === 140 && (
              <p className="text-xs text-blue-400">📱 ここから先は「さらに表示」で表示されます</p>
            )}
            {charCount > 140 && charCount < RECOMMENDED_MIN && (
              <p className="text-xs text-yellow-400">もう少し詳しく書くとGood！（あと{RECOMMENDED_MIN - charCount}文字で推奨範囲）</p>
            )}
            {inRecommended && (
              <p className="text-xs text-green-400">✅ 推奨範囲内！エンゲージメント期待大（300〜500文字）</p>
            )}
            {charCount > RECOMMENDED_MAX && !isOverLimit && (
              <p className="text-xs text-green-400">📝 長文OK！記事型投稿として効果的（最大25,000文字）</p>
            )}
            {isOverLimit && (
              <p className="text-xs text-red-400">25,000文字を超えています（{(charCount - HARD_LIMIT).toLocaleString()}文字オーバー）</p>
            )}
          </div>
        </div>

        {/* Media Attachment */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">画像/動画</label>
            <span className="text-xs text-slate-500">残り{4 - mediaUrls.length}枚</span>
          </div>

          {mediaUrls.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                  {/\.(mp4|mov|webm)(\?|$)/i.test(url) ? (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <span className="text-2xl">🎬</span>
                    </div>
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => setMediaUrls(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold text-white transition-colors"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={mediaUrls.length >= 4 || uploading}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            {uploading ? '⏳ アップロード中...' : `📷 画像/動画を追加（残り${4 - mediaUrls.length}枚）`}
          </button>
          <p className="text-xs text-slate-600 mt-1">JPEG / PNG / GIF / WebP / MP4 · 画像5MB以内 · 動画512MB以内</p>
        </div>

        {/* Engagement guidance — per spec */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <h4 className="text-xs font-bold text-orange-300">💡 エンゲージメントを高める投稿のコツ</h4>
          <div className="text-xs text-slate-300 space-y-1.5">
            <p className="font-medium text-white">【冒頭140文字が勝負】</p>
            <p className="text-slate-400">タイムラインには最初の140文字しか表示されません。「続きが気になる！」と思わせるフックを冒頭に入れましょう。</p>
          </div>
          <div className="text-xs text-slate-300 space-y-1.5">
            <p className="font-medium text-white">【推奨文字数: <span className="text-green-300">300〜500文字</span>】</p>
            <p className="text-slate-400">長文投稿は「詳細クリック」を促し、アルゴリズム評価がUPします。商品レビューや感想は、詳細まで書いた方が読者に響きます。</p>
          </div>
          <div className="text-xs space-y-1">
            <p className="font-medium text-white">【投稿構成の黄金パターン】</p>
            <p className="text-slate-400">① <span className="text-slate-200">冒頭（1〜140文字）</span>: 結論・驚き・問いかけでフック</p>
            <p className="text-slate-400">② <span className="text-slate-200">本文（141〜400文字）</span>: 詳細レビュー・データ・感想</p>
            <p className="text-slate-400">③ <span className="text-slate-200">締め（最後の数行）</span>: CTA、ハッシュタグ、次回予告</p>
          </div>
          <div className="text-xs">
            <p className="font-medium text-white">【ベストな投稿時間】</p>
            <p className="text-slate-400 mt-0.5">🌅 朝7時 / 🌞 昼12時 / 🌙 夜21時 が反応の良い時間帯です</p>
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">ハッシュタグ</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddHashtag()}
              placeholder="#タグを入力"
              className="flex-1 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            <button
              onClick={handleAddHashtag}
              className="px-3 py-2 text-slate-300 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.08)' }}
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

        {/* Platform */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">投稿先プラットフォーム</label>
          <div className="flex gap-2">
            {([['both', '𝕏 + 🧵 XとThreads両方'], ['x', '𝕏 Xのみ']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setPlatform(val)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={platform === val
                  ? { background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', color: '#fb923c' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status & Schedule */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">予約日時</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleSave('下書き')}
            disabled={saving || !content}
            className="flex-1 py-3 disabled:opacity-50 text-slate-200 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            下書き保存
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving || !content}
            className="flex-1 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
          >
            {saving ? '保存中...' : mode === 'edit' ? '更新する' : '保存する'}
          </button>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="lg:sticky lg:top-6">
        <h3 className="text-sm font-medium text-slate-400 mb-3">プレビュー</h3>
        <PostPreview content={content} postType={postType} />
      </div>
    </div>
  )
}

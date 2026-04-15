'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ImportPost {
  content: string
  postType: string
  scheduledAt: string
  postToX: boolean
  postToThreads: boolean
  source?: string
  // edit state
  _content: string
  _postType: string
  _scheduledAt: string
  _postToX: boolean
  _postToThreads: boolean
  _warn?: string
}

const glassCard = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const POST_TYPES = [
  'コンビニまとめ型', '数値比較型', '地雷暴露型', 'プロセス共有型',
  'あるある共感型', 'チェックリスト保存型', 'Instagram連携型', 'その他',
  '体験談型', '知識共有型', 'お酒おつまみ型', 'ビジョン共有型', '共感励まし型',
]

function formatJST(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

function isPastDate(isoString: string): boolean {
  try {
    return new Date(isoString) < new Date()
  } catch {
    return false
  }
}

export default function ImportPage() {
  const router = useRouter()
  const [jsonText, setJsonText] = useState('')
  const [posts, setPosts] = useState<ImportPost[]>([])
  const [parseError, setParseError] = useState('')
  const [parsed, setParsed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors?: string[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseJSON = useCallback((text: string) => {
    setParseError('')
    try {
      const raw = JSON.parse(text)
      let postsArray: Record<string, unknown>[]
      if (Array.isArray(raw)) {
        postsArray = raw as Record<string, unknown>[]
      } else if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).posts)) {
        postsArray = (raw as Record<string, unknown>).posts as Record<string, unknown>[]
      } else {
        setParseError('JSONはpostsフィールドを持つオブジェクトか配列である必要があります')
        return
      }
      const items: ImportPost[] = postsArray.map((item: Record<string, unknown>, i: number) => {
        const warns: string[] = []
        if (!item.content || !(item.content as string).trim()) warns.push('contentが空です')
        if (!item.postToX && !item.postToThreads) warns.push('postToX・postToThreadsが両方falseです')
        if (item.scheduledAt && isPastDate(item.scheduledAt as string)) warns.push('過去日時のため「下書き」で登録されます')
        // 必要なフィールドのみ抽出（id/draft_no等の余分フィールドは無視）
        return {
          content: (item.content as string) || '',
          postType: (item.postType as string) || 'その他',
          scheduledAt: (item.scheduledAt as string) || '',
          postToX: item.postToX !== false,
          postToThreads: item.postToThreads !== false,
          source: (item.source as string) || undefined,
          _content: (item.content as string) || '',
          _postType: (item.postType as string) || 'その他',
          _scheduledAt: (item.scheduledAt as string) || '',
          _postToX: item.postToX !== false,
          _postToThreads: item.postToThreads !== false,
          _warn: warns.length ? warns.join(' / ') : undefined,
          _index: i,
        } as ImportPost
      })
      setPosts(items)
      setParsed(true)
    } catch (e) {
      setParseError(`JSONのパースに失敗しました: ${String(e)}`)
    }
  }, [])

  const handleFileLoad = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setJsonText(text)
      parseJSON(text)
    }
    reader.readAsText(file)
  }, [parseJSON])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileLoad(file)
  }, [handleFileLoad])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileLoad(file)
    e.target.value = ''
  }

  const updatePost = (index: number, field: keyof ImportPost, value: string | boolean) => {
    setPosts(prev => prev.map((p, i) => {
      if (i !== index) return p
      const updated = { ...p, [field]: value }
      const warns: string[] = []
      if (!updated._content.trim()) warns.push('contentが空です')
      if (!updated._postToX && !updated._postToThreads) warns.push('postToX・postToThreadsが両方falseです')
      if (updated._scheduledAt && isPastDate(updated._scheduledAt)) warns.push('過去日時のため「下書き」で登録されます')
      updated._warn = warns.length ? warns.join(' / ') : undefined
      return updated
    }))
  }

  const handleImport = async () => {
    const validPosts = posts.filter(p => p._content.trim())
    if (validPosts.length === 0) {
      alert('登録できる投稿がありません')
      return
    }

    setImporting(true)
    try {
      const payload = validPosts.map(p => ({
        content: p._content,
        postType: p._postType,
        scheduledAt: p._scheduledAt,
        postToX: p._postToX,
        postToThreads: p._postToThreads,
        source: p.source || 'xmcp-dashboard',
      }))

      const res = await fetch('/api/posts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        setImportResult(data)
      } else {
        alert(`エラー: ${data.error}`)
      }
    } catch (e) {
      alert(`エラー: ${String(e)}`)
    } finally {
      setImporting(false)
    }
  }

  // After successful import
  if (importResult) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">インポート完了</h1>
        <div className="rounded-2xl p-6 space-y-3" style={glassCard}>
          <p className="text-green-400 text-lg font-bold">✅ 登録完了</p>
          <div className="space-y-1 text-sm text-slate-300">
            <p>登録成功: <span className="text-white font-bold">{importResult.inserted}件</span></p>
            {importResult.skipped > 0 && <p>スキップ: <span className="text-yellow-400">{importResult.skipped}件</span></p>}
          </div>
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {importResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">{e}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => router.push('/posts?status=予約済み')}
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-bold transition-colors"
          >
            投稿管理画面で確認 →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">JSONインポート</h1>
        <p className="text-slate-400 text-sm mt-1">XMCPダッシュボードが出力したexport_posts.jsonを一括登録します</p>
      </div>

      {!parsed ? (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl p-10 text-center cursor-pointer transition-all"
            style={{
              background: dragOver ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)',
              border: `2px dashed ${dragOver ? 'rgba(249,115,22,0.6)' : 'rgba(255,255,255,0.15)'}`,
            }}
          >
            <div className="text-4xl mb-3">📁</div>
            <p className="text-slate-300 text-sm font-medium">JSONファイルをドロップ</p>
            <p className="text-slate-500 text-xs mt-1">またはクリックしてファイルを選択</p>
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileInput} />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <span className="text-xs text-slate-500">または直接ペースト</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Text paste area */}
          <div>
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 rounded-xl text-slate-200 text-sm font-mono resize-none focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              placeholder={'// 配列形式\n[\n  {\n    "content": "投稿本文",\n    "postType": "数値比較型",\n    "scheduledAt": "2026-04-13T21:00:00+09:00",\n    "postToX": true,\n    "postToThreads": true\n  }\n]\n\n// またはXMCPダッシュボード出力形式\n{\n  "exported_at": "...",\n  "posts": [ ... ]\n}'}
            />
          </div>

          {parseError && (
            <div className="rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              ❌ {parseError}
            </div>
          )}

          <button
            onClick={() => parseJSON(jsonText)}
            disabled={!jsonText.trim()}
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors"
          >
            JSONを解析してプレビュー →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">
              <span className="text-white font-bold">{posts.length}件</span>の投稿を検出
              {posts.filter(p => !p._content.trim()).length > 0 && (
                <span className="text-yellow-400 ml-2">（{posts.filter(p => !p._content.trim()).length}件スキップ）</span>
              )}
            </p>
            <button
              onClick={() => { setParsed(false); setPosts([]); setJsonText('') }}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              ← やり直す
            </button>
          </div>

          {/* Post list */}
          <div className="space-y-3">
            {posts.map((post, i) => (
              <div key={i} className="rounded-2xl p-4 space-y-3" style={glassCard}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                  {post._warn && (
                    <span className="text-xs text-yellow-400 rounded-lg px-2 py-0.5" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}>
                      ⚠️ {post._warn}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">投稿文</label>
                  <textarea
                    value={post._content}
                    onChange={e => updatePost(i, '_content', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl text-slate-200 text-sm resize-none focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Post type */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">投稿タイプ</label>
                    <select
                      value={post._postType}
                      onChange={e => updatePost(i, '_postType', e.target.value)}
                      className="w-full px-2 py-2 rounded-xl text-sm text-slate-200 focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                    >
                      {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Scheduled date */}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">予定日時 (JST)</label>
                    <div className="px-2 py-2 rounded-xl text-sm text-slate-300" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {post._scheduledAt ? formatJST(post._scheduledAt) : '—'}
                    </div>
                  </div>
                </div>

                {/* Platform toggles */}
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={post._postToX}
                      onChange={e => updatePost(i, '_postToX', e.target.checked)}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm text-slate-300">𝕏 X</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={post._postToThreads}
                      onChange={e => updatePost(i, '_postToThreads', e.target.checked)}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className="text-sm text-slate-300">🧵 Threads</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Import button */}
          <div className="sticky bottom-4 pt-2">
            <button
              onClick={handleImport}
              disabled={importing || posts.filter(p => p._content.trim()).length === 0}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white rounded-2xl text-base font-bold transition-colors shadow-2xl shadow-orange-500/30"
            >
              {importing ? '⏳ 登録中...' : `📥 ${posts.filter(p => p._content.trim()).length}件を一括登録`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

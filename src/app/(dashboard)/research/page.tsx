'use client'

import { useEffect, useState } from 'react'

interface Competitor {
  id: string
  username: string
  displayName?: string | null
  createdAt: string
}

interface Keyword {
  id: string
  keyword: string
  createdAt: string
}

interface BuzzPattern {
  id: string
  sourceUrl?: string | null
  sourceText: string
  hookType: string
  structure: string
  analysis: string
  createdAt: string
}

export default function ResearchPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [newCompetitor, setNewCompetitor] = useState({ username: '', displayName: '' })
  const [newKeyword, setNewKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  // BuzzPattern state
  const [buzzPatterns, setBuzzPatterns] = useState<BuzzPattern[]>([])
  const [newBuzzText, setNewBuzzText] = useState('')
  const [newBuzzUrl, setNewBuzzUrl] = useState('')
  const [addingBuzz, setAddingBuzz] = useState(false)
  const [buzzError, setBuzzError] = useState('')
  const [expandedBuzz, setExpandedBuzz] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [compRes, kwRes, buzzRes] = await Promise.all([
        fetch('/api/competitors').then(r => r.json()),
        fetch('/api/keywords').then(r => r.json()),
        fetch('/api/buzz-patterns').then(r => r.json()),
      ])
      setCompetitors(compRes)
      setKeywords(kwRes)
      setBuzzPatterns(buzzRes.patterns || [])
    } finally {
      setLoading(false)
    }
  }

  const handleAddBuzzPattern = async () => {
    if (!newBuzzText.trim()) return
    setAddingBuzz(true)
    setBuzzError('')
    try {
      const res = await fetch('/api/buzz-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText: newBuzzText, sourceUrl: newBuzzUrl || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewBuzzText('')
        setNewBuzzUrl('')
        fetchData()
      } else {
        setBuzzError(data.error || '登録に失敗しました')
      }
    } catch {
      setBuzzError('登録に失敗しました')
    } finally {
      setAddingBuzz(false)
    }
  }

  const handleDeleteBuzzPattern = async (id: string) => {
    await fetch('/api/buzz-patterns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchData()
  }

  const handleAddCompetitor = async () => {
    if (!newCompetitor.username.trim()) return
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompetitor),
      })
      if (res.ok) {
        setNewCompetitor({ username: '', displayName: '' })
        fetchData()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteCompetitor = async (id: string) => {
    if (!confirm('この競合アカウントを削除しますか？')) return
    await fetch(`/api/competitors?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword }),
      })
      if (res.ok) {
        setNewKeyword('')
        fetchData()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteKeyword = async (id: string) => {
    await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">リサーチ</h1>
        <p className="text-gray-400 text-sm mt-1">競合調査・キーワード管理</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitors */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">競合アカウント</h2>

          {/* Add Form */}
          <div className="space-y-2 mb-4">
            <input
              type="text"
              value={newCompetitor.username}
              onChange={(e) => setNewCompetitor({ ...newCompetitor, username: e.target.value })}
              placeholder="@username"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500"
            />
            <input
              type="text"
              value={newCompetitor.displayName}
              onChange={(e) => setNewCompetitor({ ...newCompetitor, displayName: e.target.value })}
              placeholder="表示名（任意）"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleAddCompetitor}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              追加
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {competitors.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-white">@{c.username}</div>
                  {c.displayName && (
                    <div className="text-xs text-gray-400">{c.displayName}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://x.com/${c.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-blue-900/30 rounded-lg transition-colors"
                  >
                    Xで見る
                  </a>
                  <button
                    onClick={() => handleDeleteCompetitor(c.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-900/30 rounded-lg transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
            {competitors.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">競合アカウントが登録されていません</p>
            )}
          </div>
        </div>

        {/* Keywords */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">モニタリングキーワード</h2>

          {/* Add Form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              placeholder="キーワードを入力"
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleAddKeyword}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              追加
            </button>
          </div>

          {/* Keywords Grid */}
          <div className="flex gap-2 flex-wrap">
            {keywords.map(kw => (
              <div
                key={kw.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-full"
              >
                <span className="text-sm text-gray-300">#{kw.keyword}</span>
                <button
                  onClick={() => handleDeleteKeyword(kw.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            {keywords.length === 0 && (
              <p className="text-sm text-gray-500 py-4">キーワードが登録されていません</p>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Tips */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">リサーチのヒント</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: '🔍',
              title: '競合分析のポイント',
              tips: [
                '投稿頻度を確認する',
                '人気投稿のタイプを分析',
                'エンゲージメント率を比較',
                'ハッシュタグ戦略を学ぶ',
              ]
            },
            {
              icon: '📊',
              title: 'キーワード活用法',
              tips: [
                'トレンドキーワードを狙う',
                'ニッチなキーワードを組み合わせる',
                '検索ボリュームを意識する',
                'コミュニティハッシュタグを使う',
              ]
            },
            {
              icon: '💡',
              title: '投稿改善のヒント',
              tips: [
                '最初の3行で興味を引く',
                '具体的な数値を入れる',
                'ブックマーク・保存を促す',
                '返信しやすい質問で締める',
              ]
            },
          ].map(({ icon, title, tips }) => (
            <div key={title} className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{icon}</span>
                <h3 className="text-sm font-bold text-white">{title}</h3>
              </div>
              <ul className="space-y-1.5">
                {tips.map(tip => (
                  <li key={tip} className="text-xs text-gray-400 flex items-start gap-1.5">
                    <span className="text-orange-500 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Buzz Patterns */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">バズパターン登録</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              伸びた競合投稿を登録 → AIが構造を分析 → 次の投稿生成に活用
              {buzzPatterns.length < 5 && (
                <span className="text-orange-400 ml-2">（5件以上で自動注入）現在{buzzPatterns.length}件</span>
              )}
              {buzzPatterns.length >= 5 && (
                <span className="text-green-400 ml-2">✅ {buzzPatterns.length}件登録済み・自動注入中</span>
              )}
            </p>
          </div>
        </div>

        {/* Add form */}
        <div className="space-y-2 mb-5">
          <textarea
            value={newBuzzText}
            onChange={e => setNewBuzzText(e.target.value)}
            placeholder="バズった投稿のテキストをそのままペースト（URLまたは全文）"
            rows={4}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500 resize-none"
          />
          <input
            type="text"
            value={newBuzzUrl}
            onChange={e => setNewBuzzUrl(e.target.value)}
            placeholder="投稿URL（任意）"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500"
          />
          {buzzError && <p className="text-xs text-red-400">{buzzError}</p>}
          <button
            onClick={handleAddBuzzPattern}
            disabled={addingBuzz || !newBuzzText.trim()}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {addingBuzz ? 'AI分析中...' : '✨ AIで構造分析して登録'}
          </button>
        </div>

        {/* Pattern list */}
        <div className="space-y-3">
          {buzzPatterns.map(p => {
            let analysis: Record<string, string> = {}
            try { analysis = JSON.parse(p.analysis) } catch { /* ignore */ }
            return (
              <div key={p.id} className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}>
                      {p.hookType}
                    </span>
                    <span className="text-xs text-gray-400">{p.structure}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedBuzz(expandedBuzz === p.id ? null : p.id)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {expandedBuzz === p.id ? '▲ 閉じる' : '▼ 詳細'}
                    </button>
                    <button
                      onClick={() => handleDeleteBuzzPattern(p.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      削除
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2">{p.sourceText.slice(0, 120)}...</p>
                {expandedBuzz === p.id && (
                  <div className="mt-3 pt-3 border-t border-gray-700 space-y-1.5">
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">{p.sourceText}</p>
                    {Object.entries(analysis).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-gray-500 shrink-0">{k}:</span>
                        <span className="text-gray-300">{v}</span>
                      </div>
                    ))}
                    {p.sourceUrl && (
                      <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                        元URL →
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {buzzPatterns.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              バズった投稿を登録して、AIの生成精度を上げましょう
            </p>
          )}
        </div>
      </div>

      {/* X Search Links */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">X検索クイックリンク</h2>
        <div className="flex gap-3 flex-wrap">
          {keywords.map(kw => (
            <a
              key={kw.id}
              href={`https://x.com/search?q=${encodeURIComponent('#' + kw.keyword)}&f=top`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/50 text-blue-400 rounded-lg text-sm transition-colors"
            >
              #{kw.keyword} を検索 →
            </a>
          ))}
          {keywords.length === 0 && (
            <p className="text-sm text-gray-500">キーワードを追加すると検索リンクが表示されます</p>
          )}
        </div>
      </div>
    </div>
  )
}

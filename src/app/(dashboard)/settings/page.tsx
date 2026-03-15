'use client'

import { useEffect, useState } from 'react'

interface Template {
  id: string
  name: string
  postType: string
  templateContent: string
  isDefault: boolean
  createdAt: string
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

export default function SettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [newTemplate, setNewTemplate] = useState({ name: '', postType: 'コンビニまとめ型', templateContent: '' })
  const [activeTab, setActiveTab] = useState<'templates' | 'account' | 'api'>('templates')
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    const res = await fetch('/api/templates')
    const data = await res.json()
    setTemplates(data)
  }

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.templateContent) return
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      })
      if (res.ok) {
        setNewTemplate({ name: '', postType: 'コンビニまとめ型', templateContent: '' })
        fetchTemplates()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
    fetchTemplates()
  }

  const handleSeed = async () => {
    setSeeding(true)
    setSeedMessage('')
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      setSeedMessage(data.success ? '✅ ' + data.message : '❌ ' + data.error)
      if (data.success) fetchTemplates()
    } catch {
      setSeedMessage('❌ シードに失敗しました')
    } finally {
      setSeeding(false)
    }
  }

  const tabs = [
    { id: 'templates', label: 'テンプレート', icon: '📋' },
    { id: 'account', label: 'アカウント', icon: '👤' },
    { id: 'api', label: 'API設定', icon: '🔑' },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">設定</h1>
        <p className="text-gray-400 text-sm mt-1">アプリケーションの設定管理</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Add Template */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4">新しいテンプレートを追加</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">テンプレート名</label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="テンプレート名"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">投稿タイプ</label>
                  <select
                    value={newTemplate.postType}
                    onChange={(e) => setNewTemplate({ ...newTemplate, postType: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                  >
                    {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">テンプレート内容</label>
                <textarea
                  value={newTemplate.templateContent}
                  onChange={(e) => setNewTemplate({ ...newTemplate, templateContent: e.target.value })}
                  rows={5}
                  placeholder="テンプレート内容を入力..."
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              <button
                onClick={handleAddTemplate}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                テンプレートを追加
              </button>
            </div>
          </div>

          {/* Template List */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4">テンプレート一覧 ({templates.length}件)</h2>
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="bg-gray-900 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{t.name}</span>
                        {t.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">デフォルト</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{t.postType}</span>
                    </div>
                    {!t.isDefault && (
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-900/30 rounded-lg transition-colors"
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-pre-wrap line-clamp-3">{t.templateContent}</p>
                </div>
              ))}
              {templates.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">テンプレートがありません</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4">アカウント情報</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-2xl">
                  🍊
                </div>
                <div>
                  <div className="text-sm font-bold text-white">管理者</div>
                  <div className="text-xs text-gray-400">admin@raccoon.com</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4">データ管理</h2>
            <div className="space-y-3">
              <p className="text-sm text-gray-400">初期データ（管理者アカウント・競合・キーワード・テンプレート）を再生成します。</p>
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {seeding ? 'セットアップ中...' : '初期データをセットアップ'}
              </button>
              {seedMessage && (
                <p className="text-sm mt-2 text-gray-300">{seedMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* API Tab */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-2">X (Twitter) API設定</h2>
            <p className="text-xs text-gray-400 mb-4">APIキーは .env.local ファイルで管理されています</p>
            <div className="space-y-3">
              {[
                { label: 'Consumer Key', key: 'X_CONSUMER_KEY' },
                { label: 'Consumer Secret', key: 'X_CONSUMER_SECRET' },
                { label: 'Access Token', key: 'X_ACCESS_TOKEN' },
                { label: 'Access Token Secret', key: 'X_ACCESS_TOKEN_SECRET' },
              ].map(({ label, key }) => (
                <div key={key} className="p-3 bg-gray-900 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <div className="text-xs font-mono text-gray-500">{key}=••••••••••••</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
              <p className="text-xs text-green-400">✅ X API設定済み（.env.localを確認）</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-2">Anthropic API設定</h2>
            <p className="text-xs text-gray-400 mb-4">AI投稿生成機能に使用します</p>
            <div className="p-3 bg-gray-900 rounded-lg mb-4">
              <div className="text-xs text-gray-400 mb-1">API Key</div>
              <div className="text-xs font-mono text-gray-500">ANTHROPIC_API_KEY=••••••••••••</div>
            </div>
            <div className="p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
              <p className="text-xs text-yellow-400">⚠️ APIキーが未設定の場合、テンプレート生成モードで動作します</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4">設定ファイルの場所</h2>
            <div className="p-3 bg-gray-900 rounded-lg font-mono text-xs text-gray-300">
              /c/x-Auto-shishitsu/.env.local
            </div>
            <p className="text-xs text-gray-400 mt-2">
              このファイルを編集してAPIキーを設定してください。変更後はサーバーを再起動してください。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

interface Template {
  id: string; name: string; postType: string; templateContent: string; isDefault: boolean; createdAt: string
}

const POST_TYPES = ['コンビニまとめ型','数値比較型','地雷暴露型','プロセス共有型','あるある共感型','チェックリスト保存型','Instagram連携型','その他']

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
}

export default function SettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [newTemplate, setNewTemplate] = useState({ name: '', postType: 'コンビニまとめ型', templateContent: '' })
  const [activeTab, setActiveTab] = useState<'templates' | 'account' | 'api' | 'notifications'>('templates')
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')
  const [slackWebhook, setSlackWebhook] = useState('')
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackMessage, setSlackMessage] = useState('')
  const [apiStatus, setApiStatus] = useState<{ slackWebhookConfigured: boolean; anthropicConfigured: boolean; threadsConfigured: boolean; xConfigured: boolean } | null>(null)

  useEffect(() => {
    fetchTemplates()
    fetch('/api/settings').then(r => r.json()).then(setApiStatus).catch(() => {})
  }, [])

  const fetchTemplates = async () => {
    const res = await fetch('/api/templates')
    const data = await res.json()
    setTemplates(data)
  }

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.templateContent) return
    const res = await fetch('/api/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTemplate),
    })
    if (res.ok) { setNewTemplate({ name: '', postType: 'コンビニまとめ型', templateContent: '' }); fetchTemplates() }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
    fetchTemplates()
  }

  const handleSeed = async () => {
    setSeeding(true); setSeedMessage('')
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      setSeedMessage(data.success ? '✅ ' + data.message : '❌ ' + data.error)
      if (data.success) fetchTemplates()
    } catch { setSeedMessage('❌ シードに失敗しました') } finally { setSeeding(false) }
  }

  const handleSlackSave = async () => {
    setSlackSaving(true); setSlackMessage('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackWebhookUrl: slackWebhook }),
      })
      const data = await res.json()
      setSlackMessage(data.success ? '✅ ' + data.message : '❌ 保存に失敗しました')
    } finally { setSlackSaving(false) }
  }

  const tabs = [
    { id: 'templates', label: 'テンプレート', icon: '📋' },
    { id: 'notifications', label: '通知設定', icon: '🔔' },
    { id: 'account', label: 'アカウント', icon: '👤' },
    { id: 'api', label: 'API設定', icon: '🔑' },
  ] as const

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none transition-all"
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">設定</h1>
        <p className="text-slate-400 text-sm mt-1">アプリケーションの設定管理</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-4">新しいテンプレートを追加</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">テンプレート名</label>
                  <input type="text" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} placeholder="テンプレート名" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">投稿タイプ</label>
                  <select value={newTemplate.postType} onChange={e => setNewTemplate({...newTemplate, postType: e.target.value})} className={inputCls} style={inputStyle}>
                    {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">テンプレート内容</label>
                <textarea value={newTemplate.templateContent} onChange={e => setNewTemplate({...newTemplate, templateContent: e.target.value})} rows={5} placeholder="テンプレート内容を入力..." className={`${inputCls} resize-none`} style={inputStyle} />
              </div>
              <button onClick={handleAddTemplate} className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-orange-500/20">テンプレートを追加</button>
            </div>
          </div>
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-4">テンプレート一覧 ({templates.length}件)</h2>
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{t.name}</span>
                        {t.isDefault && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>デフォルト</span>}
                      </div>
                      <span className="text-xs text-slate-400">{t.postType}</span>
                    </div>
                    {!t.isDefault && (
                      <button onClick={() => handleDeleteTemplate(t.id)} className="text-xs px-2 py-1 rounded-lg transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>削除</button>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap line-clamp-3">{t.templateContent}</p>
                </div>
              ))}
              {templates.length === 0 && <p className="text-sm text-slate-500 text-center py-4">テンプレートがありません</p>}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-2">ブラウザ通知</h2>
            <p className="text-sm text-slate-400 mb-4">ブラウザの通知権限を許可すると、以下のタイミングで通知が届きます。</p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><span className="text-orange-400">🔥</span>高エンゲージメント投稿が発生したとき（いいね50以上など）</li>
              <li className="flex items-center gap-2"><span className="text-green-400">📈</span>フォロワーが5人以上増えたとき</li>
              <li className="flex items-center gap-2"><span className="text-red-400">📉</span>フォロワーが5人以上減ったとき</li>
            </ul>
            <div className="mt-4 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-sm text-slate-300">通知は5分ごとに自動チェックされます。ページ右上のベルアイコンからも確認できます。</p>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-2">Slack Webhook通知</h2>
            <p className="text-sm text-slate-400 mb-4">SlackのIncoming Webhook URLを設定すると、高エンゲージメント・フォロワー変動をSlackに通知します。</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Webhook URL（環境変数 SLACK_WEBHOOK_URL での設定を推奨）</label>
                <input type="url" value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." className={inputCls} style={inputStyle} />
              </div>
              <button onClick={handleSlackSave} disabled={slackSaving || !slackWebhook} className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-orange-500/20">
                {slackSaving ? '保存中...' : '保存する（セッション限り）'}
              </button>
              {slackMessage && <p className="text-sm text-slate-300">{slackMessage}</p>}
              {apiStatus?.slackWebhookConfigured && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-sm text-green-400">✅ 環境変数 SLACK_WEBHOOK_URL が設定されています</p>
                </div>
              )}
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs text-slate-400 font-medium mb-1">Vercel環境変数での永続化（推奨）</p>
                <p className="text-xs text-slate-500">Vercel → Settings → Environment Variables → <code className="text-orange-400">SLACK_WEBHOOK_URL</code> を追加してください。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-4">アカウント情報</h2>
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-2xl">🍊</div>
              <div>
                <div className="text-sm font-bold text-white">管理者</div>
                <div className="text-sm text-slate-400">admin@raccoon.com</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-4">データ管理</h2>
            <p className="text-sm text-slate-400 mb-3">初期データ（管理者アカウント・テンプレートなど）を再生成します。</p>
            <button onClick={handleSeed} disabled={seeding} className="px-4 py-2 rounded-xl text-sm font-medium transition-all" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
              {seeding ? 'セットアップ中...' : '初期データをセットアップ'}
            </button>
            {seedMessage && <p className="text-sm mt-2 text-slate-300">{seedMessage}</p>}
          </div>
        </div>
      )}

      {/* API Tab */}
      {activeTab === 'api' && (
        <div className="space-y-5">
          {[
            { title: 'Anthropic API', key: 'ANTHROPIC_API_KEY', ok: apiStatus?.anthropicConfigured, note: 'AI投稿生成・改善・スコアリング機能に使用' },
            { title: 'X (Twitter) API', key: 'X_CONSUMER_KEY + X_ACCESS_TOKEN', ok: apiStatus?.xConfigured, note: 'X自動投稿機能に使用' },
            { title: 'Threads API', key: 'THREADS_ACCESS_TOKEN + THREADS_USER_ID', ok: apiStatus?.threadsConfigured, note: 'Threads自動投稿機能に使用' },
            { title: 'Slack Webhook', key: 'SLACK_WEBHOOK_URL', ok: apiStatus?.slackWebhookConfigured, note: '通知機能に使用' },
          ].map(({ title, key, ok, note }) => (
            <div key={title} className="rounded-2xl p-5" style={glass}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-white">{title}</h2>
                <span className="text-sm" style={{ color: ok ? '#10b981' : '#f97316' }}>{ok ? '✅ 設定済み' : '⚠️ 未設定'}</span>
              </div>
              <p className="text-sm text-slate-400 mb-3">{note}</p>
              <div className="rounded-xl p-3 font-mono text-sm" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="text-slate-500">{key}=</span><span className="text-green-400">••••••••</span>
              </div>
            </div>
          ))}
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-base font-bold text-white mb-3">設定ファイルの場所</h2>
            <div className="rounded-xl p-3 font-mono text-sm" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8' }}>
              Vercel → Settings → Environment Variables
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

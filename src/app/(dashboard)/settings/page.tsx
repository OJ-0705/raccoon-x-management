'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Template {
  id: string; name: string; postType: string; templateContent: string; isDefault: boolean; createdAt: string
}

interface AccountStatus {
  x: { configured: boolean; handle: string | null; followers: number | null }
  threads: { configured: boolean; appReady: boolean; userId: string | null; username: string | null; followers: number | null }
}

const POST_TYPES = ['コンビニまとめ型','数値比較型','地雷暴露型','プロセス共有型','あるある共感型','チェックリスト保存型','Instagram連携型','その他']

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
}

const innerDark = { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }

function SettingsInner() {
  const searchParams = useSearchParams()
  const [templates, setTemplates] = useState<Template[]>([])
  const [newTemplate, setNewTemplate] = useState({ name: '', postType: 'コンビニまとめ型', templateContent: '' })
  const [activeTab, setActiveTab] = useState<'accounts' | 'templates' | 'notifications' | 'account' | 'api'>(
    searchParams.get('tab') === 'accounts' ? 'accounts' : 'accounts'
  )
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')
  const [slackWebhook, setSlackWebhook] = useState('')
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackMessage, setSlackMessage] = useState('')
  const [apiStatus, setApiStatus] = useState<{ slackWebhookConfigured: boolean; anthropicConfigured: boolean; threadsConfigured: boolean; xConfigured: boolean } | null>(null)
  const [accounts, setAccounts] = useState<AccountStatus | null>(null)
  const [oauthResult, setOauthResult] = useState<{ token: string; userId: string } | null>(null)

  useEffect(() => {
    fetchTemplates()
    fetch('/api/settings').then(r => r.json()).then(setApiStatus).catch(() => {})
    fetch('/api/accounts').then(r => r.json()).then(setAccounts).catch(() => {})

    // Handle OAuth callback result
    const threadsToken = searchParams.get('threads_token')
    const threadsUserId = searchParams.get('threads_user_id')
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success && threadsToken && threadsUserId) {
      setOauthResult({ token: threadsToken, userId: threadsUserId })
      setActiveTab('accounts')
    }
    if (error) {
      setActiveTab('accounts')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTemplates = async () => {
    const res = await fetch('/api/templates')
    setTemplates(await res.json())
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
    { id: 'accounts', label: 'アカウント連携', icon: '🔗' },
    { id: 'templates', label: 'テンプレート', icon: '📋' },
    { id: 'notifications', label: '通知設定', icon: '🔔' },
    { id: 'account', label: 'アカウント', icon: '👤' },
    { id: 'api', label: 'API設定', icon: '🔑' },
  ] as const

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none transition-all"
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }

  const oauthError = searchParams.get('error')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">設定</h1>
        <p className="text-slate-400 text-sm mt-1">アプリケーションの設定管理</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* === ACCOUNTS TAB === */}
      {activeTab === 'accounts' && (
        <div className="space-y-5">

          {/* OAuth success */}
          {oauthResult && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <h3 className="text-base font-bold text-green-400 mb-2">✅ Threads認証成功！</h3>
              <p className="text-sm text-slate-300 mb-3">以下の値をVercelの環境変数に設定してください。</p>
              <div className="rounded-xl p-3 font-mono text-sm space-y-1.5" style={innerDark}>
                <div><span className="text-slate-500">THREADS_ACCESS_TOKEN=</span><span className="text-green-400 break-all">{oauthResult.token}</span></div>
                <div><span className="text-slate-500">THREADS_USER_ID=</span><span className="text-green-400">{oauthResult.userId}</span></div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Vercel → Settings → Environment Variables → 上記を追加 → Redeploy</p>
            </div>
          )}

          {/* OAuth error */}
          {oauthError && !oauthResult && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <p className="text-sm text-red-400">❌ 認証エラー: {oauthError}</p>
            </div>
          )}

          {/* X Account */}
          <div className="rounded-2xl p-5" style={glass}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">𝕏 Xアカウント</h2>
              <span className="text-sm font-medium px-3 py-1 rounded-full" style={accounts?.x.configured
                ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                : { background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}>
                {accounts?.x.configured ? '✅ 連携済み' : '⚠️ 未連携'}
              </span>
            </div>

            {accounts?.x.configured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 rounded-xl" style={innerDark}>
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-xl font-bold text-white border border-white/20">𝕏</div>
                  <div>
                    <div className="text-base font-bold text-white">{accounts.x.handle || '@raccoon_lipid'}</div>
                    {accounts.x.followers !== null && (
                      <div className="text-sm text-slate-400">👥 {accounts.x.followers.toLocaleString()} フォロワー</div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <p className="text-green-400">API連携済み。投稿はX APIを通じて自動投稿されます。</p>
                </div>
                <button className="px-4 py-2 rounded-xl text-sm transition-all" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                  連携を解除（環境変数を削除してください）
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">X API認証情報が未設定です。以下の環境変数をVercelに追加してください。</p>
                <div className="rounded-xl p-3 font-mono text-sm space-y-1" style={innerDark}>
                  {['X_CONSUMER_KEY', 'X_CONSUMER_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'].map(k => (
                    <div key={k}><span className="text-slate-500">{k}=</span><span className="text-yellow-400">your_value</span></div>
                  ))}
                </div>
                <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0' }}>
                  🔑 X Developer Portalを開く →
                </a>
              </div>
            )}
          </div>

          {/* Threads Account */}
          <div className="rounded-2xl p-5" style={glass}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">🧵 Threadsアカウント</h2>
              <span className="text-sm font-medium px-3 py-1 rounded-full" style={accounts?.threads.configured
                ? { background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }
                : { background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}>
                {accounts?.threads.configured ? '✅ 連携済み' : '⚠️ 未連携'}
              </span>
            </div>

            {accounts?.threads.configured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 rounded-xl" style={innerDark}>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-xl">🧵</div>
                  <div>
                    <div className="text-base font-bold text-white">
                      {accounts.threads.username ? `@${accounts.threads.username}` : `User ID: ${accounts.threads.userId}`}
                    </div>
                    {accounts.threads.followers !== null && accounts.threads.followers > 0 && (
                      <div className="text-sm text-slate-400">👥 {accounts.threads.followers.toLocaleString()} フォロワー</div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <p className="text-purple-300">Threads連携済み。投稿時に「Threadsにも投稿」をONにすると自動投稿されます。</p>
                </div>
                <button className="px-4 py-2 rounded-xl text-sm transition-all" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                  連携を解除（THREADS_ACCESS_TOKEN を削除してください）
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts?.threads.appReady ? (
                  <div>
                    <p className="text-sm text-slate-400 mb-3">THREADS_APP_IDが設定済みです。以下のボタンからMeta OAuth認証を開始してください。</p>
                    <a href="/api/auth/threads/start"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}>
                      🧵 Threadsを連携する（Meta OAuth）
                    </a>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-400 mb-3">Threads連携には以下の環境変数が必要です。</p>
                    <div className="rounded-xl p-3 font-mono text-sm space-y-1" style={innerDark}>
                      {['THREADS_APP_ID', 'THREADS_APP_SECRET', 'THREADS_ACCESS_TOKEN', 'THREADS_USER_ID'].map(k => (
                        <div key={k}><span className="text-slate-500">{k}=</span><span className="text-yellow-400">your_value</span></div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step-by-step guide */}
                <div className="rounded-xl p-4 space-y-3" style={innerDark}>
                  <p className="text-sm font-bold text-white">📋 設定手順</p>
                  {[
                    { n: 1, title: 'Meta Developersでアプリを作成', desc: 'developers.facebook.com → 「アプリを作成」→「Threads」を選択' },
                    { n: 2, title: 'Threads APIを有効化', desc: 'アプリダッシュボード → Threads API → セットアップ' },
                    { n: 3, title: 'APP_ID・APP_SECRETをVercelに追加', desc: 'THREADS_APP_ID と THREADS_APP_SECRET を設定してRedeploy' },
                    { n: 4, title: 'このページから連携', desc: 'Redeploy後、このページに戻って「Threadsを連携する」ボタンをクリック' },
                    { n: 5, title: '取得したトークンをVercelに保存', desc: '認証後に表示されるACCESS_TOKENとUSER_IDをVercelに追加してRedeploy' },
                  ].map(s => (
                    <div key={s.n} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(139,92,246,0.3)', color: '#c4b5fd' }}>{s.n}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{s.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TEMPLATES TAB === */}
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
                <div key={t.id} className="rounded-xl p-4" style={innerDark}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{t.name}</span>
                        {t.isDefault && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>デフォルト</span>}
                      </div>
                      <span className="text-xs text-slate-400">{t.postType}</span>
                    </div>
                    {!t.isDefault && (
                      <button onClick={() => handleDeleteTemplate(t.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>削除</button>
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

      {/* === NOTIFICATIONS TAB === */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-3">ブラウザ通知</h2>
            <ul className="space-y-2 text-sm text-slate-300 mb-4">
              <li className="flex items-center gap-2">🔥 高エンゲージメント投稿（いいね50以上）</li>
              <li className="flex items-center gap-2">📈 フォロワー+5人以上増加</li>
              <li className="flex items-center gap-2">📉 フォロワー5人以上減少</li>
            </ul>
            <p className="text-sm text-slate-500">5分ごと自動チェック。右上🔔アイコンからも確認できます。</p>
          </div>
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-2">Slack Webhook</h2>
            <p className="text-sm text-slate-400 mb-4">高エンゲージメント・フォロワー変動をSlackに通知します。</p>
            <div className="space-y-3">
              <input type="url" value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." className={inputCls} style={inputStyle} />
              <button onClick={handleSlackSave} disabled={slackSaving || !slackWebhook} className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-orange-500/20">
                {slackSaving ? '保存中...' : '保存（セッション限り）'}
              </button>
              {slackMessage && <p className="text-sm text-slate-300">{slackMessage}</p>}
              {apiStatus?.slackWebhookConfigured && (
                <p className="text-sm text-green-400">✅ 環境変数 SLACK_WEBHOOK_URL が設定済みです</p>
              )}
              <p className="text-xs text-slate-500">永続化するには Vercel → Environment Variables → <code className="text-orange-400">SLACK_WEBHOOK_URL</code></p>
            </div>
          </div>
        </div>
      )}

      {/* === ACCOUNT TAB === */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-4">管理者アカウント</h2>
            <div className="flex items-center gap-4 p-4 rounded-xl" style={innerDark}>
              <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-2xl">🍊</div>
              <div>
                <div className="text-base font-bold text-white">管理者</div>
                <div className="text-sm text-slate-400">admin@raccoon.com</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-5" style={glass}>
            <h2 className="text-lg font-bold text-white mb-3">データ管理</h2>
            <p className="text-sm text-slate-400 mb-3">初期データ（管理者アカウント・テンプレートなど）を再生成します。</p>
            <button onClick={handleSeed} disabled={seeding} className="px-4 py-2 rounded-xl text-sm font-medium transition-all" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
              {seeding ? 'セットアップ中...' : '初期データをセットアップ'}
            </button>
            {seedMessage && <p className="text-sm mt-2 text-slate-300">{seedMessage}</p>}
          </div>
        </div>
      )}

      {/* === API TAB === */}
      {activeTab === 'api' && (
        <div className="space-y-5">
          {[
            { title: 'Anthropic API', key: 'ANTHROPIC_API_KEY', ok: apiStatus?.anthropicConfigured, note: 'AI投稿生成・改善・スコアリング' },
            { title: 'X (Twitter) API', key: 'X_CONSUMER_KEY + X_ACCESS_TOKEN', ok: apiStatus?.xConfigured, note: 'X自動投稿' },
            { title: 'Threads API', key: 'THREADS_ACCESS_TOKEN + THREADS_USER_ID', ok: apiStatus?.threadsConfigured, note: 'Threads自動投稿' },
            { title: 'Slack Webhook', key: 'SLACK_WEBHOOK_URL', ok: apiStatus?.slackWebhookConfigured, note: '通知' },
          ].map(({ title, key, ok, note }) => (
            <div key={title} className="rounded-2xl p-5" style={glass}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-white">{title}</h2>
                <span className="text-sm" style={{ color: ok ? '#10b981' : '#f97316' }}>{ok ? '✅ 設定済み' : '⚠️ 未設定'}</span>
              </div>
              <p className="text-sm text-slate-400 mb-3">{note}</p>
              <div className="rounded-xl p-3 font-mono text-sm" style={innerDark}>
                <span className="text-slate-500">{key}=</span><span className="text-green-400">••••••••</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  )
}

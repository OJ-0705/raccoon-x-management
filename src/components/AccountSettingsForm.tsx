'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BTN_PRIMARY, Field, INPUT, Panel } from '@/components/ui'

export interface ProfileValues {
  displayName: string
  xUsername: string
  threadsUsername: string
  persona: string
  theme: string
  targetAudience: string
  rules: string
  ctaPolicy: string
  charLimitMin: number
  charLimitMax: number
  postingSlots: string
  monthlyBudgetUsd: number
}

export default function AccountSettingsForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const set = <K extends keyof ProfileValues>(k: K, value: ProfileValues[K]) => setV((p) => ({ ...p, [k]: value }))

  async function save() {
    setBusy(true)
    setMessage(null)
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...v,
        charLimitMin: Number(v.charLimitMin),
        charLimitMax: Number(v.charLimitMax),
        monthlyBudgetUsd: Number(v.monthlyBudgetUsd),
        postingSlots: v.postingSlots
          .split(',')
          .map((s) => s.trim())
          .filter((s) => /^\d{2}:\d{2}$/.test(s)),
      }),
    })
    setBusy(false)
    setMessage(res.ok ? '保存しました' : '保存に失敗しました')
    if (res.ok) router.refresh()
  }

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="mb-4 text-sm font-semibold text-white">アカウント</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="表示名">
            <input value={v.displayName} onChange={(e) => set('displayName', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Xのハンドル" hint="@は不要">
            <input value={v.xUsername} onChange={(e) => set('xUsername', e.target.value)} className={INPUT} placeholder="your_handle" />
          </Field>
          <Field label="Threadsのハンドル" hint="@は不要">
            <input value={v.threadsUsername} onChange={(e) => set('threadsUsername', e.target.value)} className={INPUT} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-1 text-sm font-semibold text-white">運用方針</h2>
        <p className="mb-4 text-xs text-slate-500">
          ここに書いた内容が MCP の <code className="text-slate-400">get_writing_context</code> から Claude Code に渡り、投稿生成の基準になります。
        </p>
        <div className="space-y-3">
          <Field label="発信テーマ" hint="どの領域の何を発信するか">
            <textarea value={v.theme} onChange={(e) => set('theme', e.target.value)} rows={2} className={INPUT} />
          </Field>
          <Field label="ペルソナ" hint="一人称・口調・キャラクター">
            <textarea value={v.persona} onChange={(e) => set('persona', e.target.value)} rows={3} className={INPUT} />
          </Field>
          <Field label="想定読者">
            <textarea value={v.targetAudience} onChange={(e) => set('targetAudience', e.target.value)} rows={2} className={INPUT} />
          </Field>
          <Field label="投稿ルール" hint="必須要素とNGパターン。Markdownで書けます">
            <textarea value={v.rules} onChange={(e) => set('rules', e.target.value)} rows={8} className={`${INPUT} font-mono text-xs`} />
          </Field>
          <Field label="CTA方針">
            <textarea value={v.ctaPolicy} onChange={(e) => set('ctaPolicy', e.target.value)} rows={2} className={INPUT} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 text-sm font-semibold text-white">投稿の運用パラメータ</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="推奨文字数（下限）">
            <input type="number" value={v.charLimitMin} onChange={(e) => set('charLimitMin', Number(e.target.value))} className={INPUT} />
          </Field>
          <Field label="推奨文字数（上限）">
            <input type="number" value={v.charLimitMax} onChange={(e) => set('charLimitMax', Number(e.target.value))} className={INPUT} />
          </Field>
          <Field label="投稿スロット（JST）" hint="カンマ区切り 例: 08:00, 12:30, 21:00">
            <input value={v.postingSlots} onChange={(e) => set('postingSlots', e.target.value)} className={INPUT} />
          </Field>
          <Field label="月次予算（USD）" hint="超過すると自動投稿が止まります">
            <input type="number" step="0.5" value={v.monthlyBudgetUsd} onChange={(e) => set('monthlyBudgetUsd', Number(e.target.value))} className={INPUT} />
          </Field>
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <button onClick={() => void save()} disabled={busy} className={BTN_PRIMARY}>
          {busy ? '保存中…' : '保存する'}
        </button>
        {message && <span className="text-sm text-slate-400">{message}</span>}
      </div>
    </div>
  )
}

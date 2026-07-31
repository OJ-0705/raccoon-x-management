'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, Field, INPUT, Panel } from '@/components/ui'

export interface PostFormValues {
  id?: string
  content: string
  postType: string
  theme: string
  message: string
  entities: string
  hashtags: string
  postToX: boolean
  postToThreads: boolean
  scheduledAt: string | null
  mediaUrls: string[]
  status?: string
}

interface Props {
  initial: PostFormValues
  slots: Array<{ scheduledAt: string; jst: string }>
  charLimitMin: number
  charLimitMax: number
}

/** UTC ISO → datetime-local が扱えるJSTの文字列 */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  return new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 16)
}

function fromLocalInput(local: string): string | null {
  if (!local) return null
  return new Date(new Date(`${local}:00Z`).getTime() - 9 * 3600000).toISOString()
}

const LINK_RE = /https?:\/\/\S+/i

export default function PostForm({ initial, slots, charLimitMin, charLimitMax }: Props) {
  const router = useRouter()
  const [v, setV] = useState<PostFormValues>(initial)
  const [scheduleLocal, setScheduleLocal] = useState(toLocalInput(initial.scheduledAt))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dupHits, setDupHits] = useState<Array<{ reason: string; existingContent: string }> | null>(null)

  const length = [...v.content].length
  const isPublished = v.status === 'PUBLISHED'
  const hasLink = LINK_RE.test(v.content)

  const set = <K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }))

  async function save(opts: { schedule?: boolean; force?: boolean } = {}) {
    setBusy('save')
    setError(null)
    setDupHits(null)

    const payload = {
      content: v.content,
      postType: v.postType || null,
      theme: v.theme || null,
      message: v.message || null,
      entities: v.entities ? v.entities.split(/[,、]/).map((s) => s.trim()).filter(Boolean) : [],
      hashtags: v.hashtags || null,
      postToX: v.postToX,
      postToThreads: v.postToThreads,
      mediaUrls: v.mediaUrls,
      scheduledAt: opts.schedule ? fromLocalInput(scheduleLocal) : v.id ? fromLocalInput(scheduleLocal) : null,
      status: opts.schedule ? 'SCHEDULED' : undefined,
      skipDuplicateCheck: opts.force,
    }

    const res = await fetch(v.id ? `/api/posts/${v.id}` : '/api/posts', {
      method: v.id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setBusy(null)

    if (!res.ok) {
      setError(data.error ?? '保存に失敗しました')
      if (data.hits) setDupHits(data.hits)
      return
    }
    router.push('/posts')
    router.refresh()
  }

  async function publishNow() {
    if (!v.id) return
    if (!confirm('いますぐXに投稿します。X APIは従量課金です。実行しますか？')) return
    setBusy('publish')
    setError(null)
    const res = await fetch(`/api/posts/${v.id}/publish`, { method: 'POST' })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) {
      setError(data.errors?.join(' / ') ?? data.error ?? '投稿に失敗しました')
      return
    }
    router.push('/posts')
    router.refresh()
  }

  async function remove() {
    if (!v.id) return
    if (!confirm('この投稿を見送り（ARCHIVED）にします。よろしいですか？')) return
    setBusy('delete')
    await fetch(`/api/posts/${v.id}`, { method: 'DELETE' })
    setBusy(null)
    router.push('/posts')
    router.refresh()
  }

  async function upload(file: File) {
    setBusy('upload')
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) {
      setError(data.error ?? 'アップロードに失敗しました')
      return
    }
    set('mediaUrls', [...v.mediaUrls, data.url].slice(0, 4))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Panel>
        <Field label="本文" hint={`推奨 ${charLimitMin}〜${charLimitMax}文字 / Xの上限は280文字`}>
          <textarea
            value={v.content}
            onChange={(e) => set('content', e.target.value)}
            rows={10}
            disabled={isPublished}
            className={`${INPUT} resize-y font-normal leading-relaxed`}
            placeholder="投稿本文"
          />
        </Field>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className={length > 280 ? 'text-red-400' : length > charLimitMax ? 'text-amber-400' : 'text-slate-500'}>
            {length} 文字
          </span>
          {hasLink && <span className="text-amber-400">リンク検出：X APIの単価が $0.015 → $0.20 になります</span>}
        </div>

        {v.mediaUrls.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {v.mediaUrls.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-20 rounded-lg border border-white/10 object-cover" />
                <button
                  onClick={() => set('mediaUrls', v.mediaUrls.filter((u) => u !== url))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {!isPublished && v.mediaUrls.length < 4 && (
          <label className={`${BTN_GHOST} mt-3 cursor-pointer`}>
            {busy === 'upload' ? 'アップロード中…' : '🖼 画像を追加'}
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void upload(f)
                e.target.value = ''
              }}
            />
          </label>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
            {dupHits && (
              <ul className="mt-2 space-y-1 text-xs text-red-200/80">
                {dupHits.map((h, i) => (
                  <li key={i}>
                    ・{h.reason} — 「{h.existingContent}」
                  </li>
                ))}
              </ul>
            )}
            {dupHits && (
              <button onClick={() => void save({ force: true })} className={`${BTN_GHOST} mt-3`}>
                重複を承知で保存する
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
          <button onClick={() => void save()} disabled={!v.content || Boolean(busy) || isPublished} className={BTN_PRIMARY}>
            {busy === 'save' ? '保存中…' : v.id ? '保存' : '下書きとして保存'}
          </button>
          <button
            onClick={() => void save({ schedule: true })}
            disabled={!v.content || !scheduleLocal || Boolean(busy) || isPublished}
            className={BTN_GHOST}
          >
            この時刻で予約
          </button>
          {v.id && !isPublished && (
            <button onClick={() => void publishNow()} disabled={Boolean(busy)} className={BTN_GHOST}>
              {busy === 'publish' ? '投稿中…' : 'いま投稿する'}
            </button>
          )}
          {v.id && (
            <button onClick={() => void remove()} disabled={Boolean(busy)} className={`${BTN_DANGER} ml-auto`}>
              見送りにする
            </button>
          )}
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel>
          <h3 className="mb-3 text-sm font-semibold text-white">配信先</h3>
          <div className="space-y-2">
            {(
              [
                ['postToX', 'X (Twitter)'],
                ['postToThreads', 'Threads'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={v[key]}
                  disabled={isPublished}
                  onChange={(e) => set(key, e.target.checked)}
                  className="h-4 w-4 accent-orange-500"
                />
                {label}
              </label>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className="mb-3 text-sm font-semibold text-white">予約時刻（JST）</h3>
          <input
            type="datetime-local"
            value={scheduleLocal}
            disabled={isPublished}
            onChange={(e) => setScheduleLocal(e.target.value)}
            className={INPUT}
          />
          {slots.length > 0 && !isPublished && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs text-slate-500">空いている枠</div>
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <button
                    key={s.scheduledAt}
                    onClick={() => setScheduleLocal(toLocalInput(s.scheduledAt))}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:border-orange-500/40 hover:text-orange-300"
                  >
                    {s.jst}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel>
          <h3 className="mb-3 text-sm font-semibold text-white">重複チェック用メタ</h3>
          <div className="space-y-3">
            <Field label="投稿型">
              <input value={v.postType} onChange={(e) => set('postType', e.target.value)} className={INPUT} placeholder="例: 体験談型" />
            </Field>
            <Field label="Layer1 テーマ">
              <input value={v.theme} onChange={(e) => set('theme', e.target.value)} className={INPUT} />
            </Field>
            <Field label="Layer2 核心メッセージ">
              <input value={v.message} onChange={(e) => set('message', e.target.value)} className={INPUT} />
            </Field>
            <Field label="Layer3 固有名詞・数値" hint="カンマ区切り">
              <input value={v.entities} onChange={(e) => set('entities', e.target.value)} className={INPUT} />
            </Field>
            <Field label="ハッシュタグ">
              <input value={v.hashtags} onChange={(e) => set('hashtags', e.target.value)} className={INPUT} />
            </Field>
          </div>
        </Panel>
      </div>
    </div>
  )
}

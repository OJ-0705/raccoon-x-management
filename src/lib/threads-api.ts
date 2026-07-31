/**
 * Threads (Meta) API クライアント。
 *
 * 投稿は「コンテナ作成 → publish」の2段構え。
 * テキストは URLSearchParams でクエリに載せる（JSONボディだと文字化けする）。
 */

import { prisma } from '@/lib/prisma'

const GRAPH_BASE = 'https://graph.threads.net/v1.0'
const THREADS_MAX_CHARS = 500

export interface ThreadsResult<T> {
  ok: boolean
  data?: T
  error?: string
  simulated?: boolean
}

export interface ThreadsCredentials {
  accessToken: string
  userId: string
}

/** 環境変数を優先し、無ければ Settings テーブル（UIから差し替え可能）を見る */
export async function getThreadsCredentials(): Promise<ThreadsCredentials | null> {
  const envToken = (process.env.THREADS_ACCESS_TOKEN || '').trim()
  const envUserId = (process.env.THREADS_USER_ID || '').trim()
  if (envToken && envUserId) return { accessToken: envToken, userId: envUserId }

  try {
    const [tokenRow, userIdRow] = await Promise.all([
      envToken ? Promise.resolve(null) : prisma.settings.findUnique({ where: { key: 'threads_access_token' } }),
      envUserId ? Promise.resolve(null) : prisma.settings.findUnique({ where: { key: 'threads_user_id' } }),
    ])
    const accessToken = envToken || tokenRow?.value || ''
    const userId = envUserId || userIdRow?.value || ''
    if (!accessToken || !userId) return null
    return { accessToken, userId }
  } catch {
    return null
  }
}

function isVideo(url: string): boolean {
  if (url.startsWith('data:')) return url.startsWith('data:video/')
  return /\.(mp4|mov|webm)(\?|$)/i.test(url)
}

async function postJson(url: string): Promise<{ id?: string; error?: { message: string } }> {
  const res = await fetch(url, { method: 'POST' })
  return (await res.json().catch(() => ({}))) as { id?: string; error?: { message: string } }
}

export interface CreateThreadsPostInput {
  text: string
  /** Threads は公開HTTP URLしか受け付けない。data: URL は自動で除外される。 */
  mediaUrls?: string[]
  /** リプライ先（スレッド連投用） */
  replyToId?: string
}

export async function createPost(input: CreateThreadsPostInput): Promise<ThreadsResult<{ id: string }>> {
  if (process.env.SIMULATE_MODE === 'true') {
    return { ok: true, simulated: true, data: { id: `sim_threads_${Date.now()}` } }
  }

  const creds = await getThreadsCredentials()
  if (!creds) return { ok: false, error: 'Threads credentials not set: THREADS_ACCESS_TOKEN / THREADS_USER_ID' }

  const text = input.text.length > THREADS_MAX_CHARS ? input.text.slice(0, THREADS_MAX_CHARS - 1) + '…' : input.text
  const base = `${GRAPH_BASE}/${creds.userId}/threads`

  const publicUrls = (input.mediaUrls ?? []).filter((u) => !u.startsWith('data:'))
  const images = publicUrls.filter((u) => !isVideo(u))
  const videos = publicUrls.filter(isVideo)

  const common: Record<string, string> = { text, access_token: creds.accessToken }
  if (input.replyToId) common.reply_to_id = input.replyToId

  try {
    let creationId: string

    if (videos.length > 0) {
      const container = await postJson(
        `${base}?${new URLSearchParams({ ...common, media_type: 'VIDEO', video_url: videos[0] })}`,
      )
      if (!container.id) return { ok: false, error: container.error?.message || 'Threads video container failed' }
      creationId = container.id
    } else if (images.length === 1) {
      const container = await postJson(
        `${base}?${new URLSearchParams({ ...common, media_type: 'IMAGE', image_url: images[0] })}`,
      )
      if (!container.id) return { ok: false, error: container.error?.message || 'Threads image container failed' }
      creationId = container.id
    } else if (images.length > 1) {
      const itemIds: string[] = []
      for (const imageUrl of images.slice(0, 20)) {
        const item = await postJson(
          `${base}?${new URLSearchParams({
            media_type: 'IMAGE',
            image_url: imageUrl,
            is_carousel_item: 'true',
            access_token: creds.accessToken,
          })}`,
        )
        if (item.id) itemIds.push(item.id)
      }
      if (itemIds.length === 0) return { ok: false, error: 'Threads carousel item creation failed' }

      const params = new URLSearchParams({ ...common, media_type: 'CAROUSEL' })
      itemIds.forEach((id) => params.append('children', id))
      const carousel = await postJson(`${base}?${params}`)
      if (!carousel.id) return { ok: false, error: carousel.error?.message || 'Threads carousel failed' }
      creationId = carousel.id
    } else {
      const container = await postJson(`${base}?${new URLSearchParams({ ...common, media_type: 'TEXT' })}`)
      if (!container.id) return { ok: false, error: container.error?.message || 'Threads container failed' }
      creationId = container.id
    }

    // メディア処理待ち
    await new Promise((r) => setTimeout(r, publicUrls.length > 0 ? 5000 : 1000))

    const published = await postJson(
      `${GRAPH_BASE}/${creds.userId}/threads_publish?${new URLSearchParams({
        creation_id: creationId,
        access_token: creds.accessToken,
      })}`,
    )
    if (!published.id) return { ok: false, error: published.error?.message || 'Threads publish failed' }

    return { ok: true, data: { id: published.id } }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export interface ThreadsMetrics {
  id: string
  impressions: number
  likes: number
  replies: number
  reposts: number
  quotes: number
}

/** 投稿1件のインサイト取得 */
export async function getPostMetrics(threadsPostId: string): Promise<ThreadsResult<ThreadsMetrics>> {
  if (process.env.SIMULATE_MODE === 'true') return { ok: true, simulated: true }

  const creds = await getThreadsCredentials()
  if (!creds) return { ok: false, error: 'Threads credentials not set' }

  try {
    const url = `${GRAPH_BASE}/${threadsPostId}/insights?${new URLSearchParams({
      metric: 'views,likes,replies,reposts,quotes',
      access_token: creds.accessToken,
    })}`
    const res = await fetch(url)
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ name: string; values?: Array<{ value: number }> }>
      error?: { message: string }
    }
    if (!res.ok || !json.data) return { ok: false, error: json.error?.message || `HTTP ${res.status}` }

    const pick = (name: string) => json.data?.find((m) => m.name === name)?.values?.[0]?.value ?? 0
    return {
      ok: true,
      data: {
        id: threadsPostId,
        impressions: pick('views'),
        likes: pick('likes'),
        replies: pick('replies'),
        reposts: pick('reposts'),
        quotes: pick('quotes'),
      },
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** アカウント全体のインサイト（フォロワー数など） */
export async function getAccountInsights(): Promise<ThreadsResult<{ followers: number }>> {
  if (process.env.SIMULATE_MODE === 'true') return { ok: true, simulated: true }

  const creds = await getThreadsCredentials()
  if (!creds) return { ok: false, error: 'Threads credentials not set' }

  try {
    const url = `${GRAPH_BASE}/${creds.userId}/threads_insights?${new URLSearchParams({
      metric: 'followers_count',
      access_token: creds.accessToken,
    })}`
    const res = await fetch(url)
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ name: string; total_value?: { value: number } }>
      error?: { message: string }
    }
    if (!res.ok || !json.data) return { ok: false, error: json.error?.message || `HTTP ${res.status}` }
    return { ok: true, data: { followers: json.data.find((m) => m.name === 'followers_count')?.total_value?.value ?? 0 } }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

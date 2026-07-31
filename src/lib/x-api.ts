/**
 * X API v2 クライアント。
 *
 * 重要な前提:
 *   - v1.1 の media upload（upload.twitter.com）は 2025-06-09 に完全停止済み。
 *     メディアは全て api.x.com/2/media/upload のチャンクアップロードで送る。
 *   - 認証は OAuth 1.0a (user context)。ユーザー投稿にはこれが一番素直に通る。
 *   - 課金は従量制。呼び出し側が recordCost() で実費を積む前提で、
 *     ここでは「何回どの種別を叩いたか」を戻り値に含める。
 */

const X_API_BASE = 'https://api.x.com/2'
const MEDIA_UPLOAD_URL = `${X_API_BASE}/media/upload`
const TWEETS_URL = `${X_API_BASE}/tweets`

export interface XCredentials {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessTokenSecret: string
}

export interface XResult<T> {
  ok: boolean
  data?: T
  error?: string
  simulated?: boolean
}

// ── 認証情報 ────────────────────────────────────────────────────────────────

export function getXCredentials(): XCredentials | null {
  const consumerKey = (process.env.X_CONSUMER_KEY || '').trim()
  const consumerSecret = (process.env.X_CONSUMER_SECRET || '').trim()
  const accessToken = (process.env.X_ACCESS_TOKEN || '').trim()
  const accessTokenSecret = (process.env.X_ACCESS_TOKEN_SECRET || '').trim()
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) return null
  return { consumerKey, consumerSecret, accessToken, accessTokenSecret }
}

export function missingXCredentials(): string[] {
  return (
    [
      ['X_CONSUMER_KEY', process.env.X_CONSUMER_KEY],
      ['X_CONSUMER_SECRET', process.env.X_CONSUMER_SECRET],
      ['X_ACCESS_TOKEN', process.env.X_ACCESS_TOKEN],
      ['X_ACCESS_TOKEN_SECRET', process.env.X_ACCESS_TOKEN_SECRET],
    ] as const
  )
    .filter(([, v]) => !(v || '').trim())
    .map(([k]) => k)
}

export function isSimulateMode(): boolean {
  return process.env.SIMULATE_MODE === 'true'
}

// ── OAuth 1.0a 署名 ─────────────────────────────────────────────────────────

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

/**
 * Authorization ヘッダを組む。
 * signedParams には「クエリ文字列のパラメータ」と
 * 「application/x-www-form-urlencoded のボディパラメータ」だけを渡す。
 * multipart/form-data のボディは OAuth 1.0a の署名対象外（RFC5849 §3.4.1.3）。
 */
async function buildAuthHeader(
  method: string,
  baseUrl: string,
  signedParams: Record<string, string>,
  creds: XCredentials,
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  }

  const all = { ...oauthParams, ...signedParams }
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(all[k])}`)
    .join('&')

  const signatureBase = `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(paramString)}`
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessTokenSecret)}`

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(signingKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signatureBase))
  oauthParams.oauth_signature = btoa(String.fromCharCode(...new Uint8Array(sig)))

  return (
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(', ')
  )
}

// ── メディアアップロード（v2 チャンク方式） ──────────────────────────────────

interface MediaSource {
  bytes: Uint8Array
  mimeType: string
}

async function loadMedia(url: string): Promise<MediaSource | null> {
  try {
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',')
      if (comma === -1) return null
      const meta = url.slice(5, comma)
      const mimeType = meta.split(';')[0] || 'application/octet-stream'
      return { bytes: new Uint8Array(Buffer.from(url.slice(comma + 1), 'base64')), mimeType }
    }
    const res = await fetch(url)
    if (!res.ok) return null
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      mimeType: res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
    }
  } catch {
    return null
  }
}

function mediaCategory(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'tweet_video'
  if (mimeType === 'image/gif') return 'tweet_gif'
  return 'tweet_image'
}

const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB（X推奨の5MB上限に対して余裕を持たせる）

/**
 * 1件のメディアを X にアップロードして media_id を返す。
 * INIT → APPEND(×n) → FINALIZE →（動画/GIFは）STATUS ポーリング。
 */
export async function uploadMedia(sourceUrl: string, creds: XCredentials): Promise<string | null> {
  const media = await loadMedia(sourceUrl)
  if (!media) {
    console.error('[x-api] media load failed:', sourceUrl.slice(0, 80))
    return null
  }

  const totalBytes = media.bytes.byteLength
  const category = mediaCategory(media.mimeType)

  // INIT — form-urlencoded なのでボディも署名対象
  const initParams: Record<string, string> = {
    command: 'INIT',
    total_bytes: String(totalBytes),
    media_type: media.mimeType,
    media_category: category,
  }
  const initRes = await fetch(MEDIA_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: await buildAuthHeader('POST', MEDIA_UPLOAD_URL, initParams, creds),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(initParams).toString(),
  })
  const initJson = (await initRes.json().catch(() => ({}))) as {
    data?: { id?: string; media_key?: string }
    media_id_string?: string
    errors?: unknown
  }
  const mediaId = initJson.data?.id || initJson.media_id_string
  if (!initRes.ok || !mediaId) {
    console.error('[x-api] media INIT failed', initRes.status, JSON.stringify(initJson))
    return null
  }

  // APPEND — multipart なのでクエリだけ署名対象
  let segmentIndex = 0
  for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
    const chunk = media.bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, totalBytes))
    const query: Record<string, string> = {
      command: 'APPEND',
      media_id: mediaId,
      segment_index: String(segmentIndex),
    }
    const form = new FormData()
    form.append('media', new Blob([chunk as unknown as BlobPart], { type: media.mimeType }), 'chunk')

    const res = await fetch(`${MEDIA_UPLOAD_URL}?${new URLSearchParams(query).toString()}`, {
      method: 'POST',
      headers: { Authorization: await buildAuthHeader('POST', MEDIA_UPLOAD_URL, query, creds) },
      body: form,
    })
    if (!res.ok) {
      console.error('[x-api] media APPEND failed', res.status, await res.text().catch(() => ''))
      return null
    }
    segmentIndex++
  }

  // FINALIZE
  const finalizeParams = { command: 'FINALIZE', media_id: mediaId }
  const finalizeRes = await fetch(MEDIA_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: await buildAuthHeader('POST', MEDIA_UPLOAD_URL, finalizeParams, creds),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(finalizeParams).toString(),
  })
  const finalizeJson = (await finalizeRes.json().catch(() => ({}))) as {
    data?: { processing_info?: { state?: string; check_after_secs?: number } }
    processing_info?: { state?: string; check_after_secs?: number }
  }
  if (!finalizeRes.ok) {
    console.error('[x-api] media FINALIZE failed', finalizeRes.status, JSON.stringify(finalizeJson))
    return null
  }

  // 動画・GIFは非同期処理。完了まで STATUS を見る。
  let info = finalizeJson.data?.processing_info || finalizeJson.processing_info
  let guard = 0
  while (info && (info.state === 'pending' || info.state === 'in_progress') && guard < 20) {
    await new Promise((r) => setTimeout(r, (info?.check_after_secs ?? 5) * 1000))
    const query = { command: 'STATUS', media_id: mediaId }
    const statusRes = await fetch(`${MEDIA_UPLOAD_URL}?${new URLSearchParams(query).toString()}`, {
      headers: { Authorization: await buildAuthHeader('GET', MEDIA_UPLOAD_URL, query, creds) },
    })
    const statusJson = (await statusRes.json().catch(() => ({}))) as {
      data?: { processing_info?: { state?: string; check_after_secs?: number } }
      processing_info?: { state?: string; check_after_secs?: number }
    }
    info = statusJson.data?.processing_info || statusJson.processing_info
    if (info?.state === 'failed') {
      console.error('[x-api] media processing failed', JSON.stringify(statusJson))
      return null
    }
    guard++
  }

  return mediaId
}

/** 複数メディアをまとめてアップロード（Xの上限4件） */
export async function uploadMediaBatch(urls: string[], creds: XCredentials): Promise<string[]> {
  const ids: string[] = []
  for (const url of urls.slice(0, 4)) {
    const id = await uploadMedia(url, creds)
    if (id) ids.push(id)
  }
  return ids
}

// ── 投稿 ────────────────────────────────────────────────────────────────────

export interface CreatePostInput {
  text: string
  mediaUrls?: string[]
  /** リプライ先。スレッド連投で使う */
  replyToPostId?: string
  creds?: XCredentials
}

export async function createPost(input: CreatePostInput): Promise<XResult<{ id: string }>> {
  if (isSimulateMode()) {
    return { ok: true, simulated: true, data: { id: `sim_x_${Date.now()}` } }
  }

  const creds = input.creds ?? getXCredentials()
  if (!creds) return { ok: false, error: `X API credentials not set: ${missingXCredentials().join(', ')}` }

  const mediaIds = input.mediaUrls?.length ? await uploadMediaBatch(input.mediaUrls, creds) : []
  if (input.mediaUrls?.length && mediaIds.length === 0) {
    return { ok: false, error: 'media upload failed — 投稿を中止しました' }
  }

  const body: Record<string, unknown> = { text: input.text }
  if (mediaIds.length > 0) body.media = { media_ids: mediaIds }
  if (input.replyToPostId) body.reply = { in_reply_to_tweet_id: input.replyToPostId }

  try {
    // JSONボディは署名対象外
    const res = await fetch(TWEETS_URL, {
      method: 'POST',
      headers: {
        Authorization: await buildAuthHeader('POST', TWEETS_URL, {}, creds),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string; title?: string }
    if (!res.ok || !json.data?.id) {
      return { ok: false, error: `HTTP ${res.status}: ${json.detail || json.title || JSON.stringify(json)}` }
    }
    return { ok: true, data: { id: json.data.id } }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** スレッド連投。1件目の後続を順番にぶら下げる。 */
export async function createThread(
  texts: string[],
  opts: { mediaUrlsByIndex?: Record<number, string[]>; creds?: XCredentials } = {},
): Promise<XResult<{ ids: string[] }>> {
  const ids: string[] = []
  for (let i = 0; i < texts.length; i++) {
    const res = await createPost({
      text: texts[i],
      mediaUrls: opts.mediaUrlsByIndex?.[i],
      replyToPostId: i === 0 ? undefined : ids[i - 1],
      creds: opts.creds,
    })
    if (!res.ok || !res.data) {
      return { ok: false, error: `${i + 1}件目で失敗: ${res.error}`, data: { ids } }
    }
    ids.push(res.data.id)
  }
  return { ok: true, data: { ids } }
}

// ── 実績取得 ────────────────────────────────────────────────────────────────

export interface XPostMetrics {
  id: string
  text?: string
  impressions: number
  likes: number
  reposts: number
  replies: number
  quotes: number
  bookmarks: number
  profileClicks: number
  linkClicks: number
}

/**
 * 投稿の実績をまとめて取得（1回あたり最大100件）。
 * non_public_metrics / organic_metrics は自分の投稿にのみ付く。
 */
export async function getPostMetrics(ids: string[], creds?: XCredentials): Promise<XResult<XPostMetrics[]>> {
  if (ids.length === 0) return { ok: true, data: [] }
  if (isSimulateMode()) return { ok: true, simulated: true, data: [] }

  const c = creds ?? getXCredentials()
  if (!c) return { ok: false, error: `X API credentials not set: ${missingXCredentials().join(', ')}` }

  const out: XPostMetrics[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const query: Record<string, string> = {
      ids: batch.join(','),
      'tweet.fields': 'public_metrics,non_public_metrics,organic_metrics,created_at,text',
    }
    const url = `${X_API_BASE}/tweets`
    try {
      const res = await fetch(`${url}?${new URLSearchParams(query).toString()}`, {
        headers: { Authorization: await buildAuthHeader('GET', url, query, c) },
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: Array<{
          id: string
          text?: string
          public_metrics?: Record<string, number>
          non_public_metrics?: Record<string, number>
          organic_metrics?: Record<string, number>
        }>
        detail?: string
        title?: string
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${json.detail || json.title || JSON.stringify(json)}` }
      }
      for (const t of json.data ?? []) {
        const pub = t.public_metrics ?? {}
        const nonPub = t.non_public_metrics ?? {}
        const org = t.organic_metrics ?? {}
        out.push({
          id: t.id,
          text: t.text,
          impressions: nonPub.impression_count ?? org.impression_count ?? pub.impression_count ?? 0,
          likes: pub.like_count ?? 0,
          reposts: pub.retweet_count ?? 0,
          replies: pub.reply_count ?? 0,
          quotes: pub.quote_count ?? 0,
          bookmarks: pub.bookmark_count ?? 0,
          profileClicks: nonPub.user_profile_clicks ?? org.user_profile_clicks ?? 0,
          linkClicks: nonPub.url_link_clicks ?? org.url_link_clicks ?? 0,
        })
      }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }
  return { ok: true, data: out }
}

export interface XUserInfo {
  id: string
  username: string
  name: string
  followers: number
  following: number
  postCount: number
}

/** ユーザー情報（フォロワー推移の記録に使う） */
export async function getUser(username: string, creds?: XCredentials): Promise<XResult<XUserInfo>> {
  if (isSimulateMode()) return { ok: true, simulated: true }

  const c = creds ?? getXCredentials()
  if (!c) return { ok: false, error: `X API credentials not set: ${missingXCredentials().join(', ')}` }

  const handle = username.replace(/^@/, '')
  const url = `${X_API_BASE}/users/by/username/${encodeURIComponent(handle)}`
  const query = { 'user.fields': 'public_metrics' }

  try {
    const res = await fetch(`${url}?${new URLSearchParams(query).toString()}`, {
      headers: { Authorization: await buildAuthHeader('GET', url, query, c) },
    })
    const json = (await res.json().catch(() => ({}))) as {
      data?: { id: string; username: string; name: string; public_metrics?: Record<string, number> }
      detail?: string
      title?: string
    }
    if (!res.ok || !json.data) {
      return { ok: false, error: `HTTP ${res.status}: ${json.detail || json.title || JSON.stringify(json)}` }
    }
    const m = json.data.public_metrics ?? {}
    return {
      ok: true,
      data: {
        id: json.data.id,
        username: json.data.username,
        name: json.data.name,
        followers: m.followers_count ?? 0,
        following: m.following_count ?? 0,
        postCount: m.tweet_count ?? 0,
      },
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

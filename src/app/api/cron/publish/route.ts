import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── X (Twitter) OAuth 1.0a posting ──────────────────────────────────────────
async function postToX(content: string): Promise<{ id?: string; simulated?: boolean; error?: string }> {
  const consumerKey = process.env.X_CONSUMER_KEY || ''
  const consumerSecret = process.env.X_CONSUMER_SECRET || ''
  const accessToken = process.env.X_ACCESS_TOKEN || ''
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || ''

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return { simulated: true, id: `sim_x_${Date.now()}` }
  }

  const url = 'https://api.twitter.com/2/tweets'
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = Math.random().toString(36).substring(2)

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  }

  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&')

  const signatureBase = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`

  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signatureBase))
  oauthParams.oauth_signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { error: JSON.stringify(err) }
  }

  const data = await res.json()
  return { id: data.data?.id }
}

// ── Threads posting ──────────────────────────────────────────────────────────
async function postToThreads(content: string): Promise<{ id?: string; simulated?: boolean; error?: string }> {
  const accessToken = process.env.THREADS_ACCESS_TOKEN
  const userId = process.env.THREADS_USER_ID

  if (!accessToken || !userId) {
    return { simulated: true, id: `sim_threads_${Date.now()}` }
  }

  // Step 1: Create container
  const containerRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'TEXT', text: content, access_token: accessToken }),
  })
  const container = await containerRes.json() as { id?: string; error?: { message: string } }
  if (!container.id) return { error: container.error?.message || 'container creation failed' }

  // Step 2: Publish
  await new Promise(r => setTimeout(r, 1000))
  const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
  })
  const published = await publishRes.json() as { id?: string; error?: { message: string } }
  if (!published.id) return { error: published.error?.message || 'publish failed' }

  return { id: published.id }
}

// ── Cron handler (GET) ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()

  // Find all posts due for publishing (scheduledAt <= now, still 予約済み)
  const duePosts = await prisma.post.findMany({
    where: {
      status: '予約済み',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  if (duePosts.length === 0) {
    return NextResponse.json({ posted: 0, message: '投稿予定なし' })
  }

  const results: { id: string; xOk: boolean; threadsOk: boolean; errors: string[] }[] = []

  for (const post of duePosts) {
    const errors: string[] = []
    const platform = post.platform || 'both'
    const postToXFlag = platform === 'x' || platform === 'both'
    const postToThreadsFlag = platform === 'threads' || platform === 'both'

    let xPostId: string | null = post.xPostId
    let threadsPostId: string | null = post.threadsPostId

    // Post to X
    if (postToXFlag) {
      const xResult = await postToX(post.content)
      if (xResult.error) {
        errors.push(`X: ${xResult.error}`)
      } else {
        xPostId = xResult.id || null
      }
    }

    // Post to Threads
    if (postToThreadsFlag) {
      const threadsResult = await postToThreads(post.content)
      if (threadsResult.error) {
        errors.push(`Threads: ${threadsResult.error}`)
      } else {
        threadsPostId = threadsResult.id || null
      }
    }

    // Update DB
    const newStatus = errors.length > 0 && errors.length === (postToXFlag ? 1 : 0) + (postToThreadsFlag ? 1 : 0)
      ? '失敗'
      : '投稿済み'

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: newStatus,
        postedAt: now,
        xPostId: xPostId ?? undefined,
        threadsPostId: threadsPostId ?? undefined,
      },
    })

    results.push({ id: post.id, xOk: !errors.some(e => e.startsWith('X')), threadsOk: !errors.some(e => e.startsWith('Threads')), errors })
    console.log(`[cron/publish] post ${post.id} → ${newStatus}`, errors.length ? errors : 'ok')
  }

  return NextResponse.json({ posted: results.length, results })
}

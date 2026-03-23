/**
 * Shared posting logic for X (Twitter) and Threads APIs.
 * Used by /api/cron/publish and /api/posts/[id]/publish
 *
 * Simulate mode is DISABLED by default.
 * To enable simulation (e.g. for local dev without real credentials),
 * set SIMULATE_MODE=true in your environment variables.
 */

export interface PostResult {
  id?: string
  simulated?: boolean
  error?: string
}

// ── X (Twitter) OAuth 1.0a ──────────────────────────────────────────────────
export async function postToX(content: string): Promise<PostResult> {
  // ── Debug: log env var presence (never log actual values for security) ──
  console.log('=== X API Environment Variables Check ===')
  console.log('X_CONSUMER_KEY exists:', !!process.env.X_CONSUMER_KEY, '| length:', process.env.X_CONSUMER_KEY?.trim().length ?? 0)
  console.log('X_CONSUMER_SECRET exists:', !!process.env.X_CONSUMER_SECRET, '| length:', process.env.X_CONSUMER_SECRET?.trim().length ?? 0)
  console.log('X_ACCESS_TOKEN exists:', !!process.env.X_ACCESS_TOKEN, '| length:', process.env.X_ACCESS_TOKEN?.trim().length ?? 0)
  console.log('X_ACCESS_TOKEN_SECRET exists:', !!process.env.X_ACCESS_TOKEN_SECRET, '| length:', process.env.X_ACCESS_TOKEN_SECRET?.trim().length ?? 0)
  console.log('SIMULATE_MODE:', process.env.SIMULATE_MODE)
  console.log('NODE_ENV:', process.env.NODE_ENV)

  // Explicit simulate mode — must be opted-in via SIMULATE_MODE=true
  if (process.env.SIMULATE_MODE === 'true') {
    console.warn('[poster] SIMULATE_MODE=true — skipping real X API call')
    return { simulated: true, id: `sim_x_${Date.now()}` }
  }

  // Trim credentials to avoid whitespace issues from Vercel copy-paste
  const consumerKey = (process.env.X_CONSUMER_KEY || '').trim()
  const consumerSecret = (process.env.X_CONSUMER_SECRET || '').trim()
  const accessToken = (process.env.X_ACCESS_TOKEN || '').trim()
  const accessTokenSecret = (process.env.X_ACCESS_TOKEN_SECRET || '').trim()

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    const missing = [
      !consumerKey && 'X_CONSUMER_KEY',
      !consumerSecret && 'X_CONSUMER_SECRET',
      !accessToken && 'X_ACCESS_TOKEN',
      !accessTokenSecret && 'X_ACCESS_TOKEN_SECRET',
    ].filter(Boolean).join(', ')
    console.error(`[poster] X API credentials missing: ${missing}`)
    return { error: `X API credentials not set: ${missing}` }
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

  console.log('[poster] Calling X API v2 /tweets ...')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    })

    const data = await res.json()
    if (!res.ok) {
      const msg = JSON.stringify(data)
      console.error('[poster] X API error', res.status, msg)
      return { error: `HTTP ${res.status}: ${msg}` }
    }

    console.log('[poster] X posted successfully, id:', data.data?.id)
    return { id: data.data?.id }
  } catch (err) {
    console.error('[poster] X API fetch exception:', err)
    return { error: String(err) }
  }
}

// ── Threads credentials: env vars first, DB as fallback ──────────────────────
async function getThreadsCredentials(): Promise<{ accessToken: string; userId: string }> {
  const envToken = (process.env.THREADS_ACCESS_TOKEN || '').trim()
  const envUserId = (process.env.THREADS_USER_ID || '').trim()

  // If both env vars are set, use them directly (no DB lookup needed)
  if (envToken && envUserId) {
    return { accessToken: envToken, userId: envUserId }
  }

  // Fall back to DB for any missing values
  try {
    const { prisma } = await import('@/lib/prisma')
    const [tokenRow, userIdRow] = await Promise.all([
      !envToken ? prisma.settings.findUnique({ where: { key: 'threads_access_token' } }) : Promise.resolve(null),
      !envUserId ? prisma.settings.findUnique({ where: { key: 'threads_user_id' } }) : Promise.resolve(null),
    ])
    return {
      accessToken: envToken || tokenRow?.value || '',
      userId: envUserId || userIdRow?.value || '',
    }
  } catch {
    return { accessToken: envToken, userId: envUserId }
  }
}

// ── Threads ─────────────────────────────────────────────────────────────────
export async function postToThreads(content: string): Promise<PostResult> {
  if (process.env.SIMULATE_MODE === 'true') {
    console.warn('[poster] SIMULATE_MODE=true — skipping real Threads API call')
    return { simulated: true, id: `sim_threads_${Date.now()}` }
  }

  const { accessToken, userId } = await getThreadsCredentials()
  console.log('=== Threads Credentials Check ===')
  console.log('accessToken exists:', !!accessToken, '| length:', accessToken.length)
  console.log('userId exists:', !!userId, '| value:', userId)

  if (!accessToken || !userId) {
    const missing = [
      !accessToken && 'THREADS_ACCESS_TOKEN',
      !userId && 'THREADS_USER_ID',
    ].filter(Boolean).join(', ')
    console.error(`[poster] Threads credentials missing: ${missing}`)
    return { error: `Threads credentials not set: ${missing}` }
  }

  // Threads text limit is 500 characters — truncate if necessary
  const THREADS_MAX_CHARS = 500
  const threadsText = content.length > THREADS_MAX_CHARS
    ? content.slice(0, THREADS_MAX_CHARS - 3) + '...'
    : content
  console.log(`[poster] Calling Threads API, userId: ${userId}, content length: ${threadsText.length}${content.length > THREADS_MAX_CHARS ? ' (truncated from ' + content.length + ')' : ''}`)

  try {
    // Step 1: Create container
    const containerRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'TEXT', text: threadsText, access_token: accessToken }),
    })
    const container = await containerRes.json() as { id?: string; error?: { message: string } }
    if (!container.id) {
      const msg = container.error?.message || 'Threads container creation failed'
      console.error('[poster] Threads container error:', msg)
      return { error: msg }
    }
    console.log('[poster] Threads container created:', container.id)

    // Step 2: Wait for media processing (Threads requires a delay; 2s is safer than 1s)
    await new Promise(r => setTimeout(r, 2000))
    const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
    })
    const published = await publishRes.json() as { id?: string; error?: { message: string } }
    if (!published.id) {
      const msg = published.error?.message || 'Threads publish failed'
      console.error('[poster] Threads publish error:', msg)
      return { error: msg }
    }

    console.log('[poster] Threads posted successfully, id:', published.id)
    return { id: published.id }
  } catch (err) {
    console.error('[poster] Threads API fetch exception:', err)
    return { error: String(err) }
  }
}

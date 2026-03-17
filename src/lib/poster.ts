/**
 * Shared posting logic for X (Twitter) and Threads APIs.
 * Used by /api/cron/publish and /api/posts/[id]/publish
 */

export interface PostResult {
  id?: string
  simulated?: boolean
  error?: string
}

// ── X (Twitter) OAuth 1.0a ──────────────────────────────────────────────────
export async function postToX(content: string): Promise<PostResult> {
  const consumerKey = process.env.X_CONSUMER_KEY || ''
  const consumerSecret = process.env.X_CONSUMER_SECRET || ''
  const accessToken = process.env.X_ACCESS_TOKEN || ''
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || ''

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    console.warn('[poster] X API credentials not set — simulating')
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

    console.log('[poster] X posted:', data.data?.id)
    return { id: data.data?.id }
  } catch (err) {
    return { error: String(err) }
  }
}

// ── Threads ─────────────────────────────────────────────────────────────────
export async function postToThreads(content: string): Promise<PostResult> {
  const accessToken = process.env.THREADS_ACCESS_TOKEN
  const userId = process.env.THREADS_USER_ID

  if (!accessToken || !userId) {
    console.warn('[poster] Threads credentials not set — simulating')
    return { simulated: true, id: `sim_threads_${Date.now()}` }
  }

  try {
    // Step 1: Create container
    const containerRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'TEXT', text: content, access_token: accessToken }),
    })
    const container = await containerRes.json() as { id?: string; error?: { message: string } }
    if (!container.id) {
      return { error: container.error?.message || 'Threads container creation failed' }
    }

    // Step 2: Wait then publish
    await new Promise(r => setTimeout(r, 1000))
    const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
    })
    const published = await publishRes.json() as { id?: string; error?: { message: string } }
    if (!published.id) {
      return { error: published.error?.message || 'Threads publish failed' }
    }

    console.log('[poster] Threads posted:', published.id)
    return { id: published.id }
  } catch (err) {
    return { error: String(err) }
  }
}

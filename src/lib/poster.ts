/**
 * Shared posting logic for X (Twitter) and Threads APIs.
 * Used by /api/cron/publish and /api/posts/[id]/publish
 */

export interface PostResult {
  id?: string
  simulated?: boolean
  error?: string
}

interface XCredentials {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessTokenSecret: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build OAuth 1.0a Authorization header.
 * signedParams: body params (form-encoded POST) or query params (GET) to include in signature.
 */
async function buildXOAuthHeader(
  method: string,
  url: string,
  signedParams: Record<string, string>,
  creds: XCredentials
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  }

  const allParams = { ...oauthParams, ...signedParams }
  const paramString = Object.keys(allParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&')

  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
  const signingKey = `${encodeURIComponent(creds.consumerSecret)}&${encodeURIComponent(creds.accessTokenSecret)}`

  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signatureBase))
  oauthParams.oauth_signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
}

/** Convert Uint8Array to base64 safely (avoids call-stack overflow for large buffers) */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * Upload a single image to X via the simple Media Upload API.
 * Returns media_id_string on success, null on failure.
 */
async function uploadImageToX(imageUrl: string, creds: XCredentials): Promise<string | null> {
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) { console.error('[poster] Failed to fetch image:', imageUrl); return null }
    const buffer = await imgRes.arrayBuffer()
    const base64 = uint8ToBase64(new Uint8Array(buffer))

    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json'
    const bodyParams = { media_data: base64 }
    const authHeader = await buildXOAuthHeader('POST', uploadUrl, bodyParams, creds)

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(bodyParams).toString(),
    })
    const data = await res.json()
    if (!res.ok) { console.error('[poster] X media upload error:', data); return null }
    console.log('[poster] X image uploaded, media_id:', data.media_id_string)
    return data.media_id_string || null
  } catch (err) {
    console.error('[poster] uploadImageToX exception:', err)
    return null
  }
}

/**
 * Upload a video to X using the chunked Media Upload API (INIT/APPEND/FINALIZE/STATUS).
 * Returns media_id_string on success, null on failure.
 */
async function uploadVideoToX(videoUrl: string, creds: XCredentials): Promise<string | null> {
  try {
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) { console.error('[poster] Failed to fetch video:', videoUrl); return null }
    const buffer = await videoRes.arrayBuffer()
    const totalBytes = buffer.byteLength
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json'

    // INIT
    const initParams = { command: 'INIT', total_bytes: totalBytes.toString(), media_type: 'video/mp4' }
    const initAuth = await buildXOAuthHeader('POST', uploadUrl, initParams, creds)
    const initRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Authorization': initAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(initParams).toString(),
    })
    const initData = await initRes.json()
    if (!initData.media_id_string) { console.error('[poster] X video INIT failed:', initData); return null }
    const mediaId: string = initData.media_id_string
    console.log('[poster] X video INIT, media_id:', mediaId)

    // APPEND in 5MB chunks
    const CHUNK_SIZE = 5 * 1024 * 1024
    const uint8 = new Uint8Array(buffer)
    let segmentIndex = 0
    for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
      const chunk = uint8.subarray(offset, offset + CHUNK_SIZE)
      const base64Chunk = uint8ToBase64(chunk)
      const appendParams: Record<string, string> = {
        command: 'APPEND',
        media_id: mediaId,
        segment_index: segmentIndex.toString(),
        media_data: base64Chunk,
      }
      const appendAuth = await buildXOAuthHeader('POST', uploadUrl, appendParams, creds)
      await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': appendAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(appendParams).toString(),
      })
      segmentIndex++
    }
    console.log('[poster] X video APPEND done, segments:', segmentIndex)

    // FINALIZE
    const finalParams = { command: 'FINALIZE', media_id: mediaId }
    const finalAuth = await buildXOAuthHeader('POST', uploadUrl, finalParams, creds)
    const finalRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Authorization': finalAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(finalParams).toString(),
    })
    const finalData = await finalRes.json()
    console.log('[poster] X video FINALIZE:', finalData.processing_info)

    // Poll STATUS if async processing needed
    if (finalData.processing_info) {
      let state: string = finalData.processing_info.state || 'pending'
      let checkAfterSecs: number = finalData.processing_info.check_after_secs || 5
      while (state === 'pending' || state === 'in_progress') {
        await new Promise(r => setTimeout(r, checkAfterSecs * 1000))
        const statusQueryParams = { command: 'STATUS', media_id: mediaId }
        const statusAuth = await buildXOAuthHeader('GET', uploadUrl, statusQueryParams, creds)
        const statusRes = await fetch(`${uploadUrl}?command=STATUS&media_id=${mediaId}`, {
          headers: { 'Authorization': statusAuth },
        })
        const statusData = await statusRes.json()
        state = statusData.processing_info?.state || 'failed'
        checkAfterSecs = statusData.processing_info?.check_after_secs || 5
        console.log('[poster] X video STATUS:', state)
        if (state === 'failed') { console.error('[poster] X video processing failed'); return null }
      }
    }

    return mediaId
  } catch (err) {
    console.error('[poster] uploadVideoToX exception:', err)
    return null
  }
}

function isVideo(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url)
}

// ── X (Twitter) ──────────────────────────────────────────────────────────────
export async function postToX(content: string, mediaUrls?: string[]): Promise<PostResult> {
  console.log('=== X API Environment Variables Check ===')
  console.log('X_CONSUMER_KEY exists:', !!process.env.X_CONSUMER_KEY, '| length:', process.env.X_CONSUMER_KEY?.trim().length ?? 0)
  console.log('X_CONSUMER_SECRET exists:', !!process.env.X_CONSUMER_SECRET, '| length:', process.env.X_CONSUMER_SECRET?.trim().length ?? 0)
  console.log('X_ACCESS_TOKEN exists:', !!process.env.X_ACCESS_TOKEN, '| length:', process.env.X_ACCESS_TOKEN?.trim().length ?? 0)
  console.log('X_ACCESS_TOKEN_SECRET exists:', !!process.env.X_ACCESS_TOKEN_SECRET, '| length:', process.env.X_ACCESS_TOKEN_SECRET?.trim().length ?? 0)
  console.log('SIMULATE_MODE:', process.env.SIMULATE_MODE)

  if (process.env.SIMULATE_MODE === 'true') {
    console.warn('[poster] SIMULATE_MODE=true — skipping real X API call')
    return { simulated: true, id: `sim_x_${Date.now()}` }
  }

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

  const creds: XCredentials = { consumerKey, consumerSecret, accessToken, accessTokenSecret }

  // Upload media if provided
  const mediaIds: string[] = []
  if (mediaUrls && mediaUrls.length > 0) {
    console.log('[poster] Uploading', mediaUrls.length, 'media files to X...')
    for (const url of mediaUrls.slice(0, 4)) {
      const mediaId = isVideo(url)
        ? await uploadVideoToX(url, creds)
        : await uploadImageToX(url, creds)
      if (mediaId) mediaIds.push(mediaId)
    }
    console.log('[poster] Uploaded media_ids:', mediaIds)
  }

  // Build tweet body
  const url = 'https://api.twitter.com/2/tweets'
  const tweetBody: Record<string, unknown> = { text: content }
  if (mediaIds.length > 0) {
    tweetBody.media = { media_ids: mediaIds }
  }

  // OAuth for tweets API v2 — JSON body, so no body params in signature
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
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
      body: JSON.stringify(tweetBody),
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

// ── Threads credentials ───────────────────────────────────────────────────────
async function getThreadsCredentials(): Promise<{ accessToken: string; userId: string }> {
  const envToken = (process.env.THREADS_ACCESS_TOKEN || '').trim()
  const envUserId = (process.env.THREADS_USER_ID || '').trim()

  if (envToken && envUserId) {
    return { accessToken: envToken, userId: envUserId }
  }

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

// ── Threads ───────────────────────────────────────────────────────────────────
export async function postToThreads(content: string, mediaUrls?: string[]): Promise<PostResult> {
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

  const THREADS_MAX_CHARS = 500
  const threadsText = content.length > THREADS_MAX_CHARS
    ? content.slice(0, THREADS_MAX_CHARS - 3) + '...'
    : content

  const baseUrl = `https://graph.threads.net/v1.0/${userId}/threads`

  try {
    let creationId: string

    const images = (mediaUrls || []).filter(u => !isVideo(u))
    const videos = (mediaUrls || []).filter(u => isVideo(u))

    if (videos.length > 0) {
      // Single video post (video takes priority, ignoring images per X/Threads rules)
      const containerRes = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'VIDEO',
          video_url: videos[0],
          text: threadsText,
          access_token: accessToken,
        }),
      })
      const container = await containerRes.json() as { id?: string; error?: { message: string } }
      if (!container.id) {
        const msg = container.error?.message || 'Threads container creation failed'
        console.error('[poster] Threads video container error:', msg)
        return { error: msg }
      }
      creationId = container.id
    } else if (images.length === 1) {
      // Single image post
      const containerRes = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'IMAGE',
          image_url: images[0],
          text: threadsText,
          access_token: accessToken,
        }),
      })
      const container = await containerRes.json() as { id?: string; error?: { message: string } }
      if (!container.id) {
        const msg = container.error?.message || 'Threads container creation failed'
        console.error('[poster] Threads image container error:', msg)
        return { error: msg }
      }
      creationId = container.id
    } else if (images.length > 1) {
      // Carousel post
      const itemIds: string[] = []
      for (const imageUrl of images.slice(0, 4)) {
        const itemRes = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'IMAGE',
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        })
        const item = await itemRes.json() as { id?: string; error?: { message: string } }
        if (item.id) itemIds.push(item.id)
      }
      if (itemIds.length === 0) return { error: 'Threads carousel item creation failed' }

      const carouselRes = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: itemIds,
          text: threadsText,
          access_token: accessToken,
        }),
      })
      const carousel = await carouselRes.json() as { id?: string; error?: { message: string } }
      if (!carousel.id) {
        const msg = carousel.error?.message || 'Threads carousel creation failed'
        console.error('[poster] Threads carousel error:', msg)
        return { error: msg }
      }
      creationId = carousel.id
    } else {
      // Text only
      const containerRes = await fetch(baseUrl, {
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
      creationId = container.id
    }

    console.log('[poster] Threads container created:', creationId)

    // Wait for media processing then publish
    await new Promise(r => setTimeout(r, 2000))
    const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
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

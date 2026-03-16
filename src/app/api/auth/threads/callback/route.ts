import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      `${getBaseUrl(req)}/settings?tab=accounts&error=${encodeURIComponent(error || 'no_code')}`
    )
  }

  const appId = process.env.THREADS_APP_ID
  const appSecret = process.env.THREADS_APP_SECRET
  const baseUrl = getBaseUrl(req)
  const redirectUri = `${baseUrl}/api/auth/threads/callback`

  if (!appId || !appSecret) {
    return NextResponse.redirect(`${baseUrl}/settings?tab=accounts&error=missing_env`)
  }

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_message || 'Token exchange failed')
    }

    // Exchange for long-lived token
    const longRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${appSecret}&access_token=${tokenData.access_token}`
    )
    const longData = await longRes.json()
    const finalToken = longData.access_token || tokenData.access_token
    const userId = tokenData.user_id

    // Redirect to settings with token info (user saves it to Vercel env vars)
    const params = new URLSearchParams({
      tab: 'accounts',
      threads_token: finalToken,
      threads_user_id: String(userId),
      success: '1',
    })
    return NextResponse.redirect(`${baseUrl}/settings?${params}`)
  } catch (e) {
    console.error('[threads-callback]', e)
    return NextResponse.redirect(`${baseUrl}/settings?tab=accounts&error=token_exchange_failed`)
  }
}

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || ''
  const proto = host.includes('localhost') ? 'http' : 'https'
  return `${proto}://${host}`
}

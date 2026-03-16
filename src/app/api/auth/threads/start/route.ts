import { NextResponse } from 'next/server'

export async function GET() {
  const appId = process.env.THREADS_APP_ID
  if (!appId) {
    return NextResponse.json({ error: 'THREADS_APP_ID が設定されていません' }, { status: 400 })
  }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/threads/callback`)
  const scope = encodeURIComponent('threads_basic,threads_content_publish')

  const authUrl = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`

  return NextResponse.redirect(authUrl)
}

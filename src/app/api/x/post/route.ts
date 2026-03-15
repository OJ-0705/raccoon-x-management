import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postId } = body

    const post = await prisma.post.findUnique({ where: { id: postId } })
    if (!post) return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })

    // X API v2 posting with OAuth 1.0a
    const tweetText = post.content

    const consumerKey = process.env.X_CONSUMER_KEY || ''
    const consumerSecret = process.env.X_CONSUMER_SECRET || ''
    const accessToken = process.env.X_ACCESS_TOKEN || ''
    const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || ''

    if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
      // Simulate posting if no credentials
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: '投稿済み',
          postedAt: new Date(),
          xPostId: `simulated_${Date.now()}`,
        },
      })
      return NextResponse.json({ success: true, simulated: true, message: 'X APIキーが未設定のためシミュレートしました' })
    }

    // OAuth 1.0a signature generation
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = Math.random().toString(36).substring(2)
    const url = 'https://api.twitter.com/2/tweets'
    const requestBody = JSON.stringify({ text: tweetText })

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: accessToken,
      oauth_version: '1.0',
    }

    // Build signature base string
    const paramString = Object.keys(oauthParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
      .join('&')

    const signatureBase = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`

    // Use Web Crypto API for HMAC-SHA1
    const encoder = new TextEncoder()
    const keyData = encoder.encode(signingKey)
    const messageData = encoder.encode(signatureBase)
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

    oauthParams.oauth_signature = signature

    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json({ error: 'X APIエラー', details: errorData }, { status: response.status })
    }

    const tweetData = await response.json()
    const tweetId = tweetData.data?.id

    await prisma.post.update({
      where: { id: postId },
      data: {
        status: '投稿済み',
        postedAt: new Date(),
        xPostId: tweetId,
      },
    })

    return NextResponse.json({ success: true, tweetId })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'X投稿に失敗しました', details: String(error) }, { status: 500 })
  }
}

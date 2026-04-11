import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MAX_CALLS_PER_DAY = 3
const COST_PER_X_POST = 0.005

// ── OAuth 1.0a for X API GET ──────────────────────────────────────────────────
async function buildXGetAuthHeader(queryParams: Record<string, string>): Promise<string> {
  const consumerKey = (process.env.X_CONSUMER_KEY || '').trim()
  const consumerSecret = (process.env.X_CONSUMER_SECRET || '').trim()
  const accessToken = (process.env.X_ACCESS_TOKEN || '').trim()
  const accessTokenSecret = (process.env.X_ACCESS_TOKEN_SECRET || '').trim()

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  }

  const allParams = { ...oauthParams, ...queryParams }
  const paramString = Object.keys(allParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&')

  const baseUrl = 'https://api.twitter.com/2/tweets'
  const signatureBase = `GET&${encodeURIComponent(baseUrl)}&${encodeURIComponent(paramString)}`
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`

  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signatureBase))
  oauthParams.oauth_signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))

  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
}

// ── Threads credentials ───────────────────────────────────────────────────────
async function getThreadsToken(): Promise<{ accessToken: string; userId: string }> {
  const envToken = (process.env.THREADS_ACCESS_TOKEN || '').trim()
  const envUserId = (process.env.THREADS_USER_ID || '').trim()
  if (envToken && envUserId) return { accessToken: envToken, userId: envUserId }
  try {
    const [tokenRow, userIdRow] = await Promise.all([
      !envToken ? prisma.settings.findUnique({ where: { key: 'threads_access_token' } }) : Promise.resolve(null),
      !envUserId ? prisma.settings.findUnique({ where: { key: 'threads_user_id' } }) : Promise.resolve(null),
    ])
    return { accessToken: envToken || tokenRow?.value || '', userId: envUserId || userIdRow?.value || '' }
  } catch {
    return { accessToken: envToken, userId: envUserId }
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Accept either a valid session (dashboard UI) or Bearer ADMIN_PASSWORD (cron)
  const session = await getServerSession(authOptions)
  const bearer = req.headers.get('Authorization')
  const isAdmin = bearer === `Bearer ${process.env.ADMIN_PASSWORD}`
  if (!session && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Rate limit: max MAX_CALLS_PER_DAY per day
  const xUsage = await prisma.apiUsage.findUnique({
    where: { date_provider: { date: today, provider: 'x' } },
  })
  if ((xUsage?.callCount || 0) >= MAX_CALLS_PER_DAY) {
    return NextResponse.json({ error: '本日のアナリティクス取得上限に達しました（1日最大3回）' }, { status: 429 })
  }

  // Get published posts with external IDs
  const posts = await prisma.post.findMany({
    where: {
      status: '投稿済み',
      OR: [{ xPostId: { not: null } }, { threadsPostId: { not: null } }],
    },
    select: { id: true, postType: true, xPostId: true, threadsPostId: true },
  })

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Find posts already fetched within 24h (X)
  const recentX = await prisma.postAnalytics.findMany({
    where: { platform: 'x', fetchedAt: { gte: twentyFourHoursAgo } },
    select: { postId: true },
  })
  const recentXIds = new Set(recentX.map(r => r.postId))

  const postsForX = posts.filter(p => p.xPostId && !recentXIds.has(p.id))
  const postsForThreads = posts.filter(p => p.threadsPostId)

  const results = { x: 0, threads: 0, skippedX: posts.filter(p => p.xPostId).length - postsForX.length, errors: [] as string[], costUsd: 0 }

  // ═══ X API ═══════════════════════════════════════════════════════════════════
  if (postsForX.length > 0) {
    const batch = postsForX.slice(0, 100)
    const xIds = batch.map(p => p.xPostId!)
    const queryParams: Record<string, string> = {
      ids: xIds.join(','),
      'tweet.fields': 'public_metrics,created_at',
    }

    try {
      const authHeader = await buildXGetAuthHeader(queryParams)
      const url = new URL('https://api.twitter.com/2/tweets')
      Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v))

      const res = await fetch(url.toString(), { headers: { Authorization: authHeader } })
      const data = await res.json() as {
        data?: { id: string; public_metrics: { impression_count?: number; like_count?: number; retweet_count?: number; reply_count?: number; quote_count?: number; bookmark_count?: number } }[]
        errors?: unknown
      }

      if (res.ok && data.data) {
        for (const tweet of data.data) {
          const m = tweet.public_metrics
          const post = batch.find(p => p.xPostId === tweet.id)
          if (!post) continue

          const imp = m.impression_count || 0
          const eng = (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0) + (m.quote_count || 0)
          const engRate = imp > 0 ? (eng / imp) * 100 : 0

          await prisma.postAnalytics.upsert({
            where: { postId_platform_fetchDate: { postId: post.id, platform: 'x', fetchDate: today } },
            create: {
              postId: post.id, platform: 'x', externalId: tweet.id,
              impressions: imp, likes: m.like_count || 0,
              reposts: m.retweet_count || 0, replies: m.reply_count || 0,
              quotes: m.quote_count || 0, engagementRate: engRate, fetchDate: today,
            },
            update: {
              impressions: imp, likes: m.like_count || 0,
              reposts: m.retweet_count || 0, replies: m.reply_count || 0,
              quotes: m.quote_count || 0, engagementRate: engRate,
            },
          })

          // Sync back to Post table
          await prisma.post.update({
            where: { id: post.id },
            data: {
              impressions: imp,
              likes: m.like_count || 0,
              retweets: m.retweet_count || 0,
              replies: m.reply_count || 0,
              bookmarks: m.bookmark_count || 0,
            },
          })
          results.x++
        }

        const cost = batch.length * COST_PER_X_POST
        results.costUsd += cost

        // Update daily API usage
        await prisma.apiUsage.upsert({
          where: { date_provider: { date: today, provider: 'x' } },
          create: { date: today, provider: 'x', callCount: 1, postCount: batch.length, costUsd: cost },
          update: { callCount: { increment: 1 }, postCount: { increment: batch.length }, costUsd: { increment: cost } },
        })

        // Monthly cost log
        const thisMonth = today.slice(0, 7)
        const monthlyRows = await prisma.apiUsage.findMany({ where: { date: { startsWith: thisMonth }, provider: 'x' } })
        const monthlyCost = monthlyRows.reduce((s, r) => s + r.costUsd, 0)
        console.log(`[analytics/fetch] X: ${results.x}件更新 — 消費: $${cost.toFixed(3)} — 今月累計: $${monthlyCost.toFixed(2)} / $5.00上限`)
      } else {
        const errMsg = JSON.stringify(data.errors || data)
        results.errors.push(`X API error: ${errMsg}`)
        console.error('[analytics/fetch] X API error:', errMsg)
      }
    } catch (err) {
      const msg = String(err)
      results.errors.push(`X fetch exception: ${msg}`)
      console.error('[analytics/fetch] X exception:', msg)
    }
  }

  // ═══ Threads API ═════════════════════════════════════════════════════════════
  if (postsForThreads.length > 0) {
    const { accessToken } = await getThreadsToken()

    if (!accessToken) {
      results.errors.push('Threads認証情報なし（THREADS_ACCESS_TOKENまたはDB設定が必要）')
    } else {
      for (const post of postsForThreads.slice(0, 50)) {
        // 24h dedup for Threads
        const recentThreads = await prisma.postAnalytics.findFirst({
          where: { postId: post.id, platform: 'threads', fetchedAt: { gte: twentyFourHoursAgo } },
        })
        if (recentThreads) continue

        try {
          const insightsUrl =
            `https://graph.threads.net/v1.0/${post.threadsPostId}/insights` +
            `?metric=views,likes,replies,reposts,quotes&access_token=${accessToken}`
          const res = await fetch(insightsUrl)
          const data = await res.json() as { data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }

          if (res.ok && data.data) {
            const m: Record<string, number> = {}
            for (const item of data.data) {
              m[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? 0
            }

            const views = m.views || 0
            const likes = m.likes || 0
            const replies = m.replies || 0
            const reposts = m.reposts || 0
            const quotes = m.quotes || 0
            const eng = likes + replies + reposts + quotes
            const engRate = views > 0 ? (eng / views) * 100 : 0

            await prisma.postAnalytics.upsert({
              where: { postId_platform_fetchDate: { postId: post.id, platform: 'threads', fetchDate: today } },
              create: {
                postId: post.id, platform: 'threads', externalId: post.threadsPostId!,
                impressions: views, likes, reposts, replies, quotes,
                engagementRate: engRate, fetchDate: today,
              },
              update: { impressions: views, likes, reposts, replies, quotes, engagementRate: engRate },
            })

            await prisma.post.update({
              where: { id: post.id },
              data: { threadsImp: views, threadsLikes: likes, threadsReplies: replies, threadsReposts: reposts },
            })
            results.threads++
          }
        } catch (err) {
          results.errors.push(`Threads ${post.threadsPostId}: ${String(err)}`)
        }
      }
      console.log(`[analytics/fetch] Threads: ${results.threads}件更新`)
    }
  }

  return NextResponse.json({
    success: true,
    x: results.x,
    threads: results.threads,
    skippedX: results.skippedX,
    costUsd: results.costUsd,
    errors: results.errors.length > 0 ? results.errors : undefined,
  })
}

/**
 * GET /api/admin/cron-test
 *
 * Manually triggers the same logic as /api/cron/publish.
 * Use this to test scheduled posting without waiting for the cron.
 *
 * Auth: Authorization: Bearer <ADMIN_PASSWORD>  or  ?secret=<ADMIN_PASSWORD>
 *
 * curl example:
 *   curl https://YOUR_URL/api/admin/cron-test \
 *     -H "Authorization: Bearer raccoon2026"
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { postToX, postToThreads } from '@/lib/poster'

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_PASSWORD || 'raccoon2026'
  const authHeader = req.headers.get('authorization')
  const querySecret = new URL(req.url).searchParams.get('secret')
  return authHeader === `Bearer ${secret}` || querySecret === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized. Pass Authorization: Bearer <ADMIN_PASSWORD>' }, { status: 401 })
  }

  const now = new Date()
  const results: Array<{
    id: string
    postType: string
    platform: string
    scheduledAt: string
    xResult?: object
    threadsResult?: object
    status: string
  }> = []

  // Find all due posts (same logic as cron/publish)
  const duePosts = await prisma.post.findMany({
    where: {
      status: '予約済み',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  if (duePosts.length === 0) {
    return NextResponse.json({
      message: `No due posts found at ${now.toISOString()}`,
      now: now.toISOString(),
    })
  }

  for (const post of duePosts) {
    const row: (typeof results)[number] = {
      id: post.id,
      postType: post.postType || '',
      platform: post.platform,
      scheduledAt: post.scheduledAt?.toISOString() ?? '',
      status: '処理中',
    }

    let xOk = false
    let threadsOk = false
    let xPostId: string | undefined
    let threadsPostId: string | undefined

    if (post.platform === 'x' || post.platform === 'both') {
      const r = await postToX(post.content)
      row.xResult = r
      if (r.id) { xOk = true; xPostId = r.id }
    }

    if (post.platform === 'threads' || post.platform === 'both') {
      const r = await postToThreads(post.content)
      row.threadsResult = r
      if (r.id) { threadsOk = true; threadsPostId = r.id }
    }

    const allOk = (post.platform === 'x' && xOk)
      || (post.platform === 'threads' && threadsOk)
      || (post.platform === 'both' && (xOk || threadsOk))

    const newStatus = allOk ? '投稿済み' : '失敗'
    row.status = newStatus

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: newStatus,
        postedAt: allOk ? now : undefined,
        xPostId: xPostId ?? undefined,
        threadsPostId: threadsPostId ?? undefined,
      },
    })

    results.push(row)
  }

  return NextResponse.json({
    processed: results.length,
    now: now.toISOString(),
    results,
  })
}

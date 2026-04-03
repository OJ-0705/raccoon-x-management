import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { postToX, postToThreads } from '@/lib/poster'

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (if set)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  // 5-minute look-ahead: publish posts scheduled within the next 5 minutes
  // This prevents missing a post when the cron fires slightly before the scheduled time
  const lookAhead = new Date(now.getTime() + 5 * 60 * 1000)

  const duePosts = await prisma.post.findMany({
    where: { status: '予約済み', scheduledAt: { lte: lookAhead } },
    orderBy: { scheduledAt: 'asc' },
  })

  if (duePosts.length === 0) {
    return NextResponse.json({ posted: 0, message: '投稿予定なし', time: now.toISOString() })
  }

  const results: { id: string; status: string; errors: string[] }[] = []

  for (const post of duePosts) {
    const errors: string[] = []
    const platform = post.platform || 'both'
    const doX = platform === 'x' || platform === 'both'
    const doThreads = platform === 'threads' || platform === 'both'

    let xPostId: string | null = null
    let threadsPostId: string | null = null

    let mediaUrls: string[] | undefined
    if (post.imageUrls) {
      try { mediaUrls = JSON.parse(post.imageUrls) } catch { /* ignore */ }
    }

    if (doX) {
      const r = await postToX(post.content, mediaUrls)
      if (r.error) errors.push(`X: ${r.error}`)
      else xPostId = r.id || null
    }

    if (doThreads) {
      const r = await postToThreads(post.content, mediaUrls)
      if (r.error) errors.push(`Threads: ${r.error}`)
      else threadsPostId = r.id || null
    }

    const totalExpected = (doX ? 1 : 0) + (doThreads ? 1 : 0)
    const newStatus = errors.length === totalExpected ? '失敗' : '投稿済み'

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: newStatus,
        postedAt: now,
        ...(xPostId ? { xPostId } : {}),
        ...(threadsPostId ? { threadsPostId } : {}),
      },
    })

    console.log(`[cron/publish] ${post.id} → ${newStatus}`, errors.length ? errors : 'ok')
    results.push({ id: post.id, status: newStatus, errors })
  }

  return NextResponse.json({ posted: results.length, results, time: now.toISOString() })
}

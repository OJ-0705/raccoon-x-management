import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveAccount } from '@/lib/account'
import { optimalTimes, topPosts } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = Number(new URL(req.url).searchParams.get('days') ?? 30)
  const account = await getActiveAccount()
  const since = new Date(Date.now() - days * 86400000)

  const [posts, top, times, followers, counts] = await Promise.all([
    prisma.post.findMany({
      where: { accountId: account.id, status: 'PUBLISHED', postedAt: { gte: since } },
      select: { impressions: true, likes: true, reposts: true, replies: true, bookmarks: true, engagementRate: true },
    }),
    topPosts({ accountId: account.id, limit: 5, days }),
    optimalTimes(account.id),
    prisma.accountMetric.findMany({
      where: { accountId: account.id, date: { gte: since.toISOString().slice(0, 10) } },
      orderBy: { date: 'asc' },
    }),
    prisma.post.groupBy({ by: ['status'], where: { accountId: account.id }, _count: true }),
  ])

  const sum = (f: (p: (typeof posts)[number]) => number) => posts.reduce((a, p) => a + f(p), 0)
  const avg = (f: (p: (typeof posts)[number]) => number) => (posts.length ? sum(f) / posts.length : 0)

  return NextResponse.json({
    period: { days, publishedPosts: posts.length },
    summary: {
      totalImpressions: sum((p) => p.impressions),
      avgImpressions: Math.round(avg((p) => p.impressions)),
      avgEngagementRate: Number(avg((p) => p.engagementRate).toFixed(5)),
      totalLikes: sum((p) => p.likes),
      totalReposts: sum((p) => p.reposts),
      totalReplies: sum((p) => p.replies),
      totalBookmarks: sum((p) => p.bookmarks),
    },
    statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    topPosts: top,
    bestTimeSlots: times.slice(0, 10),
    followerHistory: followers,
  })
}

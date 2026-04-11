import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const thisMonth = today.slice(0, 7)

    // X totals (from Post metrics)
    const xAgg = await prisma.post.aggregate({
      where: { status: '投稿済み', xPostId: { not: null } },
      _sum: { impressions: true, likes: true, retweets: true, replies: true, bookmarks: true },
      _count: { id: true },
    })

    // Threads totals
    const threadsAgg = await prisma.post.aggregate({
      where: { status: '投稿済み', threadsPostId: { not: null } },
      _sum: { threadsImp: true, threadsLikes: true, threadsReplies: true, threadsReposts: true },
      _count: { id: true },
    })

    // Top 5 posts by X engagement rate (need impressions > 0)
    const publishedX = await prisma.post.findMany({
      where: { status: '投稿済み', xPostId: { not: null }, impressions: { gt: 0 } },
      select: {
        id: true, content: true, postType: true,
        impressions: true, likes: true, retweets: true, replies: true, bookmarks: true,
        postedAt: true, xPostId: true,
      },
      orderBy: { postedAt: 'desc' },
      take: 200,
    })

    const topPosts = publishedX
      .map(p => {
        const eng = p.likes + p.retweets + p.replies
        return { ...p, engagementRate: p.impressions > 0 ? (eng / p.impressions) * 100 : 0 }
      })
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5)

    // Post type breakdown (X)
    const byType = await prisma.post.groupBy({
      by: ['postType'],
      where: { status: '投稿済み', impressions: { gt: 0 } },
      _sum: { impressions: true, likes: true, retweets: true, replies: true },
      _count: { id: true },
    })

    // Today's API usage
    const todayUsage = await prisma.apiUsage.findUnique({
      where: { date_provider: { date: today, provider: 'x' } },
    })

    // This month's total cost
    const monthlyRows = await prisma.apiUsage.findMany({
      where: { date: { startsWith: thisMonth }, provider: 'x' },
    })
    const monthlyCost = monthlyRows.reduce((s, r) => s + r.costUsd, 0)

    // Last fetch timestamp
    const lastFetch = await prisma.postAnalytics.findFirst({
      where: { platform: 'x' },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    })

    // Count posts eligible for next X API fetch (not fetched in 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const eligibleXPosts = await prisma.post.count({
      where: {
        status: '投稿済み',
        xPostId: { not: null },
        NOT: {
          postAnalytics: {
            some: { platform: 'x', fetchedAt: { gte: twentyFourHoursAgo } },
          },
        },
      },
    })

    return NextResponse.json({
      x: {
        impressions: xAgg._sum.impressions || 0,
        likes: xAgg._sum.likes || 0,
        retweets: xAgg._sum.retweets || 0,
        replies: xAgg._sum.replies || 0,
        bookmarks: xAgg._sum.bookmarks || 0,
        postCount: xAgg._count.id,
      },
      threads: {
        impressions: threadsAgg._sum.threadsImp || 0,
        likes: threadsAgg._sum.threadsLikes || 0,
        replies: threadsAgg._sum.threadsReplies || 0,
        reposts: threadsAgg._sum.threadsReposts || 0,
        postCount: threadsAgg._count.id,
      },
      topPosts,
      byType: byType.map(t => ({
        postType: t.postType,
        count: t._count.id,
        impressions: t._sum.impressions || 0,
        engagementRate:
          (t._sum.impressions || 0) > 0
            ? (((t._sum.likes || 0) + (t._sum.retweets || 0) + (t._sum.replies || 0)) /
                (t._sum.impressions || 1)) *
              100
            : 0,
      })),
      apiUsage: {
        todayCalls: todayUsage?.callCount || 0,
        todayCost: todayUsage?.costUsd || 0,
        monthlyCost,
        maxCallsPerDay: 3,
        lastFetchAt: lastFetch?.fetchedAt || null,
        eligibleXPosts,
      },
    })
  } catch (error) {
    console.error('[analytics/summary]', error)
    return NextResponse.json({ error: 'サマリー取得に失敗' }, { status: 500 })
  }
}

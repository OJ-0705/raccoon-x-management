import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { optimalTimes, topPosts } from '@/lib/metrics'
import { ok, resolveAccount } from '@/mcp/shared'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export const schema = {
  days: z.number().int().min(1).max(365).optional().describe('集計対象の日数（既定30）'),
  topLimit: z.number().int().min(1).max(20).optional().describe('上位・下位を何件返すか（既定5）'),
  accountSlug: z.string().optional(),
}

export const metadata = {
  name: 'get_analytics',
  description:
    '実績を分析して返す。全体サマリ・伸びた投稿・伸びなかった投稿・投稿型ごとの平均・曜日×時間帯の傾向・フォロワー推移。次に何を書くかの判断材料に使う。',
  annotations: { readOnlyHint: true },
}

export default async function getAnalytics(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)
  const days = args.days ?? 30
  const limit = args.topLimit ?? 5
  const since = new Date(Date.now() - days * 86400000)

  const posts = await prisma.post.findMany({
    where: { accountId: account.id, status: 'PUBLISHED', postedAt: { gte: since } },
    select: {
      id: true,
      content: true,
      postType: true,
      postedAt: true,
      impressions: true,
      likes: true,
      reposts: true,
      replies: true,
      bookmarks: true,
      engagementRate: true,
    },
  })

  const sum = (f: (p: (typeof posts)[number]) => number) => posts.reduce((a, p) => a + f(p), 0)
  const avg = (f: (p: (typeof posts)[number]) => number) => (posts.length ? sum(f) / posts.length : 0)

  // 投稿型ごとの平均
  const byType = new Map<string, { posts: number; imp: number; er: number }>()
  for (const p of posts) {
    const key = p.postType ?? '(未分類)'
    const b = byType.get(key) ?? { posts: 0, imp: 0, er: 0 }
    b.posts++
    b.imp += p.impressions
    b.er += p.engagementRate
    byType.set(key, b)
  }

  const [top, times, followers] = await Promise.all([
    topPosts({ accountId: account.id, limit, days }),
    optimalTimes(account.id),
    prisma.accountMetric.findMany({
      where: { accountId: account.id, date: { gte: since.toISOString().slice(0, 10) } },
      orderBy: { date: 'asc' },
      select: { platform: true, date: true, followers: true },
    }),
  ])

  const worst = [...posts]
    .filter((p) => p.impressions > 0)
    .sort((a, b) => a.impressions - b.impressions)
    .slice(0, limit)

  return ok({
    period: { days, since: since.toISOString().slice(0, 10), publishedPosts: posts.length },
    summary: {
      totalImpressions: sum((p) => p.impressions),
      avgImpressions: Math.round(avg((p) => p.impressions)),
      avgEngagementRate: Number(avg((p) => p.engagementRate).toFixed(5)),
      totalLikes: sum((p) => p.likes),
      totalReposts: sum((p) => p.reposts),
      totalReplies: sum((p) => p.replies),
      totalBookmarks: sum((p) => p.bookmarks),
    },
    topPosts: top.map((p) => ({
      postId: p.id,
      postType: p.postType,
      excerpt: p.content.slice(0, 80),
      impressions: p.impressions,
      engagementScore: p.engagementScore,
    })),
    worstPosts: worst.map((p) => ({
      postId: p.id,
      postType: p.postType,
      excerpt: p.content.slice(0, 80),
      impressions: p.impressions,
    })),
    byPostType: [...byType.entries()]
      .map(([postType, b]) => ({
        postType,
        posts: b.posts,
        avgImpressions: Math.round(b.imp / b.posts),
        avgEngagementRate: Number((b.er / b.posts).toFixed(5)),
      }))
      .sort((a, b) => b.avgImpressions - a.avgImpressions),
    bestTimeSlots: times.slice(0, 10).map((t) => ({
      slot: `${WEEKDAYS[t.weekday]}曜 ${String(t.hour).padStart(2, '0')}時台`,
      posts: t.posts,
      avgImpressions: t.avgImpressions,
      avgEngagementRate: t.avgEngagementRate,
    })),
    followerHistory: followers,
    note: posts.length < 10 ? '母数が少ないため傾向は参考程度に扱ってください。' : undefined,
  })
}

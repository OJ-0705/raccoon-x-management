/**
 * 実績の収集と分析。
 * 読み取りも従量課金（$0.005/件）なので、取りに行く件数を絞る前提で組んでいる。
 */

import { prisma } from '@/lib/prisma'
import * as x from '@/lib/x-api'
import * as threads from '@/lib/threads-api'
import { recordCost } from '@/lib/api-cost'
import { jstDate, jstHour, jstWeekday } from '@/lib/jst'

/** 直近N日以内に投稿されたものだけ追う。古い投稿は数字が動かないので取りに行かない。 */
const DEFAULT_WINDOW_DAYS = 7

export interface RefreshResult {
  fetched: number
  updated: number
  errors: string[]
  costUsd: number
}

export async function refreshMetrics(opts: { windowDays?: number; accountId?: string; limit?: number } = {}): Promise<RefreshResult> {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const errors: string[] = []
  const today = jstDate()

  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      postedAt: { gte: since },
      ...(opts.accountId ? { accountId: opts.accountId } : {}),
    },
    orderBy: { postedAt: 'desc' },
    take: opts.limit ?? 100,
    select: { id: true, accountId: true, xPostId: true, threadsPostId: true },
  })

  let fetched = 0
  let updated = 0
  let costUsd = 0

  // ── X（100件ずつまとめて取れる） ──
  const xTargets = posts.filter((p) => p.xPostId)
  if (xTargets.length > 0) {
    const res = await x.getPostMetrics(xTargets.map((p) => p.xPostId as string))
    if (!res.ok) {
      errors.push(`X: ${res.error}`)
    } else if (res.data) {
      fetched += res.data.length
      const byId = new Map(res.data.map((m) => [m.id, m]))

      for (const p of xTargets) {
        const m = byId.get(p.xPostId as string)
        if (!m) continue
        const engagements = m.likes + m.reposts + m.replies + m.quotes + m.bookmarks
        const engagementRate = m.impressions > 0 ? Number((engagements / m.impressions).toFixed(6)) : 0

        await prisma.postMetric.upsert({
          where: { postId_platform_fetchDate: { postId: p.id, platform: 'X', fetchDate: today } },
          create: {
            postId: p.id,
            platform: 'X',
            externalId: m.id,
            impressions: m.impressions,
            likes: m.likes,
            reposts: m.reposts,
            replies: m.replies,
            quotes: m.quotes,
            bookmarks: m.bookmarks,
            profileClicks: m.profileClicks,
            linkClicks: m.linkClicks,
            engagementRate,
            fetchDate: today,
          },
          update: {
            impressions: m.impressions,
            likes: m.likes,
            reposts: m.reposts,
            replies: m.replies,
            quotes: m.quotes,
            bookmarks: m.bookmarks,
            profileClicks: m.profileClicks,
            linkClicks: m.linkClicks,
            engagementRate,
            fetchedAt: new Date(),
          },
        })

        await prisma.post.update({
          where: { id: p.id },
          data: {
            impressions: m.impressions,
            likes: m.likes,
            reposts: m.reposts,
            replies: m.replies,
            quotes: m.quotes,
            bookmarks: m.bookmarks,
            engagementRate,
          },
        })
        updated++
      }

      if (res.data.length > 0 && !res.simulated) {
        await recordCost({
          platform: 'X',
          operation: 'POST_READ',
          units: res.data.length,
          accountId: posts[0]?.accountId,
          note: 'metrics refresh',
        })
        const { unitPriceUsd } = await import('@/lib/pricing')
        costUsd += unitPriceUsd('POST_READ') * res.data.length
      }
    }
  }

  // ── Threads（1件ずつ。無料なのでコスト計上なし） ──
  for (const p of posts.filter((v) => v.threadsPostId)) {
    const res = await threads.getPostMetrics(p.threadsPostId as string)
    if (!res.ok) {
      errors.push(`Threads(${p.threadsPostId}): ${res.error}`)
      continue
    }
    if (!res.data) continue
    fetched++
    const m = res.data
    const engagements = m.likes + m.reposts + m.replies + m.quotes
    const engagementRate = m.impressions > 0 ? Number((engagements / m.impressions).toFixed(6)) : 0

    await prisma.postMetric.upsert({
      where: { postId_platform_fetchDate: { postId: p.id, platform: 'THREADS', fetchDate: today } },
      create: {
        postId: p.id,
        platform: 'THREADS',
        externalId: m.id,
        impressions: m.impressions,
        likes: m.likes,
        reposts: m.reposts,
        replies: m.replies,
        quotes: m.quotes,
        engagementRate,
        fetchDate: today,
      },
      update: {
        impressions: m.impressions,
        likes: m.likes,
        reposts: m.reposts,
        replies: m.replies,
        quotes: m.quotes,
        engagementRate,
        fetchedAt: new Date(),
      },
    })
    updated++
  }

  return { fetched, updated, errors, costUsd: Number(costUsd.toFixed(4)) }
}

/** アカウントの日次サマリ（フォロワー推移）を記録する */
export async function snapshotAccount(accountId: string): Promise<{ ok: boolean; error?: string }> {
  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account) return { ok: false, error: 'account not found' }
  const date = jstDate()

  if (account.xUsername) {
    const res = await x.getUser(account.xUsername)
    if (res.ok && res.data) {
      await prisma.accountMetric.upsert({
        where: { accountId_platform_date: { accountId, platform: 'X', date } },
        create: {
          accountId,
          platform: 'X',
          date,
          followers: res.data.followers,
          following: res.data.following,
          totalPosts: res.data.postCount,
        },
        update: { followers: res.data.followers, following: res.data.following, totalPosts: res.data.postCount },
      })
      if (!res.simulated) {
        await recordCost({ platform: 'X', operation: 'USER_READ', accountId, note: 'account snapshot' })
      }
    } else if (!res.ok) {
      return { ok: false, error: res.error }
    }
  }

  const t = await threads.getAccountInsights()
  if (t.ok && t.data) {
    await prisma.accountMetric.upsert({
      where: { accountId_platform_date: { accountId, platform: 'THREADS', date } },
      create: { accountId, platform: 'THREADS', date, followers: t.data.followers },
      update: { followers: t.data.followers },
    })
  }

  return { ok: true }
}

// ── 分析 ────────────────────────────────────────────────────────────────────

export interface TopPost {
  id: string
  content: string
  postType: string | null
  postedAt: Date | null
  impressions: number
  likes: number
  reposts: number
  replies: number
  bookmarks: number
  engagementRate: number
  engagementScore: number
}

/** 反応が良かった投稿。生成プロンプトへの注入素材として使う。 */
export async function topPosts(opts: { accountId?: string; limit?: number; days?: number } = {}): Promise<TopPost[]> {
  const where = {
    status: 'PUBLISHED' as const,
    ...(opts.accountId ? { accountId: opts.accountId } : {}),
    ...(opts.days ? { postedAt: { gte: new Date(Date.now() - opts.days * 86400000) } } : {}),
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { postedAt: 'desc' },
    take: 300,
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

  // リプライ > ブックマーク > RT > いいね の順に重く見る（会話と保存のほうが伸びに効く）
  return posts
    .map((p) => ({
      ...p,
      engagementScore: p.likes + p.reposts * 3 + p.replies * 5 + p.bookmarks * 2,
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, opts.limit ?? 5)
}

export interface TimeSlotStat {
  weekday: number
  hour: number
  posts: number
  avgImpressions: number
  avgEngagementRate: number
}

/** 曜日×時間帯ごとの実績。投稿スロットの見直しに使う。 */
export async function optimalTimes(accountId?: string): Promise<TimeSlotStat[]> {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED', postedAt: { not: null }, ...(accountId ? { accountId } : {}) },
    select: { postedAt: true, impressions: true, engagementRate: true },
    take: 500,
    orderBy: { postedAt: 'desc' },
  })

  const buckets = new Map<string, { weekday: number; hour: number; imp: number[]; er: number[] }>()
  for (const p of posts) {
    if (!p.postedAt) continue
    const weekday = jstWeekday(p.postedAt)
    const hour = jstHour(p.postedAt)
    const key = `${weekday}-${hour}`
    const b = buckets.get(key) ?? { weekday, hour, imp: [], er: [] }
    b.imp.push(p.impressions)
    b.er.push(p.engagementRate)
    buckets.set(key, b)
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

  return [...buckets.values()]
    .map((b) => ({
      weekday: b.weekday,
      hour: b.hour,
      posts: b.imp.length,
      avgImpressions: Math.round(avg(b.imp)),
      avgEngagementRate: Number(avg(b.er).toFixed(5)),
    }))
    .sort((a, b) => b.avgImpressions - a.avgImpressions)
}

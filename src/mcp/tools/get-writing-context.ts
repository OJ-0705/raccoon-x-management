import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { toProfile } from '@/lib/account'
import { topPosts } from '@/lib/metrics'
import { costSummary } from '@/lib/api-cost'
import { ok, resolveAccount, parseJsonArray } from '@/mcp/shared'

export const schema = {
  accountSlug: z.string().optional().describe('アカウントのslug。省略時はアクティブなアカウント'),
  topPostLimit: z.number().int().min(0).max(20).optional().describe('実績上位の投稿を何件返すか（既定5）'),
  styleSampleLimit: z.number().int().min(0).max(30).optional().describe('トーン見本を何件返すか（既定10）'),
  buzzPatternLimit: z.number().int().min(0).max(20).optional().describe('バズパターンを何件返すか（既定5）'),
  recentThemeDays: z.number().int().min(1).max(365).optional().describe('既出テーマを何日分返すか（既定60）'),
}

export const metadata = {
  name: 'get_writing_context',
  description:
    '投稿文を書く前に必要な材料を一括で取得する。運用方針・トーン見本・実績上位の投稿・バズ構造パターン・既出テーマ一覧・今月のAPIコストが1回で返る。新しい投稿を作るときは最初にこれを呼ぶこと。',
  annotations: { readOnlyHint: true },
}

export default async function getWritingContext(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)
  const recentDays = args.recentThemeDays ?? 60

  const [samples, patterns, top, recent, cost] = await Promise.all([
    prisma.styleSample.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: args.styleSampleLimit ?? 10,
      select: { content: true, note: true },
    }),
    prisma.buzzPattern.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: args.buzzPatternLimit ?? 5,
      select: { hookType: true, structure: true, analysis: true, impressions: true, sourceText: true },
    }),
    topPosts({ accountId: account.id, limit: args.topPostLimit ?? 5 }),
    prisma.post.findMany({
      where: {
        accountId: account.id,
        createdAt: { gte: new Date(Date.now() - recentDays * 86400000) },
        status: { in: ['DRAFT', 'REVIEWED', 'SCHEDULED', 'PUBLISHED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, status: true, postType: true, dedupeTheme: true, dedupeMessage: true, dedupeEntities: true, content: true },
    }),
    costSummary(undefined, account.id),
  ])

  const favorites = await prisma.post.findMany({
    where: { accountId: account.id, isFavorite: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { content: true, postType: true },
  })

  return ok({
    profile: toProfile(account),
    styleSamples: samples,
    favoritePosts: favorites,
    topPosts: top.map((p) => ({
      content: p.content,
      postType: p.postType,
      impressions: p.impressions,
      likes: p.likes,
      reposts: p.reposts,
      replies: p.replies,
      bookmarks: p.bookmarks,
      engagementScore: p.engagementScore,
    })),
    buzzPatterns: patterns.map((p) => ({
      hookType: p.hookType,
      structure: p.structure,
      impressions: p.impressions,
      analysis: p.analysis ? (JSON.parse(p.analysis) as unknown) : null,
      excerpt: p.sourceText.slice(0, 140),
    })),
    usedThemes: recent.map((p) => ({
      postId: p.id,
      status: p.status,
      postType: p.postType,
      theme: p.dedupeTheme,
      message: p.dedupeMessage,
      entities: parseJsonArray<string>(p.dedupeEntities),
      excerpt: p.content.slice(0, 60),
    })),
    cost: {
      month: cost.month,
      spentUsd: cost.totalUsd,
      budgetUsd: cost.budgetUsd,
      remainingUsd: cost.remainingUsd,
    },
    reminders: [
      'usedThemes と重複しないネタを選ぶこと。確定前に check_duplicate を通すこと。',
      `本文は ${account.charLimitMin}〜${account.charLimitMax} 文字に収めること。`,
      'リンクを含む投稿はX APIの単価が $0.015 → $0.20 に跳ね上がる。リンクは固定リプライか プロフィールに逃がすのが基本。',
    ],
  })
}

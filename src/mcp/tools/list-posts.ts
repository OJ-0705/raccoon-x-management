import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { ok, resolveAccount, parseJsonArray } from '@/mcp/shared'

export const schema = {
  status: z
    .array(z.enum(['DRAFT', 'REVIEWED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED']))
    .optional()
    .describe('絞り込むステータス。省略時は全件'),
  postType: z.string().optional().describe('投稿型で絞り込む'),
  search: z.string().optional().describe('本文の部分一致'),
  limit: z.number().int().min(1).max(200).optional().describe('取得件数（既定30）'),
  includeContent: z.boolean().optional().describe('本文全文を含めるか（既定true）'),
  accountSlug: z.string().optional(),
}

export const metadata = {
  name: 'list_posts',
  description: '投稿を一覧する。下書きの棚卸し、予約状況の確認、投稿済みの実績確認に使う。',
  annotations: { readOnlyHint: true },
}

export default async function listPosts(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)

  const posts = await prisma.post.findMany({
    where: {
      accountId: account.id,
      ...(args.status?.length ? { status: { in: args.status } } : {}),
      ...(args.postType ? { postType: args.postType } : {}),
      ...(args.search ? { content: { contains: args.search, mode: 'insensitive' as const } } : {}),
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: args.limit ?? 30,
  })

  return ok({
    count: posts.length,
    posts: posts.map((p) => ({
      id: p.id,
      status: p.status,
      postType: p.postType,
      content: args.includeContent === false ? p.content.slice(0, 60) : p.content,
      length: [...p.content].length,
      theme: p.dedupeTheme,
      message: p.dedupeMessage,
      entities: parseJsonArray<string>(p.dedupeEntities),
      mediaUrls: parseJsonArray<string>(p.mediaUrls),
      targets: [p.postToX && 'X', p.postToThreads && 'Threads'].filter(Boolean),
      scheduledAt: p.scheduledAt,
      postedAt: p.postedAt,
      xPostId: p.xPostId,
      threadsPostId: p.threadsPostId,
      metrics: {
        impressions: p.impressions,
        likes: p.likes,
        reposts: p.reposts,
        replies: p.replies,
        bookmarks: p.bookmarks,
        engagementRate: p.engagementRate,
      },
      isFavorite: p.isFavorite,
      lastError: p.lastError,
    })),
  })
}

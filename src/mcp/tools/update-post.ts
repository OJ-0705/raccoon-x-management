import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { containsLink, unitPriceUsd } from '@/lib/pricing'
import { ok, fail } from '@/mcp/shared'

export const schema = {
  postId: z.string().describe('更新する投稿のID'),
  content: z.string().optional(),
  status: z.enum(['DRAFT', 'REVIEWED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED']).optional(),
  postType: z.string().optional(),
  theme: z.string().optional().describe('Layer1: 大枠のテーマ'),
  message: z.string().optional().describe('Layer2: 核心メッセージ'),
  entities: z.array(z.string()).optional().describe('Layer3: 固有名詞・数値'),
  mediaUrls: z.array(z.string()).optional(),
  hashtags: z.string().optional(),
  postToX: z.boolean().optional(),
  postToThreads: z.boolean().optional(),
  isFavorite: z.boolean().optional().describe('お手本としてマークする。生成時の参照素材になる'),
  qualityScore: z.number().optional(),
  qualityNote: z.string().optional(),
}

export const metadata = {
  name: 'update_post',
  description:
    '既存の投稿を更新する。本文の推敲、ステータス変更、重複チェック用メタデータの補完、お手本マーク（isFavorite）に使う。',
}

export default async function updatePost(args: InferSchema<typeof schema>) {
  const existing = await prisma.post.findUnique({ where: { id: args.postId } })
  if (!existing) return fail(`投稿が見つかりません: ${args.postId}`)

  if (existing.status === 'PUBLISHED' && args.content !== undefined && args.content !== existing.content) {
    return fail('投稿済みの本文は変更できません（Xの投稿は編集できないため、DBだけずれると分析が壊れます）。')
  }

  const data: Record<string, unknown> = {}
  for (const key of ['content', 'status', 'postType', 'hashtags', 'postToX', 'postToThreads', 'isFavorite', 'qualityScore', 'qualityNote'] as const) {
    if (args[key] !== undefined) data[key] = args[key]
  }
  if (args.theme !== undefined) data.dedupeTheme = args.theme
  if (args.message !== undefined) data.dedupeMessage = args.message
  if (args.entities !== undefined) data.dedupeEntities = JSON.stringify(args.entities)
  if (args.mediaUrls !== undefined) data.mediaUrls = args.mediaUrls.length ? JSON.stringify(args.mediaUrls.slice(0, 4)) : null

  if (Object.keys(data).length === 0) return ok({ updated: [], note: '更新項目が指定されていません' })

  const post = await prisma.post.update({ where: { id: args.postId }, data })

  const warnings: string[] = []
  if (args.content) {
    const length = [...args.content].length
    if (length > 280) warnings.push('280文字を超えています。X Premium未加入だと投稿できません。')
    if (containsLink(args.content)) {
      warnings.push(`リンクが含まれています（単価 $${unitPriceUsd('POST_CREATE_WITH_LINK')}）。`)
    }
  }

  return ok({ postId: post.id, updated: Object.keys(data), status: post.status, warnings })
}

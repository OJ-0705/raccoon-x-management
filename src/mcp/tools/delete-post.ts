import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { ok, fail } from '@/mcp/shared'

export const schema = {
  postId: z.string().describe('削除する投稿のID'),
  hard: z.boolean().optional().describe('trueでレコードごと削除。既定はARCHIVEDに落とすだけ'),
}

export const metadata = {
  name: 'delete_post',
  description:
    '投稿を削除する。既定ではARCHIVEDに落とすだけで、重複チェックの履歴としては残る。hard:true で完全削除するが、投稿済みのものは実績が消えるので推奨しない。',
}

export default async function deletePost({ postId, hard }: InferSchema<typeof schema>) {
  const existing = await prisma.post.findUnique({ where: { id: postId } })
  if (!existing) return fail(`投稿が見つかりません: ${postId}`)

  if (hard) {
    if (existing.status === 'PUBLISHED') {
      return fail('投稿済みのレコードは完全削除できません（実績と重複チェックの履歴が失われます）。hard を外してください。')
    }
    await prisma.post.delete({ where: { id: postId } })
    return ok({ postId, deleted: 'hard' })
  }

  await prisma.post.update({ where: { id: postId }, data: { status: 'ARCHIVED', scheduledAt: null } })
  return ok({ postId, deleted: 'archived', note: 'ARCHIVEDに変更しました。重複チェックの対象からは外れます。' })
}

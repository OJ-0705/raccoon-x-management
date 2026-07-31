import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { publishPost } from '@/lib/publish'
import { isSimulateMode } from '@/lib/x-api'
import { postCreateOperation, unitPriceUsd } from '@/lib/pricing'
import { ok, fail } from '@/mcp/shared'

export const schema = {
  postId: z.string().describe('公開する投稿のID'),
  confirm: z
    .boolean()
    .optional()
    .describe('trueで実際に投稿する。省略時はドライラン（コスト見積もりと事前チェックのみ返す）'),
  ignoreBudget: z.boolean().optional().describe('月次予算の超過を無視して強制投稿する'),
}

export const metadata = {
  name: 'publish_post',
  description:
    '投稿を即時公開する。X APIは従量課金なので、confirm を省略した場合はドライランとしてコスト見積もりと警告だけを返す。実際に投稿するには confirm: true を明示すること。',
}

export default async function publishPostTool({ postId, confirm, ignoreBudget }: InferSchema<typeof schema>) {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post) return fail(`投稿が見つかりません: ${postId}`)
  if (post.status === 'PUBLISHED') return fail('すでに投稿済みです。')

  const operation = postCreateOperation(post.content)
  const estimatedCostUsd = post.postToX ? unitPriceUsd(operation) : 0
  const length = [...post.content].length

  if (!confirm) {
    const checks: string[] = []
    if (length > 280) checks.push('280文字を超えています。')
    if (operation === 'POST_CREATE_WITH_LINK') checks.push('リンクを含むため単価が高くなります。')
    if (!post.postToX && !post.postToThreads) checks.push('配信先が設定されていません。')
    if (isSimulateMode()) checks.push('SIMULATE_MODE=true のため実際には投稿されません。')

    return ok({
      dryRun: true,
      postId,
      length,
      targets: [post.postToX && 'X', post.postToThreads && 'Threads'].filter(Boolean),
      operation,
      estimatedCostUsd,
      checks,
      preview: post.content,
      next: '問題なければ confirm: true で再実行してください。',
    })
  }

  const result = await publishPost(post, { ignoreBudget })

  return result.status === 'PUBLISHED'
    ? ok({
        postId: result.postId,
        xPostId: result.xPostId,
        threadsPostId: result.threadsPostId,
        simulated: result.simulated,
        costUsd: result.estimatedCostUsd,
        partialErrors: result.errors,
        url: result.xPostId ? `https://x.com/i/status/${result.xPostId}` : undefined,
      })
    : fail(result.errors.join(' / ') || '投稿に失敗しました', { postId: result.postId })
}

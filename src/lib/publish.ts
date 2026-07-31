/**
 * 投稿の公開処理。UIからの即時投稿・cronの予約投稿・MCPツールが全部ここを通る。
 * 公開のたびに ApiCost を積むので、月次の実費がそのまま見える。
 */

import type { Post } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import * as x from '@/lib/x-api'
import * as threads from '@/lib/threads-api'
import { recordCost } from '@/lib/api-cost'
import { checkBudget } from '@/lib/api-cost'
import { postCreateOperation, containsLink } from '@/lib/pricing'

export interface PublishOutcome {
  postId: string
  xPostId?: string
  threadsPostId?: string
  errors: string[]
  simulated: boolean
  status: 'PUBLISHED' | 'FAILED'
  estimatedCostUsd: number
}

function parseMediaUrls(post: Pick<Post, 'mediaUrls'>): string[] {
  if (!post.mediaUrls) return []
  try {
    const v = JSON.parse(post.mediaUrls)
    return Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string') : []
  } catch {
    return []
  }
}

/**
 * 1件の投稿を、有効な配信先すべてに公開する。
 * 片方だけ成功した場合も成功した側のIDは残し、errors に理由を積む。
 */
export async function publishPost(
  post: Post,
  opts: { ignoreBudget?: boolean } = {},
): Promise<PublishOutcome> {
  const errors: string[] = []
  let simulated = false
  let estimatedCostUsd = 0
  let xPostId: string | undefined
  let threadsPostId: string | undefined

  if (!opts.ignoreBudget) {
    const budget = await checkBudget(post.accountId)
    if (!budget.ok) {
      const msg = `月次予算を超過しています（$${budget.spentUsd} / $${budget.budgetUsd}）。ignoreBudget で強制実行できます。`
      await prisma.post.update({ where: { id: post.id }, data: { status: 'FAILED', lastError: msg } })
      return { postId: post.id, errors: [msg], simulated: false, status: 'FAILED', estimatedCostUsd: 0 }
    }
  }

  const mediaUrls = parseMediaUrls(post)

  // ── X ──
  if (post.postToX) {
    const res = await x.createPost({ text: post.content, mediaUrls })
    if (res.ok && res.data) {
      xPostId = res.data.id
      simulated = simulated || Boolean(res.simulated)
      if (!res.simulated) {
        const op = postCreateOperation(post.content)
        await recordCost({
          platform: 'X',
          operation: op,
          accountId: post.accountId,
          postId: post.id,
          note: containsLink(post.content) ? 'リンクを含むため高単価' : undefined,
        })
        if (mediaUrls.length > 0) {
          await recordCost({
            platform: 'X',
            operation: 'MEDIA_UPLOAD',
            units: Math.min(mediaUrls.length, 4),
            accountId: post.accountId,
            postId: post.id,
          })
        }
        const { unitPriceUsd } = await import('@/lib/pricing')
        estimatedCostUsd += unitPriceUsd(op)
      }
    } else {
      errors.push(`X: ${res.error}`)
    }
  }

  // ── Threads ──
  if (post.postToThreads) {
    const res = await threads.createPost({ text: post.content, mediaUrls })
    if (res.ok && res.data) {
      threadsPostId = res.data.id
      simulated = simulated || Boolean(res.simulated)
    } else {
      errors.push(`Threads: ${res.error}`)
    }
  }

  if (!post.postToX && !post.postToThreads) {
    errors.push('配信先が1つも有効になっていません（postToX / postToThreads）')
  }

  const succeeded = Boolean(xPostId || threadsPostId)
  const status: 'PUBLISHED' | 'FAILED' = succeeded ? 'PUBLISHED' : 'FAILED'

  await prisma.post.update({
    where: { id: post.id },
    data: {
      status,
      postedAt: succeeded ? new Date() : null,
      xPostId: xPostId ?? post.xPostId,
      threadsPostId: threadsPostId ?? post.threadsPostId,
      lastError: errors.length > 0 ? errors.join(' / ') : null,
    },
  })

  return { postId: post.id, xPostId, threadsPostId, errors, simulated, status, estimatedCostUsd }
}

/** 予約時刻を過ぎた投稿をまとめて公開する（cronの実体） */
export async function publishDuePosts(now = new Date()): Promise<PublishOutcome[]> {
  const due = await prisma.post.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
  })

  const results: PublishOutcome[] = []
  for (const post of due) {
    results.push(await publishPost(post))
  }
  return results
}

import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { costSummary } from '@/lib/api-cost'
import { unitPriceUsd, linkPenaltyUsd } from '@/lib/pricing'
import { ok, resolveAccount } from '@/mcp/shared'

export const schema = {
  month: z.string().optional().describe('対象月 "YYYY-MM"（JST）。省略時は当月'),
  accountSlug: z.string().optional(),
}

export const metadata = {
  name: 'get_cost_report',
  description:
    'X APIの従量課金コストを集計して返す。2026年2月にXは従量課金へ移行し無料枠が廃止されたため、投稿ペースはこの数字を見て決めること。',
  annotations: { readOnlyHint: true },
}

export default async function getCostReport({ month, accountSlug }: InferSchema<typeof schema>) {
  const account = await resolveAccount(accountSlug)
  const summary = await costSummary(month, account.id)

  const postsLeft =
    summary.remainingUsd === null ? null : Math.max(0, Math.floor(summary.remainingUsd / unitPriceUsd('POST_CREATE')))

  return ok({
    ...summary,
    unitPrices: {
      postCreate: unitPriceUsd('POST_CREATE'),
      postCreateWithLink: unitPriceUsd('POST_CREATE_WITH_LINK'),
      postRead: unitPriceUsd('POST_READ'),
      userRead: unitPriceUsd('USER_READ'),
    },
    remainingPostsAtCurrentRate: postsLeft,
    advice: [
      `リンクを1本入れるごとに追加で約$${linkPenaltyUsd().toFixed(3)}かかる。リンクは固定リプライかプロフィールへ逃がすのが基本。`,
      '実績取得も1件$0.005かかる。refresh_metrics は直近の投稿だけに絞って回すこと。',
    ],
  })
}

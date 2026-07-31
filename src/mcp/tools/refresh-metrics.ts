import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { refreshMetrics } from '@/lib/metrics'
import { unitPriceUsd } from '@/lib/pricing'
import { ok, resolveAccount } from '@/mcp/shared'

export const schema = {
  windowDays: z.number().int().min(1).max(90).optional().describe('直近何日分の投稿を更新するか（既定7）'),
  limit: z.number().int().min(1).max(200).optional().describe('最大何件取得するか（既定100）'),
  accountSlug: z.string().optional(),
}

export const metadata = {
  name: 'refresh_metrics',
  description:
    'X / Threads から投稿実績を取得してDBに反映する。読み取りも従量課金（1件$0.005）なので、対象は直近の投稿に絞られる。cronでも1日1回走る。',
}

export default async function refreshMetricsTool(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)
  const result = await refreshMetrics({
    accountId: account.id,
    windowDays: args.windowDays,
    limit: args.limit,
  })

  return ok({
    fetched: result.fetched,
    updated: result.updated,
    costUsd: result.costUsd,
    unitPriceUsd: unitPriceUsd('POST_READ'),
    errors: result.errors,
  })
}

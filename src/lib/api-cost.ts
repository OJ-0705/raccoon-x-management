/** API実費の記録と集計。X APIが従量課金になったので、使った分をその都度積む。 */

import type { ApiOperation, Platform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { jstDate, jstMonth } from '@/lib/jst'
import { unitPriceUsd } from '@/lib/pricing'

export async function recordCost(params: {
  platform: Platform
  operation: ApiOperation
  units?: number
  accountId?: string | null
  postId?: string | null
  note?: string
}): Promise<void> {
  const units = params.units ?? 1
  const price = unitPriceUsd(params.operation)
  if (units <= 0) return

  try {
    await prisma.apiCost.create({
      data: {
        date: jstDate(),
        platform: params.platform,
        operation: params.operation,
        units,
        unitPriceUsd: price,
        costUsd: Number((price * units).toFixed(6)),
        accountId: params.accountId ?? null,
        postId: params.postId ?? null,
        note: params.note,
      },
    })
  } catch (err) {
    // コスト記録の失敗で投稿処理を止めない
    console.error('[api-cost] failed to record', err)
  }
}

export interface CostSummary {
  month: string
  totalUsd: number
  budgetUsd: number | null
  remainingUsd: number | null
  byOperation: Array<{ operation: ApiOperation; units: number; costUsd: number }>
  byPlatform: Array<{ platform: Platform; costUsd: number }>
  daily: Array<{ date: string; costUsd: number }>
}

/** 指定月（JST, YYYY-MM）のコストサマリ */
export async function costSummary(month = jstMonth(), accountId?: string): Promise<CostSummary> {
  const where = {
    date: { startsWith: month },
    ...(accountId ? { accountId } : {}),
  }

  const rows = await prisma.apiCost.findMany({
    where,
    select: { date: true, platform: true, operation: true, units: true, costUsd: true },
  })

  const byOperation = new Map<ApiOperation, { units: number; costUsd: number }>()
  const byPlatform = new Map<Platform, number>()
  const daily = new Map<string, number>()
  let totalUsd = 0

  for (const r of rows) {
    totalUsd += r.costUsd
    const op = byOperation.get(r.operation) ?? { units: 0, costUsd: 0 }
    byOperation.set(r.operation, { units: op.units + r.units, costUsd: op.costUsd + r.costUsd })
    byPlatform.set(r.platform, (byPlatform.get(r.platform) ?? 0) + r.costUsd)
    daily.set(r.date, (daily.get(r.date) ?? 0) + r.costUsd)
  }

  const account = accountId
    ? await prisma.account.findUnique({ where: { id: accountId }, select: { monthlyBudgetUsd: true } })
    : await prisma.account.findFirst({ where: { isActive: true }, select: { monthlyBudgetUsd: true } })

  const budgetUsd = account?.monthlyBudgetUsd ?? null
  const round = (n: number) => Number(n.toFixed(4))

  return {
    month,
    totalUsd: round(totalUsd),
    budgetUsd,
    remainingUsd: budgetUsd === null ? null : round(budgetUsd - totalUsd),
    byOperation: [...byOperation.entries()]
      .map(([operation, v]) => ({ operation, units: v.units, costUsd: round(v.costUsd) }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byPlatform: [...byPlatform.entries()].map(([platform, costUsd]) => ({ platform, costUsd: round(costUsd) })),
    daily: [...daily.entries()].map(([date, costUsd]) => ({ date, costUsd: round(costUsd) })).sort((a, b) => a.date.localeCompare(b.date)),
  }
}

/**
 * 月次予算を超えていないか。超過時は投稿処理を止める判断材料にする。
 * 予算未設定なら常に許可。
 */
export async function checkBudget(accountId?: string): Promise<{ ok: boolean; spentUsd: number; budgetUsd: number | null }> {
  const s = await costSummary(jstMonth(), accountId)
  return {
    ok: s.budgetUsd === null || s.totalUsd < s.budgetUsd,
    spentUsd: s.totalUsd,
    budgetUsd: s.budgetUsd,
  }
}

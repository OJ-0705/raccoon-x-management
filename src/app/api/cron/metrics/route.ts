import { NextResponse } from 'next/server'
import { refreshMetrics, snapshotAccount } from '@/lib/metrics'
import { getActiveAccount } from '@/lib/account'
import { checkCronAuth } from '@/lib/cron-auth'

/**
 * 実績を1日1回だけ取り込む。
 * 読み取りも従量課金（1件$0.005）なので、対象は直近7日の投稿に絞っている。
 */

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = checkCronAuth(request)
  if (denied) return denied

  try {
    const account = await getActiveAccount()
    const [metrics, snapshot] = await Promise.all([
      refreshMetrics({ accountId: account.id, windowDays: 7 }),
      snapshotAccount(account.id),
    ])

    return NextResponse.json({
      ok: true,
      fetched: metrics.fetched,
      updated: metrics.updated,
      costUsd: metrics.costUsd,
      snapshot,
      errors: metrics.errors,
    })
  } catch (err) {
    console.error('[cron/metrics]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

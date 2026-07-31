import { NextResponse } from 'next/server'
import { publishDuePosts } from '@/lib/publish'
import { checkCronAuth } from '@/lib/cron-auth'

/** 予約時刻を過ぎた投稿を公開する。GitHub Actions のcronから30分ごとに叩かれる。 */

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = checkCronAuth(request)
  if (denied) return denied

  try {
    const results = await publishDuePosts()
    const published = results.filter((r) => r.status === 'PUBLISHED')
    const failed = results.filter((r) => r.status === 'FAILED')

    return NextResponse.json({
      ok: true,
      processed: results.length,
      published: published.length,
      failed: failed.length,
      costUsd: Number(published.reduce((a, r) => a + r.estimatedCostUsd, 0).toFixed(4)),
      results,
    })
  } catch (err) {
    console.error('[cron/publish]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

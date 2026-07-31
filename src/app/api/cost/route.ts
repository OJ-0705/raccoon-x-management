import { NextRequest, NextResponse } from 'next/server'
import { costSummary } from '@/lib/api-cost'
import { getActiveAccount } from '@/lib/account'
import { unitPriceUsd } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const month = new URL(req.url).searchParams.get('month') ?? undefined
  const account = await getActiveAccount()
  const summary = await costSummary(month, account.id)

  return NextResponse.json({
    ...summary,
    unitPrices: {
      postCreate: unitPriceUsd('POST_CREATE'),
      postCreateWithLink: unitPriceUsd('POST_CREATE_WITH_LINK'),
      postRead: unitPriceUsd('POST_READ'),
      userRead: unitPriceUsd('USER_READ'),
    },
    remainingPosts:
      summary.remainingUsd === null ? null : Math.max(0, Math.floor(summary.remainingUsd / unitPriceUsd('POST_CREATE'))),
  })
}

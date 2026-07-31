import { NextRequest, NextResponse } from 'next/server'
import { nextFreeSlots } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const count = Number(new URL(req.url).searchParams.get('count') ?? 5)
  const slots = await nextFreeSlots(Math.min(Math.max(count, 1), 30))
  return NextResponse.json({ slots: slots.map((s) => ({ scheduledAt: s.at.toISOString(), jst: s.jst })) })
}

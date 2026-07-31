/** 予約枠の計算。Account.postingSlots（JSTの時刻リスト）を埋まっていない順に返す。 */

import { prisma } from '@/lib/prisma'
import { getActiveAccount } from '@/lib/account'
import { jstDate, jstToUtc } from '@/lib/jst'

const DEFAULT_SLOTS = ['08:00', '12:30', '21:00']

function slotsOf(raw: string | null): string[] {
  if (!raw) return DEFAULT_SLOTS
  try {
    const v = JSON.parse(raw)
    const slots = Array.isArray(v) ? v.filter((s): s is string => /^\d{2}:\d{2}$/.test(s)) : []
    return slots.length > 0 ? slots.sort() : DEFAULT_SLOTS
  } catch {
    return DEFAULT_SLOTS
  }
}

export interface FreeSlot {
  /** UTCのDate。DBにはこれを入れる */
  at: Date
  /** JST表記（人間が読む用） */
  jst: string
}

/**
 * 空いている予約枠を先頭からN件返す。
 * すでに予約・投稿済みの枠は飛ばす。
 */
export async function nextFreeSlots(count = 1, accountSlug?: string): Promise<FreeSlot[]> {
  const account = await getActiveAccount(accountSlug)
  const slots = slotsOf(account.postingSlots)

  const taken = await prisma.post.findMany({
    where: {
      accountId: account.id,
      status: { in: ['SCHEDULED', 'PUBLISHED'] },
      scheduledAt: { gte: new Date(Date.now() - 86400000) },
    },
    select: { scheduledAt: true },
  })
  const takenKeys = new Set(taken.map((t) => t.scheduledAt?.toISOString()).filter(Boolean))

  const out: FreeSlot[] = []
  const now = new Date()

  for (let dayOffset = 0; dayOffset < 60 && out.length < count; dayOffset++) {
    const date = jstDate(new Date(now.getTime() + dayOffset * 86400000))
    for (const slot of slots) {
      if (out.length >= count) break
      const at = jstToUtc(date, slot)
      // 5分以内に迫っている枠はcronが拾えないので飛ばす
      if (at.getTime() <= now.getTime() + 5 * 60000) continue
      if (takenKeys.has(at.toISOString())) continue
      out.push({ at, jst: `${date} ${slot}` })
    }
  }

  return out
}

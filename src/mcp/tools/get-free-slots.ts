import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { nextFreeSlots } from '@/lib/schedule'
import { ok } from '@/mcp/shared'

export const schema = {
  count: z.number().int().min(1).max(30).optional().describe('返す枠の数（既定3）'),
  accountSlug: z.string().optional(),
}

export const metadata = {
  name: 'get_free_slots',
  description:
    'アカウントに設定された投稿スロット（JST）のうち、まだ予約が入っていない直近の枠を返す。schedule_post の前に呼ぶ。',
  annotations: { readOnlyHint: true },
}

export default async function getFreeSlots({ count, accountSlug }: InferSchema<typeof schema>) {
  const slots = await nextFreeSlots(count ?? 3, accountSlug)
  return ok({
    slots: slots.map((s) => ({ scheduledAt: s.at.toISOString(), jst: s.jst })),
    note: 'scheduledAt をそのまま schedule_post に渡してください。',
  })
}

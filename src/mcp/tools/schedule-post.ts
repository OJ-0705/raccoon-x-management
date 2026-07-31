import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { nextFreeSlots } from '@/lib/schedule'
import { jstToUtc } from '@/lib/jst'
import { ok, fail } from '@/mcp/shared'

export const schema = {
  postId: z.string().describe('予約する投稿のID'),
  scheduledAt: z.string().optional().describe('UTCのISO8601文字列。get_free_slots の戻り値をそのまま渡す'),
  jstDateTime: z
    .string()
    .optional()
    .describe('JSTで指定する場合の "YYYY-MM-DD HH:mm"。scheduledAt と併用しないこと'),
  useNextFreeSlot: z.boolean().optional().describe('trueなら直近の空き枠に自動で入れる'),
  accountSlug: z.string().optional(),
}

export const metadata = {
  name: 'schedule_post',
  description:
    '下書きを予約投稿にする。時刻は scheduledAt（UTC ISO）/ jstDateTime（JST）/ useNextFreeSlot のいずれかで指定する。予約された投稿はcronが公開する。',
}

export default async function schedulePost(args: InferSchema<typeof schema>) {
  const post = await prisma.post.findUnique({ where: { id: args.postId } })
  if (!post) return fail(`投稿が見つかりません: ${args.postId}`)
  if (post.status === 'PUBLISHED') return fail('投稿済みのため予約できません。')

  let at: Date | null = null

  if (args.scheduledAt) {
    const parsed = new Date(args.scheduledAt)
    if (Number.isNaN(parsed.getTime())) return fail(`scheduledAt を解釈できません: ${args.scheduledAt}`)
    at = parsed
  } else if (args.jstDateTime) {
    const m = args.jstDateTime.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/)
    if (!m) return fail('jstDateTime は "YYYY-MM-DD HH:mm" 形式で指定してください。')
    at = jstToUtc(m[1], m[2])
  } else if (args.useNextFreeSlot) {
    const [slot] = await nextFreeSlots(1, args.accountSlug)
    if (!slot) return fail('空き枠が見つかりませんでした。投稿スロットの設定を確認してください。')
    at = slot.at
  } else {
    return fail('scheduledAt / jstDateTime / useNextFreeSlot のいずれかを指定してください。')
  }

  if (at.getTime() <= Date.now()) return fail('過去の時刻は予約できません。')

  const conflict = await prisma.post.findFirst({
    where: { accountId: post.accountId, scheduledAt: at, status: { in: ['SCHEDULED', 'PUBLISHED'] }, id: { not: post.id } },
    select: { id: true },
  })
  if (conflict) return fail(`同じ時刻に別の投稿が入っています（${conflict.id}）。別の枠を選んでください。`)

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { status: 'SCHEDULED', scheduledAt: at, lastError: null },
  })

  return ok({
    postId: updated.id,
    status: updated.status,
    scheduledAt: updated.scheduledAt?.toISOString(),
    jst: new Date(at.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' '),
  })
}

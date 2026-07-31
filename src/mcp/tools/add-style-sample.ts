import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { ok, resolveAccount } from '@/mcp/shared'

export const schema = {
  content: z.string().min(1).describe('お手本にしたい投稿文'),
  note: z.string().optional().describe('どこが良いのかのメモ'),
  sourceUrl: z.string().optional().describe('出典URL'),
  accountSlug: z.string().optional(),
}

export const metadata = {
  name: 'add_style_sample',
  description:
    'トーン・文体のお手本を登録する。ここに溜めたものは get_writing_context で返され、投稿生成の基準になる。',
}

export default async function addStyleSample(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)
  const sample = await prisma.styleSample.create({
    data: { accountId: account.id, content: args.content, note: args.note, sourceUrl: args.sourceUrl },
  })
  const total = await prisma.styleSample.count({ where: { accountId: account.id } })
  return ok({ id: sample.id, totalSamples: total })
}

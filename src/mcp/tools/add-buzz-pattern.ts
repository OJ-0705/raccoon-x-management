import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { ok, resolveAccount } from '@/mcp/shared'

export const schema = {
  sourceText: z.string().min(1).describe('分析対象の投稿本文'),
  hookType: z.string().describe('フックの型（例: 数値ギャップ / 逆張り / 実体験の告白）'),
  structure: z.string().describe('構成の説明（例: 1行目で常識を否定→根拠→具体例3つ→問いかけ）'),
  analysis: z
    .object({
      firstLine: z.string().optional(),
      emotion: z.string().optional(),
      writingStyle: z.string().optional(),
      whyItWorked: z.string().optional(),
    })
    .optional()
    .describe('詳細分析'),
  impressions: z.number().int().optional().describe('元投稿のインプレッション数'),
  sourceUrl: z.string().optional(),
  accountSlug: z.string().optional(),
}

export const metadata = {
  name: 'add_buzz_pattern',
  description:
    '外部のバズ投稿を構造分解して登録する。フックと構成の引き出しとして get_writing_context から参照される。',
}

export default async function addBuzzPattern(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)
  const pattern = await prisma.buzzPattern.create({
    data: {
      accountId: account.id,
      sourceText: args.sourceText,
      hookType: args.hookType,
      structure: args.structure,
      analysis: args.analysis ? JSON.stringify(args.analysis) : null,
      impressions: args.impressions,
      sourceUrl: args.sourceUrl,
    },
  })
  const total = await prisma.buzzPattern.count({ where: { accountId: account.id } })
  return ok({ id: pattern.id, totalPatterns: total })
}

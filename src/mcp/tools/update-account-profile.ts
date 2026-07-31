import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { toProfile } from '@/lib/account'
import { ok, resolveAccount } from '@/mcp/shared'

export const schema = {
  accountSlug: z.string().optional().describe('アカウントのslug。省略時はアクティブなアカウント'),
  displayName: z.string().optional().describe('表示名'),
  xUsername: z.string().optional().describe('Xのハンドル（@なし）'),
  threadsUsername: z.string().optional().describe('Threadsのハンドル（@なし）'),
  persona: z.string().optional().describe('一人称・口調・キャラクター設定'),
  theme: z.string().optional().describe('発信テーマ・扱う領域'),
  targetAudience: z.string().optional().describe('想定読者'),
  rules: z.string().optional().describe('投稿の必須要素とNGパターン（Markdown）'),
  ctaPolicy: z.string().optional().describe('CTAの方針'),
  postTypes: z
    .array(z.object({ name: z.string(), priority: z.number().optional(), note: z.string().optional() }))
    .optional()
    .describe('投稿型と優先度のリスト'),
  charLimitMin: z.number().int().optional().describe('推奨文字数の下限'),
  charLimitMax: z.number().int().optional().describe('推奨文字数の上限'),
  postingSlots: z.array(z.string()).optional().describe('JSTの投稿時刻リスト 例 ["08:00","12:30","21:00"]'),
  monthlyBudgetUsd: z.number().optional().describe('X APIの月次予算（USD）'),
}

export const metadata = {
  name: 'update_account_profile',
  description:
    'アカウントの運用方針を更新する。発信テーマやペルソナはコードではなくここに保存されるので、別ジャンルへ乗り換えるときもこのツールで書き換えるだけでよい。指定した項目だけが更新される。',
}

export default async function updateAccountProfile(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)

  const data: Record<string, unknown> = {}
  const passthrough = [
    'displayName',
    'xUsername',
    'threadsUsername',
    'persona',
    'theme',
    'targetAudience',
    'rules',
    'ctaPolicy',
    'charLimitMin',
    'charLimitMax',
    'monthlyBudgetUsd',
  ] as const

  for (const key of passthrough) {
    if (args[key] !== undefined) data[key] = args[key]
  }
  if (args.postTypes !== undefined) data.postTypes = JSON.stringify(args.postTypes)
  if (args.postingSlots !== undefined) data.postingSlots = JSON.stringify(args.postingSlots)

  if (Object.keys(data).length === 0) {
    return ok({ updated: [], profile: toProfile(account), note: '更新項目が指定されていません' })
  }

  const updated = await prisma.account.update({ where: { id: account.id }, data })
  return ok({ updated: Object.keys(data), profile: toProfile(updated) })
}

import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { toProfile } from '@/lib/account'
import { ok, resolveAccount } from '@/mcp/shared'

export const schema = {
  accountSlug: z.string().optional().describe('アカウントのslug。省略時はアクティブなアカウント'),
}

export const metadata = {
  name: 'get_account_profile',
  description:
    'アカウントの運用方針（ペルソナ・発信テーマ・想定読者・投稿ルール・CTA方針・投稿型・文字数レンジ・投稿スロット・月次予算）を取得する。投稿を作る前に必ず確認すること。missing に未設定の項目が入る。',
  annotations: { readOnlyHint: true },
}

export default async function getAccountProfile({ accountSlug }: InferSchema<typeof schema>) {
  const account = await resolveAccount(accountSlug)
  return ok({ profile: toProfile(account) })
}

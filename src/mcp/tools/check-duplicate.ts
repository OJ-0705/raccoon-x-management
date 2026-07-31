import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { checkDuplicate } from '@/lib/dedupe'
import { ok, resolveAccount } from '@/mcp/shared'

export const schema = {
  content: z.string().describe('チェックしたい投稿本文'),
  theme: z.string().optional().describe('Layer1: 投稿の大枠のテーマ'),
  message: z.string().optional().describe('Layer2: 伝えたい核心メッセージを1文で'),
  entities: z.array(z.string()).optional().describe('Layer3: 登場する固有名詞・商品名・数値'),
  accountSlug: z.string().optional(),
  windowDays: z.number().int().min(0).max(3650).optional().describe('何日前まで遡って比較するか（既定180、0で全期間）'),
  excludePostId: z.string().optional().describe('比較から除外する投稿ID（既存投稿を編集する場合に自分を除外する）'),
}

export const metadata = {
  name: 'check_duplicate',
  description:
    '3層（テーマ／核心メッセージ／固有名詞・数値）と本文類似度で既出ネタと衝突していないか判定する。下書きを確定する前に必ず通すこと。theme / message / entities を渡すほど精度が上がる。',
  annotations: { readOnlyHint: true },
}

export default async function checkDuplicateTool(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)
  const result = await checkDuplicate({
    accountId: account.id,
    content: args.content,
    theme: args.theme,
    message: args.message,
    entities: args.entities,
    windowDays: args.windowDays,
    excludePostId: args.excludePostId,
  })

  return ok({
    isDuplicate: result.isDuplicate,
    checkedAgainst: result.checkedAgainst,
    hits: result.hits,
    verdict: result.isDuplicate
      ? '既出と衝突しています。別のネタに差し替えるか、切り口を変えてください。'
      : '重複なし。このまま進めて問題ありません。',
  })
}

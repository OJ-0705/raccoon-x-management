import { z } from 'zod'
import { type InferSchema } from 'xmcp'
import { prisma } from '@/lib/prisma'
import { checkDuplicate } from '@/lib/dedupe'
import { containsLink, unitPriceUsd } from '@/lib/pricing'
import { ok, fail, resolveAccount } from '@/mcp/shared'

export const schema = {
  content: z.string().min(1).describe('投稿本文'),
  theme: z.string().optional().describe('Layer1: 大枠のテーマ（重複チェックに使う）'),
  message: z.string().optional().describe('Layer2: 核心メッセージ1文（重複チェックに使う）'),
  entities: z.array(z.string()).optional().describe('Layer3: 固有名詞・商品名・数値（重複チェックに使う）'),
  postType: z.string().optional().describe('投稿型。Account.postTypes と揃えると分析しやすい'),
  mediaUrls: z.array(z.string()).optional().describe('画像・動画のURL（最大4件）'),
  hashtags: z.string().optional(),
  postToX: z.boolean().optional().describe('Xへ投稿するか（既定true）'),
  postToThreads: z.boolean().optional().describe('Threadsへ投稿するか（既定false）'),
  accountSlug: z.string().optional(),
  skipDuplicateCheck: z.boolean().optional().describe('重複チェックを飛ばす（既定false）'),
  markReviewed: z.boolean().optional().describe('REVIEWED（予約待ち）で作成する（既定falseでDRAFT）'),
}

export const metadata = {
  name: 'create_draft',
  description:
    '下書きを作成する。既定で3層の重複チェックが走り、既出と衝突した場合は作成せずに衝突内容を返す。文字数レンジ超過とリンク課金についても警告を返す。',
}

export default async function createDraft(args: InferSchema<typeof schema>) {
  const account = await resolveAccount(args.accountSlug)

  if (!args.skipDuplicateCheck) {
    const dup = await checkDuplicate({
      accountId: account.id,
      content: args.content,
      theme: args.theme,
      message: args.message,
      entities: args.entities,
    })
    if (dup.isDuplicate) {
      return fail('既出ネタと衝突したため作成していません。切り口を変えるか別ネタにしてください。', {
        hits: dup.hits,
        hint: 'どうしても作成する場合は skipDuplicateCheck: true を指定してください。',
      })
    }
  }

  const warnings: string[] = []
  const length = [...args.content].length
  if (length < account.charLimitMin) warnings.push(`本文が短めです（${length}文字 / 推奨${account.charLimitMin}文字以上）`)
  if (length > account.charLimitMax) warnings.push(`本文が長すぎます（${length}文字 / 推奨${account.charLimitMax}文字以下）`)
  if (length > 280) warnings.push('280文字を超えています。X Premium未加入だと投稿できません。')
  if (containsLink(args.content)) {
    warnings.push(
      `リンクが含まれています。X APIの単価が $${unitPriceUsd('POST_CREATE')} → $${unitPriceUsd('POST_CREATE_WITH_LINK')} に上がります。`,
    )
  }

  const post = await prisma.post.create({
    data: {
      accountId: account.id,
      content: args.content,
      status: args.markReviewed ? 'REVIEWED' : 'DRAFT',
      postType: args.postType,
      mediaUrls: args.mediaUrls?.length ? JSON.stringify(args.mediaUrls.slice(0, 4)) : null,
      hashtags: args.hashtags,
      postToX: args.postToX ?? true,
      postToThreads: args.postToThreads ?? false,
      dedupeTheme: args.theme,
      dedupeMessage: args.message,
      dedupeEntities: args.entities?.length ? JSON.stringify(args.entities) : null,
    },
  })

  return ok({
    postId: post.id,
    status: post.status,
    length,
    warnings,
    next: '予約するには get_free_slots で空き枠を確認し、schedule_post を呼んでください。',
  })
}

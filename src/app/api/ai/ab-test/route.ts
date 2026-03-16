import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const { content, postType, scheduledAt } = await req.json()

  let variantA = content
  let variantB = content

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `以下の投稿文をA/Bテスト用に2つのバリアントに書き直してください。
投稿タイプ: ${postType}
元の投稿:
${content}

要件:
- バリアントAは「フック強化型」（冒頭の引きつけを強める）
- バリアントBは「共感訴求型」（読者の感情に訴える）
- 各バリアントは元の内容を保ちつつ異なるアプローチを取る
- ハッシュタグは最大2個
- 区切りは「===」のみを使用

出力形式:
[バリアントAの本文]
===
[バリアントBの本文]`,
        }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      const parts = text.split('===').map(s => s.trim()).filter(Boolean)
      if (parts.length >= 2) {
        variantA = parts[0]
        variantB = parts[1]
      }
    } catch (e) {
      console.error('[ab-test]', e)
    }
  }

  const groupId = crypto.randomUUID()
  const baseSchedule = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 86400000)
  const scheduleB = new Date(baseSchedule.getTime() + 3600000) // B posts 1 hour later

  const [postA, postB] = await Promise.all([
    prisma.post.create({
      data: {
        content: variantA,
        postType,
        formatType: 'テキスト',
        status: '承認待ち',
        scheduledAt: baseSchedule,
        abGroupId: groupId,
        abVariant: 'A',
        platform: 'both',
      },
    }),
    prisma.post.create({
      data: {
        content: variantB,
        postType,
        formatType: 'テキスト',
        status: '承認待ち',
        scheduledAt: scheduleB,
        abGroupId: groupId,
        abVariant: 'B',
        platform: 'both',
      },
    }),
  ])

  return NextResponse.json({ groupId, postA, postB })
}

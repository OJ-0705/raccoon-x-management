import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const { content, postType } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        variants: [
          content + '\n\n（AI改善版1: APIキーを設定してください）',
          content + '\n\n（AI改善版2: APIキーを設定してください）',
          content + '\n\n（AI改善版3: APIキーを設定してください）',
        ],
        generated: false,
      })
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `以下のX投稿文（${postType}）を3つの異なるアプローチで改善してください。

元の投稿:
${content}

改善ルール:
- より高いエンゲージメントを狙う
- 具体的な数値・体験談を強化
- 読者の感情を動かす表現に変える
- ハッシュタグは最大2つ
- 各バリアントは明確に異なるアプローチ

以下の形式で出力（===で区切る）:
[バリアント1]
（改善した投稿文）
===
[バリアント2]
（改善した投稿文）
===
[バリアント3]
（改善した投稿文）`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const variants = text.split('===').map(v =>
      v.replace(/^\s*\[バリアント\d+\]\s*/m, '').trim()
    ).filter(Boolean).slice(0, 3)

    return NextResponse.json({ variants, generated: true })
  } catch (error) {
    console.error('[ai/improve]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

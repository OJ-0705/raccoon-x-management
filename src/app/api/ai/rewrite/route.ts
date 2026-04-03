import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const { content, instruction, postType, formatType } = await req.json()
    const isLongForm = formatType === '長文投稿'

    // AI_DISABLED: Anthropic API呼び出し一時停止中
    return NextResponse.json({ result: 'API一時停止中', generated: false })

    /* eslint-disable no-unreachable */
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ result: content + '\n（AI書き換え: APIキー未設定）', generated: false })
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: isLongForm ? 4000 : 600,
      messages: [{
        role: 'user',
        content: `以下のX投稿文（${postType || 'その他'}）を指示に従って書き換えてください。

元の投稿:
${content}

指示:
${instruction}

ルール:
- 書き換えた投稿文のみを出力（説明・前置き・コメント不要）
- ハッシュタグは最大2つ
${isLongForm
  ? '- X Premium長文投稿（最大25,000文字）として詳細に展開してよい\n- 見出しや箇条書きで読みやすく構成する'
  : '- X Premium標準形式（280文字以内）に収める'
}
- 最初の140文字で読者を引きつけるフックを入れる
- 具体的な数値・体験談があればより効果的
- 【重要】1文目の文末には「。」を入れない（フックとして「続きが気になる」状態を作るため）`,
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : content
    // Remove trailing 。 from first line
    const nl = raw.indexOf('\n')
    const first = nl >= 0 ? raw.slice(0, nl) : raw
    const rest = nl >= 0 ? raw.slice(nl) : ''
    const result = first.replace(/。$/, '') + rest
    return NextResponse.json({ result, generated: true })
  } catch (error) {
    console.error('[ai/rewrite]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

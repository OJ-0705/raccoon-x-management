import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  try {
    const patterns = await prisma.buzzPattern.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ patterns })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sourceUrl, sourceText } = await req.json()
    if (!sourceText?.trim()) {
      return NextResponse.json({ error: '投稿テキストが必要です' }, { status: 400 })
    }

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey })

    const analysisPrompt = `以下のX（旧Twitter）投稿を分析し、バズった理由と構造パターンをJSONで出力してください。説明不要、JSONのみ。

投稿：
${sourceText}

出力形式：
{
  "hookType": "驚き|共感|疑問|怒り|喜び|自虐|発見 のいずれか",
  "structure": "フック→本文→結論の構造を1行で（例：感情的フック→数値比較→問いかけ）",
  "analysis": {
    "firstLine": "1行目のフック構造の説明",
    "emotion": "呼び起こす感情の種類",
    "writingStyle": "文体の特徴",
    "numbersUsed": "数値の使い方（なければ空文字）",
    "cta": "CTAの有無と種類（なければ「なし」）"
  }
}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: analysisPrompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI分析に失敗しました' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    const pattern = await prisma.buzzPattern.create({
      data: {
        sourceUrl: sourceUrl || null,
        sourceText,
        analysis: JSON.stringify(parsed.analysis || {}),
        hookType: parsed.hookType || '不明',
        structure: parsed.structure || '',
      },
    })

    return NextResponse.json({ pattern, analysis: parsed })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '登録に失敗しました', details: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await prisma.buzzPattern.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}

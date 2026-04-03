import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

interface TweetInput {
  text: string
  sourceUrl?: string
  likes?: number
  retweets?: number
  impressions?: number
}

const ANALYSIS_PROMPT = (text: string) => `以下のX（旧Twitter）投稿を分析し、バズった理由と構造パターンをJSONで出力してください。説明不要、JSONのみ。

投稿：
${text}

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

async function analyzeTweet(client: Anthropic, tweet: TweetInput): Promise<{
  hookType: string; structure: string; analysis: object
} | null> {
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: ANALYSIS_PROMPT(tweet.text) }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    return {
      hookType: parsed.hookType || '不明',
      structure: parsed.structure || '',
      analysis: parsed.analysis || {},
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const auth = req.headers.get('Authorization') || ''
    const token = auth.replace('Bearer ', '').trim()
    if (!token || token !== (process.env.ADMIN_PASSWORD || '').trim()) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
    }

    const body = await req.json()
    const tweets: TweetInput[] = body.tweets || []
    if (!Array.isArray(tweets) || tweets.length === 0) {
      return NextResponse.json({ error: 'tweets 配列が必要です' }, { status: 400 })
    }

    // Limit to 30 tweets per request to avoid timeout
    const targets = tweets.slice(0, 30)
    const client = new Anthropic({ apiKey })

    const results = { imported: 0, skipped: 0, errors: 0 }

    for (const tweet of targets) {
      if (!tweet.text?.trim()) { results.skipped++; continue }

      // Skip if already exists (deduplicate by first 100 chars)
      const existing = await prisma.buzzPattern.findFirst({
        where: { sourceText: { startsWith: tweet.text.slice(0, 100) } },
      })
      if (existing) { results.skipped++; continue }

      const analyzed = await analyzeTweet(client, tweet)
      if (!analyzed) { results.errors++; continue }

      await prisma.buzzPattern.create({
        data: {
          sourceText: tweet.text,
          sourceUrl: tweet.sourceUrl || null,
          hookType: analyzed.hookType,
          structure: analyzed.structure,
          analysis: JSON.stringify(analyzed.analysis),
        },
      })
      results.imported++

      // Small delay to avoid API rate limits
      await new Promise(r => setTimeout(r, 200))
    }

    return NextResponse.json({ success: true, results, total: targets.length })
  } catch (error) {
    console.error('[buzz-patterns/bulk]', error)
    return NextResponse.json({ error: '一括インポートに失敗しました', details: String(error) }, { status: 500 })
  }
}

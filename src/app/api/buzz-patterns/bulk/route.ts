import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface TweetInput {
  text: string
  sourceUrl?: string
  likes?: number
  retweets?: number
  impressions?: number
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.replace('Bearer ', '').trim()
    if (!token || token !== (process.env.ADMIN_PASSWORD || '').trim()) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await req.json()
    const tweets: TweetInput[] = body.tweets || []
    if (!Array.isArray(tweets) || tweets.length === 0) {
      return NextResponse.json({ error: 'tweets 配列が必要です' }, { status: 400 })
    }

    const targets = tweets.slice(0, 30)
    const results = { imported: 0, skipped: 0, errors: 0 }

    for (const tweet of targets) {
      if (!tweet.text?.trim()) { results.skipped++; continue }

      const existing = await prisma.buzzPattern.findFirst({
        where: { sourceText: { startsWith: tweet.text.slice(0, 100) } },
      })
      if (existing) { results.skipped++; continue }

      await prisma.buzzPattern.create({
        data: {
          sourceText: tweet.text,
          sourceUrl: tweet.sourceUrl || null,
          hookType: '手動登録',
          structure: '',
          analysis: '{}',
        },
      })
      results.imported++
    }

    return NextResponse.json({ success: true, results, total: targets.length })
  } catch (error) {
    console.error('[buzz-patterns/bulk]', error)
    return NextResponse.json({ error: '一括インポートに失敗しました', details: String(error) }, { status: 500 })
  }
}

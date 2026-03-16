import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const { days = 7 } = await req.json().catch(() => ({}))
    const since = new Date()
    since.setDate(since.getDate() - days)

    const [analytics, postsByType, postedPosts] = await Promise.all([
      prisma.analytics.findMany({ where: { date: { gte: since } }, orderBy: { date: 'asc' } }),
      prisma.post.groupBy({
        by: ['postType'],
        _count: { id: true },
        _sum: { impressions: true, likes: true, retweets: true, replies: true, bookmarks: true },
        where: { status: '投稿済み', createdAt: { gte: since } },
      }),
      prisma.post.findMany({
        where: { status: '投稿済み', createdAt: { gte: since } },
        orderBy: [{ likes: 'desc' }, { impressions: 'desc' }],
        take: 5,
      }),
    ])

    const latestFollowers = analytics[analytics.length - 1]?.followers ?? 0
    const firstFollowers = analytics[0]?.followers ?? latestFollowers
    const followerGrowth = latestFollowers - firstFollowers
    const totalImp = postedPosts.reduce((s, p) => s + p.impressions, 0)
    const totalLikes = postedPosts.reduce((s, p) => s + p.likes, 0)
    const bestType = [...postsByType].sort((a, b) => {
      const engA = (a._sum.likes || 0) + (a._sum.retweets || 0) + (a._sum.replies || 0) + (a._sum.bookmarks || 0)
      const engB = (b._sum.likes || 0) + (b._sum.retweets || 0) + (b._sum.replies || 0) + (b._sum.bookmarks || 0)
      const impA = a._sum.impressions || 1
      const impB = b._sum.impressions || 1
      return (engB / impB) - (engA / impA)
    })[0]?.postType ?? '（データなし）'

    const summary = `期間: 過去${days}日間
フォロワー増減: ${followerGrowth >= 0 ? '+' : ''}${followerGrowth}人
総インプレッション: ${totalImp.toLocaleString()}
総いいね: ${totalLikes.toLocaleString()}
最高エンゲージメント投稿タイプ: ${bestType}
投稿済み数: ${postedPosts.length}件
トップ投稿: "${postedPosts[0]?.content?.slice(0, 60) ?? 'なし'}..."`

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        report: `📊 パフォーマンスサマリー（過去${days}日）\n\n${summary}\n\n※ ANTHROPIC_API_KEY を設定するとAIによる詳細分析が利用できます。`,
        generated: false,
      })
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `以下のX運用データを分析して、日本語で実践的なパフォーマンスレポートを作成してください。

${summary}

レポート形式:
1. 総評（2-3行）
2. うまくいったこと
3. 改善が必要なこと
4. 来週への具体的なアクション提案（3つ）

絵文字を適切に使い、箇条書きで簡潔にまとめてください。`,
      }],
    })

    const report = message.content[0].type === 'text' ? message.content[0].text : summary
    return NextResponse.json({ report, generated: true })
  } catch (error) {
    console.error('[ai/report]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

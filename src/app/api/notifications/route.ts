import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24h

    // High-engagement posts
    const highEng = await prisma.post.findMany({
      where: {
        status: '投稿済み',
        postedAt: { gte: since },
        OR: [
          { likes: { gte: 50 } },
          { retweets: { gte: 20 } },
          { bookmarks: { gte: 30 } },
        ],
      },
      select: { id: true, content: true, likes: true, retweets: true, bookmarks: true, postedAt: true },
      take: 5,
      orderBy: { likes: 'desc' },
    })

    // Follower change
    const analytics = await prisma.analytics.findMany({
      orderBy: { date: 'desc' },
      take: 2,
      select: { date: true, followers: true },
    })

    const events: { type: string; message: string; time: string }[] = []

    for (const p of highEng) {
      const score = p.likes + (p.retweets || 0) * 2 + (p.bookmarks || 0) * 3
      events.push({
        type: 'high_engagement',
        message: `🔥 高エンゲージメント: いいね${p.likes} / RT${p.retweets} 「${p.content.slice(0, 30)}...」`,
        time: p.postedAt?.toISOString() || new Date().toISOString(),
      })
      // Optional Slack notify
      const webhookUrl = process.env.SLACK_WEBHOOK_URL
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🔥 *高エンゲージメント投稿* (スコア${score})\n${p.content.slice(0, 100)}\nいいね: ${p.likes} / RT: ${p.retweets} / ブクマ: ${p.bookmarks}`,
          }),
        }).catch(() => {})
      }
    }

    if (analytics.length === 2) {
      const [latest, prev] = analytics
      const diff = (latest.followers || 0) - (prev.followers || 0)
      if (Math.abs(diff) >= 5) {
        events.push({
          type: diff > 0 ? 'follower_gain' : 'follower_loss',
          message: diff > 0
            ? `📈 フォロワー+${diff}人増加しました`
            : `📉 フォロワー${diff}人減少しました`,
          time: latest.date.toISOString(),
        })
        const webhookUrl = process.env.SLACK_WEBHOOK_URL
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: diff > 0
                ? `📈 フォロワー *+${diff}人* 増加しました（現在: ${latest.followers?.toLocaleString()}人）`
                : `📉 フォロワー *${diff}人* 減少しました（現在: ${latest.followers?.toLocaleString()}人）`,
            }),
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ events, count: events.length })
  } catch (error) {
    console.error('[notifications]', error)
    return NextResponse.json({ events: [], count: 0 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const posted = await prisma.post.findMany({
      where: { status: '投稿済み', postedAt: { not: null } },
      select: { postType: true, postedAt: true, likes: true, retweets: true, replies: true, bookmarks: true, impressions: true },
    })

    if (posted.length < 5) {
      // Not enough data — return defaults
      return NextResponse.json({ learned: false, optimalHours: {} })
    }

    // Group by postType + hour, sum engagement
    const byTypeHour: Record<string, Record<number, { total: number; count: number }>> = {}
    for (const p of posted) {
      if (!p.postedAt) continue
      const hour = new Date(p.postedAt).getHours()
      const eng = p.likes + p.retweets * 2 + p.replies + p.bookmarks * 3
      const imp = p.impressions || 1
      const rate = eng / imp
      if (!byTypeHour[p.postType]) byTypeHour[p.postType] = {}
      if (!byTypeHour[p.postType][hour]) byTypeHour[p.postType][hour] = { total: 0, count: 0 }
      byTypeHour[p.postType][hour].total += rate
      byTypeHour[p.postType][hour].count += 1
    }

    // Find best hour per postType
    const optimalHours: Record<string, number> = {}
    for (const [type, hours] of Object.entries(byTypeHour)) {
      let bestHour = 12
      let bestRate = -1
      for (const [h, data] of Object.entries(hours)) {
        const avg = data.total / data.count
        if (avg > bestRate) { bestRate = avg; bestHour = parseInt(h) }
      }
      optimalHours[type] = bestHour
    }

    // Also compute overall hourly engagement (for chart)
    const hourlyEng: Record<number, number> = {}
    for (const p of posted) {
      if (!p.postedAt) continue
      const hour = new Date(p.postedAt).getHours()
      const eng = p.likes + p.retweets * 2 + p.replies + p.bookmarks * 3
      hourlyEng[hour] = (hourlyEng[hour] || 0) + eng
    }

    return NextResponse.json({ learned: true, optimalHours, hourlyEng })
  } catch (error) {
    console.error('[optimal-times]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

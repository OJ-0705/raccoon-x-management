import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DAILY_SLOTS = [7, 12, 21] // 朝7時 / 昼12時 / 夜21時

export async function GET() {
  try {
    // Get all future scheduled posts
    const now = new Date()
    const posts = await prisma.post.findMany({
      where: { scheduledAt: { gte: now } },
      select: { scheduledAt: true },
    })

    // Build a Set of booked "YYYY-M-D-H" keys
    const booked = new Set(
      posts
        .filter(p => p.scheduledAt)
        .map(p => {
          const d = new Date(p.scheduledAt!)
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
        })
    )

    // Find next available slot starting from now
    for (let day = 0; day < 21; day++) {
      for (const hour of DAILY_SLOTS) {
        const candidate = new Date()
        candidate.setDate(now.getDate() + day)
        candidate.setHours(hour, 0, 0, 0)
        if (candidate <= now) continue
        const key = `${candidate.getFullYear()}-${candidate.getMonth()}-${candidate.getDate()}-${hour}`
        if (!booked.has(key)) {
          const display = candidate.toLocaleDateString('ja-JP', {
            month: 'numeric', day: 'numeric', weekday: 'short',
          }) + ` ${hour}:00`
          return NextResponse.json({ scheduledAt: candidate.toISOString(), display })
        }
      }
    }

    // Fallback: 3 weeks out at 21:00
    const fallback = new Date()
    fallback.setDate(fallback.getDate() + 21)
    fallback.setHours(21, 0, 0, 0)
    return NextResponse.json({ scheduledAt: fallback.toISOString(), display: '' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

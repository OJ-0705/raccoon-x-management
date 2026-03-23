import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Target posting times in JST. Converted to UTC for server-side use.
const JST_OFFSET_MS = 9 * 60 * 60 * 1000  // UTC+9
const DAILY_JST_HOURS = [7, 12, 21]         // JST 07:00 / 12:00 / 21:00

/** Build a booked-slot key using JST date+hour (to match browser-side ScheduleModal keys) */
function jstKey(utcDate: Date, jstHour: number): string {
  const jst = new Date(utcDate.getTime() + JST_OFFSET_MS)
  return `${jst.getUTCFullYear()}-${jst.getUTCMonth()}-${jst.getUTCDate()}-${jstHour}`
}

/** Return the UTC Date that corresponds to a given JST day-offset + JST hour */
function jstSlotToUTC(baseUTC: Date, dayOffset: number, jstHour: number): Date {
  // Start from JST midnight of today, advance by dayOffset days, then add jstHour hours
  const jstNow = new Date(baseUTC.getTime() + JST_OFFSET_MS)
  jstNow.setUTCHours(0, 0, 0, 0)  // JST midnight (as UTC value)
  const jstSlot = new Date(jstNow.getTime() + dayOffset * 86400000 + jstHour * 3600000)
  return new Date(jstSlot.getTime() - JST_OFFSET_MS)  // convert back to UTC
}

export async function GET() {
  try {
    const now = new Date()

    // Get all future scheduled posts
    const posts = await prisma.post.findMany({
      where: { scheduledAt: { gte: now } },
      select: { scheduledAt: true },
    })

    // Build a Set of booked "YYYY-M-D-H" keys in JST
    const booked = new Set(
      posts
        .filter(p => p.scheduledAt)
        .map(p => {
          const d = new Date(p.scheduledAt!)
          const jst = new Date(d.getTime() + JST_OFFSET_MS)
          const jstHour = jst.getUTCHours()
          return `${jst.getUTCFullYear()}-${jst.getUTCMonth()}-${jst.getUTCDate()}-${jstHour}`
        })
    )

    // Find next available slot starting from now (in JST)
    for (let day = 0; day < 21; day++) {
      for (const jstHour of DAILY_JST_HOURS) {
        const candidate = jstSlotToUTC(now, day, jstHour)
        if (candidate <= now) continue

        // Build JST day info for the key
        const jst = new Date(candidate.getTime() + JST_OFFSET_MS)
        const key = `${jst.getUTCFullYear()}-${jst.getUTCMonth()}-${jst.getUTCDate()}-${jstHour}`
        if (!booked.has(key)) {
          const display = candidate.toLocaleDateString('ja-JP', {
            month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo',
          }) + ` ${jstHour}:00`
          return NextResponse.json({ scheduledAt: candidate.toISOString(), display })
        }
      }
    }

    // Fallback: 3 weeks out at JST 21:00
    const fallback = jstSlotToUTC(now, 21, 21)
    return NextResponse.json({ scheduledAt: fallback.toISOString(), display: '' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

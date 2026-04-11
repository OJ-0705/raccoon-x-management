import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface ImportPost {
  content: string
  postType: string
  scheduledAt: string
  postToX: boolean
  postToThreads: boolean
  source?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ImportPost[]

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'JSONは配列である必要があります' }, { status: 400 })
    }

    const now = new Date()
    let inserted = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < body.length; i++) {
      const item = body[i]

      if (!item.content || !item.content.trim()) {
        skipped++
        continue
      }

      if (!item.postType || !item.scheduledAt) {
        errors.push(`[${i}] postType または scheduledAt が欠落しています`)
        skipped++
        continue
      }

      let scheduledDate: Date
      try {
        scheduledDate = new Date(item.scheduledAt)
        if (isNaN(scheduledDate.getTime())) throw new Error('invalid date')
      } catch {
        errors.push(`[${i}] scheduledAt の日時形式が不正です: ${item.scheduledAt}`)
        skipped++
        continue
      }

      // Past date → draft; future date → scheduled
      const isPast = scheduledDate < now
      const status = isPast ? '下書き' : '予約済み'

      // Determine platform
      const postToX = item.postToX !== false
      const postToThreads = item.postToThreads !== false
      const platform = postToX && postToThreads ? 'both' : postToX ? 'x' : 'threads'

      await prisma.post.create({
        data: {
          content: item.content.trim(),
          postType: item.postType,
          formatType: 'テキスト',
          status,
          scheduledAt: scheduledDate,
          platform,
        },
      })
      inserted++
    }

    return NextResponse.json({ success: true, inserted, skipped, errors: errors.length ? errors : undefined })
  } catch (error) {
    console.error('[posts/import]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

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

interface ImportPayload {
  exported_at: string
  total_posts: number
  posts: ImportPost[]
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()

    // 新形式 { exported_at, total_posts, posts: [...] } と旧形式 [...] の両方に対応
    let body: ImportPost[]
    if (Array.isArray(raw)) {
      body = raw as ImportPost[]
    } else if (raw && Array.isArray((raw as ImportPayload).posts)) {
      body = (raw as ImportPayload).posts
    } else {
      return NextResponse.json({ error: 'JSONはpostsフィールドを持つオブジェクトか配列である必要があります' }, { status: 400 })
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

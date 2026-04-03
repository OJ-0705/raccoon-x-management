import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { postToX, postToThreads } from '@/lib/poster'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })

    const platform = post.platform || 'both'
    const doX = platform === 'x' || platform === 'both'
    const doThreads = platform === 'threads' || platform === 'both'

    const errors: string[] = []
    let xPostId: string | null = null
    let threadsPostId: string | null = null

    let mediaUrls: string[] | undefined
    if (post.imageUrls) {
      try { mediaUrls = JSON.parse(post.imageUrls) } catch { /* ignore */ }
    }

    if (doX) {
      const r = await postToX(post.content, mediaUrls)
      if (r.error) errors.push(`X: ${r.error}`)
      else xPostId = r.id || null
    }

    if (doThreads) {
      const r = await postToThreads(post.content, mediaUrls)
      if (r.error) errors.push(`Threads: ${r.error}`)
      else threadsPostId = r.id || null
    }

    const totalExpected = (doX ? 1 : 0) + (doThreads ? 1 : 0)
    const newStatus = errors.length === totalExpected ? '失敗' : '投稿済み'

    await prisma.post.update({
      where: { id },
      data: {
        status: newStatus,
        postedAt: new Date(),
        ...(xPostId ? { xPostId } : {}),
        ...(threadsPostId ? { threadsPostId } : {}),
      },
    })

    if (errors.length > 0 && errors.length < totalExpected) {
      return NextResponse.json({ success: true, partial: true, errors, xPostId, threadsPostId })
    }
    if (errors.length === totalExpected) {
      return NextResponse.json({ success: false, errors }, { status: 500 })
    }

    return NextResponse.json({ success: true, xPostId, threadsPostId })
  } catch (error) {
    console.error('[publish]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

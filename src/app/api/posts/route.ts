import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const postType = searchParams.get('postType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const sort = searchParams.get('sort')
    const days = searchParams.get('days')

    const platform = searchParams.get('platform')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (postType) where.postType = postType
    if (platform === 'threads') where.platform = { in: ['threads', 'both'] }
    else if (platform) where.platform = platform
    if (days) {
      const since = new Date()
      since.setDate(since.getDate() - parseInt(days))
      where.createdAt = { gte: since }
    }

    if (sort === 'engagement') {
      const all = await prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      all.sort((a, b) => {
        const scoreA = a.likes + a.retweets * 2 + a.replies + a.bookmarks * 3
        const scoreB = b.likes + b.retweets * 2 + b.replies + b.bookmarks * 3
        return scoreB - scoreA
      })
      const posts = all.slice(skip, skip + limit)
      return NextResponse.json({ posts, total: all.length, page, limit })
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    return NextResponse.json({ posts, total, page, limit })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '投稿一覧の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const post = await prisma.post.create({
      data: {
        content: body.content,
        postType: body.postType,
        formatType: body.formatType || 'テキスト',
        status: body.status || '下書き',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        imageUrls: body.imageUrls ? JSON.stringify(body.imageUrls) : null,
        hashtags: body.hashtags ? JSON.stringify(body.hashtags) : null,
        threadPosts: body.threadPosts ? JSON.stringify(body.threadPosts) : null,
        parentPostId: body.parentPostId || null,
        platform: body.platform || 'both',
      },
    })
    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '投稿の作成に失敗しました' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })
    return NextResponse.json(post)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '投稿の取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.status !== undefined) data.status = body.status
    if (body.scheduledAt !== undefined) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
    if (body.content !== undefined) data.content = body.content
    if (body.platform !== undefined) data.platform = body.platform
    if (body.isFavorite !== undefined) data.isFavorite = body.isFavorite
    if (body.imageUrls !== undefined) data.imageUrls = body.imageUrls ? JSON.stringify(body.imageUrls) : null
    const post = await prisma.post.update({ where: { id }, data })
    return NextResponse.json(post)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '投稿の更新に失敗しました' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const post = await prisma.post.update({
      where: { id },
      data: {
        content: body.content,
        postType: body.postType,
        formatType: body.formatType,
        status: body.status,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        imageUrls: body.imageUrls ? JSON.stringify(body.imageUrls) : null,
        hashtags: body.hashtags ? JSON.stringify(body.hashtags) : null,
        threadPosts: body.threadPosts ? JSON.stringify(body.threadPosts) : null,
        impressions: body.impressions,
        likes: body.likes,
        retweets: body.retweets,
        replies: body.replies,
        bookmarks: body.bookmarks,
        xPostId: body.xPostId,
        postedAt: body.postedAt ? new Date(body.postedAt) : undefined,
      },
    })
    return NextResponse.json(post)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '投稿の更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.post.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '投稿の削除に失敗しました' }, { status: 500 })
  }
}

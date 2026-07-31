import { NextRequest, NextResponse } from 'next/server'
import type { PostStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STATUSES: PostStatus[] = ['DRAFT', 'REVIEWED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await prisma.post.findUnique({
    where: { id },
    include: { metrics: { orderBy: { fetchDate: 'asc' } } },
  })
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ post })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const existing = await prisma.post.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (existing.status === 'PUBLISHED' && body.content && body.content !== existing.content) {
    return NextResponse.json({ error: '投稿済みの本文は変更できません' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.content !== undefined) data.content = body.content
  if (body.status !== undefined && STATUSES.includes(body.status)) data.status = body.status
  if (body.postType !== undefined) data.postType = body.postType
  if (body.hashtags !== undefined) data.hashtags = body.hashtags
  if (body.postToX !== undefined) data.postToX = body.postToX
  if (body.postToThreads !== undefined) data.postToThreads = body.postToThreads
  if (body.isFavorite !== undefined) data.isFavorite = body.isFavorite
  if (body.theme !== undefined) data.dedupeTheme = body.theme
  if (body.message !== undefined) data.dedupeMessage = body.message
  if (body.entities !== undefined) data.dedupeEntities = body.entities?.length ? JSON.stringify(body.entities) : null
  if (body.mediaUrls !== undefined) data.mediaUrls = body.mediaUrls?.length ? JSON.stringify(body.mediaUrls.slice(0, 4)) : null
  if (body.scheduledAt !== undefined) {
    data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
    if (body.scheduledAt && existing.status === 'DRAFT') data.status = 'SCHEDULED'
  }

  const post = await prisma.post.update({ where: { id }, data })
  return NextResponse.json({ post })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hard = new URL(req.url).searchParams.get('hard') === 'true'

  const existing = await prisma.post.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (hard && existing.status !== 'PUBLISHED') {
    await prisma.post.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: 'hard' })
  }

  await prisma.post.update({ where: { id }, data: { status: 'ARCHIVED', scheduledAt: null } })
  return NextResponse.json({ ok: true, deleted: 'archived' })
}

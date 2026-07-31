import { NextRequest, NextResponse } from 'next/server'
import type { PostStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getActiveAccount } from '@/lib/account'
import { checkDuplicate } from '@/lib/dedupe'

export const dynamic = 'force-dynamic'

const STATUSES: PostStatus[] = ['DRAFT', 'REVIEWED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const account = await getActiveAccount()

  const statusParam = searchParams.get('status')
  const statuses = statusParam
    ? statusParam.split(',').filter((s): s is PostStatus => STATUSES.includes(s as PostStatus))
    : []

  const posts = await prisma.post.findMany({
    where: {
      accountId: account.id,
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(searchParams.get('q') ? { content: { contains: searchParams.get('q') as string, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: Number(searchParams.get('limit') ?? 100),
  })

  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.content || typeof body.content !== 'string') {
    return NextResponse.json({ error: '本文が空です' }, { status: 400 })
  }

  const account = await getActiveAccount()

  if (!body.skipDuplicateCheck) {
    const dup = await checkDuplicate({
      accountId: account.id,
      content: body.content,
      theme: body.theme,
      message: body.message,
      entities: body.entities,
    })
    if (dup.isDuplicate) {
      return NextResponse.json({ error: '既出ネタと重複しています', hits: dup.hits }, { status: 409 })
    }
  }

  const post = await prisma.post.create({
    data: {
      accountId: account.id,
      content: body.content,
      status: (STATUSES.includes(body.status) ? body.status : 'DRAFT') as PostStatus,
      postType: body.postType ?? null,
      mediaUrls: Array.isArray(body.mediaUrls) && body.mediaUrls.length ? JSON.stringify(body.mediaUrls.slice(0, 4)) : null,
      hashtags: body.hashtags ?? null,
      postToX: body.postToX ?? true,
      postToThreads: body.postToThreads ?? false,
      dedupeTheme: body.theme ?? null,
      dedupeMessage: body.message ?? null,
      dedupeEntities: Array.isArray(body.entities) && body.entities.length ? JSON.stringify(body.entities) : null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    },
  })

  return NextResponse.json({ post }, { status: 201 })
}

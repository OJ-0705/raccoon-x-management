import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishPost } from '@/lib/publish'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (post.status === 'PUBLISHED') return NextResponse.json({ error: 'すでに投稿済みです' }, { status: 400 })

  const result = await publishPost(post, { ignoreBudget: body.ignoreBudget === true })

  return NextResponse.json(
    {
      ok: result.status === 'PUBLISHED',
      ...result,
      url: result.xPostId ? `https://x.com/i/status/${result.xPostId}` : undefined,
    },
    { status: result.status === 'PUBLISHED' ? 200 : 500 },
  )
}

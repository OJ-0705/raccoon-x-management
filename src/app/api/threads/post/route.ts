import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function postToThreads(text: string): Promise<{ id: string } | { error: string }> {
  const accessToken = process.env.THREADS_ACCESS_TOKEN
  const userId = process.env.THREADS_USER_ID

  if (!accessToken || !userId) {
    return { error: 'THREADS_ACCESS_TOKEN または THREADS_USER_ID が未設定です' }
  }

  // Step 1: Create media container
  const containerUrl = `https://graph.threads.net/v1.0/${userId}/threads`
  const containerRes = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'TEXT', text, access_token: accessToken }),
  })
  const container = await containerRes.json() as { id?: string; error?: { message: string } }
  if (!container.id) {
    return { error: container.error?.message || 'コンテナ作成に失敗' }
  }

  // Step 2: Wait 1s then publish
  await new Promise(r => setTimeout(r, 1000))
  const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
  })
  const published = await publishRes.json() as { id?: string; error?: { message: string } }
  if (!published.id) {
    return { error: published.error?.message || '公開に失敗' }
  }

  return { id: published.id }
}

export async function POST(req: NextRequest) {
  try {
    const { postId } = await req.json()
    const post = await prisma.post.findUnique({ where: { id: postId } })
    if (!post) return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 })

    const result = await postToThreads(post.content)

    if ('error' in result) {
      // No credentials — simulate
      if (result.error.includes('未設定')) {
        await prisma.post.update({
          where: { id: postId },
          data: { threadsPostId: 'simulated_' + Date.now(), status: '投稿済み', postedAt: new Date() },
        })
        return NextResponse.json({ success: true, simulated: true })
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    await prisma.post.update({
      where: { id: postId },
      data: { threadsPostId: result.id, status: '投稿済み', postedAt: new Date() },
    })
    return NextResponse.json({ success: true, threadsPostId: result.id })
  } catch (error) {
    console.error('[threads/post]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

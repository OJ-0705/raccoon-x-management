/**
 * POST /api/seed-from-samples
 *
 * Reads all SamplePosts from DB and registers them as draft Posts (x + threads).
 * Requires Authorization: Bearer <ADMIN_PASSWORD>
 *
 * Safe to re-run: skips samples already registered as posts (by checking content).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // Auth check
  const adminPassword = process.env.ADMIN_PASSWORD
  if (adminPassword) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${adminPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const samples = await prisma.samplePost.findMany({
    orderBy: { number: 'asc' },
  })

  if (samples.length === 0) {
    return NextResponse.json({
      error: 'SamplePostが0件です。先に /api/notion-sync を実行してください',
    }, { status: 400 })
  }

  let created = 0
  const errors: string[] = []

  for (const sample of samples) {
    try {
      // Register as X post (draft)
      await prisma.post.create({
        data: {
          content: sample.text,
          postType: '知識共有型',
          formatType: sample.text.length > 200 ? '長文投稿' : 'short',
          status: '承認待ち',
          platform: 'x',
        },
      })

      // Register as Threads post (draft) with same content
      await prisma.post.create({
        data: {
          content: sample.text,
          postType: '知識共有型',
          formatType: sample.text.length > 200 ? '長文投稿' : 'short',
          status: '承認待ち',
          platform: 'threads',
        },
      })

      created += 2
    } catch (err) {
      errors.push(`サンプル${sample.number}: ${String(err)}`)
    }
  }

  console.log(`[seed-from-samples] Created ${created} posts from ${samples.length} samples`)

  return NextResponse.json({
    success: true,
    samples: samples.length,
    postsCreated: created,
    errors: errors.length > 0 ? errors : undefined,
  })
}

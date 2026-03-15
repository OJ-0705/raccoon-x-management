import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '7')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const analytics = await prisma.analytics.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
    })

    const postStats = await prisma.post.aggregate({
      _sum: { impressions: true, likes: true, retweets: true, replies: true, bookmarks: true },
      _count: { id: true },
    })

    const postsByStatus = await prisma.post.groupBy({
      by: ['status'],
      _count: { id: true },
    })

    const postsByType = await prisma.post.groupBy({
      by: ['postType'],
      _count: { id: true },
      _sum: { impressions: true, likes: true },
    })

    return NextResponse.json({
      analytics,
      postStats: postStats._sum,
      postCount: postStats._count.id,
      postsByStatus,
      postsByType,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'アナリティクスの取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const record = await prisma.analytics.upsert({
      where: { date: new Date(body.date) },
      update: {
        followers: body.followers,
        totalImpressions: body.totalImpressions,
        totalEngagements: body.totalEngagements,
      },
      create: {
        date: new Date(body.date),
        followers: body.followers,
        totalImpressions: body.totalImpressions,
        totalEngagements: body.totalEngagements,
      },
    })
    return NextResponse.json(record)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'アナリティクスの保存に失敗しました' }, { status: 500 })
  }
}

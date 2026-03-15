import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const competitors = await prisma.competitor.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(competitors)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '競合の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const competitor = await prisma.competitor.create({
      data: {
        username: body.username,
        displayName: body.displayName || null,
      },
    })
    return NextResponse.json(competitor, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '競合の追加に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    await prisma.competitor.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '競合の削除に失敗しました' }, { status: 500 })
  }
}

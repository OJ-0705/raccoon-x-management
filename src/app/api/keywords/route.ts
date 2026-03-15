import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const keywords = await prisma.keyword.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(keywords)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'キーワードの取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const keyword = await prisma.keyword.create({
      data: { keyword: body.keyword },
    })
    return NextResponse.json(keyword, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'キーワードの追加に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    await prisma.keyword.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'キーワードの削除に失敗しました' }, { status: 500 })
  }
}

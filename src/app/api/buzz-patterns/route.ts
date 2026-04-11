import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const patterns = await prisma.buzzPattern.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ patterns })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sourceUrl, sourceText } = await req.json()
    if (!sourceText?.trim()) {
      return NextResponse.json({ error: '投稿テキストが必要です' }, { status: 400 })
    }

    // AI分析廃止 — テキストのみ保存
    const pattern = await prisma.buzzPattern.create({
      data: {
        sourceUrl: sourceUrl || null,
        sourceText,
        analysis: '{}',
        hookType: '手動登録',
        structure: '',
      },
    })

    return NextResponse.json({ pattern })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '登録に失敗しました', details: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await prisma.buzzPattern.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}

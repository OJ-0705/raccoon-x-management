import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const templates = await prisma.postTemplate.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(templates)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'テンプレートの取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const template = await prisma.postTemplate.create({
      data: {
        name: body.name,
        postType: body.postType,
        templateContent: body.templateContent,
        isDefault: body.isDefault || false,
      },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'テンプレートの作成に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    await prisma.postTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'テンプレートの削除に失敗しました' }, { status: 500 })
  }
}

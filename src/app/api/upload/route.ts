import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: '対応していないファイル形式です' }, { status: 400 })
    }

    // Validate file size: images ≤5MB, videos ≤512MB
    const maxSize = file.type.startsWith('video/') ? 512 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      const limitLabel = file.type.startsWith('video/') ? '512MB' : '5MB'
      return NextResponse.json({ error: `ファイルサイズが上限（${limitLabel}）を超えています` }, { status: 400 })
    }

    const blob = await put(file.name, file, { access: 'public' })
    return NextResponse.json({ url: blob.url, type: file.type })
  } catch (error) {
    console.error('[upload] error:', error)
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 })
  }
}

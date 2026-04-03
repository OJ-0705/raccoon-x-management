import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(request: NextRequest) {
  try {
    // Check token explicitly for a clear error message
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[upload] BLOB_READ_WRITE_TOKEN is not set')
      return NextResponse.json({ error: 'ストレージトークンが設定されていません (BLOB_READ_WRITE_TOKEN)' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: `対応していないファイル形式です: ${file.type}` }, { status: 400 })
    }

    // Validate file size (Vercel Functions body limit is 4.5MB; keep images under 4MB to be safe)
    const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 4 * 1024 * 1024
    if (file.size > maxSize) {
      const limitLabel = file.type.startsWith('video/') ? '100MB' : '4MB'
      return NextResponse.json({ error: `ファイルサイズが上限（${limitLabel}）を超えています` }, { status: 400 })
    }

    console.log('[upload] Uploading:', file.name, file.type, file.size, 'bytes')

    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,  // prevent filename conflicts
      contentType: file.type,
    })

    console.log('[upload] Success:', blob.url)
    return NextResponse.json({ url: blob.url, type: file.type })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[upload] error:', message)
    return NextResponse.json({ error: `アップロードに失敗しました: ${message}` }, { status: 500 })
  }
}

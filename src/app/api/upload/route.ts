import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    // Validate file type — videos not supported in DB storage mode
    const allowedImages = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedImages.includes(file.type)) {
      return NextResponse.json({
        error: file.type.startsWith('video/')
          ? '動画はBlobストレージが必要なため現在アップロードできません。画像(JPG/PNG/GIF/WebP)のみ対応しています。'
          : `対応していないファイル形式です: ${file.type}`,
      }, { status: 400 })
    }

    // 4MB limit (Vercel Functions body limit is 4.5MB)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズが上限（4MB）を超えています' }, { status: 400 })
    }

    console.log('[upload] Encoding to base64:', file.name, file.type, file.size, 'bytes')

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    console.log('[upload] Success, data URL length:', dataUrl.length)
    return NextResponse.json({ url: dataUrl, type: file.type })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[upload] error:', message)
    return NextResponse.json({ error: `アップロードに失敗しました: ${message}` }, { status: 500 })
  }
}

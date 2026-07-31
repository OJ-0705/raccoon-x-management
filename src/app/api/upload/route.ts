import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

/**
 * 画像をVercel Blobへ上げて公開URLを返す。
 * data: URL をDBに持つとレコードが肥大化し、Threadsは公開URLしか受け付けないので、
 * アップロード先はBlobに一本化している。
 */

export const maxDuration = 60

const MAX_BYTES = 5 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 })
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: '画像または動画を選択してください' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '5MB以下のファイルを選択してください' }, { status: 400 })
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN が未設定です。Vercel Blobを有効化してください。' },
        { status: 500 },
      )
    }

    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    const blob = await put(`posts/${Date.now()}${ext}`, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: blob.url, contentType: file.type, size: file.size })
  } catch (error) {
    console.error('[upload]', error)
    return NextResponse.json({ error: 'アップロードに失敗しました: ' + String(error) }, { status: 500 })
  }
}

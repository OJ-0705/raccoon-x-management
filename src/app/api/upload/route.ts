export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ error: 'ファイルが選択されていません' }, { status: 400 });
    }

    // 画像のみ許可（動画は非対応）
    if (!file.type.startsWith('image/')) {
      return Response.json({ error: '画像ファイルのみ対応しています' }, { status: 400 });
    }

    // 5MB制限
    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: '5MB以下の画像を選択してください' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    return Response.json({ url: dataUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: 'アップロードに失敗しました: ' + String(error) }, { status: 500 });
  }
}

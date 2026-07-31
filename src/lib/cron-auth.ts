import { NextResponse } from 'next/server'

/**
 * cronエンドポイントの認証。
 *
 * CRON_SECRET が未設定のときの挙動は環境で変える。
 *   開発 … 認証なしで通す（`npm run cron:test` を叩けないと不便なため）
 *   本番 … 503で閉じる。誰でも公開処理を走らせられる状態は、X APIの従量課金を
 *          外部から回されることを意味するので、落ちていた方がいい。
 */
export function checkCronAuth(request: Request): NextResponse | null {
  const secret = (process.env.CRON_SECRET || '').trim()

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron] CRON_SECRET が未設定のため、エンドポイントを閉じています。')
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
    }
    return null
  }

  if ((request.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return null
}

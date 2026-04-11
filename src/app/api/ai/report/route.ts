import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'AIレポート機能は廃止されました。' }, { status: 410 })
}

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'AI生成機能は廃止されました。XMCPダッシュボードを使用してください。' }, { status: 410 })
}

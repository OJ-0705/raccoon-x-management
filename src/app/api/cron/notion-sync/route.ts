import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Notion同期機能は廃止されました。' }, { status: 410 })
}

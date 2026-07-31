import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { missingXCredentials, isSimulateMode } from '@/lib/x-api'

export const dynamic = 'force-dynamic'

/** トークン未設定時の実際の挙動を返す。本番は fail-closed なので "closed"。 */
function guardState(secret: string | undefined) {
  if ((secret || '').trim()) return 'protected'
  return process.env.NODE_ENV === 'production' ? 'closed (未設定のため503)' : 'open (開発環境)'
}

export async function GET() {
  let db = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    db = String(err)
  }

  return NextResponse.json({
    ok: db === 'ok',
    db,
    x: missingXCredentials().length === 0 ? 'configured' : `missing: ${missingXCredentials().join(', ')}`,
    simulateMode: isSimulateMode(),
    mcp: guardState(process.env.MCP_AUTH_TOKEN),
    cron: guardState(process.env.CRON_SECRET),
    time: new Date().toISOString(),
  })
}

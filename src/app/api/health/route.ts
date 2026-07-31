import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { missingXCredentials, isSimulateMode } from '@/lib/x-api'

export const dynamic = 'force-dynamic'

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
    mcp: (process.env.MCP_AUTH_TOKEN || '').trim() ? 'protected' : 'unprotected',
    time: new Date().toISOString(),
  })
}

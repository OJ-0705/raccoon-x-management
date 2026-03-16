import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      STORAGE_URL: !!process.env.STORAGE_URL,
      STORAGE_URL_NON_POOLING: !!process.env.STORAGE_URL_NON_POOLING,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? '(not set)',
    },
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.db = 'ok'
  } catch (err) {
    checks.db = 'error'
    checks.dbError = err instanceof Error ? err.message : String(err)
    return NextResponse.json(checks, { status: 500 })
  }

  return NextResponse.json(checks)
}

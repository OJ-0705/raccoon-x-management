import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const candidates = [
    'STORAGE_URL',
    'STORAGE_URL_NON_POOLING',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
  ]

  const env: Record<string, string | boolean> = {
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? '(not set)',
    VERCEL_URL: process.env.VERCEL_URL ?? '(not set)',
  }
  for (const key of candidates) {
    const val = process.env[key]
    env[key] = val ? val.slice(0, 40) + '...' : false
  }

  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env,
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.db = 'ok'
  } catch (err) {
    checks.db = 'error'
    checks.dbError = err instanceof Error ? err.message : String(err)
    return NextResponse.json(checks, { status: 500 })
  }

  // Check if tables exist and user count
  try {
    const userCount = await prisma.user.count()
    checks.userCount = userCount
    checks.seedNeeded = userCount === 0
  } catch (err) {
    checks.userCountError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(checks)
}

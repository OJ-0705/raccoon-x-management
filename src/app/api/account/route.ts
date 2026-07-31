import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveAccount, toProfile } from '@/lib/account'
import { missingXCredentials, isSimulateMode } from '@/lib/x-api'
import { getThreadsCredentials } from '@/lib/threads-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const account = await getActiveAccount()
  const threads = await getThreadsCredentials()

  return NextResponse.json({
    profile: toProfile(account),
    connections: {
      x: { configured: missingXCredentials().length === 0, missing: missingXCredentials() },
      threads: { configured: Boolean(threads) },
      simulateMode: isSimulateMode(),
      mcpProtected: Boolean((process.env.MCP_AUTH_TOKEN || '').trim()),
    },
  })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const account = await getActiveAccount()

  const data: Record<string, unknown> = {}
  for (const key of [
    'displayName',
    'xUsername',
    'threadsUsername',
    'persona',
    'theme',
    'targetAudience',
    'rules',
    'ctaPolicy',
    'charLimitMin',
    'charLimitMax',
    'monthlyBudgetUsd',
  ]) {
    if (body[key] !== undefined) data[key] = body[key]
  }
  if (body.postingSlots !== undefined) data.postingSlots = JSON.stringify(body.postingSlots)
  if (body.postTypes !== undefined) data.postTypes = JSON.stringify(body.postTypes)

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
  }

  const updated = await prisma.account.update({ where: { id: account.id }, data })
  return NextResponse.json({ profile: toProfile(updated) })
}

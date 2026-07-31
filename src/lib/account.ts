/** 運用アカウント（＝運用方針そのもの）の取得。テーマ非依存にするための単一の入口。 */

import type { Account } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const DEFAULT_ACCOUNT_SLUG = 'main'

/**
 * アクティブなアカウントを取得する。無ければ空の雛形を作る。
 * ペルソナやテーマは未設定のまま作られるので、MCPの update_account_profile で埋める。
 */
export async function getActiveAccount(slug?: string): Promise<Account> {
  if (slug) {
    const found = await prisma.account.findUnique({ where: { slug } })
    if (found) return found
  }

  const active = await prisma.account.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
  if (active) return active

  return prisma.account.create({
    data: {
      slug: slug ?? DEFAULT_ACCOUNT_SLUG,
      displayName: '未設定',
      postingSlots: JSON.stringify(['08:00', '12:30', '21:00']),
    },
  })
}

export interface AccountProfile {
  slug: string
  displayName: string | null
  xUsername: string | null
  threadsUsername: string | null
  persona: string | null
  theme: string | null
  targetAudience: string | null
  rules: string | null
  ctaPolicy: string | null
  postTypes: unknown[]
  charLimitMin: number
  charLimitMax: number
  postingSlots: string[]
  monthlyBudgetUsd: number
  /** 未設定の必須項目。埋まっていないと生成の質が出ないので明示する。 */
  missing: string[]
}

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function toProfile(account: Account): AccountProfile {
  const missing: string[] = []
  if (!account.persona) missing.push('persona')
  if (!account.theme) missing.push('theme')
  if (!account.targetAudience) missing.push('targetAudience')
  if (!account.rules) missing.push('rules')
  if (!account.xUsername) missing.push('xUsername')

  return {
    slug: account.slug,
    displayName: account.displayName,
    xUsername: account.xUsername,
    threadsUsername: account.threadsUsername,
    persona: account.persona,
    theme: account.theme,
    targetAudience: account.targetAudience,
    rules: account.rules,
    ctaPolicy: account.ctaPolicy,
    postTypes: parseJsonArray(account.postTypes),
    charLimitMin: account.charLimitMin,
    charLimitMax: account.charLimitMax,
    postingSlots: parseJsonArray(account.postingSlots) as string[],
    monthlyBudgetUsd: account.monthlyBudgetUsd,
    missing,
  }
}

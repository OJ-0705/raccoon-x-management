/**
 * 3層の重複チェック。
 *
 * 同じネタを言い換えただけの投稿を弾くのが目的なので、文字列一致だけでは足りない。
 *   Layer 1: テーマ（大枠）
 *   Layer 2: 核心メッセージ（伝えたい1文）
 *   Layer 3: 固有名詞・数値（登場する具体物）
 * 加えて本文そのものの類似度も見る。
 */

import { prisma } from '@/lib/prisma'

/** 表記ゆれを潰す。全角英数→半角、記号・空白除去、小文字化。 */
export function normalize(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[、。，．！？!?「」『』（）()\[\]【】・:：;；'"`~^*_\-—–…]/g, '')
}

/** 2-gram の Jaccard 係数。日本語は分かち書きしないのでこれが素直。 */
export function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const grams = (s: string) => {
    const set = new Set<string>()
    if (s.length === 1) set.add(s)
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }

  const ga = grams(na)
  const gb = grams(nb)
  let inter = 0
  for (const g of ga) if (gb.has(g)) inter++
  const union = ga.size + gb.size - inter
  return union === 0 ? 0 : inter / union
}

function parseEntities(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return raw.split(/[,、]/).map((s) => s.trim()).filter(Boolean)
  }
}

export interface DuplicateHit {
  postId: string
  layer: 'theme' | 'message' | 'entities' | 'content'
  score: number
  reason: string
  existingContent: string
  status: string
  postedAt: Date | null
}

export interface DuplicateCheckInput {
  accountId: string
  content: string
  theme?: string
  message?: string
  entities?: string[]
  /** 直近何日分と比べるか。0で全期間。 */
  windowDays?: number
  /** 除外する投稿ID（自分自身を更新するとき） */
  excludePostId?: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  hits: DuplicateHit[]
  checkedAgainst: number
}

// 経験的にこのあたりで「言い換えただけ」を拾える
const THRESHOLD = {
  theme: 0.8,
  message: 0.72,
  content: 0.62,
  /** Layer3は共通する固有名詞の数で見る */
  entityOverlap: 2,
}

export async function checkDuplicate(input: DuplicateCheckInput): Promise<DuplicateCheckResult> {
  const windowDays = input.windowDays ?? 180
  const existing = await prisma.post.findMany({
    where: {
      accountId: input.accountId,
      status: { in: ['DRAFT', 'REVIEWED', 'SCHEDULED', 'PUBLISHED'] },
      ...(input.excludePostId ? { id: { not: input.excludePostId } } : {}),
      ...(windowDays > 0 ? { createdAt: { gte: new Date(Date.now() - windowDays * 86400000) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      content: true,
      status: true,
      postedAt: true,
      dedupeTheme: true,
      dedupeMessage: true,
      dedupeEntities: true,
    },
  })

  const inputEntities = (input.entities ?? []).map(normalize).filter(Boolean)
  const hits: DuplicateHit[] = []

  for (const p of existing) {
    const base = {
      postId: p.id,
      existingContent: p.content.slice(0, 120),
      status: p.status,
      postedAt: p.postedAt,
    }

    // Layer 1: テーマ
    if (input.theme && p.dedupeTheme) {
      const score = similarity(input.theme, p.dedupeTheme)
      if (score >= THRESHOLD.theme) {
        hits.push({ ...base, layer: 'theme', score: Number(score.toFixed(3)), reason: `テーマが重複: 「${p.dedupeTheme}」` })
        continue
      }
    }

    // Layer 2: 核心メッセージ
    if (input.message && p.dedupeMessage) {
      const score = similarity(input.message, p.dedupeMessage)
      if (score >= THRESHOLD.message) {
        hits.push({ ...base, layer: 'message', score: Number(score.toFixed(3)), reason: `核心メッセージが重複: 「${p.dedupeMessage}」` })
        continue
      }
    }

    // Layer 3: 固有名詞・数値
    if (inputEntities.length > 0) {
      const existingEntities = parseEntities(p.dedupeEntities).map(normalize)
      const shared = inputEntities.filter((e) => existingEntities.includes(e))
      if (shared.length >= THRESHOLD.entityOverlap) {
        hits.push({
          ...base,
          layer: 'entities',
          score: shared.length,
          reason: `固有名詞・数値が${shared.length}件重複: ${shared.join(', ')}`,
        })
        continue
      }
    }

    // 本文そのものの類似度（層が埋まっていない過去投稿への保険）
    const contentScore = similarity(input.content, p.content)
    if (contentScore >= THRESHOLD.content) {
      hits.push({ ...base, layer: 'content', score: Number(contentScore.toFixed(3)), reason: `本文の類似度が高い（${(contentScore * 100).toFixed(0)}%）` })
    }
  }

  hits.sort((a, b) => b.score - a.score)

  return {
    isDuplicate: hits.length > 0,
    hits: hits.slice(0, 10),
    checkedAgainst: existing.length,
  }
}

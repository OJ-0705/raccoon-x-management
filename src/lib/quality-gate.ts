/**
 * Quality Gate helpers — DB queries for prompt injection.
 * AI scoring (scorePost) is disabled; Anthropic API removed.
 */

import { prisma } from '@/lib/prisma'

export interface QualityScore {
  scores: {
    naturalness: number
    specificity: number
    empathy: number
    persona: number
    tempo: number
    experience: number
    authenticity: number
  }
  average: number
  feedback: string
  passed: boolean
}

export async function scorePost(_content: string): Promise<QualityScore | null> {
  // AI scoring廃止 — XMCPダッシュボードが担当
  return null
}

/**
 * Fetch engagement TOP5 posts for prompt injection.
 */
export async function getEngagementTop5(): Promise<Array<{
  content: string; likes: number; retweets: number; replies: number; bookmarks: number; engagementScore: number
}>> {
  try {
    const posts = await prisma.post.findMany({
      where: { status: '投稿済み' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { content: true, likes: true, retweets: true, replies: true, bookmarks: true },
    })

    if (posts.length < 10) return []

    const scored = posts.map((p) => ({
      ...p,
      engagementScore: p.likes * 1 + p.retweets * 3 + p.replies * 5 + p.bookmarks * 2,
    }))

    scored.sort((a, b) => b.engagementScore - a.engagementScore)
    return scored.slice(0, 5)
  } catch {
    return []
  }
}

/**
 * Fetch manually favorited posts for prompt injection.
 */
export async function getFavoritePosts(): Promise<Array<{ content: string }>> {
  try {
    return await prisma.post.findMany({
      where: { isFavorite: true },
      take: 10,
      select: { content: true },
    })
  } catch {
    return []
  }
}

/**
 * Build the injection block for system prompt.
 */
export function buildEngagementPromptBlock(
  top5: Array<{ content: string; likes: number; retweets: number; replies: number; bookmarks: number; engagementScore: number }>,
  favorites: Array<{ content: string }>,
): string {
  const parts: string[] = []

  if (top5.length > 0) {
    const lines = top5.map((p, i) =>
      `${i + 1}. （いいね${p.likes}/RT${p.retweets}/リプ${p.replies}）「${p.content.slice(0, 200)}」`
    )
    parts.push(
      `【過去に反応が良かった投稿TOP5（このトーンと構造を参考にすること）】\n${lines.join('\n')}`
    )
  }

  if (favorites.length > 0) {
    const lines = favorites.map((p, i) =>
      `${i + 1}. 「${p.content.slice(0, 200)}」`
    )
    parts.push(
      `【マサキが「良い」とマークした投稿（このスタイルを参考にすること）】\n${lines.join('\n')}`
    )
  }

  return parts.join('\n\n')
}

/**
 * Fetch registered buzz patterns from DB and build injection block.
 */
export async function getBuzzPatternBlock(): Promise<string> {
  try {
    const patterns = await prisma.buzzPattern.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    })

    if (patterns.length < 5) return ''

    const shuffled = [...patterns].sort(() => Math.random() - 0.5).slice(0, 5)

    const lines = shuffled.map((p, i) => {
      let analysis: Record<string, string> = {}
      try { analysis = JSON.parse(p.analysis) } catch { /* ignore */ }
      const detail = [
        analysis.firstLine ? `1行目:${analysis.firstLine}` : '',
        analysis.emotion ? `感情:${analysis.emotion}` : '',
        analysis.writingStyle ? `文体:${analysis.writingStyle}` : '',
      ].filter(Boolean).join(' / ')
      return `パターン${i + 1}：フック「${p.hookType}」→ ${p.structure}${detail ? `\n  詳細: ${detail}` : ''}`
    })

    return `【バズる投稿の構造パターン】\n${lines.join('\n')}`
  } catch {
    return ''
  }
}

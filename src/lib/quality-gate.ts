/**
 * Quality Gate: 7-item auto-scoring for generated posts
 * Returns a score and retries generation if the threshold is not met.
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export interface QualityScore {
  scores: {
    naturalness: number     // 自然さ
    specificity: number     // 具体性
    empathy: number         // 感情移入しやすさ
    persona: number         // ペルソナ一致度
    tempo: number           // テンポ感
    experience: number      // 体験語り感
    authenticity: number    // 業者臭さのなさ
  }
  average: number
  feedback: string
  passed: boolean
}

const QUALITY_SYSTEM_PROMPT = `あなたはX（旧Twitter）投稿の品質評価専門家です。与えられた投稿を7項目で採点し、JSONのみを出力してください。説明は一切不要です。`

const QUALITY_USER_PROMPT = (content: string) => `以下のX投稿文を7項目で採点してください。各項目10点満点で採点し、JSONのみ出力してください。

投稿文：
${content}

採点項目：
1. 自然さ（AI臭さがないか）
2. 具体性（具体的な数値・商品名があるか）
3. 感情移入しやすさ（共感できるか）
4. ペルソナ一致度（おとなしくユーモアのある男性、一人称「僕」、脂質制限を楽しんでいる）
5. テンポ感（改行が適切で読みやすいか）
6. 体験語り感（体験として語られているか）
7. 業者臭さのなさ（広告っぽくないか）

出力形式（JSONのみ、説明不要）：
{"scores":{"naturalness":8,"specificity":7,"empathy":9,"persona":8,"tempo":7,"experience":8,"authenticity":9},"average":8.0,"feedback":"改善点があれば1文で"}`

const PASS_THRESHOLD = 7.0
const MIN_ITEM_SCORE = 3

function getClient(): Anthropic | null {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

export async function scorePost(content: string): Promise<QualityScore | null> {
  // AI_DISABLED: Anthropic API呼び出し一時停止中
  void content
  return null

  /* eslint-disable no-unreachable */
  const client = getClient()
  if (!client) return null

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: QUALITY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: QUALITY_USER_PROMPT(content) }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const scores = parsed.scores || {}
    const avg = parsed.average || (
      Object.values(scores).reduce((a: number, b) => a + (b as number), 0) / Object.keys(scores).length
    )

    const hasLowItem = Object.values(scores).some((s) => (s as number) <= MIN_ITEM_SCORE)
    const passed = avg >= PASS_THRESHOLD && !hasLowItem

    return {
      scores: {
        naturalness: scores.naturalness ?? 5,
        specificity: scores.specificity ?? 5,
        empathy: scores.empathy ?? 5,
        persona: scores.persona ?? 5,
        tempo: scores.tempo ?? 5,
        experience: scores.experience ?? 5,
        authenticity: scores.authenticity ?? 5,
      },
      average: Math.round(avg * 10) / 10,
      feedback: parsed.feedback || '',
      passed,
    }
  } catch {
    return null
  }
}

/**
 * Fetch engagement TOP5 posts for prompt injection.
 * engagementScore = likes*1 + retweets*3 + replies*5 + bookmarks*2
 * Only returns if 10+ posted posts exist.
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
      `【過去に反応が良かった投稿TOP5（このトーンと構造を参考にすること）】\n${lines.join('\n')}\nこれらの投稿が伸びた理由を分析し、同じ要素（トーン・構造・感情表現）を活かして新しい投稿を生成してください。\nただし内容をコピーするのではなく、構造とトーンを参考にすること。`
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
 * Only injects if 5+ patterns registered.
 */
export async function getBuzzPatternBlock(): Promise<string> {
  try {
    const patterns = await prisma.buzzPattern.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    })

    if (patterns.length < 5) return ''

    // Shuffle to vary which 5 are used each generation
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

    return `【バズる投稿の構造パターン（X実績データから分析）】\n${lines.join('\n')}\nこれらのパターンの「フック」「構造」「感情」を参考に、マサキの言葉で投稿を生成してください。内容をコピーせず、構造とトーンのみ借用すること。`
  } catch {
    return ''
  }
}

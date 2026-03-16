import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const { content, postType, formatType } = await req.json()
  const isLongForm = formatType === '長文投稿'

  const charCount = content.length
  const hasHashtag = /#\S+/.test(content)
  const hasEmoji = /\p{Emoji}/u.test(content)
  const hasNumber = /\d/.test(content)
  const lineBreaks = (content.match(/\n/g) || []).length
  const hasQuestion = /[？?]/.test(content)
  const hasCTA = /ブックマーク|保存|いいね|RTして|フォロー|シェア/.test(content)

  // Base heuristic score — optimized for X Premium engagement
  let score = 50
  if (isLongForm) {
    // Long-form scoring (X Premium, 500〜5,000 chars recommended)
    if (charCount >= 500 && charCount <= 5000) score += 12
    else if (charCount >= 300) score += 5
    else if (charCount < 200) score -= 10
    if (lineBreaks >= 8) score += 8
    else if (lineBreaks >= 4) score += 4
  } else {
    // Standard scoring: 300〜500 chars is the engagement sweet spot
    // (SocialDog 1億600万ツイート分析: 文字数多いほどエンゲージメント↑)
    if (charCount >= 300 && charCount <= 500) score += 15  // optimal
    else if (charCount >= 140 && charCount < 300) score += 8  // good (passes timeline cutoff)
    else if (charCount >= 500 && charCount <= 2000) score += 10  // long, good for fans
    else if (charCount < 60) score -= 15  // too short
    else if (charCount > 25000) score -= 20  // over X Premium limit
  }
  if (hasHashtag) score += 5
  if (hasEmoji) score += 5
  if (hasNumber) score += 8
  if (lineBreaks >= 3) score += 7
  if (hasQuestion) score += 5
  if (hasCTA) score += 10
  score = Math.min(100, Math.max(1, score))

  let feedback = `文字数: ${charCount}字`
  let predictedEngagement = 0

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `以下のX（Twitter）投稿を採点してください。
投稿タイプ: ${postType}
投稿文:
${content}

以下の形式でJSONのみ出力（説明不要）:
{
  "score": 数値(1-100),
  "predictedEngagement": 数値(0.0-10.0, エンゲージメント率%),
  "feedback": "1-2文の改善アドバイス（日本語）"
}`,
        }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        score = Math.min(100, Math.max(1, Math.round(parsed.score)))
        predictedEngagement = Math.min(10, Math.max(0, parseFloat(parsed.predictedEngagement) || 0))
        feedback = parsed.feedback || feedback
      }
    } catch (e) {
      console.error('[score]', e)
    }
  } else {
    predictedEngagement = +(score * 0.05).toFixed(2)
    feedback = hasCTA
      ? 'CTAあり。数値や体験談を追加するとさらに効果的です。'
      : 'CTAを追加（「ブックマーク保存」など）するとエンゲージメントが上がります。'
  }

  return NextResponse.json({ score, predictedEngagement, feedback })
}

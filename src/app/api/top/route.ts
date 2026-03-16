import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const OPTIMAL_HOURS: Record<string, number> = {
  'コンビニまとめ型': 21,
  '数値比較型': 12,
  '地雷暴露型': 20,
  'プロセス共有型': 7,
  'あるある共感型': 22,
  'チェックリスト保存型': 21,
  'Instagram連携型': 18,
  'その他': 12,
}

const POST_TYPES_ROTATION = [
  'コンビニまとめ型',
  'あるある共感型',
  '数値比較型',
  'チェックリスト保存型',
  '地雷暴露型',
  'コンビニまとめ型',
  'あるある共感型',
  '数値比較型',
  'チェックリスト保存型',
  '地雷暴露型',
]

const TEMPLATES: Record<string, string[]> = {
  'コンビニまとめ型': [
    `セブンで買える。脂質5g以下おつまみ3選。\n\n①サラダチキン（脂質2.5g）\n②あたりめ（脂質1.2g）\n③茎わかめ（脂質0g）\n\nポテチの脂質は30g以上。\nこれなら飲みながらでも罪悪感ゼロ🍺\n\n忘れないようにブックマーク📌\n\n#低脂質おつまみ #洋なし型`,
    `ファミマで買える。脂質3g以下おつまみ3選。\n\n①蒸し鶏（脂質2.1g）\n②いか天（脂質2.8g）\n③ひじき煮（脂質0.5g）\n\nこれで今夜の晩酌は完璧🍻\n\nブックマーク保存しておいて📌\n\n#低脂質おつまみ #脂質制限`,
    `ローソンで買える。脂質ほぼゼロのおつまみ3選。\n\n①茎わかめ（脂質0g）\n②ところてん（脂質0g）\n③こんにゃくゼリー（脂質0g）\n\n脂質0gでも満足できる🎯\n\n#低脂質 #洋なし型 #ダイエット`,
  ],
  'あるある共感型': [
    `【脂質制限中あるある】\n\n・スーパーで必ず裏面の成分表を見る\n・「ノンフライ」の文字にときめく\n・揚げ物を見ると脂質計算が始まる\n・せんべいが親友になる\n・居酒屋で頼めるメニューが3つしかない\n\n共感した人、いいねください🙋‍♂️\n\n#脂質制限 #洋なし型`,
    `洋なし型体質あるある\n\n・同じもの食べてるのになぜか太る\n・糖質より脂質を気にする\n・炭水化物より揚げ物が天敵\n・麺類よりとんかつが危険\n\nこの苦しみ、わかる人だけわかる😭\n\n#洋なし型 #脂質制限 #ダイエット`,
    `ダイエット中に言われて傷ついた言葉\n\n・「そんなに食べてないのになんで？」\n・「体質だから仕方ない」\n・「運動すれば痩せる」\n\n洋なし型は脂質を減らすだけでいい。\n運動より食事改善が100倍大事🔥\n\n#洋なし型 #脂質制限`,
  ],
  '数値比較型': [
    `衝撃の事実。\n\nポテチ1袋の脂質：35g\nサラダチキン1個の脂質：2.5g\n\n→ポテチはサラダチキンの14倍。\n\n洋なし型体質の僕には、\nこの差が人生を変える。\n\n#低脂質おつまみ #脂質制限`,
    `知ってた？\n\nマヨネーズ大さじ1の脂質：10g\nノンオイルドレッシング：0.1g\n\n→100倍の差がある。\n\nサラダに何をかけるかで体型が変わる。\n\n#脂質制限 #洋なし型 #ダイエット`,
    `これ見て驚いた。\n\nラーメン1杯の脂質：18g\nうどん1杯の脂質：2g\n\n→9倍の差。\n\n洋なし型は同じ麺類でも\n選ぶだけで変わる。\n\n#脂質制限 #洋なし型`,
  ],
  'チェックリスト保存型': [
    `【保存推奨】脂質5g以下で晩酌を完結する最強セット\n\n□ 柿の種ピーナッツなし（1.3g）\n□ あたりめ（1.2g）\n□ 茎わかめ（0g）\n□ 味付き半熟たまご（4.3g）\n□ えびせんべい（2.1g）\n\n→合計脂質約9g以下\n\n#低脂質おつまみ #脂質制限`,
    `【保存版】脂質制限中でも食べられるコンビニスイーツ\n\n□ 水ようかん（脂質0.1g）\n□ ゼリー（脂質0g）\n□ 蒸しパン（脂質2g）\n□ 葛きり（脂質0g）\n□ みたらし団子（脂質1.5g）\n\n甘いもの我慢しなくていい🍡\n\n#脂質制限 #洋なし型`,
  ],
  '地雷暴露型': [
    `ヘルシーそうで実は地雷なおつまみ5選。\n\n①グラノーラ（脂質12g）\n②アーモンド（脂質14g）\n③チーズ（脂質8g）\n④ナッツバー（脂質10g）\n⑤アボカド（脂質15g）\n\n「ヘルシー風」に騙されないで👀\n\n#低脂質おつまみ #洋なし型`,
    `「ダイエット中でも食べられる」と思ったら地雷だった食品3選\n\n①玄米ブラン（脂質9g）\n②フルーツグラノーラ（脂質11g）\n③サラミ（脂質30g）\n\n食べる前に必ず成分表を確認して⚠️\n\n#脂質制限 #洋なし型 #ダイエット`,
  ],
}

/** Strip hashtags beyond the first maxCount, keeping them at end of text */
function limitHashtags(content: string, maxCount = 2): string {
  const tagRegex = /#[^\s#\n]+/g
  const tags = [...content.matchAll(tagRegex)].map(m => m[0])
  if (tags.length <= maxCount) return content
  // Remove excess tags (keep the first maxCount unique ones)
  const keep = new Set(tags.slice(0, maxCount))
  const excess = tags.slice(maxCount)
  let result = content
  for (const tag of excess) {
    result = result.replace(tag, '')
  }
  // Clean up extra whitespace/newlines
  return result.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

function getTemplate(postType: string, index: number): string {
  const templates = TEMPLATES[postType] || TEMPLATES['コンビニまとめ型']
  return templates[index % templates.length]
}

async function generateWithAI(postType: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return ''
  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `X（Twitter）の投稿文を1つ作成してください。
投稿タイプ: ${postType}
テーマ: 低脂質食品・コンビニおつまみ・脂質制限・洋なし型体質
対象: 脂質で太りやすい洋なし型体質の人
制約:
- 日本語・絵文字使用・ハッシュタグ2個
- 推奨文字数: 300〜500文字（X Premiumエンゲージメント最適範囲）
- 冒頭140文字以内で「続きを読みたい」と思わせる一文を置く
- 具体的な数値を入れる
- 改行を効果的に使う
投稿文のみ出力（説明不要）:`,
      }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return text
  } catch {
    return ''
  }
}

export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      where: { status: '承認待ち' },
      orderBy: { scheduledAt: 'asc' },
    })
    return NextResponse.json({ posts, total: posts.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '承認待ち投稿の取得に失敗しました' }, { status: 500 })
  }
}

/** 1日2投稿スケジュール: 朝7時・夜21時の交互スロット
 *  Find the latest scheduled pending post and propose the next available slot.
 */
async function nextScheduledAt(offset: number): Promise<Date> {
  const DAILY_SLOTS = [6, 21] // morning 6am and evening 9pm (peak engagement times)
  // Get latest scheduled pending post
  const latest = await prisma.post.findFirst({
    where: { status: '承認待ち', scheduledAt: { not: null } },
    orderBy: { scheduledAt: 'desc' },
    select: { scheduledAt: true },
  })

  const base = latest?.scheduledAt ? new Date(latest.scheduledAt) : new Date()
  // Determine the next slot from base + offset slots
  const totalSlots = DAILY_SLOTS.length
  const baseDay = Math.floor(offset / totalSlots)
  const slotIndex = offset % totalSlots

  // If base is already a slot, start from the next one
  const baseHour = base.getHours()
  const baseSlotIdx = DAILY_SLOTS.indexOf(baseHour)
  const startSlotIdx = baseSlotIdx >= 0 ? (baseSlotIdx + 1 + (offset % totalSlots)) % totalSlots : slotIndex
  const dayOffset = baseSlotIdx >= 0
    ? Math.floor((baseSlotIdx + 1 + offset) / totalSlots)
    : baseDay

  const candidate = new Date(base)
  candidate.setDate(base.getDate() + dayOffset)
  candidate.setHours(DAILY_SLOTS[startSlotIdx], 0, 0, 0)

  // Ensure it's in the future
  if (candidate <= new Date()) {
    candidate.setDate(candidate.getDate() + 1)
  }
  return candidate
}

export async function POST() {
  try {
    const existingCount = await prisma.post.count({ where: { status: '承認待ち' } })
    const toGenerate = Math.max(0, 10 - existingCount)

    if (toGenerate === 0) {
      return NextResponse.json({ generated: 0, message: '既に10件の承認待ち投稿があります' })
    }

    const generated = []
    for (let i = 0; i < toGenerate; i++) {
      const postType = POST_TYPES_ROTATION[(existingCount + i) % POST_TYPES_ROTATION.length]

      const scheduledAt = await nextScheduledAt(i)

      const aiContent = await generateWithAI(postType)
      const rawContent = aiContent || getTemplate(postType, existingCount + i)
      const content = limitHashtags(rawContent, 2)

      const post = await prisma.post.create({
        data: {
          content,
          postType,
          formatType: 'テキスト',
          status: '承認待ち',
          scheduledAt,
          platform: 'both',
        },
      })
      generated.push(post)
    }

    return NextResponse.json({ generated: generated.length, posts: generated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '投稿生成に失敗しました' }, { status: 500 })
  }
}

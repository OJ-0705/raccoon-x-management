/**
 * POST /api/admin/seed
 *
 * One-shot endpoint to:
 *  1. Delete all 承認待ち posts
 *  2. Create 15 new 予約済み posts (daily at 21:00 JST starting tomorrow)
 *
 * Auth: Authorization: Bearer <ADMIN_PASSWORD>  or  ?secret=<ADMIN_PASSWORD>
 *
 * curl example (replace YOUR_URL and YOUR_SECRET):
 *   curl -X POST https://YOUR_URL/api/admin/seed \
 *     -H "Authorization: Bearer raccoon2026"
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

// ── Auth ────────────────────────────────────────────────────────────────────
function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_PASSWORD || 'raccoon2026'
  const authHeader = req.headers.get('authorization')
  const querySecret = new URL(req.url).searchParams.get('secret')
  return authHeader === `Bearer ${secret}` || querySecret === secret
}

// ── Schedule helpers ─────────────────────────────────────────────────────────
function scheduledAt(dayOffset: number): Date {
  // Tomorrow + dayOffset, 12:00 UTC = 21:00 JST
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1 + dayOffset)
  d.setUTCHours(12, 0, 0, 0)
  return d
}

// ── 15 posts plan ────────────────────────────────────────────────────────────
const POSTS_PLAN: Array<{ postType: string; keywords?: string }> = [
  // コンビニまとめ型 x3
  { postType: 'コンビニまとめ型', keywords: 'セブンイレブン 脂質5g以下' },
  { postType: 'コンビニまとめ型', keywords: 'ファミマ 低脂質おつまみ' },
  { postType: 'コンビニまとめ型', keywords: 'ローソン 脂質ゼロ近い食品' },
  // 数値比較型 x2
  { postType: '数値比較型', keywords: 'ポテチ vs おせんべい 脂質比較' },
  { postType: '数値比較型', keywords: '洋菓子 vs 和菓子 脂質の差' },
  // 地雷暴露型 x1
  { postType: '地雷暴露型', keywords: 'グラノーラ ナッツ ドレッシング 高脂質' },
  // プロセス共有型 x2
  { postType: 'プロセス共有型', keywords: '遺伝子検査 洋なし型 脂質制限始めた理由' },
  { postType: 'プロセス共有型', keywords: '貧血 無茶ダイエット 失敗談' },
  // あるある共感型 x1
  { postType: 'あるある共感型', keywords: '脂質制限あるある 裏面チェック 居酒屋' },
  // チェックリスト保存型 x1
  { postType: 'チェックリスト保存型', keywords: '低脂質おつまみセット 保存推奨' },
  // お酒・おつまみ型 x2
  { postType: 'お酒・おつまみ型', keywords: 'ビール ハイボール 低脂質おつまみ' },
  { postType: 'お酒・おつまみ型', keywords: '居酒屋 脂質制限 注文術' },
  // 知識共有型 x2
  { postType: '知識共有型', keywords: '脂質1g9kcal タンパク質 糖質 違い' },
  { postType: '知識共有型', keywords: 'オメガ3 青魚 UCP1 洋なし型' },
  // ビジョン共有型 x1
  { postType: 'ビジョン共有型', keywords: '低脂質おせんべい開発 サブスクボックス 将来構想' },
]

// ── AI generation ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたは「らくーん🍊」ことマサキとして、X（旧Twitter）の投稿文を書いています。
マサキは動画制作会社の代表で、遺伝子検査で「洋なし型（脂質で太りやすいタイプ）」と判明してから脂質制限に目覚めた人物です。

【投稿の鉄則】
1. マサキの一人称（俺）で体験を交えて語る
2. 冒頭1文目の文末に「。」を入れない
3. 具体的な数字を入れる（脂質○g、○倍の差など）
4. ハッシュタグは2個
5. 絵文字を適切に使う
6. 300〜500文字推奨`

const POST_TYPE_DESCRIPTIONS: Record<string, string> = {
  'コンビニまとめ型': 'コンビニで買えるおすすめ低脂質商品をまとめた投稿。「○○で買える△△3選」形式。具体的な脂質量を必ず含める。',
  '数値比較型': '具体的な数値でインパクトを出す投稿。脂質量の比較で「○倍」「○g差」を強調。',
  '地雷暴露型': 'ヘルシーに見えて実は高脂質な商品を暴露する投稿。「ヘルシーそうで実は地雷」形式。',
  'プロセス共有型': 'マサキの実体験ベースの投稿。遺伝子検査との出会い、ダイエット失敗談、食生活の変化など。',
  'あるある共感型': '脂質制限・ダイエットあるあるで共感を得る投稿。いいね・リプ促進。',
  'チェックリスト保存型': '保存したくなるチェックリスト形式。低脂質おつまみセット等。「保存推奨」を明記。',
  'お酒・おつまみ型': 'ビール＆ハイボール好きのマサキが見つけた低脂質おつまみ提案。',
  '知識共有型': '脂質の科学知識を噛み砕いて発信。必ずマサキの一人称で語る。',
  'ビジョン共有型': '低脂質おせんべい開発、サブスクボックス等の将来構想。応援・ファン化促進。',
}

// ── Fallback templates ────────────────────────────────────────────────────────
const TEMPLATES: Record<string, string[]> = {
  'コンビニまとめ型': [
    `セブンで買える、脂質5g以下おつまみ3選

①サラダチキン（脂質2.5g）
②あたりめ（脂質1.2g）
③茎わかめ（脂質0g）

ポテチ1袋の脂質は約30g。これなら飲みながらでも罪悪感ゼロ🍺

コンビニ裏面チェックが日課の俺が厳選した。忘れないようにブックマーク📌

#低脂質おつまみ #脂質制限`,
    `ファミマで買える、脂質3g以下おつまみ3選

①蒸し鶏（脂質2.1g）
②ところてん（脂質0g）
③ひじき煮（脂質0.5g）

これで今夜の晩酌は完璧🍻

脂質制限中でも楽しく飲める。ブックマーク保存してみて📌

#低脂質おつまみ #脂質制限`,
    `ローソンで買える、脂質ほぼゼロおつまみ3選

①茎わかめ（脂質0g）
②ところてん（脂質0g）
③こんにゃくゼリー（脂質0g）

脂質0gでも満足できる😌

洋なし型の俺がたどり着いた答えがこれ

#低脂質 #洋なし型`,
  ],
  '数値比較型': [
    `衝撃の数字を見てほしい

ポテチ1袋の脂質：約30g
おせんべい1袋の脂質：約2g

→おせんべいはポテチの1/15

洋なし型体質の俺にとって、この差はマジで人生を左右するレベル。おせんべいが親友になった理由がこれ🍘

#脂質制限 #洋なし型`,
    `知ってた？ショートケーキと大福の差

ショートケーキ1個の脂質：15.7g
大福1個の脂質：1.2g

→ショートケーキは大福の13倍

甘いもの食べるなら和菓子一択。洋菓子は洋なし型の天敵🎂

#脂質制限 #洋なし型`,
  ],
  '地雷暴露型': [
    `ヘルシーそうで実は脂質の地雷5選

①グラノーラ（脂質12g/100g）
②ミックスナッツ（脂質54g/100g）
③アボカド（脂質15g/100g）
④フレンチドレッシング大さじ1（脂質5.6g）
⑤マヨネーズ大さじ1（脂質9g）

「ヘルシー風」に騙されてた過去の俺に教えてやりたい👀

#低脂質 #脂質制限`,
  ],
  'プロセス共有型': [
    `遺伝子検査で「脂質で太るタイプ」と分かってから、食生活がガラッと変わった

それまでは無茶な食事制限で貧血で倒れたことがある。やみくもに「食べない」「走る」を繰り返してた

今は脂質だけに集中してコントロール。糖質は気にしすぎず玄米食べてる。我慢しすぎないダイエットが続いてる

自分の体質を知るってマジで大事

#脂質制限 #洋なし型`,
    `無茶なダイエットで倒れたことがある

カロリーを極限まで減らして毎日走ってたら、仕事中に貧血でぶっ倒れた

「頑張れば痩せる」は間違いだった。正しい方向に努力しないと体を壊すだけ

洋なし型と分かって脂質制限に絞ってから、倒れることもなくなった🌿

#脂質制限 #洋なし型`,
  ],
  'あるある共感型': [
    `脂質制限中あるある

・スーパーで裏面の成分表示を見るのが癖になった
・「ノンフライ」の3文字にときめく
・揚げ物を見ると自動的に脂質計算が始まる
・おせんべいが親友
・居酒屋で頼めるものが3つしかない
・正月に実家帰ると3日で3キロ太る

共感した人いいねください🙋‍♂️

#脂質制限あるある #ローファット`,
  ],
  'チェックリスト保存型': [
    `【保存推奨】脂質5g以下で晩酌を完結する最強セット

□ 柿の種ピーナッツなし（1.3g）
□ あたりめ（1.2g）
□ 茎わかめ（0g）
□ 味付き半熟たまご（4.3g）
□ えびせんべい（2.1g）

→合計脂質約9g以下

ポテチ1袋（30g超）の1/3以下で飲める。ビール好きの俺が実証済み🍺

#低脂質おつまみ #脂質制限`,
  ],
  'お酒・おつまみ型': [
    `ビールとハイボールが大好きな俺の、脂質制限中おつまみルール

❌ チーズ → 脂質の塊（8g/30g）
❌ 唐揚げ → 衣が油を吸いまくり（15g以上）
❌ ポテチ → 1袋で脂質30g超

✅ あたりめ → 脂質1.2g
✅ 茎わかめ → 脂質ほぼ0g
✅ えびせんべい → 脂質2g前後

お酒好き×脂質制限の同志、試してみて🍺

#低脂質おつまみ #脂質制限`,
    `居酒屋で脂質制限してる俺が頼む3品

①枝豆（脂質3.3g/100g）
②刺身（まぐろ赤身は脂質0.1g/100g）
③冷奴（脂質4.2g/150g）

唐揚げやフライドポテトを断るのはもはや反射神経。「これとビールで十分」と思えるようになった日が転換点だった

#低脂質おつまみ #洋なし型`,
  ],
  '知識共有型': [
    `知ってた？脂質は1gで9kcal。タンパク質と糖質は4kcal

同じ量でもカロリーが倍以上違う。だから脂質をちょっと減らすだけでカロリーカットの効率がめちゃくちゃいい

ただし減らしすぎもNG。最低1日20-30gは確保しないとホルモンバランスが崩れるし肌も荒れる

俺が脂質に集中してコントロールしてる理由はこれ

#脂質制限 #ダイエット`,
    `洋なし型体質を知って最初に衝撃を受けた事実

UCP1遺伝子のGG型変異で、褐色脂肪の脂肪燃焼効率が著しく低い

日本人の約56.8%が洋なし型。半分以上いるのに全然知られてない

「頑張っても痩せない」は体質の話。脂質を減らすだけで変わる

#洋なし型 #脂質制限`,
  ],
  'ビジョン共有型': [
    `いつか低脂質おせんべいを作りたいと本気で思ってる

おせんべいはもともと脂質が低いし、俺の大好物。脂質制限で「食事が楽しめない」って悩んでる人に、安心して食べられるおやつを届けたい

低脂質の定期便ボックスや、オフィスグリコの低脂質版もやりたい🍊

応援してくれる人、コメントください

#低脂質ビジネス #プロセスエコノミー`,
  ],
}

function getTemplate(postType: string, index: number): string {
  const list = TEMPLATES[postType] || TEMPLATES['コンビニまとめ型']
  return list[index % list.length]
}

async function generateWithAI(postType: string, keywords: string): Promise<string | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) return null
  try {
    const client = new Anthropic({ apiKey })
    const desc = POST_TYPE_DESCRIPTIONS[postType] || ''
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `投稿タイプ: ${postType}\nタイプの説明: ${desc}\nキーワード: ${keywords}\n\n上記の条件でX投稿文を1つ作成してください（300〜500文字）。投稿文のみ出力。`,
      }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return text || null
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized. Pass Authorization: Bearer <ADMIN_PASSWORD>' }, { status: 401 })
  }

  const results: string[] = []

  // 1. Delete all 承認待ち posts
  const deleted = await prisma.post.deleteMany({ where: { status: '承認待ち' } })
  results.push(`✅ 承認待ち ${deleted.count} 件を削除しました`)

  // 2. Create 15 new 予約済み posts
  const created: Array<{ id: string; postType: string; scheduledAt: Date; source: string }> = []
  const typeCounters: Record<string, number> = {}

  for (let i = 0; i < POSTS_PLAN.length; i++) {
    const plan = POSTS_PLAN[i]
    typeCounters[plan.postType] = (typeCounters[plan.postType] || 0)

    // Try AI first, fall back to template
    const aiContent = await generateWithAI(plan.postType, plan.keywords || '')
    const content = aiContent || getTemplate(plan.postType, typeCounters[plan.postType])
    const source = aiContent ? 'AI' : 'template'

    typeCounters[plan.postType]++

    const post = await prisma.post.create({
      data: {
        content,
        postType: plan.postType,
        formatType: 'テキスト',
        status: '予約済み',
        scheduledAt: scheduledAt(i), // tomorrow + i days, 12:00 UTC = 21:00 JST
        platform: 'both',
      },
    })
    created.push({ id: post.id, postType: plan.postType, scheduledAt: post.scheduledAt!, source })
    results.push(`  [${i + 1}/15] ${plan.postType} → ${post.scheduledAt!.toISOString()} (${source})`)
  }

  return NextResponse.json({
    success: true,
    summary: results,
    deleted: deleted.count,
    created: created.length,
    posts: created,
  })
}

// Allow GET for quick browser testing (same auth)
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({
      error: 'Unauthorized',
      usage: 'POST /api/admin/seed with Authorization: Bearer <ADMIN_PASSWORD>',
    }, { status: 401 })
  }
  return NextResponse.json({
    message: 'Use POST to execute the seed',
    plan: POSTS_PLAN.map((p, i) => ({
      day: i + 1,
      postType: p.postType,
      scheduledAt: scheduledAt(i).toISOString(),
    })),
  })
}

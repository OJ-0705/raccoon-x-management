/**
 * POST /api/admin/seed
 *
 * 1. Delete all 承認待ち posts
 * 2. Create 15 new 予約済み posts (daily at 21:00 JST starting tomorrow)
 *
 * Auth: Authorization: Bearer <ADMIN_PASSWORD>  or  ?secret=<ADMIN_PASSWORD>
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
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1 + dayOffset)
  d.setUTCHours(12, 0, 0, 0)
  return d
}

// ── Diversity seeds (15 unique emotion×scene×target combinations) ─────────────
const DIVERSITY_SEEDS = [
  { emotion: '興奮',  scene: 'コンビニで',  target: '読者に向けて' },
  { emotion: '落胆',  scene: 'スーパーで',  target: '過去の自分に向けて' },
  { emotion: '発見',  scene: '飲み会で',    target: '仲間に向けて' },
  { emotion: '困惑',  scene: '自宅で',      target: '読者に向けて' },
  { emotion: '怒り',  scene: 'コンビニで',  target: '過去の自分に向けて' },
  { emotion: '喜び',  scene: '実家で',      target: '未来の自分に向けて' },
  { emotion: '発見',  scene: 'コンビニで',  target: '読者に向けて' },
  { emotion: '落胆',  scene: '外食で',      target: '仲間に向けて' },
  { emotion: '興奮',  scene: '飲み会で',    target: '読者に向けて' },
  { emotion: '困惑',  scene: 'スーパーで',  target: '過去の自分に向けて' },
  { emotion: '喜び',  scene: 'コンビニで',  target: '未来の自分に向けて' },
  { emotion: '怒り',  scene: '外食で',      target: '仲間に向けて' },
  { emotion: '発見',  scene: '自宅で',      target: '読者に向けて' },
  { emotion: '興奮',  scene: 'スーパーで',  target: '仲間に向けて' },
  { emotion: '落胆',  scene: '実家で',      target: '過去の自分に向けて' },
] as const

// ── 15 posts plan ────────────────────────────────────────────────────────────
const POSTS_PLAN: Array<{ postType: string; keywords: string }> = [
  { postType: 'コンビニまとめ型',    keywords: 'セブンイレブン 新商品 脂質2g台' },
  { postType: '落胆・絶望型',        keywords: 'スーパー 裏面チェック 脂質制限の現実' },
  { postType: 'お酒・おつまみ型',    keywords: '飲み会 脂質制限 枝豆 焼き鳥塩' },
  { postType: '地雷暴露型',          keywords: 'グラノーラ 脂質12g ヘルシー詐欺' },
  { postType: 'コンビニまとめ型',    keywords: 'ファミマ 低脂質 脂質1g以下の逸品' },
  { postType: 'プロセス共有型',      keywords: '実家 正月 3キロ増 脂質制限の誓い' },
  { postType: '数値比較型',          keywords: 'マヨネーズ ノンオイルドレッシング 脂質9g' },
  { postType: 'お酒・おつまみ型',    keywords: '居酒屋 高脂質メニュー 脂質制限の戦い方' },
  { postType: 'コンビニまとめ型',    keywords: 'ローソン 低脂質 脂質0.8g 見つけてしまった' },
  { postType: '地雷暴露型',          keywords: 'アボカドサラダ ヘルシーメニュー 脂質15g 罠' },
  { postType: 'あるある共感型',      keywords: 'コンビニ 裏面チェック 宝探し感 脂質制限' },
  { postType: '知識共有型',          keywords: '脂質1g9kcal 糖質と脂質の違い 洋なし型' },
  { postType: 'プロセス共有型',      keywords: '貧血 無茶ダイエット 遺伝子検査 転換点' },
  { postType: 'ビジョン共有型',      keywords: '低脂質おせんべい開発 脂質制限の楽しさ 将来構想' },
  { postType: '共感・励まし型',      keywords: '深夜ラーメン 失敗 立て直し 完璧じゃなくていい' },
]

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたは「らくーん🍊」ことマサキとして、X（旧Twitter）の投稿文を書いています。
マサキは動画制作会社の代表で、遺伝子検査で「洋なし型（脂質で太りやすいタイプ）」と判明してから脂質制限に目覚めた人物です。

【マサキの人格・口調】
- 一人称は「俺」。友人に話すような気さくな口調
- 「マジで」「〜だよね」「〜してみて」等のカジュアルな表現
- ビール＆ハイボール好き。おせんべいとマンゴーが大好物
- 太るとすぐ顔に出る。正月に3日実家に帰ると3キロ太る
- コンビニやスーパーで必ず裏面チェックするのが習慣

【マサキの実体験】
- 小学生時代サッカー部なのに太っていた
- 社会人デスクワークで体重増加。無茶ダイエットで貧血で倒れた
- 遺伝子検査で洋なし型と判明 → 脂質集中コントロールに転換
- 昼飯はそば固定。白米ではなく玄米。糖質は気にしすぎない
- 1食脂質10g以下を目指すと食べられるものが本当に少ない
- 将来は低脂質おせんべいを開発したい

【脂質の知識】
- 脂質1g=9kcal（タンパク質・糖質は4kcal）
- 洋なし型はUCP1遺伝子GG型変異。日本人の約56.8%が洋なし型
- 和菓子は脂質低い：おせんべい0.5-2g vs ショートケーキ15.7g
- マヨネーズ大さじ1=脂質9g、グラノーラ100g=脂質12g

【法的NG表現】× 「脂肪燃焼」「確実に痩せる」「代謝アップで痩せる」

━━━━━━━━━━━━━━━━━━━━━━━
【最重要ルール：bot化禁止】
━━━━━━━━━━━━━━━━━━━━━━━
- 箇条書きリスト（①②③…、・の連続）は生成禁止
- 「○○5選」「○○3選」のまとめ形式は生成禁止
- 1投稿1テーマ。1つの商品・体験を深く語る
- 冒頭は必ず「感情」から始める。情報の要約から始めない

【冒頭フックのパターン】
A「驚きの報告」：「え？」「マジか」「とんでもないものを見つけてしまった」
B「主語＋衝撃」：「セブンが本気だしてきた」「ファミマがやらかした」
C「感情の爆発」：「今日コンビニで絶望した」「これはマジで優勝」
D「呟き型」：「正月3日で3キロ太った俺が言うんだから間違いない」
E「疑問型」：「なんでこの世はこんなに脂質が高いものばかりなのか」

【感情→数値→個人的感想の流れ】
1. まず感情
2. 次に具体的数値（脂質○g、○kcal、○円）
3. 最後に個人的感想や呼びかけ

【投稿の鉄則】
1. 冒頭1文目の文末に「。」を入れない
2. 具体的な数字を入れる
3. ハッシュタグは2個
4. 絵文字を適切に使う
5. 300〜500文字推奨

━━━━━━━━━━━━━━━━━━━━━━━
【トーン参考サンプル（文体・感情の出し方を真似すること）】
━━━━━━━━━━━━━━━━━━━━━━━
sample_01: とんでもないバカ旨なものを爆誕させてしまった…ローソンの「牛ゆっけ」でユッケ丼作ったらマジ優勝だった。旨い上にダイエット向きという奇跡。脂質1gだから卵おとしても約6gという奇跡。毎朝…いや毎食これ食べたいレベルの旨さ

sample_02: セブンが本気だしてきた…0カロなのにまるでカルピスサイダー。普通に旨くて0カロとかコレ飲まない理由が見当たらない。しかも100円というコスパ。飲み物これで一生いける

sample_03: え？バターチキンカレーなのに成分良過ぎる‥脂質7.2g。低脂質。しかも、たんぱく質と食物繊維も摂れるのに税込399円。物価高騰の今めちゃくちゃ助かる‥

sample_04: 今日スーパーで30分かけて裏面チェックし続けた結果、買えたものは鶏むね肉とそばだけだった。この世は脂質で溢れている。脂質制限民の買い物は修行

sample_05: 「ヘルシーそうだから」と思って買ったグラノーラの裏面見て絶望した。脂質12g。これおやつじゃなくて脂質爆弾じゃん。過去の自分に教えてやりたい

sample_06: 昨日の飲み会で枝豆と焼き鳥（塩）だけで乗り切った。周りはフライドポテトとチーズ盛り合わせ。俺は黙ってハイボールとあたりめ。これが洋なし型の戦い方

sample_07: 脂質制限やってて一番驚いたこと。マヨネーズ大さじ1杯で脂質9g。サラダにかけた瞬間にサラダの意味が消える。ノンオイルドレッシングに切り替えた瞬間、世界が変わった

sample_08: 正月3日で3キロ太った。実家の飯がうますぎるのが悪い。おせちって意外と脂質高いの知ってた？栗きんとんは大丈夫だけど伊達巻がなかなかの曲者

sample_09: 脂質制限始めてから変わったこと。コンビニで商品を手に取る→必ず裏面を見る→脂質を確認→棚に戻す。この動作を1日10回はやってる。同じ人いる？

sample_10: 飲み会のあと深夜にラーメン食べてしまった。脂質30g超え確定。明日からまた脂質10g生活に戻す。こういう日もある。完璧じゃなくていい。続けることが大事

【重要】上記サンプルの内容をそのまま使わないこと。トーンとスタイルの参考のみ。`

// ── Fallback templates (human-like, no lists, multiple variants per type) ────────
const TEMPLATES: Record<string, string[]> = {
  'コンビニまとめ型': [
    `さっきセブン行ったら目を疑う数値の新商品が出てた

脂質2.1gなのにこの満足感はバグってる。コンビニ価格でこれは普通に優勝

コンビニの裏面を見続けてきた俺が断言する。今週のMVP商品

#低脂質 #脂質制限`,
    `ファミマでとんでもないものを見つけてしまった

脂質0.9gで食べごたえがある。これ脂質制限中の昼ご飯に最高なんだけど。お値段も普通なのにこの数値はズルい

洋なし型体質で裏面しか見てない俺が認定する神商品🍊

#低脂質 #脂質制限`,
    `ローソンが本気出してきた感がある

さっきレジ前の棚に並んでた新商品、脂質1.3g。即カゴに入れて食べてみたら普通においしかった。コンビニの宝探し、今週もいい掘り出し物があった

脂質制限中でも楽しめる食生活、これが答えだと思ってる

#低脂質 #洋なし型`,
  ],
  '落胆・絶望型': [
    `今日スーパーで30分かけて裏面チェックし続けた結果、買えたのは鶏むね肉とそばだけだった

この世は脂質で溢れている。脂質制限民の買い物は完全に修行

でも慣れてくると宝探し感があって楽しくなる。同じ経験ある人いる？🙋‍♂️

#脂質制限あるある #ローファット`,
  ],
  'お酒・おつまみ型': [
    `昨日の飲み会、周りがフライドポテトとチーズ盛り合わせを頼む中、俺はずっとハイボールとあたりめだった

あたりめの脂質は1.2g。噛めば噛むほど味が出てビールとの相性も最高。唐揚げを封印した俺の最強相棒

洋なし型の飲み会生存術、これが答え🍻

#低脂質おつまみ #脂質制限`,
    `居酒屋で脂質制限しながら飲む方法、最近やっと確立できてきた

頼むのは枝豆（脂質6.2g/100g）、焼き鳥の塩（ねぎま2本で9.9g）、刺し身のローテ。唐揚げやポテトを「これは俺のものじゃない」と思えるようになったら勝ちだった

この境地に辿り着くまでに何度か失敗した💪

#低脂質おつまみ #脂質制限`,
  ],
  '地雷暴露型': [
    `「ヘルシーそうだから」と思って買ったグラノーラの裏面見て絶望した

脂質12g。おやつじゃなくて脂質爆弾だった。毎朝ヨーグルトにかけてた過去の俺に教えてやりたい

コンビニの「ヘルシー風」な顔した食品、裏面が一番正直。騙されないで

#脂質制限 #洋なし型`,
    `居酒屋の「ヘルシーメニュー」を信じて頼んだアボカドサラダ、脂質15gだった

ヘルシーとは。アボカドは栄養価が高いのは間違いないけど、脂質制限民にとっては完全に罠。「緑＝ヘルシー」の思い込みが一番やばい

同じ罠にはまった人、いいねで教えてくれ🙋‍♂️

#脂質制限 #洋なし型`,
  ],
  'プロセス共有型': [
    `遺伝子検査で「脂質で太るタイプ」と判明した日、全てが繋がった

それまで無茶な食事制限を繰り返して、仕事中に貧血で倒れたこともある。「なぜ頑張っても痩せないのか」がずっと謎だった

体質を知るってマジで大事。俺の場合は脂質に集中するだけで、我慢しすぎない食生活が続いてる

#脂質制限 #洋なし型`,
    `無茶なダイエットで倒れた経験がある

カロリーを極限まで削って毎日走ってたら、仕事中に貧血でぶっ倒れた。「頑張れば痩せる」は方向が間違ってたら体を壊すだけだった

今は脂質だけに集中。糖質は気にしすぎず玄米食べてる。正しい方向に努力できるようになってから、倒れることがなくなった🌿

#脂質制限 #洋なし型`,
  ],
  '数値比較型': [
    `マヨネーズ大さじ1杯で脂質9gって知ってた

大さじ1杯て。サラダにかけた瞬間にサラダの意味が消える。健康意識高くてサラダ食べてるのに、ドレッシングで全部ぶっ壊してた

ノンオイルドレッシングに切り替えた瞬間、世界が変わった

#脂質制限 #洋なし型`,
  ],
  'あるある共感型': [
    `脂質制限始めてから変わったこと。コンビニで商品を手に取る→裏面を見る→脂質を確認→棚に戻す。この動作を1日10回はやってる

先週スーパーで30分かけて裏面チェックし続けた結果、買えたのは鶏むね肉とそばだけだった

この世は脂質で溢れている。同じ経験ある人いる？🙋‍♂️

#脂質制限あるある #ローファット`,
  ],
  '知識共有型': [
    `知ってた？脂質は1gで9kcal。タンパク質と糖質は4kcal

同じ量でもカロリーが倍以上違う。だから脂質をちょっと削るだけでカロリーカットの効率がえぐい。俺が糖質じゃなくて脂質に集中してる理由がこれ

ただし減らしすぎはNG。20〜30gは最低確保しないとホルモンバランスが崩れる

#脂質制限 #洋なし型`,
  ],
  'ビジョン共有型': [
    `いつか低脂質おせんべいを作りたいと本気で思ってる

おせんべいはもともと脂質が低いし、俺の大好物。脂質制限で「食事が楽しめない」って悩んでる人に安心して食べられるものを届けたい

コンビニの裏面を見続けてきた俺が作るなら、数値は絶対に妥協しない🍊

#低脂質ビジネス #プロセスエコノミー`,
  ],
  '共感・励まし型': [
    `飲み会のあと深夜にラーメン食べてしまった。脂質30g超え確定

明日からまた脂質10g生活に戻す。こういう日もある。完璧じゃなくていい。何度も失敗した俺が言うんだから間違いない、続けることが唯一の正解

昨日やらかした人、今日から一緒に立て直そう💪

#脂質制限 #ローファット`,
  ],
}

// Track usage count per type to cycle through variants
const typeIndexMap: Record<string, number> = {}

function getTemplate(postType: string): string {
  const list = TEMPLATES[postType] || TEMPLATES['コンビニまとめ型']
  const idx = typeIndexMap[postType] ?? 0
  typeIndexMap[postType] = idx + 1
  return list[idx % list.length]
}

// ── AI generation ────────────────────────────────────────────────────────────
async function generateWithAI(
  postType: string,
  keywords: string,
  seed: { emotion: string; scene: string; target: string },
  existingExcerpts: string[],
): Promise<string | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) return null

  const existingBlock = existingExcerpts.length
    ? `\n【作成済み投稿（同じ書き出し・同じ商品・同じ構成は使わないこと）】\n${existingExcerpts.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`
    : ''

  const prompt = `投稿タイプ: ${postType}
キーワード: ${keywords}

今回の切り口：
- 感情トーン：${seed.emotion}
- 場面設定：${seed.scene}
- 語りの対象：${seed.target}
この切り口でマサキのリアルな一人称で投稿を書いてください。
${existingBlock}
【絶対禁止】
- ①②③のリスト形式
- 「○○5選」「○○3選」のまとめ形式
- 冒頭を情報の要約で始める

投稿文のみ出力（300〜500文字、ハッシュタグ2個）`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
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

  // 2. Fetch last 30 posts for duplicate prevention
  const recentPosts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { content: true },
  })
  const existingExcerpts = recentPosts.map(p => p.content.slice(0, 50))

  // 3. Create 15 new 予約済み posts
  const created: Array<{ id: string; postType: string; scheduledAt: Date; source: string; hook: string }> = []
  const generatedExcerpts: string[] = [...existingExcerpts]

  for (let i = 0; i < POSTS_PLAN.length; i++) {
    const plan = POSTS_PLAN[i]
    const seed = DIVERSITY_SEEDS[i]

    // Try AI first, fall back to template
    let content: string | null = null
    let source = 'template'

    const aiContent = await generateWithAI(plan.postType, plan.keywords, seed, generatedExcerpts)
    if (aiContent) {
      // Check for 20-char overlap with existing posts
      const hook = aiContent.slice(0, 20)
      const isDuplicate = generatedExcerpts.some(e => e.slice(0, 20) === hook)
      if (isDuplicate) {
        // Retry once with a note
        const retry = await generateWithAI(
          plan.postType,
          plan.keywords,
          seed,
          generatedExcerpts,
        )
        content = retry && !generatedExcerpts.some(e => e.slice(0, 20) === retry.slice(0, 20))
          ? retry
          : aiContent // use original even if duplicate, better than template
        source = 'AI(retry)'
      } else {
        content = aiContent
        source = 'AI'
      }
    }

    if (!content) {
      content = getTemplate(plan.postType)
    }

    generatedExcerpts.push(content.slice(0, 50))

    const post = await prisma.post.create({
      data: {
        content,
        postType: plan.postType,
        formatType: 'テキスト',
        status: '予約済み',
        scheduledAt: scheduledAt(i),
        platform: 'both',
      },
    })

    const hook = content.split('\n')[0].slice(0, 40)
    created.push({ id: post.id, postType: plan.postType, scheduledAt: post.scheduledAt!, source, hook })
    results.push(`  [${i + 1}/15] ${plan.postType} (${seed.emotion}×${seed.scene}) → ${post.scheduledAt!.toISOString()} (${source})`)
  }

  return NextResponse.json({
    success: true,
    summary: results,
    deleted: deleted.count,
    created: created.length,
    posts: created,
    hooks: created.map((p, i) => `[${i + 1}] ${p.hook}`),
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
      seed: DIVERSITY_SEEDS[i],
      scheduledAt: scheduledAt(i).toISOString(),
    })),
  })
}

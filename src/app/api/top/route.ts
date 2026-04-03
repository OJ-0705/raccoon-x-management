import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { getBuzzPatternBlock, getEngagementTop5, getFavoritePosts, buildEngagementPromptBlock } from '@/lib/quality-gate'

const POST_TYPES_ROTATION = [
  'パーソナル体験型',
  'コンビニまとめ型',
  'あるある共感型',
  'パーソナル体験型',
  '数値比較型',
  'お酒・おつまみ型',
  'パーソナル体験型',
  'コンビニまとめ型',
  '問いかけ・対話型',
  '地雷暴露型',
]

const TEMPLATES: Record<string, string[]> = {
  'パーソナル体験型': [
    `遺伝子検査で「脂質で太るタイプ」と判明した日、全てが繋がった

それまで無茶な食事制限を繰り返して、仕事中に貧血で倒れたこともある。「なぜ頑張っても痩せないのか」がずっと謎だった。

小学生の頃からサッカー部でよく動いてたのに太ってた。社会人になってデスクワークになったら更に太った。遺伝子検査を受けたのはもう完全に迷走してた時期。UCP1遺伝子のGG型変異。洋なし型。脂質の燃焼効率が低い体質。結果を見た瞬間、頭の中でパズルのピースが全部はまった音がした。

今は脂質だけに集中。糖質は気にしすぎず玄米食べてる。倒れることもなくなった。自分の体質を知ることが、全ての始まりだと思ってる🌿`,
    `正直に言う。正月に実家帰って3日で3キロ太った

おせちが旨すぎるのが悪い。でもこれ、昔の僕なら「明日から断食だ！」ってなってた。今は違う。脂質だけ意識して玄米食べて、1週間でじわじわ戻す。遺伝子検査受けてから、無茶しなくなった自分がちょっと好き🌿`,
    `飲み会のあと深夜にラーメン食べてしまった。脂質30g超え確定

明日からまた脂質10g生活に戻す。こういう日もある。完璧じゃなくていい。何度も失敗した僕が言うんだから間違いない、続けることが唯一の正解。昨日やらかした人、今日から一緒に立て直そう💪`,
  ],
  'コンビニまとめ型': [
    `さっきセブン行ったら目を疑う数値の新商品が出てた

脂質2.1gなのにこの満足感はバグってる。コンビニ価格でこれは普通に優勝。コンビニの裏面を見続けて数年、「この数値は本物だ」と思う商品に出会えるのは月に数回しかない。今日はその日だった。同じ悩みを持つ人にぜひ試してほしい🍊`,
    `ファミマでとんでもないものを見つけてしまった

脂質0.9gで食べごたえがある。これ脂質制限中の昼ご飯に最高なんだけど。裏面の数値を見た瞬間「これは絶対に買いだ」と確信した。洋なし型体質で裏面しか見てない僕が認定する、今月のMVP商品🍊`,
    `ローソンが本気出してきた感がある

レジ前の棚に並んでた新商品、脂質1.3g。即カゴに入れて食べてみたら普通においしかった。コンビニの宝探しが習慣になってから、こういう発見が一番テンション上がる瞬間になってる🌿`,
  ],
  'あるある共感型': [
    `脂質制限始めてから変わったこと

コンビニで商品を手に取る→必ず裏面を見る→脂質を確認→棚に戻す。この動作を1日10回はやってる。先週スーパーで30分かけて裏面チェックし続けた結果、買えたのは鶏むね肉とそばだけだった。「この世は脂質で溢れている」という事実に毎回絶望する。でも慣れてくると宝探しみたいで楽しくなる。同じ変化を感じてる人いる？🙋‍♂️`,
    `洋なし型体質で生きることの難しさと楽しさ

同じもの食べてるのになぜか太る、という謎がずっとあった。遺伝子検査で分かってから、全てのパズルのピースがはまった感じがした。体質を知ることは「諦め」じゃなくて「戦い方を知ること」。同じ経験してる人いる？`,
  ],
  '数値比較型': [
    `マヨネーズ大さじ1杯で脂質9gって知ってた

大さじ1杯て。サラダにかけた瞬間にサラダの意味が消える。ノンオイルドレッシングに切り替えた瞬間、世界が変わった。脂質制限は「食べない」じゃなくて「何を食べるか」の話だと僕は思ってますよ。みんなは何に気をつけてる？`,
    `おせんべいとポテチの脂質差、知ってる？

おせんべい1枚：0.5〜2g / ポテチ1袋：約30g。同じ「おやつ」でこの差はエグい。洋なし型の僕がポテチを封印しておせんべいを相棒にした理由がこれ。数値を知るだけで選択が変わりますよ🍘`,
  ],
  'お酒・おつまみ型': [
    `昨日の飲み会、周りがフライドポテトとチーズ盛り合わせを頼む中、僕はずっとハイボールとあたりめでした

「それだけ？」って言われたけど、洋なし型の僕にとってはこれが戦い方なんですよね。あたりめの脂質は1.2g。枝豆（脂質6.2g/100g）と焼き鳥の塩も追加して、合計脂質20g以内で普通に楽しめた！ビール好き×脂質制限、同じ戦いしてる人いますか？🍻`,
  ],
  '地雷暴露型': [
    `「ヘルシーそうだから」と思って買ったグラノーラの裏面見て絶望した

脂質12g。おやつじゃなくて脂質爆弾だった。毎朝ヨーグルトにかけてた過去の僕に教えてやりたい。コンビニの「ヘルシー風」な顔した食品、裏面が一番正直ですよ🍊`,
  ],
  '問いかけ・対話型': [
    `ローファット vs ローカーボ、みんなはどっち派？

僕は遺伝子的に脂質で太るタイプ（洋なし型）だからローファット一択。糖質は気にしすぎず玄米普通に食べてます。遺伝子検査受けてない人は一度試してみる価値があると思うんですよね。自分がどっちのタイプか知ってからやるのとやらないのじゃ、効率が全然違う。みなさんはどうやって食事制限してますか？`,
  ],
}

function removeFirstLinePeriod(text: string): string {
  const nl = text.indexOf('\n')
  const first = nl >= 0 ? text.slice(0, nl) : text
  const rest = nl >= 0 ? text.slice(nl) : ''
  return first.replace(/。$/, '') + rest
}

function getTemplate(postType: string, index: number): string {
  const templates = TEMPLATES[postType] || TEMPLATES['コンビニまとめ型']
  return templates[index % templates.length]
}

async function generateWithAI(postType: string, existingExcerpts: string[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return ''
  try {
    const client = new Anthropic({ apiKey })

    // Fetch buzz patterns and engagement data in parallel
    const [buzzBlock, top5, favorites] = await Promise.all([
      getBuzzPatternBlock(),
      getEngagementTop5(),
      getFavoritePosts(),
    ])
    const engagementBlock = buildEngagementPromptBlock(top5, favorites)

    const existingBlock = existingExcerpts.length
      ? `\n【過去の投稿（同じテーマ・同じ書き出し・同じ構成は使わないこと）】\n${existingExcerpts.slice(-20).map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`
      : ''
    const isPersonal = postType === 'パーソナル体験型'
    const personalInstruction = isPersonal ? `
【重要】これはパーソナル体験型の投稿です。マサキ個人の体験・感情・日常を語る投稿にしてください。
商品紹介や知識共有ではなく、「人間マサキ」が主役の投稿です。
例：遺伝子検査で洋なし型と分かった日 / 無茶ダイエットで倒れた経験 / 正月3日で3キロ増 / 飲み会で我慢した話 / 低脂質おせんべいを作りたいビジョン
` : ''
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `X（Twitter）の投稿文を1つ作成してください。

投稿タイプ: ${postType}
テーマ: 低脂質食品・脂質制限・洋なし型体質・マサキの体験
${personalInstruction}
${buzzBlock ? buzzBlock + '\n' : ''}${engagementBlock ? engagementBlock + '\n' : ''}${existingBlock}
制約:
- 推奨文字数: 500〜1,500文字（X Premiumエンゲージメント最適）
- ハッシュタグは原則なし（最大1個）
- 箇条書きリスト（①②③）は禁止
- 「○○5選」のまとめ形式は禁止
- 冒頭140文字で「続きを読む」を押したくなるフックを置く
- 冒頭1文目の文末に「。」を入れない
- 一人称は「僕」。友達にゆるく話すような親しみやすい口調
- 具体的な数値を入れる
- 最後は読者への問いかけか呼びかけで締める
- 句点（。）や！の後は必ず改行する。2〜3文ごとに空行（2回改行）を入れてブロック分けする
- 語尾は「〜だよ」「〜だ」「〜なんだ」だけで終わらず「〜だよね」「〜じゃん」「〜かな」「〜かもしれない」「〜んだよな」など温かみのある語尾を使う
- 「…」を自然に使って人間味・余韻を演出する（「。…」はNG、「。」を省いて「…」のみにする）
- 妹・兄・姉・弟・親・母・父など具体的な家族を投稿に登場させない
- 敬語8割・ため口2割で書く。基本はです・ます調。感情が出る場面のみカジュアルに（「マジでヤバい！」「神すぎる！」「絶望した笑」など）。「〜と考えられています」「〜でございます」「いかがでしょうか」などの教科書・ビジネス敬語はNG
- 脂質制限を「楽しいゲーム・宝探し」として語る。苦行・我慢感はNG
投稿文のみ出力（説明不要）`,
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
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ posts, total: posts.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '承認待ち投稿の取得に失敗しました' }, { status: 500 })
  }
}

const DAILY_SLOTS = [7, 12, 21]

async function nextScheduledAt(): Promise<Date> {
  const now = new Date()
  const booked = await prisma.post.findMany({
    where: { scheduledAt: { gte: now } },
    select: { scheduledAt: true },
  })
  const bookedKeys = new Set(
    booked
      .filter(p => p.scheduledAt)
      .map(p => {
        const d = new Date(p.scheduledAt!)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
      })
  )
  for (let day = 0; day < 21; day++) {
    for (const hour of DAILY_SLOTS) {
      const candidate = new Date()
      candidate.setDate(now.getDate() + day)
      candidate.setHours(hour, 0, 0, 0)
      if (candidate <= now) continue
      const key = `${candidate.getFullYear()}-${candidate.getMonth()}-${candidate.getDate()}-${hour}`
      if (!bookedKeys.has(key)) {
        bookedKeys.add(key)
        return candidate
      }
    }
  }
  const fallback = new Date()
  fallback.setDate(fallback.getDate() + 21)
  fallback.setHours(21, 0, 0, 0)
  return fallback
}

export async function POST() {
  try {
    const existingCount = await prisma.post.count({ where: { status: '承認待ち' } })
    const toGenerate = Math.max(0, 15 - existingCount)
    if (toGenerate === 0) {
      return NextResponse.json({ generated: 0, message: '既に15件の承認待ち投稿があります' })
    }
    const [postedPosts, otherPosts] = await Promise.all([
      prisma.post.findMany({
        where: { status: '投稿済み' },
        orderBy: { postedAt: 'desc' },
        take: 50,
        select: { content: true },
      }),
      prisma.post.findMany({
        where: { status: { in: ['予約済み', '承認待ち'] } },
        select: { content: true },
      }),
    ])
    const existingExcerpts = [...postedPosts, ...otherPosts].map(p => p.content.slice(0, 100))
    const generated = []
    for (let i = 0; i < toGenerate; i++) {
      const postType = POST_TYPES_ROTATION[(existingCount + i) % POST_TYPES_ROTATION.length]
      const scheduledAt = await nextScheduledAt()
      const aiContent = await generateWithAI(postType, existingExcerpts)
      const rawContent = aiContent || getTemplate(postType, existingCount + i)
      const content = removeFirstLinePeriod(rawContent)
      existingExcerpts.push(content.slice(0, 100))
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

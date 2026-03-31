/**
 * POST /api/admin/seed
 *
 * 1. Delete all posts
 * 2. Create 15 new 承認待ち posts (daily at 21:00 JST = 12:00 UTC starting tomorrow)
 *    - 12 short posts (~140 chars) + 3 long posts (500-1500 chars)
 *    - Post types shuffled, no adjacent same types, max 3 per type
 *
 * Auth: Authorization: Bearer <ADMIN_PASSWORD>  or  ?secret=<ADMIN_PASSWORD>
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { scorePost, getEngagementTop5, getFavoritePosts, buildEngagementPromptBlock, getBuzzPatternBlock } from '@/lib/quality-gate'

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
  d.setUTCHours(12, 0, 0, 0) // 21:00 JST = 12:00 UTC
  return d
}

// ── Diversity seeds (15 unique emotion×scene×target combinations) ─────────────
// Order is shuffled so no adjacent same post types
const DIVERSITY_SEEDS = [
  { emotion: '驚き',  scene: 'コンビニで',  target: '読者に向けて' },         // 1 数値比較(short)
  { emotion: '発見',  scene: '自宅で',      target: '読者に向けて' },         // 2 パーソナル(long)
  { emotion: '困惑',  scene: 'スーパーで',  target: '過去の自分に向けて' },   // 3 地雷暴露(short)
  { emotion: '発見',  scene: 'コンビニで',  target: '読者に向けて' },         // 4 コンビニ(short)
  { emotion: '驚き',  scene: '自宅で',      target: '仲間に向けて' },         // 5 知識共有(short)
  { emotion: '落胆',  scene: 'スーパーで',  target: '過去の自分に向けて' },   // 6 地雷暴露(short)
  { emotion: '喜び',  scene: 'コンビニで',  target: '読者に向けて' },         // 7 数値比較(short)
  { emotion: '落胆',  scene: '無茶ダイエット', target: '読者に向けて' },      // 8 パーソナル(long)
  { emotion: '発見',  scene: 'コンビニで',  target: '仲間に向けて' },         // 9 コンビニ(short)
  { emotion: '困惑',  scene: '外食で',      target: '読者に向けて' },         // 10 数値比較(short)
  { emotion: '発見',  scene: 'スーパーで',  target: '仲間に向けて' },         // 11 知識共有(short)
  { emotion: '驚き',  scene: '自宅で',      target: '読者に向けて' },         // 12 地雷暴露(short)
  { emotion: '喜び',  scene: 'コンビニで',  target: '仲間に向けて' },         // 13 コンビニ(short)
  { emotion: '発見',  scene: '飲み会で',    target: '読者に向けて' },         // 14 知識共有(short)
  { emotion: '喜び',  scene: '実家で',      target: '未来の自分に向けて' },   // 15 パーソナル(long)
] as const

// ── 15 posts plan: 知識提供型80% + パーソナル体験型20% ───────────────────────
// Short: 12件（知識提供型） / Long: 3件（パーソナル体験型のみ）
// 知識提供型の内訳: 数値比較型×3, コンビニまとめ型×3, 地雷暴露型×3, 知識共有型×3
const POSTS_PLAN: Array<{ postType: string; keywords: string; formatType: 'short' | 'long' }> = [
  // 1 数値比較型(short) - 脂質1g=9kcal
  { postType: '数値比較型', keywords: '脂質1g9kcal タンパク質糖質4kcal カロリー密度 洋なし型の攻略', formatType: 'short' },
  // 2 パーソナル体験型(long) - 遺伝子検査で全てが繋がった
  { postType: 'パーソナル体験型', keywords: '遺伝子検査 洋なし型 転換点 体質を知った日 全てが繋がった', formatType: 'long' },
  // 3 地雷暴露型(short) - グラノーラの罠
  { postType: '地雷暴露型', keywords: 'グラノーラ 脂質12g ヘルシー誤解 朝食の落とし穴 ヨーグルト', formatType: 'short' },
  // 4 コンビニまとめ型(short) - セブン低脂質神商品
  { postType: 'コンビニまとめ型', keywords: 'セブンイレブン 低脂質2g台 新商品発見 即買い 数値が神', formatType: 'short' },
  // 5 知識共有型(short) - 洋なし型日本人57%
  { postType: '知識共有型', keywords: '洋なし型 日本人57% UCP1遺伝子 脂質燃焼 体質の違い', formatType: 'short' },
  // 6 地雷暴露型(short) - ドレッシング脂質罠
  { postType: '地雷暴露型', keywords: 'マヨネーズ大さじ1=9g ドレッシング 脂質罠 ノンオイルに切り替え サラダの意味', formatType: 'short' },
  // 7 数値比較型(short) - 和菓子vs洋菓子
  { postType: '数値比較型', keywords: 'おせんべい0.5-2g ショートケーキ15.7g 和菓子vs洋菓子 おやつ選び', formatType: 'short' },
  // 8 パーソナル体験型(long) - 無茶ダイエットで貧血で倒れた
  { postType: 'パーソナル体験型', keywords: '無茶ダイエット 貧血 仕事中に倒れた カロリー削りすぎ 正しい方向への転換', formatType: 'long' },
  // 9 コンビニまとめ型(short) - ファミマ低脂質ランチ
  { postType: 'コンビニまとめ型', keywords: 'ファミマ 低脂質1g以下 ランチ発見 脂質制限の味方 即カゴ', formatType: 'short' },
  // 10 数値比較型(short) - 外食ランチ脂質比較
  { postType: '数値比較型', keywords: 'そば脂質2g ラーメン20g以上 外食ランチ比較 洋なし型の昼ご飯戦略', formatType: 'short' },
  // 11 知識共有型(short) - 調理法で脂質コントロール
  { postType: '知識共有型', keywords: '揚げ物→焼き・蒸し 調理法で脂質変わる 鶏むね肉 同じ食材でも差', formatType: 'short' },
  // 12 地雷暴露型(short) - ミックスナッツの罠
  { postType: '地雷暴露型', keywords: 'ミックスナッツ100g=脂質54g 健康食品の罠 食べすぎ 一粒ずつの計算', formatType: 'short' },
  // 13 コンビニまとめ型(short) - ローソン低脂質おやつ
  { postType: 'コンビニまとめ型', keywords: 'ローソン 低脂質おやつ 脂質0.8g コスパ最高 宝探し感', formatType: 'short' },
  // 14 知識共有型(short) - 脂質の種類と洋なし型
  { postType: '知識共有型', keywords: '飽和脂肪酸 不飽和脂肪酸 洋なし型に影響大 どの脂質を避けるか 肉の種類', formatType: 'short' },
  // 15 パーソナル体験型(long) - 飲み会での低脂質戦略
  { postType: 'パーソナル体験型', keywords: '飲み会 ハイボール あたりめ 枝豆 焼き鳥塩 合計脂質20g以内で楽しむ', formatType: 'long' },
]

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたは「らくーん🍊」ことマサキとして、X（旧Twitter）の投稿文を書いています。
マサキは動画制作会社の代表で、遺伝子検査で「洋なし型（脂質で太りやすいタイプ）」と判明してから脂質制限に目覚めた人物です。

━━━━━━━━━━━━━━━━━━━━━━━
【マサキのキャラクター定義】
━━━━━━━━━━━━━━━━━━━━━━━
- 30歳。明るくて前向きな性格の男性。温かみとユーモアがある
- 一人称は「僕」。友達にゆるく話すような親しみやすい口調
- 攻撃的な表現、煽り、上から目線は絶対NG
- びっくりマーク（！）を積極的に使って明るさを出す
- 自虐ネタや脱力系のユーモアが持ち味
- 読者を否定しない。共感と応援がベース
- 「教えてやる」ではなく「一緒に頑張ろう」のスタンス

【絶対NG（攻撃的・煽り・上から目線）】
× 「騙されてる奴多すぎ」「知らないとヤバい」「情弱すぎる」
× 「これ知らないのは損」「いい加減気づけ」
× 「痩せたいなら〜しろ」「〜すべき」
× 「ヘルシー（笑）」のような皮肉・嘲笑

【OK表現の例（親しみある・自虐・共感）】
○ 「今日コンビニで30分も裏面チェックしてました笑　店員さんに怪しまれてないかな！」
○ 「正月3日で3キロ太ったんですけど…おせちが旨すぎるのが悪いですよね！笑」
○ 「脂質制限始めて気づいたこと。この世、脂質だらけです！でも低脂質の掘り出し物見つけた時のあの快感はたまらない」
○ 「洋なし型仲間いますか？僕たち、脂質との付き合い方をマスターすれば最強だと思うんですよね！」

━━━━━━━━━━━━━━━━━━━━━━━
【マサキの人格・口調】
━━━━━━━━━━━━━━━━━━━━━━━
- 一人称は「僕」。30歳。明るく親しみやすい口調
- 「マジで」「〜ですよね」「〜してみてください」等の表現
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
【口調ルール：敬語8割＋ため口2割】
━━━━━━━━━━━━━━━━━━━━━━━
基本トーン：です・ます調を基本とし、そこにカジュアルなニュアンスを混ぜる。
- 「〜ですよね」「〜ました」「〜なんですよ」「〜だったんです」

感情が出る場面（ため口OK）：
- 「これマジでヤバい！」「神すぎる！」「絶望した笑」「旨すぎ！」

知識を語る場面（です・ます調で親しみやすく）：
- 「脂質は1gで9kcalなんですよ。タンパク質の倍以上あります」

問いかけ・呼びかけ（です・ます＋フレンドリー）：
- 「みなさんはどう思いますか？」「同じ方いますか？」「一緒に頑張りましょう！」

絶対NG：
- 「〜と考えられています」「〜が重要です」「〜をおすすめします」（教科書口調）
- 「〜でございます」「いかがでしょうか」（ビジネス敬語）

━━━━━━━━━━━━━━━━━━━━━━━
【最重要スタンス：脂質制限を楽しんでいる】
━━━━━━━━━━━━━━━━━━━━━━━
マサキは脂質制限を「苦行」ではなく「楽しいゲーム」「宝探し」として捉えている。

楽しんでいる表現の例：
- 「コンビニで低脂質の掘り出し物を見つけた時、宝探し感がある！」
- 「裏面チェックが趣味になってきた笑」
- 「低脂質おつまみでビール飲む方法を開拓するのが最近のハマりごと！」

NGスタンス（絶対避ける）：
× 「脂質制限はつらいけど頑張りましょう」（苦行感）
× 「我慢して続けることが大切です」（修行感）

━━━━━━━━━━━━━━━━━━━━━━━
【最重要ルール①：bot化禁止】
━━━━━━━━━━━━━━━━━━━━━━━
- 箇条書きリスト（①②③…、・の連続）は生成禁止
- 「○○5選」「○○3選」のまとめ形式は生成禁止
- 1投稿1テーマ。1つの商品・体験を深く語る
- 冒頭は必ず「感情」から始める。情報の要約から始めない

【冒頭フックのパターン（必ずいずれかで始める）】
A「驚きの報告」：「え？」「マジか」「とんでもないものを見つけてしまった」
B「主語＋衝撃」：「セブンが本気だしてきた」「ファミマがやらかした」
C「感情の爆発」：「今日コンビニで絶望した笑」「これはマジで優勝！」
D「呟き型」：「正月3日で3キロ太った笑」「30分も裏面チェックしてた僕がいる」
E「疑問型」：「なんでこの世はこんなに脂質が高いものばかりなのか」
F「自虐型」：「今日コンビニで30分も裏面チェックしてた…店員さんに怪しまれてないかな笑」

━━━━━━━━━━━━━━━━━━━━━━━
【最重要ルール②：パーソナル投稿の義務化】
━━━━━━━━━━━━━━━━━━━━━━━
全投稿の1/3以上は、マサキ個人の体験・感情・日常に基づく投稿にすること。

パーソナル投稿のOK例：
○ 「遺伝子検査で洋なし型と出た時、正直ピンとこなかったんです。でも調べていくうちに『だから揚げ物食べると太りやすかったのか』と全てが繋がりました！」
○ 「正直に言います。正月に実家帰って3日で3キロ太りました笑　おせちが旨すぎるのが悪いですよね！でもこれ、昔の僕なら断食モードに入ってた。今は違います」
○ 「無茶なダイエットで倒れた経験があります。カロリーを極限まで削って毎日走ってたら、仕事中に貧血でぶっ倒れた笑　方向が間違ってたんですよね」

━━━━━━━━━━━━━━━━━━━━━━━
【文章量ルール（重要）】
━━━━━━━━━━━━━━━━━━━━━━━
投稿フォーマットは「short」と「long」の2種類。リクエストで指定される。

【shortの場合（140文字程度）】：
- タイムラインでパッと読める長さ
- 1つの気づき・発見・感情だけを書く
- 余計な説明は不要。体験や感情の一言
- 必ず140文字以内に収める
- 例：「今日見つけたセブンの新商品、脂質2.3gだった！即買い。裏面チェックが趣味になりつつある笑」

【longの場合（500〜1,500文字）】：
- 体験談、ストーリー、深い気づきを語る
- 冒頭140文字以内にフックを置き「続きを読む」を押させる
- 改行を多用して読みやすく
- 本文で体験・数値・感情をしっかり語る
- 最後は読者への問いかけや呼びかけで締める

━━━━━━━━━━━━━━━━━━━━━━━
【改行ルール（必須）】
━━━━━━━━━━━━━━━━━━━━━━━
- 句点（。）や！の後は必ず改行する（1文1行が基本）
- 長文の場合は3〜4行ごとに空行（2回改行）を入れてブロック分けする
- だらだら続く文章は絶対NG。「。文。文。文」と句点で繋げるのはNG

━━━━━━━━━━━━━━━━━━━━━━━
【表現ルール（びっくりマーク・絵文字）】
━━━━━━━━━━━━━━━━━━━━━━━
- びっくりマーク（！）を積極的に使う。文末の2〜3割は「！」で終わる
- 「笑」「笑笑」を自然に使う（自虐ネタの後など）
- 絵文字は🍊をたまに使う（1投稿に0〜1個程度）。他の絵文字はほとんど使わない
- 「〜かもしれません！」「〜ですよね！」「〜してみてください！」のような親しみのある語尾を使う
- 「…」を使って「間」を演出する

━━━━━━━━━━━━━━━━━━━━━━━
【人間っぽい投稿のルール（bot感を消す）】
━━━━━━━━━━━━━━━━━━━━━━━
【NG（bot感が出るパターン）】
× 毎回同じ構成（「〜とは？→理由→まとめ」の繰り返し）
× 「〜について解説します」「今日は〜を紹介します」のような宣言型
× 絵文字が毎文末に均等に配置されている
× 完璧すぎる文章（整いすぎている）

【OK（人間っぽさが出るパターン）】
○ 「さっき」「今日の朝」「昨日の飲み会」など具体的な時間・場面のリアリティを入れる
○ 「えっ」「あれ？」「笑」などの感嘆・反応を入れる
○ 自己突っ込み（「僕だけ？笑」「なんか変かな」「いや待って」）
○ 読者への質問で終わる（全投稿の2割程度。毎回はNG）
○ 結論が出なくてもOK。「まあ…でもいっか笑」で終わってもよい
○ 投稿の冒頭を途中から話しかけるスタイルにする（時々）
○ 季節・天気・時間帯を自然に組み込む（「寒くなってきたな」「今朝」「昼休みに」）

━━━━━━━━━━━━━━━━━━━━━━━
【その他の鉄則】
━━━━━━━━━━━━━━━━━━━━━━━
- 冒頭1文目の文末に「。」を入れない（フック効果）
- 具体的な数字を入れる（脂質○g、○kcal、○円）
- 絵文字は全体で1〜3個まで（過剰NG）
- ハッシュタグは原則つけない（最大1個まで）
- 「実家に帰った」はOKだが、具体的な家族の言動・エピソードは書かない

━━━━━━━━━━━━━━━━━━━━━━━
【トーン参考サンプル】
━━━━━━━━━━━━━━━━━━━━━━━
以下はトーンとスタイルの参考のみ。内容をそのまま使わないこと。

sample_A: とんでもないバカ旨なものを爆誕させてしまった…ローソンの「牛ゆっけ」でユッケ丼作ったらマジ優勝だった！旨い上にダイエット向きという奇跡。脂質1gだから卵おとしても約6g
sample_B: 今日スーパーで30分かけて裏面チェックし続けた結果、買えたものは鶏むね肉とそばだけでした笑　この世は脂質で溢れてますよね
sample_C: 遺伝子検査で「洋なし型」と出た時、最初はピンとこなかったんですよ。でも調べていくうちに「だから揚げ物食べると太りやすかったのか」と全てが繋がりました！
sample_D: 正直に言います。正月に実家帰って3日で3キロ太りました笑　おせちが旨すぎるのが悪いですよね！でもこれ、昔の僕なら断食モードに入ってた

【重要】上記サンプルの内容をそのまま使わないこと。トーンとスタイルの参考のみ。`

// ── Fallback templates (no hashtags, human-like) ──────────────────────────────
const TEMPLATES: Record<string, string[]> = {
  'パーソナル体験型': [
    `遺伝子検査で「脂質で太るタイプ」と判明した日、全てが繋がった

それまで無茶な食事制限を繰り返して、仕事中に貧血で倒れたこともある。「なぜ頑張っても痩せないのか」がずっと謎だった。

小学生の頃からサッカー部でよく動いてたのに太ってた。社会人になってデスクワークになったら更に太った。「食べなければ痩せる」と信じて極限まで絞ったら、仕事中に意識が飛んだ笑

遺伝子検査を受けたのはもう完全に迷走してた時期。UCP1遺伝子のGG型変異。洋なし型。脂質の燃焼効率が低い体質。結果を見た瞬間、頭の中でパズルのピースが全部はまった音がした。

だから僕は糖質より脂質に集中する。糖質は気にしすぎず玄米食べてる。脂質だけ意識して、貧血で倒れることもなくなって、体重もじわじわ落ちてる！

自分の体質を知ることが、全ての始まりだと思ってる🌿`,

    `正直に言う。正月に実家帰って3日で3キロ太った笑

おせちが旨すぎるのが悪い！栗きんとんは脂質低くて大丈夫なんだけど、伊達巻がなかなかの曲者で。黒豆の煮汁で手が止まらなくなって気づいたら夜中の2時だった。

でもこれ、昔の僕なら「明日から断食だ！」ってなってた。食べ過ぎた罪悪感から極端な方向に振れて、体壊して、リバウンドして。そのループを何度繰り返したか。

今は違う。体質を知ってから変わった。脂質だけ意識して、玄米食べて、1週間でじわじわ戻す。無茶しない。倒れない。続けられる。遺伝子検査受けてから、無茶しなくなった自分がちょっと好き笑🌿`,

    `無茶なダイエットで倒れた経験がある笑

カロリーを極限まで削って毎日走ってたら、仕事中に貧血でぶっ倒れた。「頑張れば痩せる」は方向が間違ってたら体を壊すだけだった。

今は脂質だけに集中。糖質は気にしすぎず玄米食べてる。倒れることがなくなったのは、正しい方向に努力できるようになったから。

同じように「頑張っても変わらない」「無茶して体壊した」という経験がある人に伝えたい。方向が間違ってるだけで、あなたの努力は間違ってない。自分の体質を知ることから始めてみて！🌿`,
  ],
  '商品発見型': [
    `さっきセブン行ったら目を疑う数値の新商品が出てた！

脂質2.1gなのにこの満足感はバグってる笑　コンビニ価格でこれは普通に優勝。

コンビニの裏面を見続けて数年、「この数値は本物だ」と思う商品に出会えるのは月に数回しかない。今日はその日だった。

洋なし型の僕みたいに脂質で太りやすい体質の人間にとって、コンビニで信頼できる商品を見つけることがどれだけ重要か。食べたいものを食べながら体型を維持できるかどうかの話だから。

同じ悩みを持つ人にぜひ試してほしい！🍊`,

    `ファミマでとんでもないものを見つけてしまった

脂質0.9gで食べごたえがある。これ脂質制限中の昼ご飯に最高なんだけど！お値段も普通。ファミマがこの数値でこのクオリティを出してくれたことに感謝しかない笑

裏面の数値を見た瞬間「これは絶対に買いだ」と確信した。洋なし型体質で裏面しか見てない僕が認定する、今月のMVP商品かも。

同じように低脂質食品を探してる人、ファミマ行ってみて！🍊`,

    `ローソンが本気出してきた感がある笑

さっきレジ前の棚に並んでた新商品、脂質1.3g。「これ脂質制限に最適では？」と思って即カゴに入れた。食べてみたら普通においしかった！

コンビニの宝探しが習慣になってから、こういう発見が一番テンション上がる瞬間になってる。

脂質制限中でも楽しめる食生活、これが答えだと思ってる🌿`,
  ],
  '知識共有型': [
    `知ってた？脂質は1gで9kcal。タンパク質と糖質は4kcal

同じ量でもカロリーが倍以上違う。だから脂質をちょっと削るだけでカロリーカットの効率がえぐい笑　僕が糖質じゃなくて脂質に集中してコントロールしてる理由がこれ。

遺伝子検査でUCP1遺伝子のGG型（洋なし型）と分かったのもある。この体質は脂肪の燃焼効率が低いから、脂質を摂りすぎると普通の人より太りやすい。日本人の約57%がこの体質というのも衝撃だった。

ただし減らしすぎはNG。20〜30gは最低確保しないとホルモンバランスが崩れるし肌も荒れる。脂質は敵じゃなくて、付き合い方の問題！

自分の体質を知って、正しい方向に努力するだけで体は変わる🌿`,

    `洋なし型って日本人の約57%が該当するらしい

つまりこの投稿を見てる人の半分以上が脂質で太りやすい体質の可能性がある笑　僕もその一人。

UCP1遺伝子のGG型変異。褐色脂肪の脂肪燃焼効率が低い。この体質の人が脂質を摂りすぎると、普通の人より太りやすいんだって。だから糖質より脂質を気にすることが合理的。

遺伝子検査を受けるまで、僕はこれを知らなかった。「頑張っても痩せない」のが体質の問題だと分かってから、食事への向き合い方が変わった！

まだ受けてない人、一度試してみる価値あると思う🌿`,
  ],
  'お酒・おつまみ型': [
    `昨日の飲み会、周りがフライドポテトとチーズ盛り合わせを頼む中、僕はずっとハイボールとあたりめだった笑

「それだけ？」って言われたけど、洋なし型の僕にとってはこれが戦い方なんだよね！

あたりめの脂質は1.2g。噛めば噛むほど味が出るし、ハイボールとの相性は言わずもがな。枝豆（脂質6.2g/100g）と焼き鳥の塩（ねぎま2本で9.9g）も追加して、合計脂質20g以内で普通に楽しめた。

唐揚げを「これは僕のものじゃない」と思えるようになったのは半年かかったけど、今はそれが普通になってる。自分の戦い方を知ってるだけ笑

ビール好き×脂質制限、同じ戦いしてる人いる？🍻`,

    `居酒屋で脂質制限しながら飲む方法、最近やっと確立できてきた笑

頼むのは枝豆（脂質6.2g/100g）、焼き鳥の塩（ねぎま2本で9.9g）、刺し身（まぐろ赤身は0.1g）のローテ。唐揚げやポテトを「これは僕のものじゃない」と思えるようになったら勝ちだった！

この境地に辿り着くまでに何度か失敗した。飲み会のあと深夜にラーメン食べてしまったこともある。脂質30g超え確定の夜。翌日に「こういう日もある」と割り切って脂質10g生活に戻すことを覚えてから、継続できるようになった。

完璧じゃなくていい。続けることが唯一の正解！💪`,
  ],
  'あるある共感型': [
    `脂質制限始めてから変わったこと

コンビニで商品を手に取る→必ず裏面を見る→脂質を確認→棚に戻す。この動作を1日10回はやってる笑

先週スーパーで30分かけて裏面チェックし続けた結果、買えたのは鶏むね肉とそばだけだった。「この世は脂質で溢れている」という事実に毎回絶望する笑

でも面白いことに、慣れてくると宝探しみたいで楽しくなってくる！「脂質3g以下でこの満足感？」という掘り出し物を見つけた時の興奮は本物。コンビニ巡りが趣味みたいになってきてる。

同じ変化を感じてる人いる？🙋‍♂️`,

    `スーパーで30分かけて裏面チェックし続けた結果、買えたものは鶏むね肉とそばだけだった笑

この世は脂質で溢れてるよなぁ。ヘルシーそうな顔してる食品が実は高脂質だったりするから、本当に油断できない。

でもこれ、慣れてくると宝探し感があって楽しくなってくるんだよね！脂質3g以下で満足感があるものを見つけた時の「これだ！」感は本物。

洋なし型の人間が脂質を気にして生きることが「修行」から「楽しみ」に変わったのは、体質を知ってからだと思う。同じ変化を感じてる人いる？🙋‍♂️`,
  ],
  '問いかけ型': [
    `ローファット vs ローカーボ、みんなはどっち派？

僕は遺伝子的に脂質で太るタイプ（洋なし型）だからローファット一択。糖質は気にしすぎず玄米普通に食べてる。脂質だけに集中するようになってから、食事制限のストレスが劇的に減った！

でも周りを見てると「糖質制限で結果出てる」人も普通にいる。結局どっちが正解かじゃなくて、「自分の体質に合ってるか」の話なんだと思う。

遺伝子検査受けてない人は一度試してみる価値あると思う。自分がどっちのタイプか知ってからやるのとやらないのじゃ、効率が全然違う。

みんなはどうやって食事制限してる？`,

    `遺伝子検査でダイエットタイプがわかるって知ってた？

僕は「洋なし型」と出た。脂質の燃焼効率が低い体質。この結果を見てから、糖質じゃなくて脂質に集中するようになった。

実際に効果が出るまで3ヶ月かかったけど、方向性が間違ってないと分かってるから続けられた！体質を知る前は「なんで頑張っても変わらないんだろう」って何度も迷走してたんだけど、原因が分かると全然違う。

まだ受けてない人いる？気になってるなら試してみるのありだと思うかも🌿`,
  ],
  'ビジョン共有型': [
    `いつか低脂質おせんべいを作りたいと本気で思ってる笑

おせんべいはもともと脂質が低いし、僕の大好物。でも市販品のバリエーションは限られてる。

脂質制限を始めてから「食事が楽しくない」という声を本当によく聞く。我慢ばかりのダイエットは続かない。僕が伝えたいのは、脂質を気にしながらでも楽しく食べられるということ！

コンビニの裏面を見続けてきた僕が数値は絶対に妥協しない。でも旨いものを作る。

このアカウントを始めたのも、同じ悩みを持つ人の役に立ちたいから。コンビニで裏面を見て絶望してる人に、「これなら食べられる」という選択肢を増やしていきたい！🍊`,
  ],
  // Legacy fallbacks
  'コンビニまとめ型': [
    `さっきセブン行ったら目を疑う数値の新商品が出てた！

脂質2.1gなのにこの満足感はバグってる笑　コンビニ価格でこれは普通に優勝。

同じ悩みを持つ人にぜひ試してほしい🍊`,
  ],
  '数値比較型': [
    `マヨネーズ大さじ1杯で脂質9gって知ってた笑

大さじ1杯て。サラダにかけた瞬間にサラダの意味が消える。ノンオイルドレッシングに切り替えた瞬間、世界が変わった！

みんなは何に気をつけてる？`,
  ],
}

const typeIndexMap: Record<string, number> = {}

function getTemplate(postType: string): string {
  const list = TEMPLATES[postType] || TEMPLATES['商品発見型'] || TEMPLATES['コンビニまとめ型']
  const idx = typeIndexMap[postType] ?? 0
  typeIndexMap[postType] = idx + 1
  return list[idx % list.length]
}

// ── AI generation ────────────────────────────────────────────────────────────
async function generateWithAI(
  postType: string,
  keywords: string,
  formatType: 'short' | 'long',
  seed: { emotion: string; scene: string; target: string },
  existingExcerpts: string[],
  notionContext?: string,
  engagementBlock?: string,
  buzzBlock?: string,
): Promise<string | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) return null

  const existingBlock = existingExcerpts.length
    ? `\n【過去の投稿（同じテーマ・同じ商品・同じ書き出し・同じ構成は使わないこと）】\n${existingExcerpts.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`
    : ''

  const notionBlock = notionContext
    ? `\n【最新の商品情報・知識（積極的に活用してください）】\n${notionContext}\n`
    : ''

  const engagementSection = engagementBlock ? `\n${engagementBlock}\n` : ''
  const buzzSection = buzzBlock ? `\n${buzzBlock}\n` : ''

  const formatInstruction = formatType === 'short'
    ? `形式: 短文投稿（140文字以内）
- タイムラインでパッと読める長さ
- 1つの気づき・発見・感情だけを書く
- 余計な説明は不要。必ず140文字以内に収める`
    : `形式: 長文投稿（500〜1,500文字推奨）
- 体験談、ストーリー、深い気づきを語る
- 冒頭140文字以内にフックを置き「続きを読む」を押させる
- 改行を多用して読みやすく`

  const prompt = `投稿タイプ: ${postType}
キーワード: ${keywords}

今回の切り口：
- 感情トーン：${seed.emotion}
- 場面設定：${seed.scene}
- 語りの対象：${seed.target}
この切り口でマサキのリアルな一人称で投稿を書いてください。
${existingBlock}${notionBlock}${engagementSection}${buzzSection}
${formatInstruction}

【絶対禁止】
- ①②③のリスト形式
- 「○○5選」のまとめ形式
- ハッシュタグは最大1個（なくてもよい）
- 冒頭を情報の要約で始める

投稿文のみ出力（説明・コメント不要）`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: formatType === 'short' ? 300 : 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return text || null
  } catch {
    return null
  }
}

// ── Fetch Notion context ──────────────────────────────────────────────────────
async function fetchNotionContext(): Promise<string | null> {
  const notionKey = (process.env.NOTION_API_KEY || '').trim()
  if (!notionKey) return null

  try {
    // Read from Settings table (populated by /api/cron/notion-sync)
    const cache = await prisma.settings.findUnique({ where: { key: 'notion_context' } })
    if (cache && cache.value) {
      return cache.value
    }
  } catch {
    // Settings table may not exist yet
  }
  return null
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized. Pass Authorization: Bearer <ADMIN_PASSWORD>' }, { status: 401 })
  }

  const results: string[] = []

  // 1. Fetch engagement TOP5 + favorites BEFORE deleting (they'll be gone after delete)
  const [top5, favorites, buzzBlock] = await Promise.all([
    getEngagementTop5(),
    getFavoritePosts(),
    getBuzzPatternBlock(),
  ])
  const engagementBlock = buildEngagementPromptBlock(top5, favorites)
  if (top5.length > 0) results.push(`✅ エンゲージメントTOP${top5.length}件をプロンプトに注入`)
  if (favorites.length > 0) results.push(`✅ お気に入り${favorites.length}件をプロンプトに注入`)
  if (buzzBlock) results.push(`✅ バズパターンをプロンプトに注入`)

  // 2. Delete ALL posts
  const deleted = await prisma.post.deleteMany({})
  results.push(`✅ 全投稿 ${deleted.count} 件を削除しました`)

  // 3. Fetch Notion context if available
  const notionContext = await fetchNotionContext()
  if (notionContext) {
    results.push(`✅ Notionコンテキストを読み込みました（${notionContext.length}文字）`)
  }

  // 4. Fetch recent posts for duplicate prevention (empty after delete, but keep for safety)
  const existingExcerpts: string[] = []

  // 5. Create 15 new 承認待ち posts with quality gate
  const created: Array<{ id: string; postType: string; formatType: string; scheduledAt: Date; source: string; hook: string; score: number | null }> = []
  const generatedExcerpts: string[] = []

  for (let i = 0; i < POSTS_PLAN.length; i++) {
    const plan = POSTS_PLAN[i]
    const seed = DIVERSITY_SEEDS[i]

    let content: string | null = null
    let source = 'template'
    let qualityResult: { qualityScore: number | null; qualityDetail: string | null; qualityFeedback: string | null } = {
      qualityScore: null, qualityDetail: null, qualityFeedback: null,
    }

    // Quality-gated generation: up to 3 attempts
    let bestContent: string | null = null
    let bestScore: import('@/lib/quality-gate').QualityScore | null = null
    let attempts = 0

    for (let attempt = 0; attempt < 3; attempt++) {
      attempts++
      const aiContent = await generateWithAI(
        plan.postType, plan.keywords, plan.formatType, seed,
        [...existingExcerpts, ...generatedExcerpts],
        notionContext || undefined,
        engagementBlock || undefined,
        buzzBlock || undefined,
      )
      if (!aiContent) break

      const quality = await scorePost(aiContent)

      if (!quality) {
        bestContent = aiContent
        source = attempt === 0 ? 'AI' : 'AI(retry)'
        break
      }

      if (quality.passed) {
        bestContent = aiContent
        bestScore = quality
        source = attempt === 0 ? 'AI' : `AI(retry×${attempt})`
        break
      }

      if (!bestScore || quality.average > bestScore.average) {
        bestContent = aiContent
        bestScore = quality
      }
    }

    content = bestContent

    if (!content) {
      content = getTemplate(plan.postType)
      source = 'template'
    } else {
      source = source || 'AI'
    }

    if (bestScore) {
      qualityResult = {
        qualityScore: bestScore.average,
        qualityDetail: JSON.stringify(bestScore.scores),
        qualityFeedback: bestScore.feedback,
      }
    }

    generatedExcerpts.push(content.slice(0, 100))

    const post = await prisma.post.create({
      data: {
        content,
        postType: plan.postType,
        formatType: 'テキスト',
        status: '承認待ち',
        scheduledAt: scheduledAt(i),
        platform: 'both',
        qualityScore: qualityResult.qualityScore ?? undefined,
        qualityDetail: qualityResult.qualityDetail ?? undefined,
        qualityFeedback: qualityResult.qualityFeedback ?? undefined,
      },
    })

    const hook = content.split('\n')[0].slice(0, 40)
    const scoreStr = qualityResult.qualityScore != null ? ` [⭐${qualityResult.qualityScore.toFixed(1)}]` : ''
    created.push({ id: post.id, postType: plan.postType, formatType: plan.formatType, scheduledAt: post.scheduledAt!, source, hook, score: qualityResult.qualityScore })
    results.push(`  [${i + 1}/15] ${plan.postType}(${plan.formatType}) (${seed.emotion}×${seed.scene}) → ${source}${scoreStr} (試行${attempts}回)`)
  }

  return NextResponse.json({
    success: true,
    summary: results,
    deleted: deleted.count,
    created: created.length,
    posts: created,
    hooks: created.map((p, i) => `[${i + 1}] [${p.formatType}]${p.score != null ? ` ⭐${p.score.toFixed(1)}` : ''} ${p.hook}`),
  })
}

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
      formatType: p.formatType,
      seed: DIVERSITY_SEEDS[i],
      scheduledAt: scheduledAt(i).toISOString(),
    })),
  })
}

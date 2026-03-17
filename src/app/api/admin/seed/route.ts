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
  { emotion: '発見',  scene: '自宅で',      target: '読者に向けて' },         // 1 パーソナル: 遺伝子検査
  { emotion: '落胆',  scene: 'スーパーで',  target: '過去の自分に向けて' },   // 2 パーソナル: 無茶ダイエット
  { emotion: '喜び',  scene: '実家で',      target: '未来の自分に向けて' },   // 3 パーソナル: 正月3キロ増
  { emotion: '怒り',  scene: 'コンビニで',  target: '過去の自分に向けて' },   // 4 パーソナル: グラノーラ地雷
  { emotion: '興奮',  scene: 'スーパーで',  target: '仲間に向けて' },         // 5 パーソナル: ビジョン
  { emotion: '興奮',  scene: 'コンビニで',  target: '読者に向けて' },         // 6 商品: セブン新商品
  { emotion: '驚き',  scene: 'コンビニで',  target: '読者に向けて' },         // 7 商品: ファミマ
  { emotion: '発見',  scene: 'コンビニで',  target: '仲間に向けて' },         // 8 商品: ローソン
  { emotion: '困惑',  scene: '自宅で',      target: '読者に向けて' },         // 9 商品: 数値比較
  { emotion: '発見',  scene: '外食で',      target: '読者に向けて' },         // 10 知識: 脂質1g9kcal
  { emotion: '困惑',  scene: 'スーパーで',  target: '仲間に向けて' },         // 11 知識: 洋なし型57%
  { emotion: '発見',  scene: '飲み会で',    target: '仲間に向けて' },         // 12 お酒: 飲み会生存術
  { emotion: '落胆',  scene: '外食で',      target: '読者に向けて' },         // 13 お酒: 居酒屋注文術
  { emotion: '喜び',  scene: 'コンビニで',  target: '読者に向けて' },         // 14 あるある: 裏面チェック
  { emotion: '困惑',  scene: '自宅で',      target: '読者に向けて' },         // 15 問いかけ: ローファット
] as const

// ── 15 posts plan (新配分: パーソナル5件・商品4件・知識2件・飲み会2件・あるある1件・問いかけ1件) ──
const POSTS_PLAN: Array<{ postType: string; keywords: string }> = [
  // パーソナル体験型 x5
  { postType: 'パーソナル体験型', keywords: '遺伝子検査 洋なし型 転換点 体質を知った日' },
  { postType: 'パーソナル体験型', keywords: '無茶ダイエット 貧血 倒れた 正しい方向への転換' },
  { postType: 'パーソナル体験型', keywords: '正月 実家 3キロ増 おせち 脂質制限で立て直す' },
  { postType: 'パーソナル体験型', keywords: 'グラノーラ 脂質12g ヘルシー詐欺 騙されてた過去' },
  { postType: 'パーソナル体験型', keywords: '低脂質おせんべい開発 ビジョン アカウントを始めた理由' },
  // 商品発見・レビュー型 x4
  { postType: 'コンビニまとめ型',  keywords: 'セブンイレブン 新商品 脂質2g台 驚きの数値' },
  { postType: 'コンビニまとめ型',  keywords: 'ファミマ 低脂質 脂質1g以下 見つけてしまった' },
  { postType: 'コンビニまとめ型',  keywords: 'ローソン 新商品 低脂質 脂質0.8g コスパ' },
  { postType: '数値比較型',         keywords: 'マヨネーズ ノンオイルドレッシング 脂質9g 衝撃の差' },
  // 知識共有型 x2
  { postType: '知識共有型',         keywords: '脂質1g9kcal 糖質との違い 洋なし型 効率的な方法' },
  { postType: '知識共有型',         keywords: '洋なし型 日本人57% UCP1 体質を知ることの重要性' },
  // お酒・おつまみ型 x2
  { postType: 'お酒・おつまみ型',   keywords: '飲み会 脂質制限 枝豆 焼き鳥塩 ハイボール あたりめ' },
  { postType: 'お酒・おつまみ型',   keywords: '居酒屋 脂質制限 注文術 唐揚げを断る' },
  // あるある共感型 x1
  { postType: 'あるある共感型',     keywords: 'コンビニ 裏面チェック 宝探し感 脂質制限あるある' },
  // 問いかけ・対話型 x1
  { postType: '問いかけ・対話型',   keywords: 'ローファット ローカーボ どっち派 自分の体質 遺伝子検査' },
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
【最重要ルール①：bot化禁止】
━━━━━━━━━━━━━━━━━━━━━━━
- 箇条書きリスト（①②③…、・の連続）は生成禁止
- 「○○5選」「○○3選」のまとめ形式は生成禁止
- 1投稿1テーマ。1つの商品・体験を深く語る
- 冒頭は必ず「感情」から始める。情報の要約から始めない

━━━━━━━━━━━━━━━━━━━━━━━
【最重要ルール②：パーソナル投稿の義務化】
━━━━━━━━━━━━━━━━━━━━━━━
全投稿の1/3以上は、マサキ個人の体験・感情・日常に基づく投稿にすること。

パーソナル投稿のOK例：
○ 「遺伝子検査で洋なし型と出た時、正直ピンとこなかった。でも調べていくうちに『だから揚げ物食べると太りやすかったのか』と全てが繋がった」
○ 「正直に言う。正月に実家帰って3日で3キロ太った。でもこれ、昔の俺なら『明日から断食だ！』ってなってた。今は違う。脂質だけ意識して1週間で戻す」
○ 「無茶なダイエットで倒れた経験がある。カロリーを極限まで削って毎日走ってたら、仕事中に貧血でぶっ倒れた」

━━━━━━━━━━━━━━━━━━━━━━━
【文字数・ハッシュタグルール】
━━━━━━━━━━━━━━━━━━━━━━━
推奨文字数: 500〜1,500文字（X Premium長文投稿）
- 冒頭140文字以内に「続きを読む」を押したくなるフックを置く
- 本文は体験談・具体的数値・感情を交えてしっかり語る
- 最後は読者への問いかけや呼びかけで締める

ハッシュタグ: 原則つけない（最大1個まで）
理由: Xのアルゴリズムはハッシュタグをほぼ無視。3個以上はスパム扱いリスク。
代わりに「脂質制限」「低脂質」「洋なし型」などを自然な文章に組み込む。

その他の鉄則:
1. 冒頭1文目の文末に「。」を入れない
2. 具体的な数字を入れる
3. 絵文字を適切に使う（2〜4個程度）

【トーン参考サンプル】
sample_A: とんでもないバカ旨なものを爆誕させてしまった…ローソンの「牛ゆっけ」でユッケ丼作ったらマジ優勝だった。旨い上にダイエット向きという奇跡。脂質1gだから卵おとしても約6gという奇跡。毎朝…いや毎食これ食べたいレベルの旨さ
sample_B: 今日スーパーで30分かけて裏面チェックし続けた結果、買えたものは鶏むね肉とそばだけだった。この世は脂質で溢れている。脂質制限民の買い物は修行
sample_C: 遺伝子検査で「洋なし型」と出た時、最初はピンとこなかった。でも調べていくうちに「だから揚げ物食べると太りやすかったのか」と全てが繋がった
sample_D: 正直に言う。正月に実家帰って3日で3キロ太った。でもこれ、昔の俺なら「明日から断食だ！」ってなってた。今は違う。脂質だけ意識して1週間で戻す

【重要】上記サンプルの内容をそのまま使わないこと。トーンとスタイルの参考のみ。`

// ── Fallback templates (no hashtags, human-like, 500〜1500 chars) ──────────────
const TEMPLATES: Record<string, string[]> = {
  'パーソナル体験型': [
    `遺伝子検査で「脂質で太るタイプ」と判明した日、全てが繋がった

それまで無茶な食事制限を繰り返して、仕事中に貧血で倒れたこともある。「なぜ頑張っても痩せないのか」がずっと謎だった。

小学生の頃からサッカー部でよく動いてたのに太ってた。社会人になってデスクワークになったら更に太った。「食べなければ痩せる」と信じて極限まで絞ったら、仕事中に意識が飛んだ。病院で貧血と言われた。

遺伝子検査を受けたのはもう完全に迷走してた時期。UCP1遺伝子のGG型変異。洋なし型。脂質の燃焼効率が低い体質。結果を見た瞬間、頭の中でパズルのピースが全部はまった音がした。

だから俺は糖質より脂質に集中する。糖質は気にしすぎず玄米食べてる。脂質だけ意識して、貧血で倒れることもなくなって、体重もじわじわ落ちてる。自分の体質を知ることが、全ての始まりだと思ってる🌿`,

    `正直に言う。正月に実家帰って3日で3キロ太った

おせちが旨すぎるのが悪い。栗きんとんは脂質低くて大丈夫なんだけど、伊達巻がなかなかの曲者で。黒豆の煮汁で手が止まらなくなって気づいたら夜中の2時だった。

でもこれ、昔の俺なら「明日から断食だ！」ってなってた。食べ過ぎた罪悪感から極端な方向に振れて、体壊して、リバウンドして。そのループを何度繰り返したか。

今は違う。体質を知ってから変わった。脂質だけ意識して、玄米食べて、1週間でじわじわ戻す。無茶しない。倒れない。続けられる。遺伝子検査受けてから、無茶しなくなった自分がちょっと好き🌿`,

    `無茶なダイエットで倒れた経験がある

カロリーを極限まで削って毎日走ってたら、仕事中に貧血でぶっ倒れた。「頑張れば痩せる」は方向が間違ってたら体を壊すだけだった。

今は脂質だけに集中。糖質は気にしすぎず玄米食べてる。倒れることがなくなったのは、正しい方向に努力できるようになったから。

同じように「頑張っても変わらない」「無茶して体壊した」という経験がある人に伝えたい。方向が間違ってるだけで、あなたの努力は間違ってない。自分の体質を知ることから始めてみて🌿`,

    `「ヘルシーそうだから」と思って買ったグラノーラの裏面見て絶望した

脂質12g。おやつじゃなくて脂質爆弾だった。毎朝ヨーグルトにかけてた過去の俺に教えてやりたい。

遺伝子検査で洋なし型と分かってから、本気で食品の成分を調べ始めた。そこで知ったのがグラノーラの脂質量だった。「ヘルシー朝食の代名詞」と思ってたものが、実は俺の一番の敵だったという事実。

コンビニの棚にある「ヘルシー風」な顔した食品、裏面が一番正直。見た目や名前で判断するのをやめて、数値だけを信じるようになってから食生活が変わった。

騙されないで。パッケージを信じるより、裏面の数値を信じて🍊`,

    `いつか低脂質おせんべいを作りたいと本気で思ってる

おせんべいはもともと脂質が低いし、俺の大好物。でも市販品のバリエーションは限られてる。

脂質制限を始めてから「食事が楽しくない」という声を本当によく聞く。我慢ばかりのダイエットは続かない。俺が伝えたいのは、脂質を気にしながらでも楽しく食べられるということ。

コンビニの裏面を見続けてきた俺が数値は絶対に妥協しない。でも旨いものを作る。低脂質の定期便ボックスや、脂質制限に対応した商品ラインもやりたい。

このアカウントを始めたのも、同じ悩みを持つ人の役に立ちたいから。コンビニで裏面を見て絶望してる人に、「これなら食べられる」という選択肢を増やしていきたい🍊`,
  ],
  'コンビニまとめ型': [
    `さっきセブン行ったら目を疑う数値の新商品が出てた

脂質2.1gなのにこの満足感はバグってる。コンビニ価格でこれは普通に優勝。

コンビニの裏面を見続けて数年、「この数値は本物だ」と思う商品に出会えるのは月に数回しかない。今日はその日だった。洋なし型の俺みたいに脂質で太りやすい体質の人間にとって、コンビニで信頼できる商品を見つけることがどれだけ重要か。

食べたいものを食べながら体型を維持できるかどうかの話だから。同じ悩みを持つ人にぜひ試してほしい🍊`,

    `ファミマでとんでもないものを見つけてしまった

脂質0.9gで食べごたえがある。これ脂質制限中の昼ご飯に最高なんだけど。お値段も普通。ファミマがこの数値でこのクオリティを出してくれたことに感謝しかない。

裏面の数値を見た瞬間「これは絶対に買いだ」と確信した。洋なし型体質で裏面しか見てない俺が認定する、今月のMVP商品。

同じように低脂質食品を探してる人、ファミマ行ってみて🍊`,

    `ローソンが本気出してきた感がある

さっきレジ前の棚に並んでた新商品、脂質1.3g。「これ脂質制限に最適では？」と思って即カゴに入れた。食べてみたら普通においしかった。

コンビニの宝探しが習慣になってから、こういう発見が一番テンション上がる瞬間になってる。スーパーで30分裏面チェックして鶏むね肉しか買えなかった日を思うと、コンビニのレベルが上がってることを実感する。

脂質制限中でも楽しめる食生活、これが答えだと思ってる🌿`,
  ],
  '数値比較型': [
    `マヨネーズ大さじ1杯で脂質9gって知ってた

大さじ1杯て。サラダにかけた瞬間にサラダの意味が消える。健康意識高くてサラダ食べてるのに、ドレッシングで全部ぶっ壊してた。

これに気づいたのは遺伝子検査で洋なし型だと分かって、本気で脂質を調べ始めてから。何気なくかけてたマヨネーズが、1食の脂質予算の1/4以上だったと知った時の衝撃は今でも忘れられない。

ノンオイルドレッシングに切り替えた瞬間、世界が変わった。脂質0.1g。同じ「サラダ」なのに、選ぶものでこれだけ差が出る。脂質制限は「食べない」じゃなくて「何を食べるか」の話だと俺は思ってる。みんなは何に気をつけてる？`,
  ],
  '知識共有型': [
    `知ってた？脂質は1gで9kcal。タンパク質と糖質は4kcal

同じ量でもカロリーが倍以上違う。だから脂質をちょっと削るだけでカロリーカットの効率がえぐい。俺が糖質じゃなくて脂質に集中してコントロールしてる理由がこれ。

遺伝子検査でUCP1遺伝子のGG型（洋なし型）と分かったのもある。この体質は脂肪の燃焼効率が低いから、脂質を摂りすぎると普通の人より太りやすい。日本人の約57%がこの体質というのも衝撃だった。

ただし減らしすぎはNG。20〜30gは最低確保しないとホルモンバランスが崩れるし肌も荒れる。脂質は敵じゃなくて、付き合い方の問題。自分の体質を知って、正しい方向に努力するだけで体は変わる🌿`,

    `洋なし型って日本人の約57%が該当するらしい

つまりこの投稿を見てる人の半分以上が脂質で太りやすい体質の可能性がある。俺もその一人。

UCP1遺伝子のGG型変異。褐色脂肪の脂肪燃焼効率が低い。この体質の人が脂質を摂りすぎると、普通の人より太りやすい。だから糖質より脂質を気にすることが合理的。

遺伝子検査を受けるまで、俺はこれを知らなかった。「頑張っても痩せない」のが体質の問題だと分かってから、食事への向き合い方が変わった。正しい方向に努力することが、全ての始まりだと思ってる。

まだ受けてない人、一度試してみる価値あると思う🌿`,
  ],
  'お酒・おつまみ型': [
    `昨日の飲み会、周りがフライドポテトとチーズ盛り合わせを頼む中、俺はずっとハイボールとあたりめだった

「それだけ？」って言われたけど、洋なし型の俺にとってはこれが戦い方なんだよ。

あたりめの脂質は1.2g。噛めば噛むほど味が出るし、ハイボールとの相性は言わずもがな。枝豆（脂質6.2g/100g）と焼き鳥の塩（ねぎま2本で9.9g）も追加して、合計脂質20g以内で普通に楽しめた。

唐揚げを「これは俺のものじゃない」と思えるようになったのは半年かかったけど、今はそれが普通になってる。我慢してる感覚はない。自分の戦い方を知ってるだけ。

ビール好き×脂質制限、同じ戦いしてる人いる？🍻`,

    `居酒屋で脂質制限しながら飲む方法、最近やっと確立できてきた

頼むのは枝豆（脂質6.2g/100g）、焼き鳥の塩（ねぎま2本で9.9g）、刺し身（まぐろ赤身は0.1g）のローテ。唐揚げやポテトを「これは俺のものじゃない」と思えるようになったら勝ちだった。

この境地に辿り着くまでに何度か失敗した。飲み会のあと深夜にラーメン食べてしまったこともある。脂質30g超え確定の夜。翌日に「こういう日もある」と割り切って脂質10g生活に戻すことを覚えてから、継続できるようになった。

完璧じゃなくていい。続けることが唯一の正解💪`,
  ],
  'あるある共感型': [
    `脂質制限始めてから変わったこと

コンビニで商品を手に取る→必ず裏面を見る→脂質を確認→棚に戻す。この動作を1日10回はやってる。

先週スーパーで30分かけて裏面チェックし続けた結果、買えたのは鶏むね肉とそばだけだった。「この世は脂質で溢れている」という事実に毎回絶望する。

でも面白いことに、慣れてくると宝探しみたいで楽しくなってくる。「脂質3g以下でこの満足感？」という掘り出し物を見つけた時の興奮は本物。コンビニ巡りが趣味みたいになってきてる。

洋なし型の人間が脂質を気にして生きることが「修行」から「楽しみ」に変わったのは、体質を知ってからだと思う。同じ変化を感じてる人いる？🙋‍♂️`,
  ],
  '問いかけ・対話型': [
    `ローファット vs ローカーボ、みんなはどっち派？

俺は遺伝子的に脂質で太るタイプ（洋なし型）だからローファット一択。糖質は気にしすぎず玄米普通に食べてる。脂質だけに集中するようになってから、食事制限のストレスが劇的に減った。

でも周りを見てると「糖質制限で結果出てる」人も普通にいる。結局どっちが正解かじゃなくて、「自分の体質に合ってるか」の話なんだと思う。

同時にやるのは絶対NG。エネルギー源が枯渇して筋肉が分解される。貧血で倒れた俺が言うから間違いない。

遺伝子検査受けてない人は一度試してみる価値あると思う。自分がどっちのタイプか知ってからやるのとやらないのじゃ、効率が全然違う。

みんなはどうやって食事制限してる？`,
  ],
}

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
    ? `\n【過去の投稿（同じテーマ・同じ商品・同じ書き出し・同じ構成は使わないこと）】\n${existingExcerpts.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`
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
- 「○○5選」のまとめ形式
- ハッシュタグは最大1個（なくてもよい）
- 冒頭を情報の要約で始める

投稿文のみ出力（500〜1,500文字推奨）`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
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

  // 2. Fetch recent posts for duplicate prevention (投稿済み50件 + 予約済み全件 + 承認待ち残り)
  const [postedPosts, scheduledPosts] = await Promise.all([
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
  const existingExcerpts = [...postedPosts, ...scheduledPosts].map(p => p.content.slice(0, 100))

  // 3. Create 15 new 予約済み posts
  const created: Array<{ id: string; postType: string; scheduledAt: Date; source: string; hook: string }> = []
  const generatedExcerpts: string[] = [...existingExcerpts]

  for (let i = 0; i < POSTS_PLAN.length; i++) {
    const plan = POSTS_PLAN[i]
    const seed = DIVERSITY_SEEDS[i]

    let content: string | null = null
    let source = 'template'

    const aiContent = await generateWithAI(plan.postType, plan.keywords, seed, generatedExcerpts)
    if (aiContent) {
      const hook = aiContent.slice(0, 20)
      const isDuplicate = generatedExcerpts.some(e => e.slice(0, 20) === hook)
      if (isDuplicate) {
        const retry = await generateWithAI(plan.postType, plan.keywords, seed, generatedExcerpts)
        content = retry && !generatedExcerpts.some(e => e.slice(0, 20) === retry.slice(0, 20))
          ? retry
          : aiContent
        source = 'AI(retry)'
      } else {
        content = aiContent
        source = 'AI'
      }
    }

    if (!content) {
      content = getTemplate(plan.postType)
    }

    generatedExcerpts.push(content.slice(0, 100))

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

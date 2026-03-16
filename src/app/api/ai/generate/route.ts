import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

const POST_TYPE_DESCRIPTIONS: Record<string, string> = {
  'コンビニまとめ型': 'コンビニで買えるおすすめ商品をまとめた投稿。「○○で買える△△3選」形式。ブックマーク促進。',
  '数値比較型': '具体的な数値でインパクトを出す投稿。脂質量の比較など。「○倍」「○g差」などを強調。',
  '地雷暴露型': 'ヘルシーに見えて実は高脂質な商品を暴露する投稿。「ヘルシーそうで実は地雷」形式。',
  'プロセス共有型': '体験・プロセスを共有する投稿。自分の実体験ベース。共感・信頼獲得。',
  'あるある共感型': '脂質制限・ダイエットあるあるで共感を得る投稿。いいね・リプ促進。',
  'チェックリスト保存型': '保存したくなるチェックリスト形式。「保存推奨」を明記。',
  'Instagram連携型': 'Instagramの投稿をXに展開。写真と連携したテキスト。',
  'その他': '自由形式の投稿。',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postType, keywords, additionalContext, formatType } = body

    if (!process.env.ANTHROPIC_API_KEY) {
      // Return a template if no API key
      return NextResponse.json({
        content: generateTemplate(postType, keywords),
        generated: false,
      })
    }

    const description = POST_TYPE_DESCRIPTIONS[postType] || POST_TYPE_DESCRIPTIONS['その他']
    const keywordStr = keywords?.length ? `キーワード: ${keywords.join(', ')}` : ''

    const prompt = `あなたはX（旧Twitter）の投稿文を作成する専門家です。
以下の条件でX投稿文を1つ作成してください。

投稿タイプ: ${postType}
タイプの説明: ${description}
${keywordStr}
${additionalContext ? `追加コンテキスト: ${additionalContext}` : ''}

ターゲット: 脂質制限中・ダイエット中の人（特に洋なし型体質）
テーマ: 低脂質食品・コンビニおつまみ・脂質制限

制約:
${formatType === '長文投稿'
  ? '- 長文投稿形式（X Premium対応・500〜3,000文字推奨）\n- 詳細な解説・体験談・まとめを含むコラム形式\n- 見出し・箇条書きを活用して読みやすく構成\n- ハッシュタグ2個'
  : '- 推奨文字数: 300〜500文字（X Premiumエンゲージメント最適範囲）\n- 冒頭140文字以内で続きを読ませる一文を置く（タイムライン表示限界）\n- 「詳細クリック」を促す構成にする\n- 改行を効果的に使う\n- 具体的な数値を入れる（できれば）\n- ハッシュタグ2個'}
- 絵文字を適切に使用
- 日本語で書く

投稿文のみを出力してください（説明不要）:`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: formatType === '長文投稿' ? 4000 : 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ content, generated: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'AI生成に失敗しました', details: String(error) }, { status: 500 })
  }
}

function generateTemplate(postType: string, keywords: string[]): string {
  const kw = keywords?.[0] || '低脂質おつまみ'
  const templates: Record<string, string> = {
    'コンビニまとめ型': `セブンで買える。脂質5g以下${kw}3選。\n\n①サラダチキン（脂質2.5g）\n②あたりめ（脂質1.2g）\n③茎わかめ（脂質0g）\n\nポテチの脂質は30g以上。\nこれなら飲みながらでも罪悪感ゼロ🍺\n\n忘れないようにブックマーク📌\n\n#低脂質おつまみ #洋なし型`,
    '数値比較型': `衝撃の事実。\n\nポテチ1袋の脂質：35g\nサラダチキン1個の脂質：2.5g\n\n→ポテチはサラダチキンの14倍。\n\n洋なし型体質（脂質で太りやすい）の僕には、\nこの差が人生を変える。\n\n#${kw} #脂質制限`,
    '地雷暴露型': `ヘルシーそうで実は地雷な${kw}5選。\n\n①グラノーラ（脂質12g）\n②アーモンド（脂質14g）\n③チーズ（脂質8g）\n④ナッツバー（脂質10g）\n⑤アボカド（脂質15g）\n\n「ヘルシー風」に騙されないで。\nパッケージ裏の脂質を確認しよう👀\n\n#低脂質おつまみ #洋なし型`,
    'あるある共感型': `【脂質制限中あるある】\n\n・スーパーで必ず裏面の成分表を見る\n・「ノンフライ」の文字にときめく\n・揚げ物を見ると脂質計算が始まる\n・せんべいが親友になる\n・居酒屋で頼めるメニューが3つしかない\n\n共感した人、いいねください🙋‍♂️\n\n#脂質制限 #洋なし型`,
    'チェックリスト保存型': `【保存推奨】脂質5g以下で晩酌を完結する最強セット\n\n□ 柿の種ピーナッツなし（1.3g）\n□ あたりめ（1.2g）\n□ 茎わかめ（0g）\n□ 味付き半熟たまご（4.3g）\n□ えびせんべい（2.1g）\n\n→合計脂質約9g以下\n\nポテチ1袋（35g）の1/4以下で飲める🍺\n\n#低脂質おつまみ #脂質制限`,
  }
  return templates[postType] || `${kw}についての投稿テンプレートです。\n\n#${kw} #脂質制限`
}

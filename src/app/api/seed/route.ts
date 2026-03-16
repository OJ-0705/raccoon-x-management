import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// GET: auto-seed only when no users exist (safe bootstrap endpoint)
export async function GET() {
  const count = await prisma.user.count()
  if (count > 0) {
    return NextResponse.json({ message: 'Already seeded', userCount: count })
  }
  return runSeed()
}

async function runSeed() {
  try {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Raccoon2026!', 10)
    await prisma.user.upsert({
      where: { email: process.env.ADMIN_EMAIL || 'admin@raccoon.com' },
      update: {},
      create: {
        email: process.env.ADMIN_EMAIL || 'admin@raccoon.com',
        password: hashedPassword,
      },
    })

    const competitors = [
      { username: 'conveni_diet_', displayName: 'コンビニダイエット' },
      { username: 'yuu1234ts', displayName: '土田ゆうや＠ラクやせ' },
      { username: 'debumi_yuu_diet', displayName: 'なるみゆう' },
      { username: 'mametamacho', displayName: 'まめたまの筋トレ日記' },
    ]
    for (const c of competitors) {
      await prisma.competitor.upsert({
        where: { username: c.username },
        update: {},
        create: c,
      })
    }

    const keywords = ['低脂質', '低脂質おつまみ', '脂質制限', '洋なし型', 'ダイエット', 'コンビニダイエット']
    for (const kw of keywords) {
      await prisma.keyword.upsert({
        where: { keyword: kw },
        update: {},
        create: { keyword: kw },
      })
    }

    const templates = [
      {
        name: 'コンビニまとめ型',
        postType: 'コンビニまとめ型',
        templateContent: '【店名】で買える。脂質5g以下おつまみ3選。\n\n①【商品1】（脂質○g）\n②【商品2】（脂質○g）\n③【商品3】（脂質○g）\n\nポテチの脂質は30g以上。\nこれなら飲みながらでも罪悪感ゼロ🍺\n\n忘れないようにブックマーク📌\n\n#低脂質おつまみ #洋なし型',
        isDefault: true,
      },
      {
        name: '数値比較型',
        postType: '数値比較型',
        templateContent: '衝撃の事実。\n\n【商品A】の脂質：○○g\n【商品B】の脂質：○○g\n\n→【商品A】は【商品B】の約○倍。\n\n洋なし型体質（脂質で太りやすい）の僕には、\nこの差が人生を変える。\n\n#低脂質おつまみ #脂質制限',
        isDefault: true,
      },
      {
        name: '地雷暴露型',
        postType: '地雷暴露型',
        templateContent: 'ヘルシーそうで実は地雷なおつまみ5選。\n\n①【商品1】（脂質○g）\n②【商品2】（脂質○g）\n③【商品3】（脂質○g）\n④【商品4】\n⑤【商品5】\n\n「ヘルシー風」に騙されないで。\nパッケージ裏の脂質を確認しよう👀\n\n#低脂質おつまみ #洋なし型',
        isDefault: true,
      },
      {
        name: 'あるある共感型',
        postType: 'あるある共感型',
        templateContent: '【脂質制限中あるある】\n\n・スーパーで必ず裏面の成分表を見る\n・「ノンフライ」の文字にときめく\n・揚げ物を見ると脂質計算が始まる\n・せんべいが親友になる\n・居酒屋で頼めるメニューが3つしかない\n\n共感した人、いいねください🙋‍♂️\n\n#脂質制限 #洋なし型',
        isDefault: true,
      },
      {
        name: 'チェックリスト保存型',
        postType: 'チェックリスト保存型',
        templateContent: '【保存推奨】脂質5g以下で晩酌を完結する最強セット\n\n□ 柿の種ピーナッツなし（1.3g）\n□ あたりめ（1.2g）\n□ 茎わかめ（0g）\n□ 味付き半熟たまご（4.3g）\n□ えびせんべい（2.1g）\n\n→合計脂質約9g以下\n\nポテチ1袋（35g）の1/4以下で飲める🍺\n\n#低脂質おつまみ #脂質制限',
        isDefault: true,
      },
    ]
    for (const t of templates) {
      const existing = await prisma.postTemplate.findFirst({ where: { name: t.name, isDefault: true } })
      if (!existing) {
        await prisma.postTemplate.create({ data: t })
      }
    }

    return NextResponse.json({ success: true, message: 'シード完了' })
  } catch (error) {
    console.error('[seed error]', error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { error: 'シード失敗', details: message, stack },
      { status: 500 }
    )
  }
}

export async function POST() {
  return runSeed()
}

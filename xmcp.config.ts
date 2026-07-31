import { type XmcpConfig } from 'xmcp'

/**
 * MCPサーバーの設定。
 * Next.jsアプリに同居させ、/mcp で公開する（運用の主役はこちら側）。
 */
const config: XmcpConfig = {
  template: {
    name: 'x-ops',
    description: 'X / Threads 運用オペレーション。下書き・重複チェック・予約・実績・APIコストを扱う。',
    instructions: [
      '投稿を作るときは必ず get_writing_context から始めること。運用方針・トーン見本・実績・既出テーマ・当月コストが一度に返る。',
      '本文が固まったら create_draft を呼ぶ。3層の重複チェックが自動で走り、既出と衝突すれば作成されない。',
      '予約は get_free_slots → schedule_post。cronが予約時刻に公開する。',
      'publish_post は confirm を省略するとドライラン。X APIは従量課金なので、実投稿は必ず内容を確認してから confirm: true で行うこと。',
      'リンクを含む投稿は単価が $0.015 → $0.20 に跳ね上がる。リンクは固定リプライかプロフィールへ逃がすのが基本方針。',
      '発信テーマやペルソナはコードではなくDBにある。変更は update_account_profile で行うこと。',
    ].join('\n'),
  },
  // adapter を使う場合も http を有効にしておかないとエントリが生成されない
  http: true,
  experimental: {
    adapter: 'nextjs',
  },
  paths: {
    tools: 'src/mcp/tools',
    prompts: false,
    resources: false,
  },
  // 型チェックは next build 側に任せる。
  // ここで走らせるとNext.jsのアプリ全体まで舐めてチェッカーがOOMで落ちる。
  typescript: {
    skipTypeCheck: true,
  },
}

export default config

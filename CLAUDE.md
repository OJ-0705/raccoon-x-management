# x-ops プロジェクトルール

X / Threads 運用オペレーション基盤。**運用の主役は MCP サーバー**で、ダッシュボードは確認用のビューア。

## 投稿を作るときの手順（必ずこの順で）

1. `get_writing_context` — 運用方針・トーン見本・実績上位・バズパターン・既出テーマ・当月コストを一括取得
2. 本文を書く（生成はこちら側の仕事。アプリ内にAI生成機能は無い）
3. `check_duplicate` — 3層チェック。`theme` / `message` / `entities` を必ず渡す
4. `create_draft` — 重複チェック内蔵。`theme` / `message` / `entities` を保存しておかないと次回以降の判定精度が落ちる
5. `get_free_slots` → `schedule_post`

即時投稿は `publish_post`。**`confirm: true` を付けるまでは実投稿されない**（ドライラン）。

## 守ること

- **リンクを本文に入れない。** X APIの単価が $0.015 → $0.20 になる。リンクは固定リプライかプロフィールへ逃がす。
- **実投稿の前に必ずユーザーに確認を取る。** 外部への公開に当たるため、自動で `confirm: true` を付けない。
- **発信テーマ・ペルソナ・ルールをコードに書かない。** すべて `update_account_profile` でDBに入れる。
  ここを守らないと、別ジャンルへ乗り換えるときにコード改修が必要になる。
- **`refresh_metrics` を無闇に回さない。** 読み取りも1件$0.005かかる。既定の直近7日から広げない。
- 日付は全てJST基準。`src/lib/jst.ts` のヘルパーを使い、`new Date().toISOString()` で日付を切り出さない。

## 実装上の注意

- **X の v1.1 media upload は停止済み**（2025-06-09）。メディアは `api.x.com/2/media/upload` の
  チャンクアップロードのみ。`upload.twitter.com` を復活させない。
- OAuth 1.0a の署名対象は「クエリ文字列」と「form-urlencodedのボディ」だけ。
  multipart と JSON ボディは署名に含めない（`src/lib/x-api.ts` の `buildAuthHeader` 参照）。
- MCPツールを追加・変更したら `npm run mcp:build` が必要。`src/mcp/tools/*.ts` に1ファイル1ツールで置く。
- zod は v4 を使う。v3 に落とすと MCP SDK 側でスキーマ変換が壊れる。
- `xmcp.config.ts` は `http: true` と `experimental.adapter: 'nextjs'` の両方が必要。
  `http` を外すとエントリが生成されずビルドが失敗する。

## 検証

`SIMULATE_MODE=true` で起動すると外部APIを叩かずに投稿を模擬する。課金も発生しない。
公開まわりを触ったときはこのモードで cron まで通すこと。

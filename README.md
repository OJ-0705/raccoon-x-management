# x-ops — X / Threads 運用オペレーション

Claude Code から MCP 経由で回すことを前提にした、X（Twitter）と Threads の運用基盤。
投稿の生成は Claude Code 側が担当し、このアプリは **素材・下書き・重複チェック・予約・実績・APIコスト** を持つ。

発信テーマ・ペルソナ・投稿ルールはコードに一切埋めていない。すべて DB の `Account` レコードにあるので、
別ジャンルのアカウントへ乗り換えるときも設定を書き換えるだけで済む。

---

## 構成

```
src/
├── mcp/tools/         ← MCPツール（運用の主役。16本）
├── app/mcp/route.ts   ← MCPエンドポイント（Bearerトークン保護）
├── app/api/           ← ダッシュボード用API + cron
├── app/(dashboard)/   ← 最小限のビューア（一覧・カレンダー・コスト・設定）
└── lib/
    ├── x-api.ts       ← X API v2（OAuth1.0a / media upload v2 / 実績取得）
    ├── threads-api.ts ← Threads Graph API
    ├── publish.ts     ← 公開処理とコスト計上
    ├── metrics.ts     ← 実績収集と分析
    ├── dedupe.ts      ← 3層の重複チェック
    ├── pricing.ts     ← 従量課金の単価
    └── schedule.ts    ← 投稿スロットの空き計算
```

---

## X APIの課金について（重要）

2026年2月に X は **従量課金がデフォルト**になり、無料枠は廃止された。
定額の Basic ($200) / Pro ($5,000) は既存契約者のみで、新規は従量課金しか選べない。

| オペレーション | 単価 |
| --- | --- |
| 投稿作成 | $0.015 |
| **投稿作成（リンクを含む）** | **$0.20** |
| 投稿読み取り | $0.005 |
| ユーザー情報読み取り | $0.010 |

リンク1本で単価が13倍になるため、**リンクは本文に置かず固定リプライかプロフィールへ逃がす**のが基本方針。
`create_draft` / `publish_post` はリンクを検出すると警告を返す。

実費は `ApiCost` テーブルに1件ずつ積まれ、`/cost` と `get_cost_report` で確認できる。
`Account.monthlyBudgetUsd` を超えると自動投稿は停止する（`ignoreBudget` で強制実行は可能）。

単価が改定されたら `X_PRICE_*` の環境変数で上書きする。

---

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を埋める
npx prisma migrate deploy
npm run dev                  # http://localhost:3001
```

`ADMIN_EMAIL` / `ADMIN_PASSWORD` を設定しておくと、User テーブルが空のときの初回ログインで
自動的に管理ユーザーが作られる。

ログイン後 `/settings` で発信テーマ・ペルソナ・投稿ルール・投稿スロット・月次予算を埋める。
ここが空のままだと生成の質が出ないので、ダッシュボードに警告が出る。

---

## Claude Code から接続する

```bash
claude mcp add --transport http x-ops https://<your-domain>/mcp \
  --header "Authorization: Bearer $MCP_AUTH_TOKEN"
```

`MCP_AUTH_TOKEN` は本番では必須。未設定のまま本番にデプロイすると `/mcp` は 503 を返して閉じる
（投稿ツールが無防備に公開されるのを防ぐため）。開発環境では未設定でも認証なしで通る。
`CRON_SECRET` も同じ扱いで、未設定の本番では cron エンドポイントが 503 になる。

### 運用の流れ

```
get_writing_context      運用方針・トーン見本・実績・既出テーマ・当月コストを一括取得
      ↓
（Claude Code が本文を書く）
      ↓
check_duplicate          3層（テーマ／核心メッセージ／固有名詞）で既出と衝突しないか判定
      ↓
create_draft             下書き作成。重複チェックは内蔵。文字数とリンク課金も警告
      ↓
get_free_slots
      ↓
schedule_post            予約。cronが時刻になったら公開
```

即時投稿する場合は `publish_post`。`confirm` を省略するとドライラン（コスト見積もりのみ）になる。

### ツール一覧

| ツール | 用途 |
| --- | --- |
| `get_account_profile` / `update_account_profile` | 運用方針の取得・更新 |
| `get_writing_context` | 生成前の材料を一括取得 |
| `check_duplicate` | 3層の重複チェック |
| `create_draft` / `update_post` / `list_posts` / `delete_post` | 下書き管理 |
| `get_free_slots` / `schedule_post` | 予約 |
| `publish_post` | 即時投稿（既定はドライラン） |
| `refresh_metrics` / `get_analytics` | 実績の取得と分析 |
| `get_cost_report` | APIコストの集計 |
| `add_style_sample` / `add_buzz_pattern` | 生成素材の登録 |

---

## 3層の重複チェック

同じネタの言い換えを弾くために、以下のいずれかが既出と衝突したら重複と判定する。

| 層 | 内容 |
| --- | --- |
| Layer 1 | テーマ（大枠） |
| Layer 2 | 核心メッセージ（伝えたい1文） |
| Layer 3 | 固有名詞・商品名・数値 |
| 保険 | 本文そのものの2-gram類似度 |

`create_draft` 時に `theme` / `message` / `entities` を渡しておくほど、後続の判定精度が上がる。

---

## cron

Vercel の Hobby プランはcronが1日1回に制限されるため、定期実行は **GitHub Actions** で回している
（`.github/workflows/publish-cron.yml`）。二重実行を避けるため `vercel.json` に `crons` は置かない。

| パス | 間隔 | 内容 |
| --- | --- | --- |
| `/api/cron/publish` | 30分ごと | 予約時刻を過ぎた投稿を公開 |
| `/api/cron/metrics` | 1日1回 (JST 12:00 / 03:00 UTC) | 直近7日の実績とフォロワー数を取得 |

どちらも GET で、`CRON_SECRET` を設定すると `Authorization: Bearer` での認証が必須になる。
GitHub 側には同じ値を **リポジトリシークレット `CRON_SECRET`** として登録すること。未登録だと
ヘッダが空になり401で落ちる。

手動実行は Actions タブの `x-ops cron` → Run workflow から `publish` / `metrics` を選ぶ。

Vercel の cron に戻す場合は `vercel.json` に以下を足す（Pro以上が必要）。

```json
"crons": [
  { "path": "/api/cron/publish", "schedule": "*/15 * * * *" },
  { "path": "/api/cron/metrics", "schedule": "0 3 * * *" }
]
```

---

## 動作確認

```bash
SIMULATE_MODE=true npm run dev
```

`SIMULATE_MODE=true` の間は X / Threads を実際には叩かず、投稿を模擬してDBだけ更新する。課金も発生しない。

---

## 開発メモ

- `npm run build` は `prisma generate → xmcp build → next build` の順に走る。
  MCPツールを追加・変更したら `npm run mcp:build` が必要。
- MCPツールは `src/mcp/tools/*.ts` に1ファイル1ツールで置くと自動登録される。
  `schema`（zod）・`metadata`・default export の3つを持たせる。
- 日付はすべて JST 基準（`src/lib/jst.ts`）。DBの `fetchDate` / `ApiCost.date` は JST の `YYYY-MM-DD`。

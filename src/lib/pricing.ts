/**
 * X API の従量課金レート。
 *
 * 2026年2月に X は定額プラン（Basic $200 / Pro $5,000）の新規受付を終了し、
 * 従量課金がデフォルトになった。無料枠も廃止。
 * リンクを含む投稿は単価が一桁上がるため、リンクの扱いが運用コストを直接左右する。
 *
 * 単価はXの価格改定で変わるので env で上書きできるようにしている。
 */

import type { ApiOperation } from '@prisma/client'

function envPrice(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** 1オペレーションあたりのUSD単価 */
export function unitPriceUsd(op: ApiOperation): number {
  switch (op) {
    case 'POST_CREATE':
      return envPrice('X_PRICE_POST_CREATE', 0.015)
    case 'POST_CREATE_WITH_LINK':
      return envPrice('X_PRICE_POST_CREATE_WITH_LINK', 0.2)
    case 'POST_READ':
      return envPrice('X_PRICE_POST_READ', 0.005)
    case 'USER_READ':
      return envPrice('X_PRICE_USER_READ', 0.01)
    case 'MEDIA_UPLOAD':
      return envPrice('X_PRICE_MEDIA_UPLOAD', 0)
    default:
      return 0
  }
}

/**
 * 投稿本文にリンクが含まれるか。
 * X側は t.co 短縮の対象になるものをリンクと判定するので、
 * スキーム付きURLに加えて裸ドメイン（example.com/... 形式）も拾う。
 */
export function containsLink(text: string): boolean {
  if (/https?:\/\/\S+/i.test(text)) return true
  // 裸ドメイン: 英数ハイフンのラベル + よくあるTLD
  return /(^|[\s(])[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|jp|co|io|ai|app|dev|me|to|ly|gg|xyz|shop|info|biz)(\/\S*)?/i.test(
    text,
  )
}

/** 投稿作成時に計上すべきオペレーション種別 */
export function postCreateOperation(text: string): ApiOperation {
  return containsLink(text) ? 'POST_CREATE_WITH_LINK' : 'POST_CREATE'
}

/** リンクを外した場合に浮く金額（UI/MCPの警告用） */
export function linkPenaltyUsd(): number {
  return unitPriceUsd('POST_CREATE_WITH_LINK') - unitPriceUsd('POST_CREATE')
}

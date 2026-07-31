/** MCPツール共通のヘルパー。戻り値はJSON文字列で揃える（モデルが読みやすい形にする）。 */

import { getActiveAccount } from '@/lib/account'

export function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function ok(value: Record<string, unknown>): string {
  return json({ ok: true, ...value })
}

export function fail(message: string, extra: Record<string, unknown> = {}): string {
  return json({ ok: false, error: message, ...extra })
}

/** ツールから渡されたslugを解決する。未指定ならアクティブなアカウント。 */
export async function resolveAccount(slug?: string) {
  return getActiveAccount(slug)
}

export function parseJsonArray<T = unknown>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

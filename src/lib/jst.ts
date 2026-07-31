/** JST基準の日付ユーティリティ。DBの fetchDate / ApiCost.date は全てJSTの YYYY-MM-DD で揃える。 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** JSTの YYYY-MM-DD */
export function jstDate(d: Date = new Date()): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/** JSTの YYYY-MM（月次集計用） */
export function jstMonth(d: Date = new Date()): string {
  return jstDate(d).slice(0, 7)
}

/** JSTの HH:mm */
export function jstTime(d: Date = new Date()): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(11, 16)
}

/** JSTの時（0-23） */
export function jstHour(d: Date = new Date()): number {
  return new Date(d.getTime() + JST_OFFSET_MS).getUTCHours()
}

/** JSTの曜日（0=日）*/
export function jstWeekday(d: Date = new Date()): number {
  return new Date(d.getTime() + JST_OFFSET_MS).getUTCDay()
}

/**
 * 「JSTの YYYY-MM-DD HH:mm」をUTCのDateへ変換する。
 * 予約時刻の指定はすべてJSTで受け取る前提。
 */
export function jstToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - JST_OFFSET_MS)
}

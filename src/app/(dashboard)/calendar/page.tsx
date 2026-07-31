import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getActiveAccount } from '@/lib/account'
import { jstDate, jstTime } from '@/lib/jst'
import { Empty, PageTitle, Panel, StatusBadge } from '@/components/ui'

export const dynamic = 'force-dynamic'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 4週間分の予定と実績を日ごとに並べる */
export default async function CalendarPage() {
  const account = await getActiveAccount()
  const from = new Date(Date.now() - 7 * 86400000)
  const to = new Date(Date.now() + 21 * 86400000)

  const posts = await prisma.post.findMany({
    where: {
      accountId: account.id,
      status: { in: ['SCHEDULED', 'PUBLISHED', 'FAILED'] },
      OR: [
        { scheduledAt: { gte: from, lte: to } },
        { postedAt: { gte: from, lte: to } },
      ],
    },
    orderBy: [{ scheduledAt: 'asc' }],
    select: { id: true, content: true, status: true, scheduledAt: true, postedAt: true, impressions: true },
  })

  const byDate = new Map<string, typeof posts>()
  for (const p of posts) {
    const at = p.postedAt ?? p.scheduledAt
    if (!at) continue
    const key = jstDate(at)
    byDate.set(key, [...(byDate.get(key) ?? []), p])
  }

  const days: string[] = []
  for (let i = -7; i < 21; i++) {
    days.push(jstDate(new Date(Date.now() + i * 86400000)))
  }

  const today = jstDate()

  return (
    <>
      <PageTitle title="カレンダー" description="過去1週間 〜 今後3週間の予定と実績" />

      {posts.length === 0 ? (
        <Empty message="この期間に予約・投稿はありません" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {days.map((date) => {
            const items = byDate.get(date) ?? []
            const d = new Date(`${date}T00:00:00Z`)
            const isToday = date === today
            return (
              <Panel key={date} className={`!p-3 ${isToday ? '!border-orange-500/40' : ''} ${items.length === 0 ? 'opacity-50' : ''}`}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className={`text-sm font-semibold ${isToday ? 'text-orange-300' : 'text-slate-300'}`}>
                    {date.slice(5)}
                  </span>
                  <span className="text-xs text-slate-500">({WEEKDAYS[d.getUTCDay()]})</span>
                  {isToday && <span className="text-xs text-orange-400">今日</span>}
                </div>
                {items.length === 0 ? (
                  <p className="py-2 text-xs text-slate-600">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/posts/${p.id}/edit`}
                          className="block rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 hover:border-white/15"
                        >
                          <div className="mb-1 flex items-center gap-1.5">
                            <StatusBadge status={p.status} />
                            <span className="text-xs tabular-nums text-slate-500">
                              {jstTime((p.postedAt ?? p.scheduledAt) as Date)}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-xs text-slate-400">{p.content}</p>
                          {p.status === 'PUBLISHED' && p.impressions > 0 && (
                            <p className="mt-1 text-xs tabular-nums text-slate-600">👁 {p.impressions.toLocaleString()}</p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )
          })}
        </div>
      )}
    </>
  )
}

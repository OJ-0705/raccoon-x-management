import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getActiveAccount, toProfile } from '@/lib/account'
import { costSummary } from '@/lib/api-cost'
import { topPosts } from '@/lib/metrics'
import { missingXCredentials, isSimulateMode } from '@/lib/x-api'
import { unitPriceUsd } from '@/lib/pricing'
import { Empty, PageTitle, Panel, Stat, StatusBadge, BTN_GHOST } from '@/components/ui'

export const dynamic = 'force-dynamic'

const jst = (d: Date | null) =>
  d ? new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '—'

export default async function DashboardPage() {
  const account = await getActiveAccount()
  const profile = toProfile(account)
  const since = new Date(Date.now() - 30 * 86400000)

  const [counts, published, upcoming, top, cost] = await Promise.all([
    prisma.post.groupBy({ by: ['status'], where: { accountId: account.id }, _count: true }),
    prisma.post.findMany({
      where: { accountId: account.id, status: 'PUBLISHED', postedAt: { gte: since } },
      select: { impressions: true, engagementRate: true },
    }),
    prisma.post.findMany({
      where: { accountId: account.id, status: 'SCHEDULED' },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      select: { id: true, content: true, scheduledAt: true, status: true, postToX: true, postToThreads: true },
    }),
    topPosts({ accountId: account.id, limit: 3, days: 30 }),
    costSummary(undefined, account.id),
  ])

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>
  const totalImp = published.reduce((a, p) => a + p.impressions, 0)
  const avgImp = published.length ? Math.round(totalImp / published.length) : 0
  const budgetTone = cost.budgetUsd && cost.totalUsd / cost.budgetUsd > 0.8 ? 'warn' : 'default'

  const setupIssues: string[] = []
  if (profile.missing.length > 0) setupIssues.push(`運用設定が未入力: ${profile.missing.join(' / ')}`)
  if (missingXCredentials().length > 0) setupIssues.push(`X APIキーが未設定: ${missingXCredentials().join(', ')}`)
  if (isSimulateMode()) setupIssues.push('SIMULATE_MODE=true のため実際には投稿されません')

  return (
    <>
      <PageTitle
        title="ダッシュボード"
        description="直近30日の実績と当月のAPIコスト"
        action={
          <Link href="/posts/new" className={BTN_GHOST}>
            投稿を作る
          </Link>
        }
      />

      {setupIssues.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
          <div className="mb-1.5 text-sm font-semibold text-amber-300">セットアップが未完了です</div>
          <ul className="space-y-1 text-xs text-amber-200/80">
            {setupIssues.map((issue) => (
              <li key={issue}>・{issue}</li>
            ))}
          </ul>
          <Link href="/settings" className="mt-3 inline-block text-xs text-amber-300 underline">
            運用設定を開く →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="30日インプレッション" value={totalImp.toLocaleString()} sub={`平均 ${avgImp.toLocaleString()} / 投稿`} />
        <Stat label="投稿済（30日）" value={published.length} sub={`予約中 ${byStatus.SCHEDULED ?? 0}件`} />
        <Stat label="下書き" value={(byStatus.DRAFT ?? 0) + (byStatus.REVIEWED ?? 0)} sub={`失敗 ${byStatus.FAILED ?? 0}件`} />
        <Stat
          label={`${cost.month} のAPIコスト`}
          value={`$${cost.totalUsd.toFixed(3)}`}
          sub={cost.budgetUsd !== null ? `予算 $${cost.budgetUsd}（残り約${Math.max(0, Math.floor((cost.remainingUsd ?? 0) / unitPriceUsd('POST_CREATE')))}投稿）` : '予算未設定'}
          tone={budgetTone}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">これから投稿されるもの</h2>
            <Link href="/calendar" className="text-xs text-slate-500 hover:text-slate-300">
              カレンダー →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">予約中の投稿はありません</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((p) => (
                <li key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <StatusBadge status={p.status} />
                    <span className="tabular-nums">{jst(p.scheduledAt)}</span>
                    <span>{[p.postToX && 'X', p.postToThreads && 'Threads'].filter(Boolean).join(' + ')}</span>
                  </div>
                  <Link href={`/posts/${p.id}/edit`} className="line-clamp-2 text-sm text-slate-300 hover:text-white">
                    {p.content}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-3 text-sm font-semibold text-white">反応が良かった投稿（30日）</h2>
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">まだ実績がありません</p>
          ) : (
            <ul className="space-y-2">
              {top.map((p) => (
                <li key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="line-clamp-2 text-sm text-slate-300">{p.content}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs tabular-nums text-slate-500">
                    <span>👁 {p.impressions.toLocaleString()}</span>
                    <span>♡ {p.likes}</span>
                    <span>↺ {p.reposts}</span>
                    <span>💬 {p.replies}</span>
                    <span>🔖 {p.bookmarks}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {published.length === 0 && upcoming.length === 0 && (
        <div className="mt-5">
          <Empty message="まだ投稿がありません。Claude Code から MCP 経由で下書きを作るか、「新規投稿」から手動で作成してください。" />
        </div>
      )}
    </>
  )
}

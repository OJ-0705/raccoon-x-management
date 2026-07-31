import Link from 'next/link'
import type { PostStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getActiveAccount } from '@/lib/account'
import { BTN_GHOST, BTN_PRIMARY, Empty, PageTitle, Panel, StatusBadge } from '@/components/ui'

export const dynamic = 'force-dynamic'

const TABS: Array<{ key: string; label: string; statuses: PostStatus[] }> = [
  { key: 'all', label: 'すべて', statuses: [] },
  { key: 'draft', label: '下書き', statuses: ['DRAFT', 'REVIEWED'] },
  { key: 'scheduled', label: '予約済', statuses: ['SCHEDULED'] },
  { key: 'published', label: '投稿済', statuses: ['PUBLISHED'] },
  { key: 'failed', label: '失敗', statuses: ['FAILED'] },
  { key: 'archived', label: '見送り', statuses: ['ARCHIVED'] },
]

const jst = (d: Date | null) =>
  d ? new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '—'

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'all' } = await searchParams
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]
  const account = await getActiveAccount()

  const posts = await prisma.post.findMany({
    where: {
      accountId: account.id,
      ...(active.statuses.length ? { status: { in: active.statuses } } : {}),
    },
    orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return (
    <>
      <PageTitle
        title="投稿管理"
        description={`${posts.length}件を表示中`}
        action={
          <Link href="/posts/new" className={BTN_PRIMARY}>
            新規投稿
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/posts?tab=${t.key}`}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
              t.key === active.key
                ? 'border-orange-500/30 bg-orange-500/20 text-orange-300'
                : 'border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <Empty message="該当する投稿がありません" />
      ) : (
        <div className="space-y-2.5">
          {posts.map((p) => (
            <Panel key={p.id} className="!p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <StatusBadge status={p.status} />
                {p.postType && <span className="rounded-lg border border-white/10 px-2 py-0.5">{p.postType}</span>}
                <span>{[p.postToX && 'X', p.postToThreads && 'Threads'].filter(Boolean).join(' + ') || '配信先なし'}</span>
                <span className="tabular-nums">
                  {p.status === 'PUBLISHED' ? `投稿 ${jst(p.postedAt)}` : p.scheduledAt ? `予約 ${jst(p.scheduledAt)}` : `作成 ${jst(p.createdAt)}`}
                </span>
                <span className="ml-auto tabular-nums">{[...p.content].length}文字</span>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{p.content}</p>

              {p.lastError && <p className="mt-2 text-xs text-red-400">エラー: {p.lastError}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3 text-xs tabular-nums text-slate-500">
                {p.status === 'PUBLISHED' && (
                  <>
                    <span>👁 {p.impressions.toLocaleString()}</span>
                    <span>♡ {p.likes}</span>
                    <span>↺ {p.reposts}</span>
                    <span>💬 {p.replies}</span>
                    <span>🔖 {p.bookmarks}</span>
                    <span>ER {(p.engagementRate * 100).toFixed(2)}%</span>
                  </>
                )}
                <div className="ml-auto flex gap-2">
                  {p.xPostId && (
                    <a href={`https://x.com/i/status/${p.xPostId}`} target="_blank" rel="noreferrer" className={`${BTN_GHOST} !px-2.5 !py-1`}>
                      Xで見る
                    </a>
                  )}
                  <Link href={`/posts/${p.id}/edit`} className={`${BTN_GHOST} !px-2.5 !py-1`}>
                    編集
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}

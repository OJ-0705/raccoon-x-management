import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getActiveAccount } from '@/lib/account'
import { nextFreeSlots } from '@/lib/schedule'
import PostForm from '@/components/PostForm'
import { PageTitle, StatusBadge } from '@/components/ui'

export const dynamic = 'force-dynamic'

function parseArray(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [post, account, slots] = await Promise.all([
    prisma.post.findUnique({ where: { id } }),
    getActiveAccount(),
    nextFreeSlots(6),
  ])
  if (!post) notFound()

  return (
    <>
      <PageTitle
        title="投稿を編集"
        description={post.lastError ? `直近のエラー: ${post.lastError}` : undefined}
        action={<StatusBadge status={post.status} />}
      />
      <PostForm
        initial={{
          id: post.id,
          content: post.content,
          postType: post.postType ?? '',
          theme: post.dedupeTheme ?? '',
          message: post.dedupeMessage ?? '',
          entities: parseArray(post.dedupeEntities).join(', '),
          hashtags: post.hashtags ?? '',
          postToX: post.postToX,
          postToThreads: post.postToThreads,
          scheduledAt: post.scheduledAt?.toISOString() ?? null,
          mediaUrls: parseArray(post.mediaUrls),
          status: post.status,
        }}
        slots={slots.map((s) => ({ scheduledAt: s.at.toISOString(), jst: s.jst }))}
        charLimitMin={account.charLimitMin}
        charLimitMax={account.charLimitMax}
      />
    </>
  )
}

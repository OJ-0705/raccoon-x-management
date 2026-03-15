import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PostEditor from '@/components/PostEditor'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: Props) {
  const { id } = await params
  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">投稿を編集</h1>
        <p className="text-gray-400 text-sm mt-1">投稿内容を編集してください</p>
      </div>
      <PostEditor
        mode="edit"
        initialData={{
          id: post.id,
          content: post.content,
          postType: post.postType,
          formatType: post.formatType,
          status: post.status,
          scheduledAt: post.scheduledAt?.toISOString() || null,
          hashtags: post.hashtags,
        }}
      />
    </div>
  )
}

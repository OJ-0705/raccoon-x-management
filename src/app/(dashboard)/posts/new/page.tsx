import PostEditor from '@/components/PostEditor'

export default function NewPostPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">新規投稿作成</h1>
        <p className="text-gray-400 text-sm mt-1">投稿タイプを選択してAIまたは手動で作成</p>
      </div>
      <PostEditor mode="create" />
    </div>
  )
}

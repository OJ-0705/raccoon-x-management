import { getActiveAccount } from '@/lib/account'
import { nextFreeSlots } from '@/lib/schedule'
import PostForm from '@/components/PostForm'
import { PageTitle } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const account = await getActiveAccount()
  const slots = await nextFreeSlots(6)

  return (
    <>
      <PageTitle
        title="新規投稿"
        description="生成はClaude Code（MCP）側で行い、ここでは手直しと予約だけを行う想定です"
      />
      <PostForm
        initial={{
          content: '',
          postType: '',
          theme: '',
          message: '',
          entities: '',
          hashtags: '',
          postToX: true,
          postToThreads: false,
          scheduledAt: null,
          mediaUrls: [],
        }}
        slots={slots.map((s) => ({ scheduledAt: s.at.toISOString(), jst: s.jst }))}
        charLimitMin={account.charLimitMin}
        charLimitMax={account.charLimitMax}
      />
    </>
  )
}

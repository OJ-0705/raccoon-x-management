import { getActiveAccount, toProfile } from '@/lib/account'
import { getThreadsCredentials } from '@/lib/threads-api'
import { isSimulateMode, missingXCredentials } from '@/lib/x-api'
import AccountSettingsForm from '@/components/AccountSettingsForm'
import { PageTitle, Panel } from '@/components/ui'

export const dynamic = 'force-dynamic'

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5 last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      <span className={`text-xs ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
        {ok ? '✓ ' : '! '}
        {detail}
      </span>
    </div>
  )
}

export default async function SettingsPage() {
  const account = await getActiveAccount()
  const profile = toProfile(account)
  const threads = await getThreadsCredentials()
  const xMissing = missingXCredentials()
  const mcpProtected = Boolean((process.env.MCP_AUTH_TOKEN || '').trim())
  const cronProtected = Boolean((process.env.CRON_SECRET || '').trim())

  return (
    <>
      <PageTitle title="運用設定" description="発信テーマやルールはコードではなくここに保存されます" />

      <Panel className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-white">接続状態</h2>
        <Row label="X API" ok={xMissing.length === 0} detail={xMissing.length === 0 ? '設定済み' : `未設定: ${xMissing.join(', ')}`} />
        <Row label="Threads API" ok={Boolean(threads)} detail={threads ? '設定済み' : '未接続'} />
        <Row
          label="MCPエンドポイント (/mcp)"
          ok={mcpProtected}
          detail={mcpProtected ? 'トークン保護あり' : 'MCP_AUTH_TOKEN 未設定（本番では503で閉じています）'}
        />
        <Row
          label="cron (/api/cron/*)"
          ok={cronProtected}
          detail={cronProtected ? 'トークン保護あり' : 'CRON_SECRET 未設定（本番では503で閉じています）'}
        />
        <Row label="投稿モード" ok={!isSimulateMode()} detail={isSimulateMode() ? 'SIMULATE_MODE（実投稿しない）' : '本番'} />
        {!threads && (
          <a href="/api/auth/threads/start" className="mt-3 inline-block text-xs text-orange-400 underline">
            Threadsを接続する →
          </a>
        )}
      </Panel>

      {profile.missing.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm text-amber-200">
          未入力の項目があります: {profile.missing.join(' / ')}
        </div>
      )}

      <AccountSettingsForm
        initial={{
          displayName: profile.displayName ?? '',
          xUsername: profile.xUsername ?? '',
          threadsUsername: profile.threadsUsername ?? '',
          persona: profile.persona ?? '',
          theme: profile.theme ?? '',
          targetAudience: profile.targetAudience ?? '',
          rules: profile.rules ?? '',
          ctaPolicy: profile.ctaPolicy ?? '',
          charLimitMin: profile.charLimitMin,
          charLimitMax: profile.charLimitMax,
          postingSlots: profile.postingSlots.join(', '),
          monthlyBudgetUsd: profile.monthlyBudgetUsd,
        }}
      />

      <Panel className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-white">Claude Code から接続する</h2>
        <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-xs text-slate-400">
{`claude mcp add --transport http x-ops <このサイトのURL>/mcp \\
  --header "Authorization: Bearer $MCP_AUTH_TOKEN"`}
        </pre>
        <p className="mt-2 text-xs text-slate-500">
          接続後は get_writing_context → check_duplicate → create_draft → schedule_post の順で運用します。
        </p>
      </Panel>
    </>
  )
}

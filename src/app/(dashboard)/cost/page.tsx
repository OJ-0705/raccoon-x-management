import { getActiveAccount } from '@/lib/account'
import { costSummary } from '@/lib/api-cost'
import { unitPriceUsd, linkPenaltyUsd } from '@/lib/pricing'
import { PageTitle, Panel, Stat } from '@/components/ui'

export const dynamic = 'force-dynamic'

const OP_LABEL: Record<string, string> = {
  POST_CREATE: '投稿作成',
  POST_CREATE_WITH_LINK: '投稿作成（リンク入り）',
  POST_READ: '投稿読み取り',
  USER_READ: 'ユーザー情報読み取り',
  MEDIA_UPLOAD: 'メディアアップロード',
  OTHER: 'その他',
}

export default async function CostPage() {
  const account = await getActiveAccount()
  const s = await costSummary(undefined, account.id)

  const used = s.budgetUsd ? Math.min(100, (s.totalUsd / s.budgetUsd) * 100) : 0
  const maxDaily = Math.max(1, ...s.daily.map((d) => d.costUsd))

  return (
    <>
      <PageTitle
        title="APIコスト"
        description="Xは2026年2月から従量課金。無料枠は廃止されているため、投稿ペースはこの数字で決めます"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${s.month} の実費`} value={`$${s.totalUsd.toFixed(3)}`} />
        <Stat label="月次予算" value={s.budgetUsd === null ? '未設定' : `$${s.budgetUsd}`} sub="運用設定で変更できます" />
        <Stat
          label="残り"
          value={s.remainingUsd === null ? '—' : `$${s.remainingUsd.toFixed(3)}`}
          tone={s.remainingUsd !== null && s.remainingUsd < 0 ? 'warn' : 'default'}
        />
        <Stat
          label="残り投稿数の目安"
          value={s.remainingUsd === null ? '—' : Math.max(0, Math.floor(s.remainingUsd / unitPriceUsd('POST_CREATE')))}
          sub={`リンクなし $${unitPriceUsd('POST_CREATE')} / 件`}
        />
      </div>

      {s.budgetUsd !== null && (
        <Panel className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-slate-400">
            <span>予算消化率</span>
            <span className="tabular-nums">{used.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${used > 90 ? 'bg-red-500' : used > 70 ? 'bg-amber-500' : 'bg-orange-500'}`}
              style={{ width: `${used}%` }}
            />
          </div>
        </Panel>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 text-sm font-semibold text-white">内訳</h2>
          {s.byOperation.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">今月の課金はまだありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs text-slate-500">
                  <th className="pb-2 text-left font-medium">オペレーション</th>
                  <th className="pb-2 text-right font-medium">件数</th>
                  <th className="pb-2 text-right font-medium">金額</th>
                </tr>
              </thead>
              <tbody>
                {s.byOperation.map((o) => (
                  <tr key={o.operation} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2 text-slate-300">{OP_LABEL[o.operation] ?? o.operation}</td>
                    <td className="py-2 text-right tabular-nums text-slate-400">{o.units}</td>
                    <td className="py-2 text-right tabular-nums text-white">${o.costUsd.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-3 text-sm font-semibold text-white">日次推移</h2>
          {s.daily.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">データなし</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {s.daily.map((d) => (
                <div key={d.date} className="group relative flex-1" title={`${d.date}: $${d.costUsd.toFixed(3)}`}>
                  <div
                    className="w-full rounded-t bg-orange-500/60 transition-all group-hover:bg-orange-400"
                    style={{ height: `${Math.max(2, (d.costUsd / maxDaily) * 150)}px` }}
                  />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-white">現在の単価</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between rounded-xl border border-white/[0.06] px-3 py-2">
            <span className="text-slate-400">投稿作成</span>
            <span className="tabular-nums text-white">${unitPriceUsd('POST_CREATE')}</span>
          </div>
          <div className="flex justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
            <span className="text-amber-300">投稿作成（リンク入り）</span>
            <span className="tabular-nums text-amber-200">${unitPriceUsd('POST_CREATE_WITH_LINK')}</span>
          </div>
          <div className="flex justify-between rounded-xl border border-white/[0.06] px-3 py-2">
            <span className="text-slate-400">投稿読み取り</span>
            <span className="tabular-nums text-white">${unitPriceUsd('POST_READ')}</span>
          </div>
          <div className="flex justify-between rounded-xl border border-white/[0.06] px-3 py-2">
            <span className="text-slate-400">ユーザー情報読み取り</span>
            <span className="tabular-nums text-white">${unitPriceUsd('USER_READ')}</span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          リンクを1本入れるごとに追加で約 ${linkPenaltyUsd().toFixed(3)} かかります。リンクは固定リプライかプロフィールへ逃がすのが基本方針です。
          単価が改定された場合は環境変数（X_PRICE_POST_CREATE など）で上書きできます。
        </p>
      </Panel>
    </>
  )
}

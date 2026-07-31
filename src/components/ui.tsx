import type { ReactNode } from 'react'

export const PANEL =
  'rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${PANEL} p-4 md:p-5 ${className}`}>{children}</div>
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: ReactNode; sub?: string; tone?: 'default' | 'warn' | 'good' }) {
  const toneCls = tone === 'warn' ? 'text-amber-300' : tone === 'good' ? 'text-emerald-300' : 'text-white'
  return (
    <div className={`${PANEL} p-4`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '下書き', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/25' },
  REVIEWED: { label: 'レビュー済', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/25' },
  SCHEDULED: { label: '予約済', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
  PUBLISHED: { label: '投稿済', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  FAILED: { label: '失敗', cls: 'bg-red-500/15 text-red-300 border-red-500/25' },
  ARCHIVED: { label: '見送り', cls: 'bg-white/[0.05] text-slate-500 border-white/10' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, cls: 'bg-white/[0.05] text-slate-400 border-white/10' }
  return <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

export const BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed'
export const BTN_PRIMARY = `${BTN} bg-orange-500 text-white hover:bg-orange-400`
export const BTN_GHOST = `${BTN} border border-white/10 text-slate-300 hover:bg-white/[0.06] hover:text-white`
export const BTN_DANGER = `${BTN} border border-red-500/30 text-red-300 hover:bg-red-500/10`

export const INPUT =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-orange-500/50'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  )
}

export function Empty({ message }: { message: string }) {
  return <div className={`${PANEL} p-10 text-center text-sm text-slate-500`}>{message}</div>
}

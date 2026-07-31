'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

const NAV = [
  { href: '/', icon: '📊', label: 'ダッシュボード' },
  { href: '/posts', icon: '📝', label: '投稿管理' },
  { href: '/posts/new', icon: '✏️', label: '新規投稿' },
  { href: '/calendar', icon: '📅', label: 'カレンダー' },
  { href: '/cost', icon: '💰', label: 'APIコスト' },
  { href: '/settings', icon: '⚙️', label: '運用設定' },
]

export default function Sidebar({ accountName }: { accountName?: string }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/posts') return pathname === '/posts' || /^\/posts\/[^/]+\/edit$/.test(pathname)
    return pathname === href
  }

  const linkCls = (href: string) =>
    `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
      isActive(href)
        ? 'border-orange-500/30 bg-orange-500/20 text-orange-300'
        : 'border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white'
    }`

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className={`fixed left-3 top-3 z-[60] flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.12] bg-[#06070d]/90 text-white backdrop-blur-xl md:hidden ${
          mobileOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-label="メニュー"
      >
        ☰
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 z-[60] flex h-full w-56 flex-col border-r border-white/[0.07] bg-[#06070d]/95 backdrop-blur-2xl transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="border-b border-white/[0.07] p-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛰️</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-orange-400">{accountName || 'X Ops'}</div>
              <div className="text-xs text-slate-500">X運用オペレーション</div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.08] text-slate-400 hover:text-white md:hidden"
            >
              ✕
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={linkCls(item.href)}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            投稿の生成・推敲は Claude Code から MCP（<code className="text-slate-400">/mcp</code>）経由で行います。
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-500 transition-all hover:bg-white/[0.05] hover:text-white"
          >
            <span>🚪</span>
            <span>ログアウト</span>
          </button>
        </div>
      </aside>
    </>
  )
}

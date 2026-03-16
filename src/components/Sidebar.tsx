'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const isDashboard = pathname === '/' || pathname.startsWith('/dashboard')
  const [dashOpen, setDashOpen] = useState(isDashboard)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  const linkCls = (href: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
      isActive(href)
        ? 'bg-orange-500 text-white font-medium'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`

  const subLinkCls = (href: string) =>
    `flex items-center gap-2 pl-8 pr-3 py-2 rounded-lg text-sm transition-colors ${
      isActive(href)
        ? 'bg-orange-500/80 text-white font-medium'
        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
    }`

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-gray-800 border-r border-gray-700 flex flex-col z-50">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍊</span>
          <div>
            <div className="text-sm font-bold text-orange-500">らくーん</div>
            <div className="text-xs text-gray-400">X自動運用管理</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* トップ */}
        <Link href="/top" className={linkCls('/top')}>
          <span>🏠</span><span>トップ</span>
        </Link>

        {/* ダッシュボード (accordion) */}
        <div>
          <button
            onClick={() => setDashOpen(o => !o)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isDashboard ? 'bg-orange-500 text-white font-medium' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <span>📊</span><span>ダッシュボード</span>
            </span>
            <span className="text-xs">{dashOpen ? '▾' : '▸'}</span>
          </button>
          {dashOpen && (
            <div className="mt-1 space-y-0.5">
              <Link href="/" className={subLinkCls('/__x__')}>
                <span className={`w-1.5 h-1.5 rounded-full ${pathname === '/' ? 'bg-orange-400' : 'bg-gray-600'}`} />
                <span>X</span>
              </Link>
              <Link href="/dashboard/threads" className={subLinkCls('/dashboard/threads')}>
                <span className={`w-1.5 h-1.5 rounded-full ${pathname === '/dashboard/threads' ? 'bg-orange-400' : 'bg-gray-600'}`} />
                <span>Threads</span>
              </Link>
            </div>
          )}
        </div>

        {/* Others */}
        <Link href="/posts" className={linkCls('/posts')}>
          <span>📝</span><span>投稿管理</span>
        </Link>
        <Link href="/posts/new" className={linkCls('/posts/new')}>
          <span>✏️</span><span>新規投稿</span>
        </Link>
        <Link href="/calendar" className={linkCls('/calendar')}>
          <span>📅</span><span>カレンダー</span>
        </Link>
        <Link href="/research" className={linkCls('/research')}>
          <span>🔍</span><span>リサーチ</span>
        </Link>
        <Link href="/settings" className={linkCls('/settings')}>
          <span>⚙️</span><span>設定</span>
        </Link>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <span>🚪</span><span>ログアウト</span>
        </button>
      </div>
    </aside>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/top', label: 'トップ', icon: '🏠' },
  { href: '/', label: 'ダッシュボード', icon: '📊' },
  { href: '/posts', label: '投稿管理', icon: '📝' },
  { href: '/posts/new', label: '新規投稿', icon: '✏️' },
  { href: '/calendar', label: 'カレンダー', icon: '📅' },
  { href: '/research', label: 'リサーチ', icon: '🔍' },
  { href: '/settings', label: '設定', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

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
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white font-medium'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <span>🚪</span>
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  )
}

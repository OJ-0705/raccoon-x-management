import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getActiveAccount } from '@/lib/account'
import Sidebar from '@/components/Sidebar'
import SessionProvider from '@/components/SessionProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const account = await getActiveAccount()
  const name = account.displayName || (account.xUsername ? `@${account.xUsername}` : 'X Ops')

  return (
    <SessionProvider>
      <div className="flex h-screen">
        <Sidebar accountName={name} />
        <main className="flex-1 overflow-y-auto md:ml-56">
          <div className="sticky top-0 z-40 flex h-12 items-center justify-center border-b border-white/[0.07] bg-[#06070d]/95 px-4 backdrop-blur-xl md:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛰️</span>
              <span className="text-sm font-bold text-orange-400">{name}</span>
            </div>
          </div>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </SessionProvider>
  )
}

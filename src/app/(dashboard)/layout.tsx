import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import SessionProvider from '@/components/SessionProvider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <SessionProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 md:ml-56 overflow-y-auto">
          {/* Mobile header */}
          <div className="sticky top-0 z-40 flex md:hidden items-center justify-center h-12 px-4" style={{ background: 'rgba(6,7,13,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🍊</span>
              <span className="text-sm font-bold text-orange-400">らくーん</span>
            </div>
          </div>
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  )
}

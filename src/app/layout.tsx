import type { Metadata } from 'next'
import { BIZ_UDPGothic } from 'next/font/google'
import './globals.css'

const bizUdpGothic = BIZ_UDPGothic({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-biz-udp-gothic',
})

export const metadata: Metadata = {
  title: 'らくーん🍊 X自動運用管理システム',
  description: 'X（Twitter）の自動投稿・管理システム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="dark">
      <body className={`${bizUdpGothic.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}

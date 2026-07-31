import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

/**
 * 管理ユーザーがまだ1人もいない場合に限り、ADMIN_EMAIL / ADMIN_PASSWORD から初期ユーザーを作る。
 * DBを作り直したあとに手動でseedを走らせなくてもログインできるようにするため。
 * 既にユーザーが存在する場合は何もしない。
 */
async function bootstrapAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL || '').trim()
  const password = process.env.ADMIN_PASSWORD || ''
  if (!email || !password) return

  if ((await prisma.user.count()) > 0) return

  await prisma.user.create({
    data: { email, password: await bcrypt.hash(password, 10) },
  })
  console.log('[auth] 初期管理ユーザーを作成しました:', email)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        await bootstrapAdmin()

        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user) return null
        if (!(await bcrypt.compare(credentials.password, user.password))) return null

        return { id: user.id, email: user.email }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (token && session.user) (session.user as { id?: string }).id = token.id as string
      return session
    },
  },
}

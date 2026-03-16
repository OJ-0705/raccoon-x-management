import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // pg.Pool インスタンスではなく PoolConfig を渡すことで
  // dual package hazard（pg の型定義の競合）を回避する
  const adapter = new PrismaPg({
    connectionString: process.env.STORAGE_URL ?? '',
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

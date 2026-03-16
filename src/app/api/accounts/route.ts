import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  // X account status — from env vars + latest analytics
  const xConfigured = !!(process.env.X_CONSUMER_KEY && process.env.X_ACCESS_TOKEN)
  const threadsConfigured = !!(process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_USER_ID)
  const threadsAppReady = !!(process.env.THREADS_APP_ID && process.env.THREADS_APP_SECRET)

  // Get latest follower count from analytics
  let xFollowers: number | null = null
  try {
    const latest = await prisma.analytics.findFirst({
      orderBy: { date: 'desc' },
      select: { followers: true },
    })
    xFollowers = latest?.followers ?? null
  } catch {}

  // Try to get Threads profile if connected
  let threadsProfile: { username?: string; followers?: number } | null = null
  if (threadsConfigured) {
    try {
      const res = await fetch(
        `https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_audience_size&access_token=${process.env.THREADS_ACCESS_TOKEN}`,
        { next: { revalidate: 300 } }
      )
      if (res.ok) {
        const data = await res.json()
        threadsProfile = {
          username: data.username,
          followers: data.threads_profile_audience_size,
        }
      }
    } catch {}
  }

  return NextResponse.json({
    x: {
      configured: xConfigured,
      handle: xConfigured ? '@raccoon_lipid' : null,
      followers: xFollowers,
    },
    threads: {
      configured: threadsConfigured,
      appReady: threadsAppReady,
      userId: process.env.THREADS_USER_ID || null,
      username: threadsProfile?.username || null,
      followers: threadsProfile?.followers || null,
    },
  })
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [lastFetch, totalStories] = await Promise.all([
      prisma.fetchLog.findFirst({ orderBy: { ranAt: 'desc' } }),
      prisma.story.count(),
    ])
    return NextResponse.json({ lastFetch, totalStories })
  } catch {
    // DB not ready yet — still return 200 so healthcheck passes
    return NextResponse.json({ lastFetch: null, totalStories: 0 })
  }
}

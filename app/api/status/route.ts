import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [lastFetch, totalStories] = await Promise.all([
    prisma.fetchLog.findFirst({ orderBy: { ranAt: 'desc' } }),
    prisma.story.count(),
  ])
  return NextResponse.json({ lastFetch, totalStories })
}

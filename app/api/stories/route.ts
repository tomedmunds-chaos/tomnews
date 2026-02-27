import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  const stories = await prisma.story.findMany({
    where: {
      // Use publishedAt when available; fall back to fetchedAt for stories without it
      OR: [
        { publishedAt: { gte: threeDaysAgo } },
        { publishedAt: null, fetchedAt: { gte: threeDaysAgo } },
      ],
      ...(category ? { category } : {}),
    },
    orderBy: { score: 'desc' },
    take: 10,
  })

  return NextResponse.json(stories)
}

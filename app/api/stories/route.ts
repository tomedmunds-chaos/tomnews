import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const hours = parseInt(searchParams.get('hours') ?? '48')

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const stories = await prisma.story.findMany({
    where: {
      fetchedAt: { gte: since },
      ...(category ? { category } : {}),
    },
    orderBy: { score: 'desc' },
    take: 100,
  })

  return NextResponse.json(stories)
}

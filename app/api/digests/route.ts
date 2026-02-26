import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const digests = await prisma.digest.findMany({
    orderBy: { sentAt: 'desc' },
    take: 30,
    select: { id: true, sentAt: true, storyIds: true },
  })
  return NextResponse.json(digests)
}

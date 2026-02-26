import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const digest = await prisma.digest.findUnique({ where: { id } })
  if (!digest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(digest)
}

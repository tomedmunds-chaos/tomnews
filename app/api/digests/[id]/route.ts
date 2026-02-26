import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const digest = await prisma.digest.findUnique({ where: { id: params.id } })
  if (!digest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(digest)
}

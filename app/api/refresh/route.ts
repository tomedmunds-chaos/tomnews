import { NextResponse } from 'next/server'
import { runFetchJob } from '@/lib/jobs/fetchJob'

export async function POST() {
  const result = await runFetchJob()
  return NextResponse.json(result)
}

import { Resend } from 'resend'
import { prisma } from '../prisma'
import { digestConfig } from '@/config/topics'
import { buildDigestEmail } from '../email'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export async function runDigestJob(): Promise<{ status: string; error?: string }> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const stories = await prisma.story.findMany({
      where: {
        fetchedAt: { gte: since },
        includedInDigest: false,
        score: { gte: digestConfig.minScoreForDigest },
      },
      orderBy: { score: 'desc' },
      take: digestConfig.topStoriesPerDigest,
    })

    if (stories.length === 0) {
      console.log('[digestJob] No qualifying stories, skipping')
      return { status: 'skipped' }
    }

    const { subject, html, text } = buildDigestEmail(
      stories.map((s: { title: string; url: string; summary: string | null; rawContent?: string; score: number | null; category: string | null }) => ({
        title: s.title,
        url: s.url,
        summary: s.summary ?? (s.rawContent ?? '').slice(0, 120),
        score: s.score ?? 5,
        category: s.category ?? 'Other',
      })),
      new Date()
    )

    const { error } = await getResend().emails.send({
      from: 'AI Digest <digest@yourdomain.com>',
      to: digestConfig.emailRecipient,
      subject,
      html,
      text,
    })

    if (error) throw new Error(error.message)

    await prisma.story.updateMany({
      where: { id: { in: stories.map((s: { id: string }) => s.id) } },
      data: { includedInDigest: true },
    })

    await prisma.digest.create({
      data: {
        emailHtml: html,
        storyIds: stories.map((s: { id: string }) => s.id),
      },
    })

    console.log(`[digestJob] Sent digest with ${stories.length} stories`)
    return { status: 'success' }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[digestJob] Error:', error)
    return { status: 'error', error }
  }
}

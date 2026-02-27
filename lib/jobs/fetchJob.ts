import { searchQueries } from '@/config/topics'
import { fetchStoriesFromPerplexity, RawStory } from '../perplexity'
import { scoreAndSummarizeStories } from '../claude'
import { deduplicateStories } from '../dedup'
import { prisma } from '../prisma'

export async function runFetchJob(): Promise<{ storiesFound: number; status: string; error?: string }> {
  let storiesFound = 0

  try {
    // Get all existing URLs to deduplicate against
    const existingStories = await prisma.story.findMany({ select: { url: true } })
    const existingUrls = existingStories.map((s: { url: string }) => s.url)

    // Fetch from all search queries in parallel, collecting errors per query
    const rawResults = await Promise.allSettled(
      searchQueries.map(q => fetchStoriesFromPerplexity(q))
    )
    const queryErrors = rawResults
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason instanceof Error ? r.reason.message : String(r.reason))
    if (queryErrors.length > 0) {
      console.error('[fetchJob] Query errors:', queryErrors)
    }
    const allRaw = rawResults
      .filter((r): r is PromiseFulfilledResult<RawStory[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    // Deduplicate
    const newStories = deduplicateStories(allRaw, existingUrls)

    if (newStories.length > 0) {
      // Score and summarize — fall back to defaults if AI scoring is unavailable
      let scored: Awaited<ReturnType<typeof scoreAndSummarizeStories>>
      try {
        scored = await scoreAndSummarizeStories(newStories)
      } catch (err) {
        console.error('[fetchJob] Scoring unavailable, saving unscored stories:', err)
        scored = newStories.map(s => ({
          ...s,
          score: 5,
          summary: s.rawContent.slice(0, 120),
          category: 'Other',
        }))
      }

      // Save to DB
      await prisma.story.createMany({
        data: scored.map((s: { title: string; url: string; sourceDomain: string; rawContent: string; summary: string; score: number; category: string; publishedAt?: string }) => ({
          title: s.title,
          url: s.url,
          sourceDomain: s.sourceDomain,
          rawContent: s.rawContent,
          summary: s.summary,
          score: s.score,
          category: s.category,
          publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
        })),
        skipDuplicates: true,
      })

      storiesFound = scored.length
    }

    // If all queries failed, treat as error
    if (queryErrors.length === searchQueries.length && storiesFound === 0) {
      const error = queryErrors[0]
      await prisma.fetchLog.create({
        data: { storiesFound: 0, status: 'error', error },
      })
      return { storiesFound: 0, status: 'error', error }
    }

    await prisma.fetchLog.create({
      data: { storiesFound, status: 'success' },
    })

    console.log(`[fetchJob] Saved ${storiesFound} new stories`)
    return { storiesFound, status: 'success' }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[fetchJob] Error:', error)

    await prisma.fetchLog.create({
      data: { storiesFound: 0, status: 'error', error },
    })

    return { storiesFound: 0, status: 'error', error }
  }
}

import { searchQueries } from '@/config/topics'
import { fetchStoriesFromPerplexity } from '../perplexity'
import { scoreAndSummarizeStories } from '../claude'
import { deduplicateStories } from '../dedup'
import { prisma } from '../prisma'

export async function runFetchJob(): Promise<{ storiesFound: number; status: string; error?: string }> {
  let storiesFound = 0

  try {
    // Get all existing URLs to deduplicate against
    const existingStories = await prisma.story.findMany({ select: { url: true } })
    const existingUrls = existingStories.map((s: { url: string }) => s.url)

    // Fetch from all search queries in parallel
    const rawBatches = await Promise.all(
      searchQueries.map(q => fetchStoriesFromPerplexity(q))
    )
    const allRaw = rawBatches.flat()

    // Deduplicate
    const newStories = deduplicateStories(allRaw, existingUrls)

    if (newStories.length > 0) {
      // Score and summarize
      const scored = await scoreAndSummarizeStories(newStories)

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

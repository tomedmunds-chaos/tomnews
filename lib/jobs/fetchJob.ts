import { searchQueries } from '@/config/topics'
import { twitterUsernames } from '@/config/accounts'
import { fetchStoriesFromPerplexity, RawStory } from '../perplexity'
import { fetchTweetsFromAccounts, TweetStory } from '../socialdata'
import { scoreAndSummarizeStories } from '../claude'
import { deduplicateStories } from '../dedup'
import { prisma } from '../prisma'

export async function runFetchJob(): Promise<{ storiesFound: number; status: string; error?: string }> {
  let storiesFound = 0

  try {
    // Delete stories older than 3 days
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    await prisma.story.deleteMany({ where: { fetchedAt: { lt: cutoff } } })

    // Get all existing URLs to deduplicate against
    const existingStories = await prisma.story.findMany({ select: { url: true } })
    const existingUrls = existingStories.map((s: { url: string }) => s.url)

    // Run Perplexity queries and Twitter account feed in parallel
    const [perplexityResults, twitterStories] = await Promise.all([
      Promise.allSettled(searchQueries.map(q => fetchStoriesFromPerplexity(q))),
      fetchTweetsFromAccounts(twitterUsernames).catch((err) => {
        console.error('[fetchJob] Twitter fetch failed:', err)
        return [] as TweetStory[]
      }),
    ])

    const queryErrors = perplexityResults
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason instanceof Error ? r.reason.message : String(r.reason))
    if (queryErrors.length > 0) {
      console.error('[fetchJob] Perplexity query errors:', queryErrors)
    }

    const perplexityStories = perplexityResults
      .filter((r): r is PromiseFulfilledResult<RawStory[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    const allRaw: RawStory[] = [...perplexityStories, ...twitterStories]

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
        data: scored.map((s) => ({
          title: s.title,
          url: s.url,
          sourceDomain: s.sourceDomain,
          rawContent: s.rawContent,
          summary: s.summary,
          score: s.score,
          category: s.category,
          publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
          tweetAuthor: s.tweetAuthor ?? null,
        })),
        skipDuplicates: true,
      })

      storiesFound = scored.length
    }

    // If all queries failed, treat as error
    if (queryErrors.length === searchQueries.length) {
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

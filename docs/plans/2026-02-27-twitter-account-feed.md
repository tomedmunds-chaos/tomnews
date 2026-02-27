# Twitter Account Feed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add curated Twitter/X accounts as a parallel fetch source so the feed surfaces both Perplexity news and posts from a hand-picked list of people.

**Architecture:** SocialData.tools API fetches recent tweets per account in parallel. Results merge with Perplexity stories before the existing dedup → Gemini scoring → DB save pipeline. A new `tweetAuthor` field on `Story` tracks which account surfaced each piece.

**Tech Stack:** SocialData.tools REST API, existing Prisma/Next.js/Gemini stack, Jest for tests.

---

### Task 1: Update Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add `tweetAuthor` field to the Story model**

In `prisma/schema.prisma`, add one line to the `Story` model after `publishedAt`:

```prisma
tweetAuthor  String?
```

The full Story model should look like:
```prisma
model Story {
  id               String    @id @default(cuid())
  title            String
  url              String    @unique
  sourceDomain     String
  rawContent       String
  summary          String?
  score            Float?
  category         String?
  publishedAt      DateTime?
  fetchedAt        DateTime  @default(now())
  includedInDigest Boolean   @default(false)
  tweetAuthor      String?

  @@map("stories")
}
```

**Step 2: Regenerate Prisma client**

```bash
npx prisma generate
```
Expected: `✔ Generated Prisma Client`

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add tweetAuthor field to Story schema"
```

---

### Task 2: Create `config/accounts.ts`

**Files:**
- Create: `config/accounts.ts`

**Step 1: Create the file**

```typescript
// Flat list of Twitter/X usernames to monitor.
// Categories map to the existing topic filter values.
export const twitterAccounts: { username: string; category: string }[] = [
  // AI Research / General
  { username: 'aiedge_', category: 'Other' },
  { username: 'levie', category: 'Industry' },
  { username: 'omooretweets', category: 'Other' },
  { username: 'mreflow', category: 'Other' },
  { username: 'carlvellotti', category: 'Other' },
  { username: 'slow_developer', category: 'Other' },
  { username: 'petergyang', category: 'Other' },
  { username: 'rubenhassid', category: 'Other' },
  { username: 'minchoi', category: 'Other' },
  { username: 'heyshrutimishra', category: 'Other' },

  // AI Agents
  { username: 'openclaw', category: 'AI Agents' },
  { username: 'steipete', category: 'AI Agents' },
  { username: 'AlexFinn', category: 'AI Agents' },
  { username: 'MatthewBerman', category: 'AI Agents' },
  { username: 'johann_sath', category: 'AI Agents' },
  { username: 'DeRonin_', category: 'AI Agents' },

  // Industry / Business
  { username: 'Codie_Sanchez', category: 'Industry' },
  { username: 'alliekmiller', category: 'Industry' },
  { username: 'ideabrowser', category: 'Industry' },
  { username: 'eptwts', category: 'Industry' },
  { username: 'gregisenberg', category: 'Industry' },
  { username: 'startupideaspod', category: 'Industry' },
  { username: 'Lukealexxander', category: 'Industry' },
  { username: 'vasuman', category: 'Industry' },
  { username: 'eyad_khrais', category: 'Industry' },
  { username: 'damianplayer', category: 'Industry' },
  { username: 'EXM7777', category: 'Industry' },
  { username: 'VibeMarketer_', category: 'Industry' },
  { username: 'boringmarketer', category: 'Industry' },
  { username: 'viktoroddy', category: 'Industry' },
  { username: 'Salmaaboukarr', category: 'Industry' },
  { username: 'AndrewBolis', category: 'Industry' },

  // Technical Expertise
  { username: 'frankdegods', category: 'Research' },
  { username: 'bcherny', category: 'Research' },
  { username: 'dani_avila7', category: 'Research' },
  { username: 'karpathy', category: 'Research' },
  { username: 'geoffreyhinton', category: 'AI Safety' },
  { username: 'MoonDevOnYT', category: 'Research' },
  { username: 'Hesamation', category: 'Research' },
  { username: 'kloss_xyz', category: 'Research' },
  { username: 'GithubProjects', category: 'Research' },
  { username: 'tom_doerr', category: 'Research' },
  { username: 'googleaidevs', category: 'Research' },
  { username: 'OpenAIDevs', category: 'Model Releases' },

  // Prompt Engineering
  { username: 'PromptLLM', category: 'Research' },
  { username: 'godofprompt', category: 'Research' },
  { username: 'alex_prompter', category: 'Research' },
  { username: 'promptcowboy', category: 'Research' },
  { username: 'Prompt_Perfect', category: 'Research' },
]

export const twitterUsernames = twitterAccounts.map(a => a.username)
```

**Step 2: Commit**

```bash
git add config/accounts.ts
git commit -m "feat: add curated Twitter account list"
```

---

### Task 3: Create `lib/socialdata.ts` with tests

**Files:**
- Create: `lib/socialdata.ts`
- Create: `lib/__tests__/socialdata.test.ts`

**Step 1: Write the failing tests**

Create `lib/__tests__/socialdata.test.ts`:

```typescript
import { fetchTweetsFromAccounts } from '../socialdata'

global.fetch = jest.fn()

describe('fetchTweetsFromAccounts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('maps a plain tweet (no links) to a RawStory with tweet URL', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '111',
            full_text: 'Fascinating new paper on attention mechanisms.',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: { urls: [] },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].url).toBe('https://x.com/karpathy/status/111')
    expect(stories[0].sourceDomain).toBe('x.com')
    expect(stories[0].rawContent).toBe('Fascinating new paper on attention mechanisms.')
    expect(stories[0].tweetAuthor).toBe('karpathy')
  })

  it('uses the external link URL when tweet contains one', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '222',
            full_text: 'Great read: https://t.co/abc',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: {
              urls: [
                { expanded_url: 'https://arxiv.org/abs/2502.12345', display_url: 'arxiv.org/abs/2502.12345' },
              ],
            },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].url).toBe('https://arxiv.org/abs/2502.12345')
    expect(stories[0].sourceDomain).toBe('arxiv.org')
  })

  it('skips an account that returns a non-ok response without throwing', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })

    const stories = await fetchTweetsFromAccounts(['private_account'])

    expect(stories).toHaveLength(0)
  })

  it('merges tweets from multiple accounts', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tweets: [{ id_str: '1', full_text: 'Tweet A', tweet_created_at: '2026-02-27T10:00:00.000Z', user: { screen_name: 'userA' }, entities: { urls: [] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tweets: [{ id_str: '2', full_text: 'Tweet B', tweet_created_at: '2026-02-27T10:00:00.000Z', user: { screen_name: 'userB' }, entities: { urls: [] } }],
        }),
      })

    const stories = await fetchTweetsFromAccounts(['userA', 'userB'])

    expect(stories).toHaveLength(2)
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
npx jest lib/__tests__/socialdata.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../socialdata'`

**Step 3: Implement `lib/socialdata.ts`**

```typescript
import type { RawStory } from './perplexity'

export interface TweetStory extends RawStory {
  tweetAuthor: string
}

interface SocialDataTweet {
  id_str: string
  full_text: string
  tweet_created_at: string
  user: { screen_name: string }
  entities: {
    urls: Array<{ expanded_url: string; display_url: string }>
  }
}

async function fetchUserTweets(username: string): Promise<TweetStory[]> {
  const response = await fetch(
    `https://api.socialdata.tools/twitter/user/timeline?username=${username}&type=Latest`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SOCIALDATA_API_KEY}`,
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`SocialData error for @${username} ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json() as { tweets: SocialDataTweet[] }
  const tweets = data.tweets ?? []

  return tweets.map((tweet): TweetStory => {
    const externalUrl = tweet.entities.urls.find(
      u => !u.expanded_url.includes('twitter.com') && !u.expanded_url.includes('x.com')
    )

    const url = externalUrl
      ? externalUrl.expanded_url
      : `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`

    const sourceDomain = externalUrl
      ? new URL(externalUrl.expanded_url).hostname.replace(/^www\./, '')
      : 'x.com'

    return {
      title: tweet.full_text.slice(0, 100),
      url,
      sourceDomain,
      rawContent: tweet.full_text,
      publishedAt: tweet.tweet_created_at,
      tweetAuthor: tweet.user.screen_name,
    }
  })
}

export async function fetchTweetsFromAccounts(usernames: string[]): Promise<TweetStory[]> {
  const results = await Promise.allSettled(usernames.map(u => fetchUserTweets(u)))

  results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .forEach(r => console.error('[socialdata]', r.reason instanceof Error ? r.reason.message : r.reason))

  return results
    .filter((r): r is PromiseFulfilledResult<TweetStory[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx jest lib/__tests__/socialdata.test.ts --no-coverage
```
Expected: PASS — 4 tests

**Step 5: Commit**

```bash
git add lib/socialdata.ts lib/__tests__/socialdata.test.ts
git commit -m "feat: add SocialData.tools client for Twitter account feed"
```

---

### Task 4: Wire Twitter feed into `fetchJob`

**Files:**
- Modify: `lib/jobs/fetchJob.ts`
- Modify: `lib/jobs/__tests__/fetchJob.test.ts`

**Step 1: Update `fetchJob.ts`**

Replace the imports block at the top:

```typescript
import { searchQueries } from '@/config/topics'
import { twitterUsernames } from '@/config/accounts'
import { fetchStoriesFromPerplexity, RawStory } from '../perplexity'
import { fetchTweetsFromAccounts, TweetStory } from '../socialdata'
import { scoreAndSummarizeStories } from '../claude'
import { deduplicateStories } from '../dedup'
import { prisma } from '../prisma'
```

Replace the Perplexity fetch block (the `Promise.allSettled` section and `allRaw` assembly) with one that runs both sources in parallel:

```typescript
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
```

Update the `prisma.story.createMany` call to include `tweetAuthor`. Replace the `data: scored.map(...)` block:

```typescript
        data: scored.map((s: { title: string; url: string; sourceDomain: string; rawContent: string; summary: string; score: number; category: string; publishedAt?: string; tweetAuthor?: string }) => ({
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
```

**Step 2: Update `fetchJob.test.ts` to mock `socialdata`**

Add to the top of the mock section:

```typescript
import * as socialdata from '../../socialdata'
jest.mock('../../socialdata')
```

In the `beforeEach` of the success test, add:

```typescript
;(socialdata.fetchTweetsFromAccounts as jest.Mock).mockResolvedValue([])
```

In the error test, also add:

```typescript
;(socialdata.fetchTweetsFromAccounts as jest.Mock).mockResolvedValue([])
```

**Step 3: Run all tests**

```bash
npx jest --no-coverage
```
Expected: all tests PASS

**Step 4: Commit**

```bash
git add lib/jobs/fetchJob.ts lib/jobs/__tests__/fetchJob.test.ts
git commit -m "feat: merge Twitter account feed into fetch pipeline"
```

---

### Task 5: Deploy and configure

**Step 1: Push to Railway**

```bash
git push
```

**Step 2: Add `SOCIALDATA_API_KEY` to Railway**

1. Go to [socialdata.tools](https://socialdata.tools) → sign up → copy your API key
2. Railway dashboard → your service → Variables → add:
   - `SOCIALDATA_API_KEY` = your key
3. Railway will auto-redeploy

**Step 3: Verify**

Click **Refresh now** on the live site. After it completes, stories from the curated accounts should appear alongside Perplexity stories. The "Last fetch" line should show a story count higher than before.

If there's a fetch error, check the Railway logs for lines starting with `[socialdata]`.

# Image Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract real images from tweets and article OG tags at fetch time; display them as left thumbnails in StoryCard and a full-bleed hero in StoryReader; fall back to a programmatic gradient when no image is found.

**Architecture:** Add `imageUrl String?` to the Prisma Story model. At fetch time, pull `extended_entities.media` from tweets (already in the SocialData response) and fetch `og:image` meta tags from article URLs with a 3-second timeout. Store the URL in the DB. On the frontend, render the image when present or compute a deterministic gradient from title + category when absent.

**Tech Stack:** Next.js 15, Prisma/PostgreSQL, TypeScript, Jest/ts-jest, Tailwind CSS v4.

---

## Context for implementer

The app is "The Signal" — an AI news aggregator. Stories come from two sources:
- **Perplexity** (`lib/perplexity.ts`) — article URLs, no image data returned
- **SocialData** (`lib/socialdata.ts`) — tweet objects that include `extended_entities.media` when the tweet has photos

The fetch pipeline in `lib/jobs/fetchJob.ts`:
1. Fetches from both sources in parallel
2. Deduplicates against existing DB URLs
3. Scores/summarises with Gemini (`lib/claude.ts`)
4. Saves to DB with `prisma.story.createMany`

The `RawStory` interface (in `lib/perplexity.ts`) is the base type that flows through the whole pipeline:
```typescript
export interface RawStory {
  title: string
  url: string
  sourceDomain: string
  rawContent: string
  publishedAt?: string
}
```

Tests live in `lib/__tests__/`. Run tests with `npx jest --no-coverage`. TypeScript check: `npx tsc --project tsconfig.json --noEmit`. One pre-existing test failure in `perplexity.test.ts` is expected — ignore it.

**Verification for every task:** `npx tsc --project tsconfig.json --noEmit` → 0 errors.

---

### Task 1: Schema + RawStory interface

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/perplexity.ts`

**Step 1: Add imageUrl to Prisma schema**

In `prisma/schema.prisma`, add one line to the Story model after `tweetAuthor`:

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
  imageUrl         String?   // ← ADD THIS LINE

  @@map("stories")
}
```

**Step 2: Push schema to database**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.`

**Step 3: Add imageUrl to RawStory interface**

In `lib/perplexity.ts`, update the interface:

```typescript
export interface RawStory {
  title: string
  url: string
  sourceDomain: string
  rawContent: string
  publishedAt?: string
  imageUrl?: string   // ← ADD THIS LINE
}
```

**Step 4: TypeScript check**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add prisma/schema.prisma lib/perplexity.ts
git commit -m "feat: add imageUrl field to Story model and RawStory interface"
```

---

### Task 2: OG image fetcher — lib/ogImage.ts (TDD)

**Files:**
- Create: `lib/ogImage.ts`
- Create: `lib/__tests__/ogImage.test.ts`

**Step 1: Write the failing tests**

Create `lib/__tests__/ogImage.test.ts`:

```typescript
import { fetchOgImage } from '../ogImage'

global.fetch = jest.fn()

describe('fetchOgImage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns og:image URL when property attribute comes first', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><head>
        <meta property="og:image" content="https://example.com/image.jpg" />
      </head></html>`,
    })
    expect(await fetchOgImage('https://example.com/article')).toBe('https://example.com/image.jpg')
  })

  it('returns og:image URL when content attribute comes first', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><head>
        <meta content="https://example.com/image2.jpg" property="og:image" />
      </head></html>`,
    })
    expect(await fetchOgImage('https://example.com/article')).toBe('https://example.com/image2.jpg')
  })

  it('falls back to twitter:image when og:image is absent', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><head>
        <meta name="twitter:image" content="https://example.com/twitter.jpg" />
      </head></html>`,
    })
    expect(await fetchOgImage('https://example.com/article')).toBe('https://example.com/twitter.jpg')
  })

  it('returns null when no image meta tags are present', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><head><title>No images</title></head></html>',
    })
    expect(await fetchOgImage('https://example.com/article')).toBeNull()
  })

  it('returns null on non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 })
    expect(await fetchOgImage('https://example.com/404')).toBeNull()
  })

  it('returns null when fetch throws (timeout or network error)', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('AbortError'))
    expect(await fetchOgImage('https://example.com/slow')).toBeNull()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx jest lib/__tests__/ogImage.test.ts --no-coverage`
Expected: FAIL — "Cannot find module '../ogImage'"

**Step 3: Implement lib/ogImage.ts**

Create `lib/ogImage.ts`:

```typescript
export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TheSignal/1.0)' },
    })
    clearTimeout(timeout)

    if (!response.ok) return null

    const html = await response.text()

    // og:image — both attribute orders
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (ogMatch?.[1]) return ogMatch[1]

    // twitter:image — both attribute orders
    const twitterMatch =
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
    if (twitterMatch?.[1]) return twitterMatch[1]

    return null
  } catch {
    return null
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest lib/__tests__/ogImage.test.ts --no-coverage`
Expected: 6/6 PASS

**Step 5: TypeScript check**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add lib/ogImage.ts lib/__tests__/ogImage.test.ts
git commit -m "feat: OG image fetcher with 3s timeout and regex meta-tag extraction"
```

---

### Task 3: Extract tweet media images in socialdata.ts

**Files:**
- Modify: `lib/socialdata.ts`
- Modify: `lib/__tests__/socialdata.test.ts`

**Step 1: Add failing test**

In `lib/__tests__/socialdata.test.ts`, add a new test after the existing ones:

```typescript
  it('extracts imageUrl from extended_entities photo media', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '333',
            full_text: 'Check out this chart',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: { urls: [] },
            extended_entities: {
              media: [
                { media_url_https: 'https://pbs.twimg.com/media/abc.jpg', type: 'photo' },
              ],
            },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].imageUrl).toBe('https://pbs.twimg.com/media/abc.jpg')
  })

  it('leaves imageUrl undefined when tweet has no media', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '444',
            full_text: 'Text only tweet',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: { urls: [] },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].imageUrl).toBeUndefined()
  })
```

**Step 2: Run tests to verify they fail**

Run: `npx jest lib/__tests__/socialdata.test.ts --no-coverage`
Expected: 2 new tests FAIL

**Step 3: Update SocialDataTweet interface and extraction logic**

In `lib/socialdata.ts`, update the `SocialDataTweet` interface and the mapping function:

```typescript
interface SocialDataTweet {
  id_str: string
  full_text: string
  tweet_created_at: string
  user: { screen_name: string }
  entities?: {
    urls?: Array<{ expanded_url: string; display_url: string }>
  }
  extended_entities?: {
    media?: Array<{ media_url_https: string; type: string }>
  }
}
```

In the `tweets.map((tweet): TweetStory => {` function, add imageUrl extraction. Replace the `return {` block at the end of the map function:

```typescript
    const photo = (tweet.extended_entities?.media ?? []).find(m => m.type === 'photo')

    return {
      title: tweet.full_text.slice(0, 100),
      url,
      sourceDomain,
      rawContent: tweet.full_text,
      publishedAt: tweet.tweet_created_at,
      tweetAuthor: tweet.user.screen_name,
      ...(photo ? { imageUrl: photo.media_url_https } : {}),
    }
```

**Step 4: Run tests to verify they pass**

Run: `npx jest lib/__tests__/socialdata.test.ts --no-coverage`
Expected: all 6 tests PASS

**Step 5: TypeScript check**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add lib/socialdata.ts lib/__tests__/socialdata.test.ts
git commit -m "feat: extract photo imageUrl from tweet extended_entities"
```

---

### Task 4: Wire OG image fetching into fetchJob.ts

**Files:**
- Modify: `lib/jobs/fetchJob.ts`

No new tests needed — this is orchestration glue. The unit-tested pieces (ogImage, socialdata) are already tested.

**Step 1: Add OG image fetching after deduplication**

In `lib/jobs/fetchJob.ts`, add the import at the top:

```typescript
import { fetchOgImage } from '../ogImage'
```

Then, after the `const newStories = deduplicateStories(allRaw, existingUrls)` line and before `if (newStories.length > 0)`, add:

```typescript
    // Fetch OG images for article stories that don't already have one
    const newStoriesWithImages = await Promise.all(
      newStories.map(async (s) => {
        if (s.imageUrl) return s
        const imageUrl = await fetchOgImage(s.url)
        return imageUrl ? { ...s, imageUrl } : s
      })
    )
```

Then replace `newStories` with `newStoriesWithImages` in the block below:

```typescript
    if (newStoriesWithImages.length > 0) {
      let scored: Awaited<ReturnType<typeof scoreAndSummarizeStories>>
      try {
        scored = await scoreAndSummarizeStories(newStoriesWithImages)
      } catch (err) {
        console.error('[fetchJob] Scoring unavailable, saving unscored stories:', err)
        scored = newStoriesWithImages.map(s => ({
          ...s,
          score: 5,
          summary: JSON.stringify([s.rawContent.slice(0, 120)]),
          category: 'Other',
        }))
      }
```

**Step 2: Pass imageUrl to prisma.story.createMany**

In the `prisma.story.createMany` call, add `imageUrl`:

```typescript
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
          imageUrl: s.imageUrl ?? null,   // ← ADD THIS LINE
        })),
        skipDuplicates: true,
      })
```

Also update the `storiesFound` reference and closing brace to match `newStoriesWithImages`:

```typescript
      storiesFound = scored.length
    }
```

**Step 3: TypeScript check**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 4: Run full test suite**

Run: `npx jest --no-coverage`
Expected: 20/21 pass (pre-existing perplexity failure only — not related to this work)

**Step 5: Commit**

```bash
git add lib/jobs/fetchJob.ts
git commit -m "feat: fetch OG images in parallel after dedup, store imageUrl in DB"
```

---

### Task 5: StoryCard — left thumbnail

**Files:**
- Modify: `app/components/StoryCard.tsx`

No automated tests — visual component. Verify with TypeScript check.

**Step 1: Replace app/components/StoryCard.tsx entirely**

```typescript
import { parseBullets } from '@/lib/parseBullets'

interface Story {
  id: string
  title: string
  url: string
  sourceDomain: string
  summary: string | null
  score: number | null
  category: string | null
  fetchedAt: string
  tweetAuthor?: string | null
  imageUrl?: string | null
}

function getPlaceholderGradient(title: string, category: string | null): string {
  let hash = 5381
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) + hash + title.charCodeAt(i)) & 0x7fffffff
  }
  const angle = hash % 360
  const palettes: Record<string, [string, string]> = {
    'Model Releases': ['#C8102E', '#7a0a1a'],
    'Research':       ['#1a3a6b', '#2d5fa0'],
    'AI Policy':      ['#1a5c2d', '#2e9e50'],
    'Industry':       ['#6b3a1a', '#a05e2d'],
    'AI Safety':      ['#3d1a6b', '#6b2ea0'],
    'AI Agents':      ['#1a4f6b', '#2d8aa0'],
    'Other':          ['#3a3532', '#6b6560'],
  }
  const [c1, c2] = palettes[category ?? 'Other'] ?? palettes['Other']
  return `linear-gradient(${angle}deg, ${c1}, ${c2})`
}

export function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const score = story.score ?? 0
  const bullets = parseBullets(story.summary)
  const isHighScore = score >= 8
  const timeStr = new Date(story.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <article
      className="group relative py-5 border-b border-rule cursor-pointer pl-0 hover:pl-4 transition-[padding] duration-200 flex gap-4 items-start"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {/* Red left accent — scales in on hover */}
      <div
        className="absolute left-0 top-5 bottom-5 w-[3px] bg-accent scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top"
        aria-hidden="true"
      />

      {/* Thumbnail */}
      <div className="shrink-0 w-20 h-20 rounded-sm overflow-hidden mt-0.5">
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: getPlaceholderGradient(story.title, story.category) }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Headline + score row */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="flex-1 font-display text-[1.15rem] font-bold leading-snug text-ink group-hover:text-accent transition-colors duration-200">
            {story.title}
          </h2>
          <span
            className={`shrink-0 font-label text-sm font-medium tabular-nums ${isHighScore ? 'text-accent' : 'text-muted'}`}
            aria-label={`Score: ${score.toFixed(1)}`}
          >
            {score.toFixed(1)}
          </span>
        </div>

        {/* Thin rule under headline */}
        <div className="mt-2 mb-3 border-t border-rule" aria-hidden="true" />

        {/* Bullets */}
        {bullets.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {bullets.map((b, i) => (
              <li key={i} className="font-body text-sm text-ink leading-relaxed flex gap-2">
                <span className="text-muted shrink-0 mt-0.5" aria-hidden="true">·</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Metadata footer */}
        <div className="font-label text-xs text-muted tracking-wide flex flex-wrap gap-x-3 gap-y-1">
          <span>{story.sourceDomain}</span>
          {story.tweetAuthor && <span>@{story.tweetAuthor}</span>}
          {story.category && <span className="uppercase tracking-widest">{story.category}</span>}
          <span>{timeStr}</span>
        </div>
      </div>
    </article>
  )
}
```

**Step 2: TypeScript check**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/components/StoryCard.tsx
git commit -m "feat: left thumbnail on StoryCard — real image or gradient placeholder"
```

---

### Task 6: StoryReader — full-bleed hero band

**Files:**
- Modify: `app/components/StoryReader.tsx`

**Step 1: Add imageUrl to Story interface and import getPlaceholderGradient**

The `getPlaceholderGradient` function should live in a shared utility so both StoryCard and StoryReader can use it without duplication. Move it to a new file first.

Create `lib/placeholderGradient.ts`:

```typescript
export function getPlaceholderGradient(title: string, category: string | null): string {
  let hash = 5381
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) + hash + title.charCodeAt(i)) & 0x7fffffff
  }
  const angle = hash % 360
  const palettes: Record<string, [string, string]> = {
    'Model Releases': ['#C8102E', '#7a0a1a'],
    'Research':       ['#1a3a6b', '#2d5fa0'],
    'AI Policy':      ['#1a5c2d', '#2e9e50'],
    'Industry':       ['#6b3a1a', '#a05e2d'],
    'AI Safety':      ['#3d1a6b', '#6b2ea0'],
    'AI Agents':      ['#1a4f6b', '#2d8aa0'],
    'Other':          ['#3a3532', '#6b6560'],
  }
  const [c1, c2] = palettes[category ?? 'Other'] ?? palettes['Other']
  return `linear-gradient(${angle}deg, ${c1}, ${c2})`
}
```

Then update `app/components/StoryCard.tsx` to import from the shared utility instead of using the inline function — replace the inline `getPlaceholderGradient` function definition with:

```typescript
import { getPlaceholderGradient } from '@/lib/placeholderGradient'
```

And delete the `function getPlaceholderGradient(...)` definition from StoryCard.tsx.

**Step 2: Update StoryReader.tsx**

Replace the entire `return (...)` block in `app/components/StoryReader.tsx` (lines 79 onwards) with:

```typescript
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col select-none"
      style={{ background: '#111009', color: '#F2EFE8' }}
      role="dialog"
      aria-modal="true"
      aria-label={story.title}
      tabIndex={-1}
      onClick={handleTap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress bars — red fill for current and previous */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-3 pt-3 pb-1">
        {stories.map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1 rounded-full transition-colors"
            style={{
              background: i <= index ? '#C8102E' : 'rgba(242,239,232,0.2)',
            }}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        className="absolute top-2 right-3 z-10 p-2 text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-sm"
        style={{ color: 'rgba(242,239,232,0.5)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#F2EFE8')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(242,239,232,0.5)')}
        onFocus={(e) => (e.currentTarget.style.color = '#F2EFE8')}
        onBlur={(e) => (e.currentTarget.style.color = 'rgba(242,239,232,0.5)')}
        onClick={(e) => { e.stopPropagation(); onCloseRef.current() }}
        aria-label="Close reader"
      >
        ✕
      </button>

      {/* Hero image / gradient */}
      <div className="relative h-[42vh] shrink-0 overflow-hidden">
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: getPlaceholderGradient(story.title, story.category) }}
            aria-hidden="true"
          />
        )}
        {/* Fade to dark at bottom */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 30%, #111009)' }}
          aria-hidden="true"
        />
      </div>

      {/* Story content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-8 max-w-lg mx-auto w-full">
        {/* Source + author */}
        <p className="font-label text-xs tracking-widest uppercase mb-3" style={{ color: 'rgba(242,239,232,0.45)' }}>
          {story.sourceDomain}
          {story.tweetAuthor && <span className="ml-3">@{story.tweetAuthor}</span>}
        </p>

        {/* Headline */}
        <h2 className="font-display text-3xl font-bold leading-tight mb-6" style={{ color: '#F2EFE8' }}>
          {story.title}
        </h2>

        {/* Bullets */}
        <ul className="space-y-4">
          {bullets.map((b, i) => (
            <li key={i} className="font-body text-base leading-relaxed flex gap-3" style={{ color: 'rgba(242,239,232,0.85)' }}>
              <span style={{ color: '#C8102E' }} className="shrink-0 mt-0.5" aria-hidden="true">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Read full article */}
        <div className="mt-8 flex justify-center">
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-xs tracking-widest uppercase px-6 py-2.5 transition-colors"
            style={{
              border: '1px solid rgba(242,239,232,0.25)',
              borderRadius: '2px',
              color: 'rgba(242,239,232,0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            READ FULL ARTICLE →
          </a>
        </div>
      </div>
    </div>
  )
```

Also add `imageUrl?: string | null` to the `Story` interface at the top of `StoryReader.tsx`, and add the import:

```typescript
import { getPlaceholderGradient } from '@/lib/placeholderGradient'
```

**Step 3: TypeScript check**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 4: Run full test suite**

Run: `npx jest --no-coverage`
Expected: 20/21 pass (pre-existing perplexity failure only)

**Step 5: Commit**

```bash
git add lib/placeholderGradient.ts app/components/StoryCard.tsx app/components/StoryReader.tsx
git commit -m "feat: hero band in StoryReader, shared gradient util, imageUrl on Story interfaces"
```

---

### Task 7: Push to Railway

**Step 1: Push**

```bash
git push origin main
```

**Step 2: Verify deployment**

Check Railway logs — the next scheduled fetch (or a manual Refresh in the app) will start populating `imageUrl` for new stories. Existing stories in the DB will have `imageUrl = null` and will show gradient placeholders until they are re-fetched.

---

## Verification checklist after all tasks

- [ ] `npx tsc --project tsconfig.json --noEmit` → 0 errors
- [ ] `npx jest --no-coverage` → 20/21 (pre-existing failure only)
- [ ] `git log --oneline -7` shows 7 new commits
- [ ] Hit Refresh in the app — stories with tweets that have photos show real images
- [ ] Stories without images show the category-coloured gradient placeholder
- [ ] Gradient is consistent for the same story (same title → same gradient every time)
- [ ] StoryReader hero fills ~40% of screen height
- [ ] Progress bars and close button are visible above the hero image

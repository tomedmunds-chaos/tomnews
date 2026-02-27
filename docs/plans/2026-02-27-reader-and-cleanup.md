# Story Reader & Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-delete stories older than 3 days, replace single-sentence summaries with up-to-3 bullet points from Gemini, and add an Instagram Stories-style full-screen reader.

**Architecture:** Cleanup runs at the top of `runFetchJob`. Gemini prompt is updated to return `bullets: string[]`, serialised as a JSON string in the existing `summary` column (no schema change). A new `parseBullets` utility deserialises bullets in the UI. A new `StoryReader` overlay opens when any card is tapped, showing bullets and a "Read full article" link.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Prisma, Gemini (`@google/generative-ai`), Jest.

---

### Task 1: 3-day cleanup in fetchJob

**Files:**
- Modify: `lib/jobs/fetchJob.ts`
- Modify: `lib/jobs/__tests__/fetchJob.test.ts`

**Step 1: Write a failing test for cleanup**

In `lib/jobs/__tests__/fetchJob.test.ts`, add `deleteMany: jest.fn()` to the prisma story mock:

```typescript
jest.mock('../../prisma', () => ({
  prisma: {
    story: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    fetchLog: {
      create: jest.fn(),
    },
  },
}))
```

Add this new test inside the `describe` block:

```typescript
it('deletes stories older than 3 days before fetching', async () => {
  ;(perplexity.fetchStoriesFromPerplexity as jest.Mock).mockResolvedValue([])
  ;(socialdata.fetchTweetsFromAccounts as jest.Mock).mockResolvedValue([])
  ;(prisma.story.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.story.deleteMany as jest.Mock).mockResolvedValue({ count: 2 })
  ;(prisma.fetchLog.create as jest.Mock).mockResolvedValue({})

  await runFetchJob()

  expect(prisma.story.deleteMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ fetchedAt: expect.objectContaining({ lt: expect.any(Date) }) }),
    })
  )
})
```

**Step 2: Run test to confirm it fails**

```bash
npx jest lib/jobs/__tests__/fetchJob.test.ts --no-coverage
```
Expected: FAIL — `deleteMany is not a function` or `expect(jest.fn()).toHaveBeenCalledWith` failure.

**Step 3: Add cleanup to fetchJob.ts**

At the very start of the `try` block in `runFetchJob` (before `findMany`), add:

```typescript
    // Delete stories older than 3 days
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    await prisma.story.deleteMany({ where: { fetchedAt: { lt: cutoff } } })
```

**Step 4: Run tests to confirm they pass**

```bash
npx jest lib/jobs/__tests__/fetchJob.test.ts --no-coverage
```
Expected: all tests PASS.

**Step 5: Commit**

```bash
git add lib/jobs/fetchJob.ts lib/jobs/__tests__/fetchJob.test.ts
git commit -m "feat: delete stories older than 3 days at start of fetch job"
```

---

### Task 2: Update Gemini scoring to return bullet arrays

**Files:**
- Modify: `lib/claude.ts`
- Modify: `lib/__tests__/claude.test.ts`

**Step 1: Rewrite claude.test.ts to mock Gemini (not Anthropic)**

The existing test mocks `@anthropic-ai/sdk` which is no longer used. Replace the entire file:

```typescript
import { scoreAndSummarizeStories } from '../claude'
import { GoogleGenerativeAI } from '@google/generative-ai'

jest.mock('@google/generative-ai')

const mockGenerateContent = jest.fn()
;(GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(() => ({
  getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
} as unknown as GoogleGenerativeAI))

describe('scoreAndSummarizeStories', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns scored stories with JSON-serialised bullet summary', async () => {
    const input = [{
      title: 'Anthropic releases Claude 4',
      url: 'https://anthropic.com/claude4',
      sourceDomain: 'anthropic.com',
      rawContent: 'Anthropic today released...',
    }]

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify([{
          url: 'https://anthropic.com/claude4',
          score: 9.2,
          bullets: ['Claude 4 released by Anthropic', 'Major capability improvements', 'Available via API now'],
          category: 'Model Releases',
        }]),
      },
    })

    const result = await scoreAndSummarizeStories(input)

    expect(result).toHaveLength(1)
    expect(result[0].score).toBe(9.2)
    expect(result[0].summary).toBe('["Claude 4 released by Anthropic","Major capability improvements","Available via API now"]')
    expect(result[0].category).toBe('Model Releases')
  })

  it('falls back to raw content as single-bullet JSON on parse error', async () => {
    const input = [{
      title: 'Some story',
      url: 'https://example.com',
      sourceDomain: 'example.com',
      rawContent: 'Story content here',
    }]

    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => 'not valid json at all' },
    })

    const result = await scoreAndSummarizeStories(input)
    expect(result[0].summary).toBe(JSON.stringify(['Story content here'.slice(0, 120)]))
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
npx jest lib/__tests__/claude.test.ts --no-coverage
```
Expected: FAIL (wrong mock or wrong summary format).

**Step 3: Update lib/claude.ts**

Replace `SCORING_PROMPT` with:

```typescript
const SCORING_PROMPT = `You are an AI news editor. Score each story for importance to the AI/ML community.

Return a JSON array where each item has:
- url: (same as input)
- score: number 1-10 (10 = groundbreaking, 7 = notable, 4 = routine, 1 = trivial/noise)
- bullets: array of up to 3 short bullet points explaining what happened and why it matters
- category: one of: ${VALID_CATEGORIES.join(', ')}

Scoring guide:
- 9-10: Major model releases, significant safety findings, landmark policy
- 7-8: New research papers with clear impact, company pivots, notable funding
- 5-6: Minor releases, incremental research, general industry news
- 1-4: Opinion pieces, minor updates, duplicates of already-known news

Return ONLY the JSON array, no other text.`
```

Update the parsing inside `scoreAndSummarizeStories`. Replace the `JSON.parse` line and `return stories.map(...)`:

```typescript
  const scored = JSON.parse(cleaned) as Array<{ url: string; score: number; bullets: string[]; category: string }>

  return stories.map(story => {
    const scoring = scored.find(s => s.url === story.url)
    const bullets = scoring?.bullets?.slice(0, 3) ?? []
    return {
      ...story,
      score: scoring?.score ?? 5,
      summary: bullets.length > 0
        ? JSON.stringify(bullets)
        : JSON.stringify([story.rawContent.slice(0, 120)]),
      category: scoring?.category ?? 'Other',
    }
  })
```

Also update the fallback in `lib/jobs/fetchJob.ts` (the catch block inside the scoring try/catch) so unscored stories also use JSON format:

```typescript
        scored = newStories.map(s => ({
          ...s,
          score: 5,
          summary: JSON.stringify([s.rawContent.slice(0, 120)]),
          category: 'Other',
        }))
```

**Step 4: Run tests to confirm they pass**

```bash
npx jest lib/__tests__/claude.test.ts --no-coverage
```
Expected: 2 tests PASS.

**Step 5: Run all tests**

```bash
npx jest --no-coverage
```
Expected: only the pre-existing `perplexity.test.ts` failure remains (mock missing `.text()` — unrelated to this feature).

**Step 6: Commit**

```bash
git add lib/claude.ts lib/__tests__/claude.test.ts lib/jobs/fetchJob.ts
git commit -m "feat: update Gemini prompt to return bullet array summaries"
```

---

### Task 3: parseBullets utility

**Files:**
- Create: `lib/parseBullets.ts`
- Create: `lib/__tests__/parseBullets.test.ts`

**Step 1: Write failing tests**

Create `lib/__tests__/parseBullets.test.ts`:

```typescript
import { parseBullets } from '../parseBullets'

describe('parseBullets', () => {
  it('parses a JSON array of strings', () => {
    const result = parseBullets('["Point one","Point two","Point three"]')
    expect(result).toEqual(['Point one', 'Point two', 'Point three'])
  })

  it('returns a single-item array for plain text (legacy summaries)', () => {
    const result = parseBullets('This is a plain text summary.')
    expect(result).toEqual(['This is a plain text summary.'])
  })

  it('returns empty array for null', () => {
    expect(parseBullets(null)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseBullets('')).toEqual([])
  })

  it('filters out non-string values from parsed array', () => {
    const result = parseBullets('["valid", 42, null, "also valid"]')
    expect(result).toEqual(['valid', 'also valid'])
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
npx jest lib/__tests__/parseBullets.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../parseBullets'`

**Step 3: Implement lib/parseBullets.ts**

```typescript
export function parseBullets(summary: string | null): string[] {
  if (!summary) return []
  try {
    const parsed = JSON.parse(summary)
    if (Array.isArray(parsed)) {
      return parsed.filter((b): b is string => typeof b === 'string')
    }
  } catch {
    // not JSON — treat as legacy plain-text summary
  }
  return [summary]
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx jest lib/__tests__/parseBullets.test.ts --no-coverage
```
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add lib/parseBullets.ts lib/__tests__/parseBullets.test.ts
git commit -m "feat: add parseBullets utility for JSON bullet summaries"
```

---

### Task 4: Update StoryCard to show bullets and support onClick

**Files:**
- Modify: `app/components/StoryCard.tsx`

**Step 1: Update StoryCard.tsx**

Replace the entire file:

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
}

export function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const score = story.score ?? 0
  const scoreColor = score >= 8 ? 'bg-green-100 text-green-800' : score >= 6 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
  const bullets = parseBullets(story.summary)

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 line-clamp-2">{story.title}</p>
          {bullets.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {bullets.map((b, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-1.5">
                  <span className="text-gray-400 shrink-0">•</span>
                  <span className="line-clamp-2">{b}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>{story.sourceDomain}</span>
            {story.tweetAuthor && (
              <>
                <span>·</span>
                <span>@{story.tweetAuthor}</span>
              </>
            )}
            <span>·</span>
            <span>{new Date(story.fetchedAt).toLocaleTimeString()}</span>
            {story.category && (
              <>
                <span>·</span>
                <span className="text-gray-500">{story.category}</span>
              </>
            )}
          </div>
        </div>
        <span className={`shrink-0 text-sm font-bold px-2 py-1 rounded ${scoreColor}`}>
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors (or only pre-existing errors unrelated to StoryCard).

**Step 3: Commit**

```bash
git add app/components/StoryCard.tsx
git commit -m "feat: show bullet points and tweetAuthor in StoryCard"
```

---

### Task 5: Create StoryReader overlay

**Files:**
- Create: `app/components/StoryReader.tsx`

**Step 1: Create app/components/StoryReader.tsx**

```typescript
'use client'

import { useEffect, useState, useRef } from 'react'
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
}

export function StoryReader({
  stories,
  initialIndex,
  onClose,
}: {
  stories: Story[]
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const story = stories[index]
  const bullets = parseBullets(story.summary)

  function prev() { setIndex(i => Math.max(0, i - 1)) }
  function next() { setIndex(i => Math.min(stories.length - 1, i + 1)) }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const x = e.clientX
    const width = (e.currentTarget as HTMLDivElement).offsetWidth
    if (x < width / 3) prev()
    else next()
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > 60) onClose()
      return
    }
    if (Math.abs(dx) > 30) {
      if (dx < 0) next()
      else prev()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-950 text-white flex flex-col select-none"
      onClick={handleTap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3 pb-1">
        {stories.map((_, i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 rounded-full transition-colors ${i <= index ? 'bg-white' : 'bg-white/25'}`}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        className="absolute top-2 right-3 text-white/60 hover:text-white p-2 text-lg leading-none"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close reader"
      >
        ✕
      </button>

      {/* Story content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-lg mx-auto w-full overflow-hidden">
        <p className="text-sm text-white/40 mb-1">
          {story.sourceDomain}
          {story.tweetAuthor && <span className="ml-2">via @{story.tweetAuthor}</span>}
        </p>
        <h2 className="text-2xl font-bold leading-tight mb-6">{story.title}</h2>
        <ul className="space-y-4">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-3 text-white/80 text-base leading-relaxed">
              <span className="text-white/30 mt-1 shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Read full article link */}
      <div className="px-6 pb-8 flex justify-center">
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm border border-white/25 rounded-full px-6 py-2.5 hover:bg-white/10 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Read full article →
        </a>
      </div>
    </div>
  )
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

**Step 3: Commit**

```bash
git add app/components/StoryReader.tsx
git commit -m "feat: add StoryReader full-screen overlay with swipe navigation"
```

---

### Task 6: Wire StoryReader into page.tsx

**Files:**
- Modify: `app/page.tsx`

**Step 1: Update page.tsx**

Replace the entire file:

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { StoryCard } from './components/StoryCard'
import { StoryReader } from './components/StoryReader'
import { TopicFilter } from './components/TopicFilter'
import { StatusHeader } from './components/StatusHeader'

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
}

export default function Home() {
  const [stories, setStories] = useState<Story[]>([])
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [readerIndex, setReaderIndex] = useState<number | null>(null)

  const loadStories = useCallback(async () => {
    setLoading(true)
    const params = category !== 'All' ? `?category=${encodeURIComponent(category)}` : ''
    const res = await fetch(`/api/stories${params}`)
    const data = await res.json()
    setStories(data)
    setLoading(false)
  }, [category])

  useEffect(() => { loadStories() }, [loadStories])

  return (
    <>
      {readerIndex !== null && (
        <StoryReader
          stories={stories}
          initialIndex={readerIndex}
          onClose={() => setReaderIndex(null)}
        />
      )}
      <main className="max-w-2xl mx-auto px-4 pb-16">
        <StatusHeader onRefresh={loadStories} />
        <div className="mt-2 text-right">
          <a href="/digests" className="text-sm text-gray-400 hover:text-gray-700">Digest history →</a>
        </div>
        <div className="mt-4 mb-4">
          <TopicFilter selected={category} onChange={setCategory} />
        </div>
        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading stories...</div>
        ) : stories.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No stories yet. Hit Refresh to fetch.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {stories.map((story, i) => (
              <StoryCard
                key={story.id}
                story={story}
                onClick={() => setReaderIndex(i)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
```

**Step 2: Check the stories API returns tweetAuthor**

Read `app/api/stories/route.ts`. If `tweetAuthor` is not included in the select/response, add it. It should return all fields the Story interface needs.

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

**Step 4: Run all tests**

```bash
npx jest --no-coverage
```
Expected: all tests pass (pre-existing `perplexity.test.ts` failure is unrelated and can be ignored).

**Step 5: Commit and push**

```bash
git add app/page.tsx
git commit -m "feat: wire StoryReader into main page"
git push
```

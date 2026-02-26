# AI News Aggregator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal web app that fetches AI news every 3 hours via Perplexity, scores stories with Claude, displays them in a ranked dashboard, and sends a daily 8am TL;DR email digest.

**Architecture:** Next.js 14 App Router app with a custom Node.js server that runs two node-cron jobs (fetch + digest). Perplexity Sonar API sources stories, Claude scores/summarizes them, Resend delivers email. Postgres via Prisma on Railway.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Postgres, Perplexity API, Claude API (claude-sonnet-4-6), Resend, node-cron, Tailwind CSS, Jest, Railway

---

## Prerequisites

You will need API keys for:
- Perplexity API — https://www.perplexity.ai/settings/api
- Anthropic API — https://console.anthropic.com/
- Resend — https://resend.com/

---

### Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.gitignore`

**Step 1: Create Next.js app**

```bash
cd /Users/tomedmunds/Documents/my-first-project
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

**Step 2: Install dependencies**

```bash
npm install @prisma/client prisma node-cron @anthropic-ai/sdk resend
npm install --save-dev jest @types/jest @types/node-cron ts-jest jest-environment-node
```

**Step 3: Create `.env.example`**

```
DATABASE_URL="postgresql://user:password@localhost:5432/ainews"
ANTHROPIC_API_KEY=""
PERPLEXITY_API_KEY=""
RESEND_API_KEY=""
DIGEST_EMAIL_RECIPIENT=""
APP_PASSWORD=""
```

Copy to `.env.local` and fill in values.

**Step 4: Configure Jest — create `jest.config.ts`**

```ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathPattern: '.*\\.test\\.ts$',
}

export default config
```

**Step 5: Add test script to `package.json`**

Add to the `scripts` section:
```json
"test": "jest",
"test:watch": "jest --watch"
```

**Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with dependencies"
```

Expected: clean git history, `node_modules` ignored.

---

### Task 2: Prisma schema and database setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/` (auto-generated)

**Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

**Step 2: Replace `prisma/schema.prisma` with**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

  @@map("stories")
}

model Digest {
  id        String   @id @default(cuid())
  sentAt    DateTime @default(now())
  emailHtml String
  storyIds  String[]

  @@map("digests")
}

model FetchLog {
  id            String   @id @default(cuid())
  ranAt         DateTime @default(now())
  storiesFound  Int      @default(0)
  status        String
  error         String?

  @@map("fetch_logs")
}
```

**Step 3: Create and run migration**

```bash
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/` folder created, tables created in DB.

**Step 4: Create Prisma client singleton — `lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 5: Commit**

```bash
git add prisma/ lib/prisma.ts
git commit -m "feat: add Prisma schema with stories, digests, fetch_logs"
```

---

### Task 3: Configuration file

**Files:**
- Create: `config/topics.ts`

**Step 1: Create `config/topics.ts`**

```ts
export const searchQueries = [
  'AI model release announcement site:openai.com OR site:anthropic.com OR site:deepmind.com OR site:mistral.ai',
  'large language model research paper 2026',
  'AI policy regulation news 2026',
  'artificial intelligence industry news today',
  'AI agent autonomous systems 2026',
  'AI safety alignment research',
]

export const digestConfig = {
  fetchCron: '0 */3 * * *',   // every 3 hours
  digestCron: '0 8 * * *',    // 8am daily
  topStoriesPerDigest: 8,
  minScoreForDigest: 7,
  emailRecipient: process.env.DIGEST_EMAIL_RECIPIENT ?? '',
}
```

**Step 2: Commit**

```bash
git add config/topics.ts
git commit -m "feat: add topic search queries and digest config"
```

---

### Task 4: Perplexity service

**Files:**
- Create: `lib/perplexity.ts`
- Create: `lib/__tests__/perplexity.test.ts`

**Step 1: Write the failing test — `lib/__tests__/perplexity.test.ts`**

```ts
import { fetchStoriesFromPerplexity } from '../perplexity'

// Mock fetch globally
global.fetch = jest.fn()

describe('fetchStoriesFromPerplexity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns parsed stories from Perplexity response', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify([
            {
              title: 'OpenAI releases GPT-5',
              url: 'https://openai.com/blog/gpt5',
              sourceDomain: 'openai.com',
              rawContent: 'OpenAI today announced GPT-5...',
              publishedAt: '2026-02-26T08:00:00Z',
            }
          ])
        }
      }]
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const stories = await fetchStoriesFromPerplexity('AI model release')

    expect(stories).toHaveLength(1)
    expect(stories[0].title).toBe('OpenAI releases GPT-5')
    expect(stories[0].url).toBe('https://openai.com/blog/gpt5')
  })

  it('returns empty array when API call fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 })

    const stories = await fetchStoriesFromPerplexity('AI news')

    expect(stories).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx jest lib/__tests__/perplexity.test.ts -v
```

Expected: FAIL — "Cannot find module '../perplexity'"

**Step 3: Implement `lib/perplexity.ts`**

```ts
export interface RawStory {
  title: string
  url: string
  sourceDomain: string
  rawContent: string
  publishedAt?: string
}

const SYSTEM_PROMPT = `You are a news extraction assistant. Given a search query about AI news,
return a JSON array of the most relevant, distinct news stories from the last 24 hours.
Each item must have: title, url, sourceDomain, rawContent (2-3 sentence summary), publishedAt (ISO string if known).
Return ONLY the JSON array, no other text. Maximum 5 stories per query.`

export async function fetchStoriesFromPerplexity(query: string): Promise<RawStory[]> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Find the latest AI news stories for: ${query}` },
        ],
        return_citations: true,
      }),
    })

    if (!response.ok) {
      console.error(`Perplexity API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? '[]'

    // Strip markdown code fences if present
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned) as RawStory[]
  } catch (err) {
    console.error('fetchStoriesFromPerplexity error:', err)
    return []
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx jest lib/__tests__/perplexity.test.ts -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/perplexity.ts lib/__tests__/perplexity.test.ts
git commit -m "feat: add Perplexity story fetching service"
```

---

### Task 5: Claude scoring service

**Files:**
- Create: `lib/claude.ts`
- Create: `lib/__tests__/claude.test.ts`

**Step 1: Write the failing test — `lib/__tests__/claude.test.ts`**

```ts
import { scoreAndSummarizeStories } from '../claude'
import Anthropic from '@anthropic-ai/sdk'

jest.mock('@anthropic-ai/sdk')

const mockCreate = jest.fn()
;(Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
  messages: { create: mockCreate },
} as unknown as Anthropic))

describe('scoreAndSummarizeStories', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns scored and categorized stories', async () => {
    const input = [{
      title: 'Anthropic releases Claude 4',
      url: 'https://anthropic.com/claude4',
      sourceDomain: 'anthropic.com',
      rawContent: 'Anthropic today released...',
    }]

    mockCreate.mockResolvedValueOnce({
      content: [{
        text: JSON.stringify([{
          url: 'https://anthropic.com/claude4',
          score: 9.2,
          summary: 'Anthropic released Claude 4 with major capability improvements.',
          category: 'Model Releases',
        }])
      }]
    })

    const result = await scoreAndSummarizeStories(input)

    expect(result).toHaveLength(1)
    expect(result[0].score).toBe(9.2)
    expect(result[0].summary).toBe('Anthropic released Claude 4 with major capability improvements.')
    expect(result[0].category).toBe('Model Releases')
  })

  it('returns empty array on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'))
    const result = await scoreAndSummarizeStories([])
    expect(result).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx jest lib/__tests__/claude.test.ts -v
```

Expected: FAIL — "Cannot find module '../claude'"

**Step 3: Implement `lib/claude.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk'
import type { RawStory } from './perplexity'

const client = new Anthropic()

export interface ScoredStory extends RawStory {
  score: number
  summary: string
  category: string
}

const VALID_CATEGORIES = [
  'Model Releases',
  'Research',
  'AI Policy',
  'Industry',
  'AI Safety',
  'AI Agents',
  'Other',
]

const SCORING_PROMPT = `You are an AI news editor. Score each story for importance to the AI/ML community.

Return a JSON array where each item has:
- url: (same as input)
- score: number 1-10 (10 = groundbreaking, 7 = notable, 4 = routine, 1 = trivial/noise)
- summary: one clear sentence explaining what happened and why it matters
- category: one of: ${VALID_CATEGORIES.join(', ')}

Scoring guide:
- 9-10: Major model releases, significant safety findings, landmark policy
- 7-8: New research papers with clear impact, company pivots, notable funding
- 5-6: Minor releases, incremental research, general industry news
- 1-4: Opinion pieces, minor updates, duplicates of already-known news

Return ONLY the JSON array, no other text.`

export async function scoreAndSummarizeStories(stories: RawStory[]): Promise<ScoredStory[]> {
  if (stories.length === 0) return []

  try {
    const storiesJson = JSON.stringify(stories.map(s => ({
      title: s.title,
      url: s.url,
      sourceDomain: s.sourceDomain,
      rawContent: s.rawContent,
    })))

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `${SCORING_PROMPT}\n\nStories to score:\n${storiesJson}`,
      }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()
    const scored = JSON.parse(cleaned) as Array<{ url: string; score: number; summary: string; category: string }>

    return stories.map(story => {
      const scoring = scored.find(s => s.url === story.url)
      return {
        ...story,
        score: scoring?.score ?? 5,
        summary: scoring?.summary ?? story.rawContent.slice(0, 120),
        category: scoring?.category ?? 'Other',
      }
    })
  } catch (err) {
    console.error('scoreAndSummarizeStories error:', err)
    return []
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx jest lib/__tests__/claude.test.ts -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/claude.ts lib/__tests__/claude.test.ts
git commit -m "feat: add Claude scoring and summarization service"
```

---

### Task 6: Story deduplication utility

**Files:**
- Create: `lib/dedup.ts`
- Create: `lib/__tests__/dedup.test.ts`

**Step 1: Write the failing test — `lib/__tests__/dedup.test.ts`**

```ts
import { deduplicateStories } from '../dedup'
import type { RawStory } from '../perplexity'

describe('deduplicateStories', () => {
  const existing = ['https://openai.com/blog/gpt5', 'https://anthropic.com/news']

  it('filters out stories with URLs already in existingUrls', () => {
    const incoming: RawStory[] = [
      { title: 'GPT-5', url: 'https://openai.com/blog/gpt5', sourceDomain: 'openai.com', rawContent: '...' },
      { title: 'New Model', url: 'https://mistral.ai/news', sourceDomain: 'mistral.ai', rawContent: '...' },
    ]
    const result = deduplicateStories(incoming, existing)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://mistral.ai/news')
  })

  it('returns all stories when no existing URLs', () => {
    const incoming: RawStory[] = [
      { title: 'New Story', url: 'https://new.com', sourceDomain: 'new.com', rawContent: '...' },
    ]
    expect(deduplicateStories(incoming, [])).toHaveLength(1)
  })

  it('deduplicates within the incoming batch itself', () => {
    const incoming: RawStory[] = [
      { title: 'Story A', url: 'https://same.com', sourceDomain: 'same.com', rawContent: '...' },
      { title: 'Story A duplicate', url: 'https://same.com', sourceDomain: 'same.com', rawContent: '...' },
    ]
    expect(deduplicateStories(incoming, [])).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx jest lib/__tests__/dedup.test.ts -v
```

Expected: FAIL

**Step 3: Implement `lib/dedup.ts`**

```ts
import type { RawStory } from './perplexity'

export function deduplicateStories(incoming: RawStory[], existingUrls: string[]): RawStory[] {
  const seen = new Set(existingUrls)
  const result: RawStory[] = []

  for (const story of incoming) {
    if (!seen.has(story.url)) {
      seen.add(story.url)
      result.push(story)
    }
  }

  return result
}
```

**Step 4: Run test to verify it passes**

```bash
npx jest lib/__tests__/dedup.test.ts -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/dedup.ts lib/__tests__/dedup.test.ts
git commit -m "feat: add story deduplication utility"
```

---

### Task 7: Fetch job

**Files:**
- Create: `lib/jobs/fetchJob.ts`
- Create: `lib/jobs/__tests__/fetchJob.test.ts`

**Step 1: Write the failing test — `lib/jobs/__tests__/fetchJob.test.ts`**

```ts
import { runFetchJob } from '../fetchJob'
import * as perplexity from '../../perplexity'
import * as claude from '../../claude'
import { prisma } from '../../prisma'

jest.mock('../../perplexity')
jest.mock('../../claude')
jest.mock('../../prisma', () => ({
  prisma: {
    story: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    fetchLog: {
      create: jest.fn(),
    },
  },
}))

describe('runFetchJob', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fetches, scores, deduplicates, and saves new stories', async () => {
    ;(perplexity.fetchStoriesFromPerplexity as jest.Mock).mockResolvedValue([
      { title: 'New AI Story', url: 'https://new.ai/story', sourceDomain: 'new.ai', rawContent: 'content' },
    ])
    ;(claude.scoreAndSummarizeStories as jest.Mock).mockResolvedValue([
      { title: 'New AI Story', url: 'https://new.ai/story', sourceDomain: 'new.ai', rawContent: 'content', score: 8, summary: 'A new AI story.', category: 'Research' },
    ])
    ;(prisma.story.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.story.createMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.fetchLog.create as jest.Mock).mockResolvedValue({})

    const result = await runFetchJob()

    expect(result.storiesFound).toBeGreaterThan(0)
    expect(result.status).toBe('success')
    expect(prisma.story.createMany).toHaveBeenCalled()
    expect(prisma.fetchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'success' }) })
    )
  })

  it('logs error and still creates fetch log on failure', async () => {
    ;(perplexity.fetchStoriesFromPerplexity as jest.Mock).mockRejectedValue(new Error('network error'))
    ;(prisma.story.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.fetchLog.create as jest.Mock).mockResolvedValue({})

    const result = await runFetchJob()

    expect(result.status).toBe('error')
    expect(prisma.fetchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'error' }) })
    )
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx jest lib/jobs/__tests__/fetchJob.test.ts -v
```

Expected: FAIL

**Step 3: Create `lib/jobs/fetchJob.ts`**

```ts
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
    const existingUrls = existingStories.map(s => s.url)

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
        data: scored.map(s => ({
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
```

**Step 4: Run test to verify it passes**

```bash
npx jest lib/jobs/__tests__/fetchJob.test.ts -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/jobs/fetchJob.ts lib/jobs/__tests__/fetchJob.test.ts
git commit -m "feat: add fetch job to source and score stories"
```

---

### Task 8: Email template and digest job

**Files:**
- Create: `lib/email.ts`
- Create: `lib/jobs/digestJob.ts`
- Create: `lib/jobs/__tests__/digestJob.test.ts`

**Step 1: Create `lib/email.ts`**

```ts
export interface DigestStory {
  title: string
  url: string
  summary: string
  score: number
  category: string
}

export function buildDigestEmail(stories: DigestStory[], date: Date): { subject: string; html: string; text: string } {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const bulletPoints = stories
    .map(s => `<li><strong>${s.title}</strong> — ${s.summary} <em>(${s.score}/10)</em> <a href="${s.url}">[link]</a></li>`)
    .join('\n')

  const textBullets = stories
    .map(s => `• ${s.title} — ${s.summary} (${s.score}/10)\n  ${s.url}`)
    .join('\n\n')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
  <h2 style="border-bottom: 2px solid #111; padding-bottom: 8px;">AI Daily Digest</h2>
  <p style="color: #666;">${dateStr}</p>
  <ul style="line-height: 1.8; padding-left: 20px;">
    ${bulletPoints}
  </ul>
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;">
  <p style="font-size: 12px; color: #999;">Your personal AI news digest</p>
</body>
</html>`

  const text = `AI Daily Digest — ${dateStr}\n\n${textBullets}`

  const subject = `AI Digest — ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return { subject, html, text }
}
```

**Step 2: Write the failing test — `lib/jobs/__tests__/digestJob.test.ts`**

```ts
import { runDigestJob } from '../digestJob'
import { prisma } from '../../prisma'
import { Resend } from 'resend'

jest.mock('../../prisma', () => ({
  prisma: {
    story: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    digest: {
      create: jest.fn(),
    },
  },
}))

jest.mock('resend')
const mockSend = jest.fn()
;(Resend as jest.MockedClass<typeof Resend>).mockImplementation(() => ({
  emails: { send: mockSend },
} as unknown as Resend))

describe('runDigestJob', () => {
  beforeEach(() => jest.clearAllMocks())

  it('skips sending if no qualifying stories found', async () => {
    ;(prisma.story.findMany as jest.Mock).mockResolvedValue([])

    const result = await runDigestJob()

    expect(result.status).toBe('skipped')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends email and marks stories when qualifying stories exist', async () => {
    const mockStories = [
      { id: '1', title: 'GPT-5 Released', url: 'https://openai.com', summary: 'OpenAI released GPT-5.', score: 9, category: 'Model Releases' },
      { id: '2', title: 'EU AI Act', url: 'https://eu.gov', summary: 'EU enforces AI Act.', score: 8, category: 'AI Policy' },
    ]
    ;(prisma.story.findMany as jest.Mock).mockResolvedValue(mockStories)
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null })
    ;(prisma.story.updateMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(prisma.digest.create as jest.Mock).mockResolvedValue({})

    const result = await runDigestJob()

    expect(result.status).toBe('success')
    expect(mockSend).toHaveBeenCalled()
    expect(prisma.story.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { includedInDigest: true } })
    )
  })
})
```

**Step 3: Run test to verify it fails**

```bash
npx jest lib/jobs/__tests__/digestJob.test.ts -v
```

Expected: FAIL

**Step 4: Create `lib/jobs/digestJob.ts`**

```ts
import { Resend } from 'resend'
import { prisma } from '../prisma'
import { digestConfig } from '@/config/topics'
import { buildDigestEmail } from '../email'

const resend = new Resend(process.env.RESEND_API_KEY)

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
      stories.map(s => ({
        title: s.title,
        url: s.url,
        summary: s.summary ?? s.rawContent.slice(0, 120),
        score: s.score ?? 5,
        category: s.category ?? 'Other',
      })),
      new Date()
    )

    const { error } = await resend.emails.send({
      from: 'AI Digest <digest@yourdomain.com>',
      to: digestConfig.emailRecipient,
      subject,
      html,
      text,
    })

    if (error) throw new Error(error.message)

    await prisma.story.updateMany({
      where: { id: { in: stories.map(s => s.id) } },
      data: { includedInDigest: true },
    })

    await prisma.digest.create({
      data: {
        emailHtml: html,
        storyIds: stories.map(s => s.id),
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
```

**Step 5: Run test to verify it passes**

```bash
npx jest lib/jobs/__tests__/digestJob.test.ts -v
```

Expected: PASS

**Step 6: Commit**

```bash
git add lib/email.ts lib/jobs/digestJob.ts lib/jobs/__tests__/digestJob.test.ts
git commit -m "feat: add email template and daily digest job"
```

---

### Task 9: Custom server with cron jobs

**Files:**
- Create: `server.ts`
- Modify: `package.json`

**Step 1: Create `server.ts`**

```ts
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import cron from 'node-cron'
import { runFetchJob } from './lib/jobs/fetchJob'
import { runDigestJob } from './lib/jobs/digestJob'
import { digestConfig } from './config/topics'

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)
    await handle(req, res, parsedUrl)
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)

    // Register cron jobs
    cron.schedule(digestConfig.fetchCron, () => {
      console.log('[cron] Running fetch job...')
      runFetchJob()
    })

    cron.schedule(digestConfig.digestCron, () => {
      console.log('[cron] Running digest job...')
      runDigestJob()
    })

    console.log(`[cron] fetchJob scheduled: ${digestConfig.fetchCron}`)
    console.log(`[cron] digestJob scheduled: ${digestConfig.digestCron}`)
  })
})
```

**Step 2: Update `package.json` scripts**

Replace the `start` script:
```json
"build": "next build",
"start": "node server.ts",
"dev": "node server.ts"
```

Also add ts-node as dev dependency for running the server:
```bash
npm install --save-dev ts-node tsconfig-paths
```

Update `package.json` start script to use ts-node in production:
```json
"start": "ts-node --project tsconfig.server.json server.ts"
```

**Step 3: Create `tsconfig.server.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "outDir": ".next/server"
  },
  "include": ["server.ts", "lib/**/*", "config/**/*"]
}
```

**Step 4: Test that server starts**

```bash
npm run dev
```

Expected: Server starts on port 3000, cron jobs registered, Next.js app accessible at http://localhost:3000

**Step 5: Commit**

```bash
git add server.ts tsconfig.server.json package.json
git commit -m "feat: add custom server with node-cron job scheduling"
```

---

### Task 10: API routes

**Files:**
- Create: `app/api/stories/route.ts`
- Create: `app/api/digests/route.ts`
- Create: `app/api/digests/[id]/route.ts`
- Create: `app/api/refresh/route.ts`
- Create: `app/api/status/route.ts`

**Step 1: Create `app/api/stories/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const hours = parseInt(searchParams.get('hours') ?? '48')

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const stories = await prisma.story.findMany({
    where: {
      fetchedAt: { gte: since },
      ...(category ? { category } : {}),
    },
    orderBy: { score: 'desc' },
    take: 100,
  })

  return NextResponse.json(stories)
}
```

**Step 2: Create `app/api/digests/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const digests = await prisma.digest.findMany({
    orderBy: { sentAt: 'desc' },
    take: 30,
    select: { id: true, sentAt: true, storyIds: true },
  })
  return NextResponse.json(digests)
}
```

**Step 3: Create `app/api/digests/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const digest = await prisma.digest.findUnique({ where: { id: params.id } })
  if (!digest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(digest)
}
```

**Step 4: Create `app/api/refresh/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { runFetchJob } from '@/lib/jobs/fetchJob'

export async function POST() {
  const result = await runFetchJob()
  return NextResponse.json(result)
}
```

**Step 5: Create `app/api/status/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [lastFetch, totalStories] = await Promise.all([
    prisma.fetchLog.findFirst({ orderBy: { ranAt: 'desc' } }),
    prisma.story.count(),
  ])
  return NextResponse.json({ lastFetch, totalStories })
}
```

**Step 6: Verify routes work**

Start the dev server (`npm run dev`) and test:
```bash
curl http://localhost:3000/api/stories
curl http://localhost:3000/api/status
curl -X POST http://localhost:3000/api/refresh
```

Expected: JSON responses from each route.

**Step 7: Commit**

```bash
git add app/api/
git commit -m "feat: add API routes for stories, digests, refresh, status"
```

---

### Task 11: Dashboard UI — components

**Files:**
- Create: `app/components/StoryCard.tsx`
- Create: `app/components/TopicFilter.tsx`
- Create: `app/components/StatusHeader.tsx`

**Step 1: Create `app/components/StoryCard.tsx`**

```tsx
interface Story {
  id: string
  title: string
  url: string
  sourceDomain: string
  summary: string | null
  score: number | null
  category: string | null
  fetchedAt: string
}

export function StoryCard({ story }: { story: Story }) {
  const score = story.score ?? 0
  const scoreColor = score >= 8 ? 'bg-green-100 text-green-800' : score >= 6 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:underline line-clamp-2"
          >
            {story.title}
          </a>
          {story.summary && (
            <p className="mt-1 text-sm text-gray-600">{story.summary}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>{story.sourceDomain}</span>
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

**Step 2: Create `app/components/TopicFilter.tsx`**

```tsx
'use client'

const CATEGORIES = ['All', 'Model Releases', 'Research', 'AI Policy', 'Industry', 'AI Safety', 'AI Agents', 'Other']

export function TopicFilter({ selected, onChange }: { selected: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {CATEGORIES.map(cat => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            selected === cat
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
```

**Step 3: Create `app/components/StatusHeader.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

interface Status {
  lastFetch: { ranAt: string; status: string; storiesFound: number } | null
  totalStories: number
}

export function StatusHeader({ onRefresh }: { onRefresh: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus)
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetch('/api/refresh', { method: 'POST' })
    setRefreshing(false)
    onRefresh()
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-200">
      <div>
        <h1 className="text-xl font-bold">AI News</h1>
        {status?.lastFetch && (
          <p className="text-xs text-gray-400 mt-0.5">
            Last fetch: {new Date(status.lastFetch.ranAt).toLocaleString()} · {status.totalStories} stories
            {status.lastFetch.status === 'error' && (
              <span className="text-red-500 ml-1">· Fetch error</span>
            )}
          </p>
        )}
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {refreshing ? 'Refreshing...' : 'Refresh now'}
      </button>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add app/components/
git commit -m "feat: add StoryCard, TopicFilter, StatusHeader components"
```

---

### Task 12: Dashboard main page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Replace `app/page.tsx` with**

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { StoryCard } from './components/StoryCard'
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
}

export default function Home() {
  const [stories, setStories] = useState<Story[]>([])
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)

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
    <main className="max-w-2xl mx-auto px-4 pb-16">
      <StatusHeader onRefresh={loadStories} />
      <div className="mt-4 mb-4">
        <TopicFilter selected={category} onChange={setCategory} />
      </div>
      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading stories...</div>
      ) : stories.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No stories yet. Hit Refresh to fetch.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {stories.map(story => <StoryCard key={story.id} story={story} />)}
        </div>
      )}
    </main>
  )
}
```

**Step 2: Start dev server and verify the dashboard renders**

```bash
npm run dev
```

Open http://localhost:3000 — should see the header, topic filters, and empty state.

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add main dashboard page"
```

---

### Task 13: Digest history page

**Files:**
- Create: `app/digests/page.tsx`

**Step 1: Create `app/digests/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DigestSummary {
  id: string
  sentAt: string
  storyIds: string[]
}

export default function DigestsPage() {
  const [digests, setDigests] = useState<DigestSummary[]>([])

  useEffect(() => {
    fetch('/api/digests').then(r => r.json()).then(setDigests)
  }, [])

  return (
    <main className="max-w-2xl mx-auto px-4 pb-16">
      <div className="py-4 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-xl font-bold">Digest History</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Back to feed</Link>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {digests.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No digests sent yet.</p>
        ) : (
          digests.map(d => (
            <Link
              key={d.id}
              href={`/digests/${d.id}`}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 flex items-center justify-between"
            >
              <span className="font-medium">
                {new Date(d.sentAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <span className="text-sm text-gray-400">{d.storyIds.length} stories</span>
            </Link>
          ))
        )}
      </div>
    </main>
  )
}
```

**Step 2: Create `app/digests/[id]/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DigestPage({ params }: { params: { id: string } }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/digests/${params.id}`)
      .then(r => r.json())
      .then(d => setHtml(d.emailHtml))
  }, [params.id])

  return (
    <main className="max-w-2xl mx-auto px-4 pb-16">
      <div className="py-4 border-b border-gray-200">
        <Link href="/digests" className="text-sm text-gray-500 hover:text-gray-900">← Digest history</Link>
      </div>
      {html ? (
        <div className="mt-4" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-gray-400 text-center py-16">Loading...</p>
      )}
    </main>
  )
}
```

**Step 3: Add nav link on home page**

In `app/page.tsx`, add a link to digest history in the `<StatusHeader>` area. After the `<StatusHeader>` line add:

```tsx
<div className="mt-2 text-right">
  <a href="/digests" className="text-sm text-gray-400 hover:text-gray-700">Digest history →</a>
</div>
```

**Step 4: Commit**

```bash
git add app/digests/
git commit -m "feat: add digest history pages"
```

---

### Task 14: Simple password middleware

**Files:**
- Create: `middleware.ts`

**Step 1: Create `middleware.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD
  if (!password) return NextResponse.next() // No password set = open

  const cookie = request.cookies.get('auth')
  if (cookie?.value === password) return NextResponse.next()

  // Allow the auth endpoint through
  if (request.nextUrl.pathname === '/api/auth') return NextResponse.next()

  // Redirect to login
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!login|_next|favicon).*)'],
}
```

**Step 2: Create `app/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ password }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      router.push('/')
    } else {
      setError(true)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-72">
        <h1 className="text-xl font-bold text-center">AI News</h1>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="border border-gray-300 rounded px-3 py-2"
        />
        {error && <p className="text-red-500 text-sm">Incorrect password</p>}
        <button type="submit" className="bg-gray-900 text-white rounded py-2">Enter</button>
      </form>
    </main>
  )
}
```

**Step 3: Create `app/api/auth/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { password } = await request.json()
  const appPassword = process.env.APP_PASSWORD

  if (!appPassword || password !== appPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth', appPassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return response
}
```

**Step 4: Commit**

```bash
git add middleware.ts app/login/ app/api/auth/
git commit -m "feat: add simple password auth middleware"
```

---

### Task 15: Railway deployment

**Files:**
- Create: `railway.toml`
- Create: `.env.example` (update)

**Step 1: Create `railway.toml`**

```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/status"
restartPolicyType = "on_failure"
```

**Step 2: Add Postgres to Railway project**

In the Railway dashboard:
1. Create new project
2. Add "PostgreSQL" service
3. Copy `DATABASE_URL` from the PostgreSQL service's "Connect" tab
4. Add your Next.js app as a new service from GitHub
5. Set all env vars from `.env.example` in the Railway service settings

**Step 3: Run Prisma migration on Railway**

After first deploy, run migration:
```bash
npx prisma migrate deploy
```

Or add to `package.json`:
```json
"postbuild": "prisma migrate deploy"
```

**Step 4: Final test — run all tests**

```bash
npm test
```

Expected: All tests pass.

**Step 5: Final commit**

```bash
git add railway.toml package.json
git commit -m "feat: add Railway deployment config"
```

---

## Running Tests

```bash
npm test                    # run all tests
npm test -- --watch         # watch mode
npm test lib/__tests__/     # specific directory
```

## Environment Variables Reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string from Railway |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `PERPLEXITY_API_KEY` | From perplexity.ai/settings/api |
| `RESEND_API_KEY` | From resend.com |
| `DIGEST_EMAIL_RECIPIENT` | Your email address for digests |
| `APP_PASSWORD` | Optional — password to protect the app |
| `PORT` | Set automatically by Railway |

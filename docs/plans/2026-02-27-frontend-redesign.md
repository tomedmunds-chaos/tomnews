# Frontend Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the app's frontend from default create-next-app boilerplate into a world-class editorial newspaper aesthetic.

**Architecture:** Pure visual changes only — no API routes, business logic, or data models are touched. Each component file is rewritten to use a new design system: Playfair Display headlines, Source Serif 4 body, DM Mono labels, warm cream background, near-black ink, editorial red accent. Tailwind v4 CSS variables bridge Next.js font tokens to utility classes.

**Tech Stack:** Next.js 15, Tailwind CSS v4, `next/font/google` (Playfair_Display, Source_Serif_4, DM_Mono), TypeScript.

---

## Context for implementer

The app is a personal AI news aggregator called **"The Signal"**. It fetches stories from Perplexity and Twitter, scores them with Gemini, and displays them as a scrollable list with an Instagram Stories-style full-screen reader.

**Current state:** Stock create-next-app. Geist font, white background, gray bordered cards, zero personality.

**Target state:** Editorial newspaper. Warm cream background, Playfair Display headlines, Source Serif body text, DM Mono monospace for all metadata/labels/scores. No card boxes — horizontal rule separators. Score displayed as a typographic number (red if ≥ 8). App branded as "The Signal".

**Design system:**
```
--bg:      #FAF8F5  (warm cream)
--ink:     #0F0D0A  (near-black)
--accent:  #C8102E  (editorial red)
--muted:   #6B6560  (warm gray)
--rule:    #D6D0C8  (warm divider)
```

**Verification for every task:** Since these are pure styling changes, the "test" is:
1. `npx tsc --project tsconfig.json --noEmit` → 0 errors
2. `npx jest --no-coverage` → same pass/fail as before (20/21 — the perplexity test failure is pre-existing)

---

### Task 1: Design system foundation — globals.css and layout.tsx

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**What this does:** Replaces Geist fonts with the editorial trio, sets up CSS variables, and wires them into Tailwind v4 `@theme` so you can write `font-display`, `font-body`, `font-label`, `text-ink`, `text-accent`, `bg-bg`, `border-rule` etc. as Tailwind utility classes.

**Step 1: Replace app/globals.css entirely**

```css
@import "tailwindcss";

:root {
  --bg:     #FAF8F5;
  --ink:    #0F0D0A;
  --accent: #C8102E;
  --muted:  #6B6560;
  --rule:   #D6D0C8;
}

@theme inline {
  --color-bg:     var(--bg);
  --color-ink:    var(--ink);
  --color-accent: var(--accent);
  --color-muted:  var(--muted);
  --color-rule:   var(--rule);

  --font-display: var(--font-playfair);
  --font-body:    var(--font-source-serif);
  --font-label:   var(--font-dm-mono);
}

body {
  background: var(--bg);
  color: var(--ink);
}
```

**Step 2: Replace app/layout.tsx entirely**

```typescript
import type { Metadata } from 'next'
import { Playfair_Display, Source_Serif_4, DM_Mono } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '700'],
})

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
  weight: ['400', '600'],
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'The Signal',
  description: 'Your daily AI intelligence briefing',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${sourceSerif.variable} ${dmMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

**Step 3: Verify TypeScript**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: editorial design system — fonts and CSS variables"
```

---

### Task 2: Masthead — StatusHeader.tsx

**Files:**
- Modify: `app/components/StatusHeader.tsx`

**What this does:** Replaces the plain flex header with a centred newspaper masthead. "The Signal" in large Playfair Display, date and story count in DM Mono below, a bold horizontal rule, and a small typographic refresh link in the top-right corner.

**Step 1: Replace app/components/StatusHeader.tsx entirely**

```typescript
'use client'

import { useEffect, useState } from 'react'

interface Status {
  lastFetch: { ranAt: string; status: string; storiesFound: number; error?: string } | null
  totalStories: number
}

export function StatusHeader({ onRefresh }: { onRefresh: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus)
  }, [])

  async function reloadStatus() {
    const r = await fetch('/api/status')
    const data = await r.json()
    setStatus(data)
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetch('/api/refresh', { method: 'POST' })
    setRefreshing(false)
    await reloadStatus()
    onRefresh()
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).toUpperCase()

  const storyCount = status?.totalStories ?? 0
  const lastFetchTime = status?.lastFetch
    ? new Date(status.lastFetch.ranAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <header className="pt-8 pb-0">
      <div className="relative text-center">
        {/* Refresh — top right */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="absolute right-0 top-1 font-label text-xs tracking-widest uppercase text-muted hover:text-accent transition-colors disabled:opacity-40"
        >
          {refreshing ? 'FETCHING…' : '↺ REFRESH'}
        </button>

        {/* Masthead title */}
        <h1 className="font-display text-5xl font-bold tracking-tight text-ink leading-none">
          The Signal
        </h1>

        {/* Date */}
        <p className="mt-2 font-label text-xs tracking-widest text-muted">
          {dateStr}
        </p>

        {/* Status */}
        <p className="mt-0.5 font-label text-xs tracking-widest text-muted">
          {storyCount} STORIES
          {lastFetchTime && ` · LAST FETCH ${lastFetchTime}`}
          {status?.lastFetch?.status === 'error' && (
            <span className="text-accent ml-2" title={status.lastFetch.error}>
              · FETCH ERROR
            </span>
          )}
        </p>
      </div>

      {/* Bold masthead rule */}
      <div className="mt-5 border-t-[3px] border-ink" />
      <div className="mt-0.5 border-t border-ink" />
    </header>
  )
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/components/StatusHeader.tsx
git commit -m "feat: newspaper masthead design for StatusHeader"
```

---

### Task 3: Topic filter — TopicFilter.tsx

**Files:**
- Modify: `app/components/TopicFilter.tsx`

**What this does:** Replaces pill buttons with an editorial tab row — uppercase DM Mono labels separated by `·` spacers, active category gets a 2px editorial red underline, no filled backgrounds.

**Step 1: Replace app/components/TopicFilter.tsx entirely**

```typescript
'use client'

const CATEGORIES = ['All', 'Model Releases', 'Research', 'AI Policy', 'Industry', 'AI Safety', 'AI Agents', 'Other']

export function TopicFilter({ selected, onChange }: { selected: string; onChange: (c: string) => void }) {
  return (
    <nav className="py-3 border-b border-rule overflow-x-auto">
      <div className="flex items-center whitespace-nowrap">
        {CATEGORIES.map((cat, i) => (
          <span key={cat} className="flex items-center">
            {i > 0 && (
              <span className="font-label text-xs text-rule px-2 select-none">·</span>
            )}
            <button
              onClick={() => onChange(cat)}
              className={`font-label text-xs tracking-widest uppercase pb-0.5 transition-colors border-b-2 ${
                selected === cat
                  ? 'text-accent border-accent'
                  : 'text-muted border-transparent hover:text-ink'
              }`}
            >
              {cat}
            </button>
          </span>
        ))}
      </div>
    </nav>
  )
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/components/TopicFilter.tsx
git commit -m "feat: editorial tab filter — DM Mono uppercase with red underline"
```

---

### Task 4: Story card — StoryCard.tsx

**Files:**
- Modify: `app/components/StoryCard.tsx`

**What this does:** The most significant visual change. Removes the bordered card box entirely. Each story is a full-width article separated by a horizontal rule. Headline in Playfair Display, bullets in Source Serif 4, metadata in DM Mono. Score is a typographic number (red if ≥ 8). Hover reveals a red left-border accent and turns the headline red.

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
}

export function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const score = story.score ?? 0
  const bullets = parseBullets(story.summary)
  const isHighScore = score >= 8
  const timeStr = new Date(story.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <article
      className="group relative py-5 border-b border-rule cursor-pointer pl-0 hover:pl-4 transition-[padding] duration-200"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      {/* Red left accent — slides in on hover */}
      <div className="absolute left-0 top-5 bottom-5 w-[3px] bg-accent scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top" />

      {/* Headline + score row */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="flex-1 font-display text-[1.15rem] font-bold leading-snug text-ink group-hover:text-accent transition-colors duration-200">
          {story.title}
        </h2>
        <span className={`shrink-0 font-label text-sm font-medium tabular-nums ${isHighScore ? 'text-accent' : 'text-muted'}`}>
          {score.toFixed(1)}
        </span>
      </div>

      {/* Rule under headline */}
      <div className="mt-2 mb-3 border-t border-rule" />

      {/* Bullets */}
      {bullets.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {bullets.map((b, i) => (
            <li key={i} className="font-body text-sm text-ink leading-relaxed flex gap-2">
              <span className="text-muted shrink-0 mt-0.5">·</span>
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
    </article>
  )
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/components/StoryCard.tsx
git commit -m "feat: editorial story card — Playfair headline, ruled separator, typographic score"
```

---

### Task 5: Story reader overlay — StoryReader.tsx

**Files:**
- Modify: `app/components/StoryReader.tsx`

**What this does:** The reader overlay keeps its full-screen dark background but adopts the editorial palette inverted. Warm cream (`#F2EFE8`) text on near-black (`#111009`) background. Playfair Display headline, Source Serif bullets, DM Mono metadata. Progress bar fill changes from white to editorial red.

**Step 1: Replace the JSX return in app/components/StoryReader.tsx**

The hooks, state, and event handler functions (lines 1–78) stay exactly the same. Only the `return (...)` block changes. Replace from the `return (` on line 79 to the closing `}` with:

```typescript
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none"
      style={{ background: '#111009', color: '#F2EFE8' }}
      onClick={handleTap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3 pb-1">
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
        className="absolute top-2 right-3 p-2 text-lg leading-none transition-opacity"
        style={{ color: 'rgba(242,239,232,0.5)' }}
        onClick={(e) => { e.stopPropagation(); onCloseRef.current() }}
        onMouseEnter={e => (e.currentTarget.style.color = '#F2EFE8')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(242,239,232,0.5)')}
        aria-label="Close reader"
      >
        ✕
      </button>

      {/* Story content */}
      <div className="flex-1 min-h-0 flex flex-col justify-center px-6 py-8 max-w-lg mx-auto w-full overflow-y-auto">
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
              <span style={{ color: '#C8102E' }} className="shrink-0 mt-0.5">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Read full article */}
      <div className="px-6 pb-8 flex justify-center">
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
  )
```

**Important:** Only replace the `return (...)` block. Everything before line 79 (hooks, refs, guards, event handlers) is unchanged.

**Step 2: Verify TypeScript**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add app/components/StoryReader.tsx
git commit -m "feat: editorial reader overlay — warm cream on near-black, Playfair headline, red progress"
```

---

### Task 6: Page layout — page.tsx + final verification

**Files:**
- Modify: `app/page.tsx`

**What this does:** Small layout adjustments — removes the card gap (cards now self-separate with bottom borders), adds a top border above the topic filter, adds the "Digest history" link in the editorial label style. Final TypeScript check and full test run.

**Step 1: Replace app/page.tsx entirely**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { StoryCard } from './components/StoryCard'
import { TopicFilter } from './components/TopicFilter'
import { StatusHeader } from './components/StatusHeader'
import { StoryReader } from './components/StoryReader'

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
    <main className="max-w-2xl mx-auto px-4 pb-20">
      <StatusHeader onRefresh={loadStories} />

      <div className="mt-1 flex justify-end">
        <a
          href="/digests"
          className="font-label text-xs tracking-widest uppercase text-muted hover:text-accent transition-colors"
        >
          Digest History →
        </a>
      </div>

      <TopicFilter
        selected={category}
        onChange={(cat) => { setReaderIndex(null); setCategory(cat) }}
      />

      {loading ? (
        <div className="font-label text-xs tracking-widest uppercase text-muted text-center py-20">
          Loading…
        </div>
      ) : stories.length === 0 ? (
        <div className="font-label text-xs tracking-widest uppercase text-muted text-center py-20">
          No stories yet — hit Refresh to fetch
        </div>
      ) : (
        <div>
          {stories.map((story, index) => (
            <StoryCard key={story.id} story={story} onClick={() => setReaderIndex(index)} />
          ))}
        </div>
      )}

      {readerIndex !== null && (
        <StoryReader
          stories={stories}
          initialIndex={readerIndex}
          onClose={() => setReaderIndex(null)}
        />
      )}
    </main>
  )
}
```

**Step 2: TypeScript check**

Run: `npx tsc --project tsconfig.json --noEmit`
Expected: 0 errors

**Step 3: Run full test suite**

Run: `npx jest --no-coverage`
Expected: 20/21 pass (the one failing perplexity test is a pre-existing mock issue, not related to this work)

**Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: editorial page layout — ruled card list, label-style digest link"
```

**Step 5: Push to Railway**

```bash
git push origin main
```

---

## Verification checklist after all tasks

- [ ] `npx tsc --project tsconfig.json --noEmit` → 0 errors
- [ ] `npx jest --no-coverage` → 20/21 (pre-existing failure only)
- [ ] `git log --oneline -6` shows 6 new commits
- [ ] App deployed on Railway — visit live URL and check:
  - Warm cream background (not white)
  - "The Signal" masthead in serif font, centred
  - DM Mono date/count line below masthead
  - Double rule below masthead
  - Topic filter as small uppercase labels (not pills)
  - Story cards: Playfair headline, no box border, bottom rule separator
  - Score in monospace, red for ≥ 8
  - Hover on card: red left accent appears, headline turns red
  - Story reader: dark bg, warm cream text, red progress bars, Playfair headline

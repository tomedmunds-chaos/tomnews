# Story Reader & Cleanup — Design

**Date:** 2026-02-27
**Status:** Approved

## Goal

Two features: (1) automatically delete stories older than 3 days to keep the DB lean, and (2) an Instagram Stories-style full-screen reader that shows bullet-point summaries when you tap a story card.

---

## Feature 1: 3-Day Cleanup

At the start of `runFetchJob`, delete all stories where `fetchedAt < now - 3 days` using a single `prisma.story.deleteMany` call. No schema changes, no new cron job.

**Changed file:** `lib/jobs/fetchJob.ts`

---

## Feature 2: Bullet Summaries

Change the Gemini scoring prompt to return `bullets: string[]` (up to 3 items) instead of `summary: string`. Serialise the array as a JSON string before storing in the existing `summary` column — no schema migration needed.

The `scoreAndSummarizeStories` function in `lib/claude.ts` returns the JSON string. The UI parses it with `JSON.parse` and falls back gracefully to rendering the raw string as a single bullet for any existing plain-text summaries.

**Changed file:** `lib/claude.ts`

---

## Feature 3: Story Reader Overlay

### Layout

```
┌─────────────────────────────┐
│ ▮▮▮▮▮▮░░░░░░░░░░░░░░░░░░░  │  ← progress bars (one per story)
│                           ✕ │
│                             │
│  techcrunch.com             │
│  via @karpathy              │
│                             │
│  Title of the story         │
│                             │
│  • First bullet point       │
│  • Second bullet point      │
│  • Third bullet point       │
│                             │
│       [ Read full article → ]│
└─────────────────────────────┘
   tap left ←      → tap right
```

### Behaviour
- Opens when any StoryCard is tapped, starting at that story
- Navigates through the same filtered list visible on the main page
- Tap left third of screen = previous story
- Tap right third of screen = next story
- Swipe left/right gesture also navigates
- X button (top-right), swipe down, or Escape key closes the reader

### Components

**`app/components/StoryReader.tsx`** (new)
Full-screen fixed overlay. Props: `stories: Story[]`, `initialIndex: number`, `onClose: () => void`.

Internal state: `currentIndex`. Renders progress bars, story content, navigation tap zones, close button. Uses `touchstart`/`touchend` for swipe detection and `keydown` for keyboard nav.

**`app/components/StoryCard.tsx`** (updated)
- Replace single-sentence summary with bullet list (parse JSON, fallback to plain text)
- Add `onClick` prop to open the reader

**`app/page.tsx`** (updated)
- Track `readerIndex: number | null` state (null = closed)
- Pass `onOpen={(index) => setReaderIndex(index)}` to each StoryCard
- Render `<StoryReader>` when `readerIndex !== null`

### Helper: `parseBullets(summary: string | null): string[]`
Shared utility — attempts `JSON.parse`, returns array of strings. Falls back to `[summary]` if not valid JSON or null.

---

## Out of Scope
- Auto-advance timer (manual navigation only)
- Save/dismiss gestures (no Tinder-style interaction)
- Per-story reading progress persistence

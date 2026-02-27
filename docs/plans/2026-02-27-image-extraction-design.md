# Image Extraction — Design

**Date:** 2026-02-27
**Status:** Approved

## Goal

Add visual imagery to every story card and the full-screen reader. Extract real images from tweets and article OG tags; fall back to a programmatic gradient placeholder when none is found.

---

## Architecture

Three layers:
1. **Extraction (backend)** — Pull image URLs at fetch time, store in DB as a nullable string
2. **Placeholder (client)** — Compute a deterministic gradient from title + category at render time; zero cost, zero storage
3. **Display (frontend)** — Left thumbnail on StoryCard; full-bleed hero band in StoryReader

No new infrastructure. No cloud storage. No base64 in DB.

---

## Image Extraction

### Tweets (SocialData)

The SocialData API returns `extended_entities.media` on tweets with photos. Extend `SocialDataTweet` interface:

```typescript
extended_entities?: {
  media?: Array<{ media_url_https: string; type: string }>
}
```

Extract `extended_entities.media[0].media_url_https` when `type === 'photo'`. This becomes the `imageUrl` on the `TweetStory`.

### Articles (Perplexity)

New utility `lib/ogImage.ts`:

```typescript
export async function fetchOgImage(url: string): Promise<string | null>
```

- Fetches the article URL with a 3-second `AbortController` timeout
- Extracts `og:image` or `twitter:image` meta tag from the HTML
- Returns the URL string or `null` on any failure (timeout, 403, parse error, etc.)
- Failures are silent — never throws

Called in `fetchJob.ts` after deduplication, in parallel across all new stories:

```typescript
const withImages = await Promise.all(
  newStories.map(async (s) => ({
    ...s,
    imageUrl: s.imageUrl ?? await fetchOgImage(s.url).catch(() => null),
  }))
)
```

### Data model

Add to `RawStory` interface:
```typescript
imageUrl?: string
```

Add to Prisma `Story` model:
```prisma
imageUrl  String?
```

Apply with `prisma db push` (no migration file needed for nullable addition).

---

## Placeholder Gradient

Pure client-side function, no imports needed:

```typescript
function getPlaceholderGradient(title: string, category: string | null): string
```

- Hashes the title string (djb2-style) to a stable number
- Derives gradient angle from hash (0–360°)
- Category determines the colour palette:

| Category | Colours |
|---|---|
| Model Releases | `#C8102E` → `#7a0a1a` |
| Research | `#1a3a6b` → `#2d5fa0` |
| AI Policy | `#1a5c2d` → `#2e9e50` |
| Industry | `#6b3a1a` → `#a05e2d` |
| AI Safety | `#3d1a6b` → `#6b2ea0` |
| AI Agents | `#1a4f6b` → `#2d8aa0` |
| Other | `#3a3532` → `#6b6560` |

The same title always produces the same gradient. Computed at render time.

---

## StoryCard — Left Thumbnail

Two-column layout. Left: `80×80px` square. Right: existing content unchanged.

```
┌──────────────────────────────────────────────┐
│ [IMG] OpenAI Releases GPT-5 in Surprise...  9.2│
│       ─────────────────────────────────────    │
│       · Benchmark results show 15% improvement │
│       · Free API tier available immediately    │
│                                                │
│       openai.com · @karpathy · 14:32           │
└──────────────────────────────────────────────┘
```

- Image slot: `w-20 h-20 rounded-sm overflow-hidden shrink-0`
- Real image: `<img>` with `object-cover w-full h-full`, `loading="lazy"`, `alt=""`
- Placeholder: `<div>` with inline `background: gradient`
- Red left-border hover accent and `hover:pl-4` animation remain on the outer `<article>`; thumbnail sits to the left of the content column, unaffected

---

## StoryReader — Full-Bleed Hero

Hero band occupies the top ~40% of the overlay. Below it: source/author, headline, bullets, article link (unchanged).

```
┌────────────────────────────────┐
│  [████ HERO IMAGE / GRADIENT ██│  ← ~40vh, object-cover with bottom gradient fade
│  ██████████████████████████████│
│  ██████████████████████████████│
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← fade to #111009
├────────────────────────────────┤
│  openai.com · @karpathy        │
│                                │
│  OpenAI Releases GPT-5         │  ← Playfair Display headline
│  in Surprise Late-Night Drop   │
│                                │
│  · Benchmark results show...   │  ← Source Serif bullets
│  · Free API tier available...  │
│                                │
│  [READ FULL ARTICLE →]         │
└────────────────────────────────┘
```

- Progress bars stay at top, absolute-positioned above the hero
- Close button stays top-right, absolute above hero
- Hero: `relative h-[40vh] overflow-hidden`
- Gradient overlay: `absolute inset-0 bg-gradient-to-b from-transparent to-[#111009]`
- Image: `<img>` with `object-cover w-full h-full`, or `<div>` with gradient background

---

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `imageUrl String?` to Story model |
| `lib/perplexity.ts` | Add `imageUrl?: string` to `RawStory` interface |
| `lib/socialdata.ts` | Extend `SocialDataTweet` to include `extended_entities.media`; extract imageUrl |
| `lib/ogImage.ts` | New utility — fetch OG image from URL with 3s timeout |
| `lib/jobs/fetchJob.ts` | After dedup, fetch OG images in parallel for article stories |
| `app/components/StoryCard.tsx` | Two-column layout with left thumbnail |
| `app/components/StoryReader.tsx` | Full-bleed hero band at top |

---

## Out of Scope

- AI image generation
- Cloud storage
- Image caching/CDN
- Images on `/digests` or `/login` pages

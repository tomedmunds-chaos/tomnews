# AI News Aggregator — Design Document
**Date:** 2026-02-26
**Status:** Approved

## Overview

A personal web app that aggregates and curates daily AI news. Replaces scrolling Twitter for signal. Surfaces the most important AI stories via a clean web dashboard and a daily TL;DR email digest.

---

## Goals

- Automatically fetch AI news every 3 hours from across the web
- Use an LLM to score stories by importance and filter out noise
- Display ranked stories in a clean web dashboard
- Send a daily 8am email with the top 5-10 stories as TL;DR bullet points
- Be personal — no auth complexity, no multi-user overhead

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Deployment | Railway |
| News sourcing | Perplexity Sonar API |
| AI scoring/summarization | Claude API (claude-sonnet-4-6) |
| Email delivery | Resend |
| Database | Postgres (Railway) |
| ORM | Prisma |
| Background jobs | node-cron (inside Next.js server process) |
| Language | TypeScript |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Railway                        │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │           Next.js App                   │    │
│  │                                         │    │
│  │  ┌──────────┐    ┌─────────────────┐   │    │
│  │  │ Dashboard│    │   API Routes    │   │    │
│  │  │  (UI)    │    │ /api/stories    │   │    │
│  │  └──────────┘    │ /api/digest     │   │    │
│  │                  │ /api/refresh    │   │    │
│  │                  └─────────────────┘   │    │
│  │                                         │    │
│  │  ┌─────────────────────────────────┐   │    │
│  │  │         node-cron jobs          │   │    │
│  │  │  fetchJob (every 3 hours)       │   │    │
│  │  │  digestJob (daily 8am)          │   │    │
│  │  └─────────────────────────────────┘   │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────┐                               │
│  │   Postgres   │                               │
│  └──────────────┘                               │
└─────────────────────────────────────────────────┘
         │                │              │
         ▼                ▼              ▼
  Perplexity API     Claude API      Resend
  (news search)    (score/summarize) (email)
```

---

## Data Flow

### Fetch Job (every 3 hours)
1. Cron fires `fetchJob`
2. Calls Perplexity Sonar API with configured search queries
3. Deduplicates results against URLs already in DB
4. Sends new stories to Claude in batches — returns score (1–10), 1-sentence summary, category
5. Saves stories to `stories` table
6. Logs run to `fetch_logs`

### Digest Job (daily at 8am)
1. Cron fires `digestJob`
2. Queries top-scored stories (score ≥ 7) from last 24hrs not yet in a digest
3. Sends to Claude to write 5–10 TL;DR bullet points
4. Renders HTML email
5. Sends via Resend
6. Saves digest record to `digests` table

---

## Data Model

### `stories`
```sql
id             UUID PRIMARY KEY
title          TEXT
url            TEXT UNIQUE
source_domain  TEXT
raw_content    TEXT
summary        TEXT          -- 1-sentence Claude summary
score          DECIMAL(3,1)  -- Claude importance score 1-10
category       TEXT          -- e.g. "Model Releases", "Research", "Policy"
published_at   TIMESTAMP
fetched_at     TIMESTAMP
included_in_digest BOOLEAN DEFAULT false
```

### `digests`
```sql
id          UUID PRIMARY KEY
sent_at     TIMESTAMP
email_html  TEXT
story_ids   UUID[]
```

### `fetch_logs`
```sql
id              UUID PRIMARY KEY
ran_at          TIMESTAMP
stories_found   INTEGER
status          TEXT  -- 'success' | 'error'
error           TEXT
```

---

## Dashboard UI

- **Header** — app name, last updated timestamp, manual "refresh now" button, status indicator
- **Topic filter bar** — filter by category (auto-assigned by Claude)
- **Feed** — story cards sorted by score (highest first), each showing:
  - Headline (linked to original)
  - 1-sentence summary
  - Source domain + published time
  - Score badge
  - Category tag
- **Digest history** — list of past daily emails, click to read

No authentication. App is private via Railway's private networking or a simple middleware password check.

---

## Email Format

Plain TL;DR style. Example:

```
Subject: AI Daily Digest — Feb 26, 2026

Today's top AI stories:

• Anthropic releases Claude 4 Opus with 2M context window (9.2/10)
• EU AI Act enforcement begins, first fines issued to three companies (8.8/10)
• Google DeepMind publishes new protein folding research in Nature (8.1/10)
...

Read all stories → [link to dashboard]
```

---

## Configuration

Stored in `config/topics.ts`:

```ts
export const searchQueries = [
  "AI model release announcement",
  "large language model research paper",
  "AI policy regulation news",
  "OpenAI Anthropic Google DeepMind news",
  "AI agent autonomous systems",
  "AI safety alignment news",
]

export const digestConfig = {
  sendTime: "0 8 * * *",        // 8am daily
  fetchInterval: "0 */3 * * *", // every 3 hours
  topStoriesPerDigest: 8,
  minScoreForDigest: 7,
  emailRecipient: "you@email.com",
}
```

---

## Error Handling

| Failure | Behavior |
|---|---|
| Perplexity API fails | Log error, skip run, retry next cycle |
| Claude API fails | Store raw story without summary/score, retry next fetch |
| Resend fails | Log failure, show warning in dashboard header |
| All errors | Visible in `fetch_logs`, surfaced as status indicator in UI |

---

## Out of Scope (for now)

- Multi-user support
- Twitter/X API integration
- Mobile app
- Story bookmarking or annotations
- Custom per-category email digests

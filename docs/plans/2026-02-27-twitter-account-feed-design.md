# Twitter Account Feed — Design

**Date:** 2026-02-27
**Status:** Approved

## Goal

Add curated Twitter/X accounts as a second content source alongside Perplexity, so the feed surfaces both general AI news and posts from a hand-picked list of people the user follows.

## Architecture

The Twitter feed slots into the existing pipeline as a parallel fetch source. Both Perplexity and SocialData.tools run concurrently; their results are merged before dedup → Gemini scoring → DB save. No changes to the scoring or storage layer.

```
fetchJob
├── Perplexity queries (existing)
└── SocialData.tools (new)
    └── fetch recent tweets per account
        ├── tweet with no link  → story: url=tweet URL, rawContent=tweet text
        └── tweet with link     → story: url=article URL, rawContent=tweet text

merged → dedup → Gemini scoring → DB
```

## New Files

### `config/accounts.ts`
Flat list of Twitter usernames with categories matching the existing topic filter values.

### `lib/socialdata.ts`
Single exported function:
```ts
fetchTweetsFromAccounts(usernames: string[]): Promise<RawStory[]>
```
- Calls `GET https://api.socialdata.tools/twitter/user/timeline?username={u}&type=Latest` per account
- Auth: `Authorization: Bearer SOCIALDATA_API_KEY`
- Requests run in parallel via `Promise.allSettled`
- Tweet → RawStory mapping:
  - `url`: tweet URL (`https://x.com/username/status/ID`) or first external URL in tweet entities
  - `sourceDomain`: `x.com` or article domain
  - `rawContent`: tweet full text
  - `publishedAt`: tweet `created_at`
- Errors per account are logged and skipped (same pattern as Perplexity query errors)

## Changed Files

### `prisma/schema.prisma`
Add optional field to `Story`:
```prisma
tweetAuthor  String?
```
Populated with the account username when the story originates from a tweet.

### `lib/jobs/fetchJob.ts`
Run both sources in parallel:
```ts
const [perplexityResults, twitterResults] = await Promise.allSettled([
  Promise.allSettled(searchQueries.map(q => fetchStoriesFromPerplexity(q))),
  fetchTweetsFromAccounts(twitterAccounts),
])
```
Merge all `RawStory[]` arrays before passing to dedup.

## Environment Variables

| Variable | Source |
|---|---|
| `SOCIALDATA_API_KEY` | api.socialdata.tools dashboard |

## Accounts

Organised by category (maps to existing topic filter):

**AI Research / General**
aiedge_, levie, omooretweets, mreflow, carlvellotti, slow_developer, petergyang, rubenhassid, minchoi, heyshrutimishra

**AI Agents (OpenClaw)**
openclaw, steipete, AlexFinn, MatthewBerman, johann_sath, DeRonin_

**Industry**
Codie_Sanchez, alliekmiller, ideabrowser, eptwts, gregisenberg, startupideaspod, Lukealexxander, vasuman, eyad_khrais, damianplayer, EXM7777, VibeMarketer_, boringmarketer, viktoroddy, Salmaaboukarr, AndrewBolis

**Technical Expertise**
frankdegods, bcherny, dani_avila7, karpathy, geoffreyhinton, MoonDevOnYT, Hesamation, kloss_xyz, GithubProjects, tom_doerr, googleaidevs, OpenAIDevs

**Research (Prompt Engineering)**
PromptLLM, godofprompt, alex_prompter, promptcowboy, Prompt_Perfect

## Out of Scope

- Substack/newsletter ingestion
- Displaying tweet text natively (tweets surface as stories like any other)
- Per-account weighting or filtering in the UI

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { RawStory } from './perplexity'

let _client: GoogleGenerativeAI | null = null
function getClient() {
  if (!_client) _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  return _client
}

export interface ScoredStory extends RawStory {
  score: number
  summary: string
  category: string
  tweetAuthor?: string
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
- bullets: array of up to 3 short bullet points explaining what happened and why it matters
- category: one of: ${VALID_CATEGORIES.join(', ')}

Scoring guide:
- 9-10: Major model releases, significant safety findings, landmark policy
- 7-8: New research papers with clear impact, company pivots, notable funding
- 5-6: Minor releases, incremental research, general industry news
- 1-4: Opinion pieces, minor updates, duplicates of already-known news

Return ONLY the JSON array, no other text.`

export async function scoreAndSummarizeStories(stories: RawStory[]): Promise<ScoredStory[]> {
  if (stories.length === 0) return []

  const storiesJson = JSON.stringify(stories.map(s => ({
    title: s.title,
    url: s.url,
    sourceDomain: s.sourceDomain,
    rawContent: s.rawContent,
  })))

  const model = getClient().getGenerativeModel({ model: 'gemini-1.5-flash' })
  const result = await model.generateContent(`${SCORING_PROMPT}\n\nStories to score:\n${storiesJson}`)
  const content = result.response.text()

  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim()

  let scored: Array<{ url: string; score: number; bullets: string[]; category: string }> = []
  try {
    scored = JSON.parse(cleaned)
  } catch {
    return stories.map(story => ({
      ...story,
      score: 5,
      summary: JSON.stringify([story.rawContent.slice(0, 120)]),
      category: 'Other',
    }))
  }

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
}

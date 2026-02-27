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

function getScoringPrompt() {
  const today = new Date().toISOString().split('T')[0]
  return `You are an AI news editor curating the most important stories of the day for the AI/ML community. Today is ${today}.

Score each story for importance AND current relevance. Reward stories that are new and breaking; penalise anything old, evergreen, or purely opinion.

Return a JSON array where each item has:
- url: (same as input)
- score: number 1-10 (10 = groundbreaking and current, 7 = notable and recent, 4 = routine, 1 = trivial/stale/noise)
- bullets: array of up to 3 short bullet points explaining what happened and why it matters today
- category: one of: ${VALID_CATEGORIES.join(', ')}

Scoring guide:
- 9-10: Major model releases, significant safety findings, or landmark policy announced THIS WEEK
- 7-8: Significant research, company news, or industry shifts from the last 2 days
- 5-6: Minor releases, incremental research, general industry updates
- 1-4: Opinion pieces, rehashed older news, minor updates, anything not genuinely new

Be strict: the goal is to surface the 10 most important AI stories happening RIGHT NOW, not evergreen content.

Return ONLY the JSON array, no other text.`
}

export async function scoreAndSummarizeStories(stories: RawStory[]): Promise<ScoredStory[]> {
  if (stories.length === 0) return []

  const storiesJson = JSON.stringify(stories.map(s => ({
    title: s.title,
    url: s.url,
    sourceDomain: s.sourceDomain,
    rawContent: s.rawContent,
    publishedAt: s.publishedAt ?? null,
  })))

  const model = getClient().getGenerativeModel({ model: 'gemini-1.5-flash' })
  const result = await model.generateContent(`${getScoringPrompt()}\n\nStories to score:\n${storiesJson}`)
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

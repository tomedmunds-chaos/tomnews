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

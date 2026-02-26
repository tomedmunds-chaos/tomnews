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

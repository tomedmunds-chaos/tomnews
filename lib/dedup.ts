import type { RawStory } from './perplexity'

export function deduplicateStories<T extends RawStory>(incoming: T[], existingUrls: string[]): T[] {
  const seen = new Set(existingUrls)
  const result: T[] = []

  for (const story of incoming) {
    if (!seen.has(story.url)) {
      seen.add(story.url)
      result.push(story)
    }
  }

  return result
}

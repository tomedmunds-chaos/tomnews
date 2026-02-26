import { deduplicateStories } from '../dedup'
import type { RawStory } from '../perplexity'

describe('deduplicateStories', () => {
  const existing = ['https://openai.com/blog/gpt5', 'https://anthropic.com/news']

  it('filters out stories with URLs already in existingUrls', () => {
    const incoming: RawStory[] = [
      { title: 'GPT-5', url: 'https://openai.com/blog/gpt5', sourceDomain: 'openai.com', rawContent: '...' },
      { title: 'New Model', url: 'https://mistral.ai/news', sourceDomain: 'mistral.ai', rawContent: '...' },
    ]
    const result = deduplicateStories(incoming, existing)
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://mistral.ai/news')
  })

  it('returns all stories when no existing URLs', () => {
    const incoming: RawStory[] = [
      { title: 'New Story', url: 'https://new.com', sourceDomain: 'new.com', rawContent: '...' },
    ]
    expect(deduplicateStories(incoming, [])).toHaveLength(1)
  })

  it('deduplicates within the incoming batch itself', () => {
    const incoming: RawStory[] = [
      { title: 'Story A', url: 'https://same.com', sourceDomain: 'same.com', rawContent: '...' },
      { title: 'Story A duplicate', url: 'https://same.com', sourceDomain: 'same.com', rawContent: '...' },
    ]
    expect(deduplicateStories(incoming, [])).toHaveLength(1)
  })
})

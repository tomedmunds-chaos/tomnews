import { fetchStoriesFromPerplexity } from '../perplexity'

// Mock fetch globally
global.fetch = jest.fn()

describe('fetchStoriesFromPerplexity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns parsed stories from Perplexity response', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify([
            {
              title: 'OpenAI releases GPT-5',
              url: 'https://openai.com/blog/gpt5',
              sourceDomain: 'openai.com',
              rawContent: 'OpenAI today announced GPT-5...',
              publishedAt: '2026-02-26T08:00:00Z',
            }
          ])
        }
      }]
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const stories = await fetchStoriesFromPerplexity('AI model release')

    expect(stories).toHaveLength(1)
    expect(stories[0].title).toBe('OpenAI releases GPT-5')
    expect(stories[0].url).toBe('https://openai.com/blog/gpt5')
  })

  it('returns empty array when API call fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 })

    const stories = await fetchStoriesFromPerplexity('AI news')

    expect(stories).toEqual([])
  })
})

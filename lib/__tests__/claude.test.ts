import { scoreAndSummarizeStories } from '../claude'
import Anthropic from '@anthropic-ai/sdk'

jest.mock('@anthropic-ai/sdk')

const mockCreate = jest.fn()
;(Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
  messages: { create: mockCreate },
} as unknown as Anthropic))

describe('scoreAndSummarizeStories', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns scored and categorized stories', async () => {
    const input = [{
      title: 'Anthropic releases Claude 4',
      url: 'https://anthropic.com/claude4',
      sourceDomain: 'anthropic.com',
      rawContent: 'Anthropic today released...',
    }]

    mockCreate.mockResolvedValueOnce({
      content: [{
        text: JSON.stringify([{
          url: 'https://anthropic.com/claude4',
          score: 9.2,
          summary: 'Anthropic released Claude 4 with major capability improvements.',
          category: 'Model Releases',
        }])
      }]
    })

    const result = await scoreAndSummarizeStories(input)

    expect(result).toHaveLength(1)
    expect(result[0].score).toBe(9.2)
    expect(result[0].summary).toBe('Anthropic released Claude 4 with major capability improvements.')
    expect(result[0].category).toBe('Model Releases')
  })

  it('returns empty array on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'))
    const result = await scoreAndSummarizeStories([])
    expect(result).toEqual([])
  })
})

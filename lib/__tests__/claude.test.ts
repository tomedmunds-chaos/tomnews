import { scoreAndSummarizeStories } from '../claude'
import { GoogleGenerativeAI } from '@google/generative-ai'

jest.mock('@google/generative-ai')

const mockGenerateContent = jest.fn()
;(GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(() => ({
  getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
} as unknown as GoogleGenerativeAI))

describe('scoreAndSummarizeStories', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns scored stories with JSON-serialised bullet summary', async () => {
    const input = [{
      title: 'Anthropic releases Claude 4',
      url: 'https://anthropic.com/claude4',
      sourceDomain: 'anthropic.com',
      rawContent: 'Anthropic today released...',
    }]

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify([{
          url: 'https://anthropic.com/claude4',
          score: 9.2,
          bullets: ['Claude 4 released by Anthropic', 'Major capability improvements', 'Available via API now'],
          category: 'Model Releases',
        }]),
      },
    })

    const result = await scoreAndSummarizeStories(input)

    expect(result).toHaveLength(1)
    expect(result[0].score).toBe(9.2)
    expect(result[0].summary).toBe('["Claude 4 released by Anthropic","Major capability improvements","Available via API now"]')
    expect(result[0].category).toBe('Model Releases')
  })

  it('falls back to raw content as single-bullet JSON on parse error', async () => {
    const input = [{
      title: 'Some story',
      url: 'https://example.com',
      sourceDomain: 'example.com',
      rawContent: 'Story content here',
    }]

    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => 'not valid json at all' },
    })

    const result = await scoreAndSummarizeStories(input)
    expect(result[0].summary).toBe(JSON.stringify(['Story content here'.slice(0, 120)]))
  })
})

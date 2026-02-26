import { runFetchJob } from '../fetchJob'
import * as perplexity from '../../perplexity'
import * as claude from '../../claude'
import { prisma } from '../../prisma'

jest.mock('../../perplexity')
jest.mock('../../claude')
jest.mock('../../prisma', () => ({
  prisma: {
    story: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    fetchLog: {
      create: jest.fn(),
    },
  },
}))

describe('runFetchJob', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fetches, scores, deduplicates, and saves new stories', async () => {
    ;(perplexity.fetchStoriesFromPerplexity as jest.Mock).mockResolvedValue([
      { title: 'New AI Story', url: 'https://new.ai/story', sourceDomain: 'new.ai', rawContent: 'content' },
    ])
    ;(claude.scoreAndSummarizeStories as jest.Mock).mockResolvedValue([
      { title: 'New AI Story', url: 'https://new.ai/story', sourceDomain: 'new.ai', rawContent: 'content', score: 8, summary: 'A new AI story.', category: 'Research' },
    ])
    ;(prisma.story.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.story.createMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.fetchLog.create as jest.Mock).mockResolvedValue({})

    const result = await runFetchJob()

    expect(result.storiesFound).toBeGreaterThan(0)
    expect(result.status).toBe('success')
    expect(prisma.story.createMany).toHaveBeenCalled()
    expect(prisma.fetchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'success' }) })
    )
  })

  it('logs error and still creates fetch log on failure', async () => {
    ;(perplexity.fetchStoriesFromPerplexity as jest.Mock).mockRejectedValue(new Error('network error'))
    ;(prisma.story.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.fetchLog.create as jest.Mock).mockResolvedValue({})

    const result = await runFetchJob()

    expect(result.status).toBe('error')
    expect(prisma.fetchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'error' }) })
    )
  })
})

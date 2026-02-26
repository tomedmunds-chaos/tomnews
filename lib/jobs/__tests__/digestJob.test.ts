import { runDigestJob } from '../digestJob'
import { prisma } from '../../prisma'
import { Resend } from 'resend'

jest.mock('../../prisma', () => ({
  prisma: {
    story: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    digest: {
      create: jest.fn(),
    },
  },
}))

jest.mock('resend')
const mockSend = jest.fn()
;(Resend as jest.MockedClass<typeof Resend>).mockImplementation(() => ({
  emails: { send: mockSend },
} as unknown as Resend))

describe('runDigestJob', () => {
  beforeEach(() => jest.clearAllMocks())

  it('skips sending if no qualifying stories found', async () => {
    ;(prisma.story.findMany as jest.Mock).mockResolvedValue([])

    const result = await runDigestJob()

    expect(result.status).toBe('skipped')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends email and marks stories when qualifying stories exist', async () => {
    const mockStories = [
      { id: '1', title: 'GPT-5 Released', url: 'https://openai.com', summary: 'OpenAI released GPT-5.', score: 9, category: 'Model Releases' },
      { id: '2', title: 'EU AI Act', url: 'https://eu.gov', summary: 'EU enforces AI Act.', score: 8, category: 'AI Policy' },
    ]
    ;(prisma.story.findMany as jest.Mock).mockResolvedValue(mockStories)
    mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null })
    ;(prisma.story.updateMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(prisma.digest.create as jest.Mock).mockResolvedValue({})

    const result = await runDigestJob()

    expect(result.status).toBe('success')
    expect(mockSend).toHaveBeenCalled()
    expect(prisma.story.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { includedInDigest: true } })
    )
  })
})

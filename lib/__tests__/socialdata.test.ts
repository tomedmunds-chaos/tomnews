import { fetchTweetsFromAccounts } from '../socialdata'

global.fetch = jest.fn()

describe('fetchTweetsFromAccounts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SOCIALDATA_API_KEY = 'test-key'
  })

  it('maps a plain tweet (no links) to a RawStory with tweet URL', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '111',
            full_text: 'Fascinating new paper on attention mechanisms.',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: { urls: [] },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].url).toBe('https://x.com/karpathy/status/111')
    expect(stories[0].sourceDomain).toBe('x.com')
    expect(stories[0].rawContent).toBe('Fascinating new paper on attention mechanisms.')
    expect(stories[0].tweetAuthor).toBe('karpathy')
  })

  it('uses the external link URL when tweet contains one', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '222',
            full_text: 'Great read: https://t.co/abc',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: {
              urls: [
                { expanded_url: 'https://arxiv.org/abs/2502.12345', display_url: 'arxiv.org/abs/2502.12345' },
              ],
            },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].url).toBe('https://arxiv.org/abs/2502.12345')
    expect(stories[0].sourceDomain).toBe('arxiv.org')
  })

  it('skips an account that returns a non-ok response without throwing', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })

    const stories = await fetchTweetsFromAccounts(['private_account'])

    expect(stories).toHaveLength(0)
  })

  it('merges tweets from multiple accounts', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tweets: [{ id_str: '1', full_text: 'Tweet A', tweet_created_at: '2026-02-27T10:00:00.000Z', user: { screen_name: 'userA' }, entities: { urls: [] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tweets: [{ id_str: '2', full_text: 'Tweet B', tweet_created_at: '2026-02-27T10:00:00.000Z', user: { screen_name: 'userB' }, entities: { urls: [] } }],
        }),
      })

    const stories = await fetchTweetsFromAccounts(['userA', 'userB'])

    expect(stories).toHaveLength(2)
  })
})

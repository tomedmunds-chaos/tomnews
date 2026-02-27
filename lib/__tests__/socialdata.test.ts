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

    // Verify the correct search endpoint is used (not the old /user/timeline one)
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('twitter/search')
    expect(calledUrl).toContain('from%3Akarpathy')
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
    expect(stories[0].imageUrl).toBeUndefined()
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

  it('extracts imageUrl from extended_entities photo media', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '333',
            full_text: 'Check out this chart',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: { urls: [] },
            extended_entities: {
              media: [
                { media_url_https: 'https://pbs.twimg.com/media/abc.jpg', type: 'photo' },
              ],
            },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].imageUrl).toBe('https://pbs.twimg.com/media/abc.jpg')
  })

  it('leaves imageUrl undefined when tweet has no media', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '444',
            full_text: 'Text only tweet',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: { urls: [] },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].imageUrl).toBeUndefined()
  })

  it('extracts imageUrl from video media thumbnail', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tweets: [
          {
            id_str: '555',
            full_text: 'Watch this demo',
            tweet_created_at: '2026-02-27T10:00:00.000Z',
            user: { screen_name: 'karpathy' },
            entities: { urls: [] },
            extended_entities: {
              media: [
                { media_url_https: 'https://pbs.twimg.com/ext_tw_video_thumb/abc/pu/img/thumb.jpg', type: 'video' },
              ],
            },
          },
        ],
      }),
    })

    const stories = await fetchTweetsFromAccounts(['karpathy'])

    expect(stories).toHaveLength(1)
    expect(stories[0].imageUrl).toBe('https://pbs.twimg.com/ext_tw_video_thumb/abc/pu/img/thumb.jpg')
  })
})

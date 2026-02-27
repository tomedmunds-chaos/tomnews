import { fetchOgImage } from '../ogImage'

global.fetch = jest.fn()

describe('fetchOgImage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns og:image URL when property attribute comes first', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><head>
        <meta property="og:image" content="https://example.com/image.jpg" />
      </head></html>`,
    })
    expect(await fetchOgImage('https://example.com/article')).toBe('https://example.com/image.jpg')
  })

  it('returns og:image URL when content attribute comes first', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><head>
        <meta content="https://example.com/image2.jpg" property="og:image" />
      </head></html>`,
    })
    expect(await fetchOgImage('https://example.com/article')).toBe('https://example.com/image2.jpg')
  })

  it('falls back to twitter:image when og:image is absent', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><head>
        <meta name="twitter:image" content="https://example.com/twitter.jpg" />
      </head></html>`,
    })
    expect(await fetchOgImage('https://example.com/article')).toBe('https://example.com/twitter.jpg')
  })

  it('returns null when no image meta tags are present', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><head><title>No images</title></head></html>',
    })
    expect(await fetchOgImage('https://example.com/article')).toBeNull()
  })

  it('returns null on non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 })
    expect(await fetchOgImage('https://example.com/404')).toBeNull()
  })

  it('returns null when fetch throws (timeout or network error)', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('AbortError'))
    expect(await fetchOgImage('https://example.com/slow')).toBeNull()
  })
})

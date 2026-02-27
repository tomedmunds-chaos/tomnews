import { parseBullets } from '../parseBullets'

describe('parseBullets', () => {
  it('parses a JSON array of strings', () => {
    const result = parseBullets('["Point one","Point two","Point three"]')
    expect(result).toEqual(['Point one', 'Point two', 'Point three'])
  })

  it('returns a single-item array for plain text (legacy summaries)', () => {
    const result = parseBullets('This is a plain text summary.')
    expect(result).toEqual(['This is a plain text summary.'])
  })

  it('returns empty array for null', () => {
    expect(parseBullets(null)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseBullets('')).toEqual([])
  })

  it('filters out non-string values from parsed array', () => {
    const result = parseBullets('["valid", 42, null, "also valid"]')
    expect(result).toEqual(['valid', 'also valid'])
  })
})

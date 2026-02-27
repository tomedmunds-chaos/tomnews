export function parseBullets(summary: string | null): string[] {
  if (!summary) return []
  try {
    const parsed = JSON.parse(summary)
    if (Array.isArray(parsed)) {
      return parsed.filter((b): b is string => typeof b === 'string')
    }
  } catch {
    // not JSON — treat as legacy plain-text summary
  }
  return [summary]
}

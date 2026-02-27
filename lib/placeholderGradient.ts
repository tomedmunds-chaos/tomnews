export function getPlaceholderGradient(title: string, category: string | null): string {
  let hash = 5381
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) + hash + title.charCodeAt(i)) & 0x7fffffff
  }
  const angle = hash % 360
  const palettes: Record<string, [string, string]> = {
    'Model Releases': ['#C8102E', '#7a0a1a'],
    'Research':       ['#1a3a6b', '#2d5fa0'],
    'AI Policy':      ['#1a5c2d', '#2e9e50'],
    'Industry':       ['#6b3a1a', '#a05e2d'],
    'AI Safety':      ['#3d1a6b', '#6b2ea0'],
    'AI Agents':      ['#1a4f6b', '#2d8aa0'],
    'Other':          ['#3a3532', '#6b6560'],
  }
  const [c1, c2] = palettes[category ?? 'Other'] ?? palettes['Other']
  return `linear-gradient(${angle}deg, ${c1}, ${c2})`
}

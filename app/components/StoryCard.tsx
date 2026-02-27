import { parseBullets } from '@/lib/parseBullets'

interface Story {
  id: string
  title: string
  url: string
  sourceDomain: string
  summary: string | null
  score: number | null
  category: string | null
  fetchedAt: string
  tweetAuthor?: string | null
  imageUrl?: string | null
}

function getPlaceholderGradient(title: string, category: string | null): string {
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

export function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const score = story.score ?? 0
  const bullets = parseBullets(story.summary)
  const isHighScore = score >= 8
  const timeStr = new Date(story.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <article
      className="group relative py-5 border-b border-rule cursor-pointer pl-0 hover:pl-4 transition-[padding] duration-200 flex gap-4 items-start"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {/* Red left accent — scales in on hover */}
      <div
        className="absolute left-0 top-5 bottom-5 w-[3px] bg-accent scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top"
        aria-hidden="true"
      />

      {/* Thumbnail */}
      <div className="shrink-0 w-20 h-20 rounded-sm overflow-hidden mt-0.5">
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: getPlaceholderGradient(story.title, story.category) }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Headline + score row */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="flex-1 font-display text-[1.15rem] font-bold leading-snug text-ink group-hover:text-accent transition-colors duration-200">
            {story.title}
          </h2>
          <span
            className={`shrink-0 font-label text-sm font-medium tabular-nums ${isHighScore ? 'text-accent' : 'text-muted'}`}
            aria-label={`Score: ${score.toFixed(1)}`}
          >
            {score.toFixed(1)}
          </span>
        </div>

        {/* Thin rule under headline */}
        <div className="mt-2 mb-3 border-t border-rule" aria-hidden="true" />

        {/* Bullets */}
        {bullets.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {bullets.map((b, i) => (
              <li key={i} className="font-body text-sm text-ink leading-relaxed flex gap-2">
                <span className="text-muted shrink-0 mt-0.5" aria-hidden="true">·</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Metadata footer */}
        <div className="font-label text-xs text-muted tracking-wide flex flex-wrap gap-x-3 gap-y-1">
          <span>{story.sourceDomain}</span>
          {story.tweetAuthor && <span>@{story.tweetAuthor}</span>}
          {story.category && <span className="uppercase tracking-widest">{story.category}</span>}
          <span>{timeStr}</span>
        </div>
      </div>
    </article>
  )
}

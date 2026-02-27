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
}

export function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const score = story.score ?? 0
  const scoreColor = score >= 8 ? 'bg-green-100 text-green-800' : score >= 6 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
  const bullets = parseBullets(story.summary)

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 line-clamp-2">{story.title}</p>
          {bullets.length > 0 && (
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              {bullets.map((b, i) => (
                <li key={i} className="text-sm text-gray-600 line-clamp-2">{b}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>{story.sourceDomain}</span>
            {story.tweetAuthor && (
              <>
                <span>·</span>
                <span>@{story.tweetAuthor}</span>
              </>
            )}
            <span>·</span>
            <span>{new Date(story.fetchedAt).toLocaleTimeString()}</span>
            {story.category && (
              <>
                <span>·</span>
                <span className="text-gray-500">{story.category}</span>
              </>
            )}
          </div>
        </div>
        <span className={`shrink-0 text-sm font-bold px-2 py-1 rounded ${scoreColor}`}>
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

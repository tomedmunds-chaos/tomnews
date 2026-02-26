interface Story {
  id: string
  title: string
  url: string
  sourceDomain: string
  summary: string | null
  score: number | null
  category: string | null
  fetchedAt: string
}

export function StoryCard({ story }: { story: Story }) {
  const score = story.score ?? 0
  const scoreColor = score >= 8 ? 'bg-green-100 text-green-800' : score >= 6 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:underline line-clamp-2"
          >
            {story.title}
          </a>
          {story.summary && (
            <p className="mt-1 text-sm text-gray-600">{story.summary}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>{story.sourceDomain}</span>
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

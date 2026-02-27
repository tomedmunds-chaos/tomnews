'use client'

import { useEffect, useState, useRef } from 'react'
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

export function StoryReader({
  stories,
  initialIndex,
  onClose,
}: {
  stories: Story[]
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const story = stories[index]
  const bullets = parseBullets(story.summary)

  function prev() { setIndex(i => Math.max(0, i - 1)) }
  function next() { setIndex(i => Math.min(stories.length - 1, i + 1)) }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const x = e.clientX
    const width = (e.currentTarget as HTMLDivElement).offsetWidth
    if (x < width / 3) prev()
    else next()
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > 60) onClose()
      return
    }
    if (Math.abs(dx) > 30) {
      if (dx < 0) next()
      else prev()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-950 text-white flex flex-col select-none"
      onClick={handleTap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3 pb-1">
        {stories.map((_, i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 rounded-full transition-colors ${i <= index ? 'bg-white' : 'bg-white/25'}`}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        className="absolute top-2 right-3 text-white/60 hover:text-white p-2 text-lg leading-none"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close reader"
      >
        ✕
      </button>

      {/* Story content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-lg mx-auto w-full overflow-hidden">
        <p className="text-sm text-white/40 mb-1">
          {story.sourceDomain}
          {story.tweetAuthor && <span className="ml-2">via @{story.tweetAuthor}</span>}
        </p>
        <h2 className="text-2xl font-bold leading-tight mb-6">{story.title}</h2>
        <ul className="space-y-4 list-disc list-inside">
          {bullets.map((b, i) => (
            <li key={i} className="text-white/80 text-base leading-relaxed">{b}</li>
          ))}
        </ul>
      </div>

      {/* Read full article link */}
      <div className="px-6 pb-8 flex justify-center">
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm border border-white/25 rounded-full px-6 py-2.5 hover:bg-white/10 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Read full article →
        </a>
      </div>
    </div>
  )
}

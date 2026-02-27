'use client'

import { useEffect, useState, useRef } from 'react'
import { parseBullets } from '@/lib/parseBullets'
import { getPlaceholderGradient } from '@/lib/placeholderGradient'

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

export function StoryReader({
  stories,
  initialIndex,
  onClose,
}: {
  stories: Story[]
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(Math.min(Math.max(0, initialIndex), Math.max(0, stories.length - 1)))
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)
  const touchHandledRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const story = stories[index]
  const bullets = parseBullets(story?.summary ?? null)

  function prev() { setIndex(i => Math.max(0, i - 1)) }
  function next() { setIndex(i => Math.min(stories.length - 1, i + 1)) }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(stories.length - 1, i + 1))
      else if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stories.length])

  if (stories.length === 0 || !story) return null

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    if (touchHandledRef.current) {
      touchHandledRef.current = false
      return
    }
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
      if (dy > 60) onCloseRef.current()
      touchHandledRef.current = true
      return
    }
    if (Math.abs(dx) > 30) {
      touchHandledRef.current = true
      if (dx < 0) next()
      else prev()
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={story.title}
      className="fixed inset-0 z-50 flex flex-col select-none"
      style={{ background: '#111009', color: '#F2EFE8' }}
      onClick={handleTap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress bars — absolute z-10 so they sit above the hero */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-3 pt-3 pb-1">
        {stories.map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1 rounded-full transition-colors"
            style={{
              background: i <= index ? '#C8102E' : 'rgba(242,239,232,0.2)',
            }}
          />
        ))}
      </div>

      {/* Close button — absolute z-10 above hero */}
      <button
        className="absolute top-2 right-3 z-10 p-2 text-lg leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-sm"
        style={{ color: 'rgba(242,239,232,0.5)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#F2EFE8')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(242,239,232,0.5)')}
        onFocus={(e) => (e.currentTarget.style.color = '#F2EFE8')}
        onBlur={(e) => (e.currentTarget.style.color = 'rgba(242,239,232,0.5)')}
        onClick={(e) => { e.stopPropagation(); onCloseRef.current() }}
        aria-label="Close reader"
      >
        ✕
      </button>

      {/* Hero image / gradient — 42vh */}
      <div className="relative h-[42vh] shrink-0 overflow-hidden">
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: getPlaceholderGradient(story.title, story.category) }}
            aria-hidden="true"
          />
        )}
        {/* Fade to dark at bottom */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 30%, #111009)' }}
          aria-hidden="true"
        />
      </div>

      {/* Story content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-8 max-w-lg mx-auto w-full">
        {/* Source + author */}
        <p className="font-label text-xs tracking-widest uppercase mb-3" style={{ color: 'rgba(242,239,232,0.45)' }}>
          {story.sourceDomain}
          {story.tweetAuthor && <span className="ml-3">@{story.tweetAuthor}</span>}
        </p>

        {/* Headline */}
        <h2 className="font-display text-3xl font-bold leading-tight mb-6" style={{ color: '#F2EFE8' }}>
          {story.title}
        </h2>

        {/* Bullets */}
        <ul className="space-y-4">
          {bullets.map((b, i) => (
            <li key={i} className="font-body text-base leading-relaxed flex gap-3" style={{ color: 'rgba(242,239,232,0.85)' }}>
              <span style={{ color: '#C8102E' }} className="shrink-0 mt-0.5" aria-hidden="true">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Read full article */}
        <div className="mt-8 flex justify-center">
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-xs tracking-widest uppercase px-6 py-2.5 transition-colors"
            style={{
              border: '1px solid rgba(242,239,232,0.25)',
              borderRadius: '2px',
              color: 'rgba(242,239,232,0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            READ FULL ARTICLE →
          </a>
        </div>
      </div>
    </div>
  )
}

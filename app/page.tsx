'use client'

import { useEffect, useState, useCallback } from 'react'
import { StoryCard } from './components/StoryCard'
import { TopicFilter } from './components/TopicFilter'
import { StatusHeader } from './components/StatusHeader'
import { StoryReader } from './components/StoryReader'

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

export default function Home() {
  const [stories, setStories] = useState<Story[]>([])
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [readerIndex, setReaderIndex] = useState<number | null>(null)

  const loadStories = useCallback(async () => {
    setLoading(true)
    try {
      const params = category !== 'All' ? `?category=${encodeURIComponent(category)}` : ''
      const res = await fetch(`/api/stories${params}`)
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data = await res.json()
      setStories(Array.isArray(data) ? data : [])
    } catch {
      // keep stories as-is on error so the list doesn't vanish
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { loadStories() }, [loadStories])

  return (
    <main className="max-w-2xl mx-auto px-4 pb-20">
      <StatusHeader onRefresh={loadStories} />

      <div className="mt-1 flex justify-end">
        <a
          href="/digests"
          className="font-label text-xs tracking-widest uppercase text-muted hover:text-accent transition-colors"
        >
          DIGEST HISTORY <span aria-hidden="true">→</span>
        </a>
      </div>

      <TopicFilter
        selected={category}
        onChange={(cat) => { setReaderIndex(null); setCategory(cat) }}
      />

      {loading ? (
        <div className="font-label text-xs tracking-widest uppercase text-muted text-center py-20">
          Loading…
        </div>
      ) : stories.length === 0 ? (
        <div className="font-label text-xs tracking-widest uppercase text-muted text-center py-20">
          No stories yet — hit Refresh to fetch
        </div>
      ) : (
        <div>
          {stories.map((story, index) => (
            <StoryCard key={story.id} story={story} onClick={() => setReaderIndex(index)} />
          ))}
        </div>
      )}

      {readerIndex !== null && (
        <StoryReader
          stories={stories}
          initialIndex={readerIndex}
          onClose={() => setReaderIndex(null)}
        />
      )}
    </main>
  )
}

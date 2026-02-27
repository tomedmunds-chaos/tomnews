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
}

export default function Home() {
  const [stories, setStories] = useState<Story[]>([])
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [readerIndex, setReaderIndex] = useState<number | null>(null)

  const loadStories = useCallback(async () => {
    setLoading(true)
    const params = category !== 'All' ? `?category=${encodeURIComponent(category)}` : ''
    const res = await fetch(`/api/stories${params}`)
    const data = await res.json()
    setStories(data)
    setLoading(false)
  }, [category])

  useEffect(() => { loadStories() }, [loadStories])

  return (
    <main className="max-w-2xl mx-auto px-4 pb-16">
      <StatusHeader onRefresh={loadStories} />
      <div className="mt-2 text-right">
        <a href="/digests" className="text-sm text-gray-400 hover:text-gray-700">Digest history →</a>
      </div>
      <div className="mt-4 mb-4">
        <TopicFilter selected={category} onChange={setCategory} />
      </div>
      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading stories...</div>
      ) : stories.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No stories yet. Hit Refresh to fetch.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {stories.map((story, index) => <StoryCard key={story.id} story={story} onClick={() => setReaderIndex(index)} />)}
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

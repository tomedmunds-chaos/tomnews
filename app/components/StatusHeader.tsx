'use client'

import { useEffect, useState } from 'react'

interface Status {
  lastFetch: { ranAt: string; status: string; storiesFound: number; error?: string } | null
  totalStories: number
}

export function StatusHeader({ onRefresh }: { onRefresh: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus)
  }, [])

  async function reloadStatus() {
    const r = await fetch('/api/status')
    const data = await r.json()
    setStatus(data)
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetch('/api/refresh', { method: 'POST' })
    setRefreshing(false)
    await reloadStatus()
    onRefresh()
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).toUpperCase()

  const storyCount = status?.totalStories ?? 0
  const lastFetchTime = status?.lastFetch
    ? new Date(status.lastFetch.ranAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <header className="pt-8 pb-0">
      <div className="relative text-center">
        {/* Refresh — top right */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="absolute right-0 top-1 font-label text-xs tracking-widest uppercase text-muted hover:text-accent transition-colors disabled:opacity-40"
        >
          {refreshing ? 'FETCHING…' : '↺ REFRESH'}
        </button>

        {/* Masthead title */}
        <h1 className="font-display text-5xl font-bold tracking-tight text-ink leading-none">
          The Signal
        </h1>

        {/* Date */}
        <p className="mt-2 font-label text-xs tracking-widest text-muted">
          {dateStr}
        </p>

        {/* Status */}
        <p className="mt-0.5 font-label text-xs tracking-widest text-muted">
          {storyCount} STORIES
          {lastFetchTime && ` · LAST FETCH ${lastFetchTime}`}
          {status?.lastFetch?.status === 'error' && (
            <span className="text-accent ml-2" title={status.lastFetch.error}>
              · FETCH ERROR
            </span>
          )}
        </p>
      </div>

      {/* Double masthead rule */}
      <div className="mt-5 border-t-[3px] border-ink" />
      <div className="mt-0.5 border-t border-ink" />
    </header>
  )
}

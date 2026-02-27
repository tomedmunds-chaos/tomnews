'use client'

import { useEffect, useState, useMemo } from 'react'

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
    try {
      await fetch('/api/refresh', { method: 'POST' })
      await reloadStatus()
      onRefresh()
    } catch (e) {
      console.error('[StatusHeader] Refresh failed:', e)
    } finally {
      setRefreshing(false)
    }
  }

  const dateStr = useMemo(() =>
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).toUpperCase()
  , [])

  const storyCount = status?.totalStories ?? 0
  const lastFetchTime = status?.lastFetch
    ? new Date(status.lastFetch.ranAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <header className="pt-8 pb-0">
      <div className="flex justify-end mb-2">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label={refreshing ? 'Fetching stories, please wait' : 'Refresh stories'}
          className="font-label text-xs tracking-widest uppercase text-muted hover:text-accent transition-colors disabled:opacity-40"
        >
          {refreshing ? 'FETCHING…' : '↺ REFRESH'}
        </button>
      </div>

      <div className="text-center">
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

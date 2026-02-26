'use client'

import { useEffect, useState } from 'react'

interface Status {
  lastFetch: { ranAt: string; status: string; storiesFound: number } | null
  totalStories: number
}

export function StatusHeader({ onRefresh }: { onRefresh: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setStatus)
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetch('/api/refresh', { method: 'POST' })
    setRefreshing(false)
    onRefresh()
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-200">
      <div>
        <h1 className="text-xl font-bold">AI News</h1>
        {status?.lastFetch && (
          <p className="text-xs text-gray-400 mt-0.5">
            Last fetch: {new Date(status.lastFetch.ranAt).toLocaleString()} · {status.totalStories} stories
            {status.lastFetch.status === 'error' && (
              <span className="text-red-500 ml-1">· Fetch error</span>
            )}
          </p>
        )}
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {refreshing ? 'Refreshing...' : 'Refresh now'}
      </button>
    </div>
  )
}

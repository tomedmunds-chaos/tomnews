'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DigestSummary {
  id: string
  sentAt: string
  storyIds: string[]
}

export default function DigestsPage() {
  const [digests, setDigests] = useState<DigestSummary[]>([])

  useEffect(() => {
    fetch('/api/digests').then(r => r.json()).then(setDigests)
  }, [])

  return (
    <main className="max-w-2xl mx-auto px-4 pb-16">
      <div className="py-4 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-xl font-bold">Digest History</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Back to feed</Link>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {digests.length === 0 ? (
          <p className="text-gray-400 text-center py-16">No digests sent yet.</p>
        ) : (
          digests.map(d => (
            <Link
              key={d.id}
              href={`/digests/${d.id}`}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 flex items-center justify-between"
            >
              <span className="font-medium">
                {new Date(d.sentAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <span className="text-sm text-gray-400">{d.storyIds.length} stories</span>
            </Link>
          ))
        )}
      </div>
    </main>
  )
}

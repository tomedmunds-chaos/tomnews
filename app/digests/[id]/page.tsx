'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/digests/${id}`)
        .then(r => r.json())
        .then(d => setHtml(d.emailHtml))
    })
  }, [params])

  return (
    <main className="max-w-2xl mx-auto px-4 pb-16">
      <div className="py-4 border-b border-gray-200">
        <Link href="/digests" className="text-sm text-gray-500 hover:text-gray-900">← Digest history</Link>
      </div>
      {html ? (
        <div className="mt-4" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-gray-400 text-center py-16">Loading...</p>
      )}
    </main>
  )
}

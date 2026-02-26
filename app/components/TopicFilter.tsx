'use client'

const CATEGORIES = ['All', 'Model Releases', 'Research', 'AI Policy', 'Industry', 'AI Safety', 'AI Agents', 'Other']

export function TopicFilter({ selected, onChange }: { selected: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {CATEGORIES.map(cat => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            selected === cat
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

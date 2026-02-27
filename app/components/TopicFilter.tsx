'use client'

const CATEGORIES = ['All', 'Model Releases', 'Research', 'AI Policy', 'Industry', 'AI Safety', 'AI Agents', 'Other']

export function TopicFilter({ selected, onChange }: { selected: string; onChange: (c: string) => void }) {
  return (
    <nav className="py-3 border-b border-rule overflow-x-auto" aria-label="Filter by topic">
      <div className="flex items-center whitespace-nowrap">
        {CATEGORIES.map((cat, i) => (
          <span key={cat} className="flex items-center">
            {i > 0 && (
              <span className="font-label text-xs text-rule px-2 select-none" aria-hidden="true">·</span>
            )}
            <button
              onClick={() => onChange(cat)}
              aria-pressed={selected === cat}
              className={`font-label text-xs tracking-widest uppercase pb-0.5 transition-colors border-b-2 ${
                selected === cat
                  ? 'text-accent border-accent'
                  : 'text-muted border-transparent hover:text-ink'
              }`}
            >
              {cat}
            </button>
          </span>
        ))}
      </div>
    </nav>
  )
}

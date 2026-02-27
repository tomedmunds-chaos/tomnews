# Frontend Redesign — Design

**Date:** 2026-02-27
**Status:** Approved

## Goal

Redesign the app's frontend from the default create-next-app aesthetic to a world-class editorial / newspaper look — sharp, confident, typographically rich, and instantly memorable.

---

## Design Concept

**"The Signal"** — A broadsheet newspaper for the AI age.

Every element is set in type, not assembled from UI components. Sections are separated by horizontal rules, not boxes. The score is a typographic number, not a coloured badge. The masthead is centred and ornamental, like a real newspaper front page.

---

## Design System

### Colour Palette
```
Background   #FAF8F5   warm cream (aged newsprint)
Text         #0F0D0A   near-black ink
Accent       #C8102E   editorial red (high scores, active filter)
Muted        #6B6560   warm gray (metadata, secondary text)
Rule         #D6D0C8   warm divider
```

CSS variables defined in `globals.css`:
```css
--bg:      #FAF8F5;
--ink:     #0F0D0A;
--accent:  #C8102E;
--muted:   #6B6560;
--rule:    #D6D0C8;
```

### Typography
| Role     | Font               | Usage |
|----------|--------------------|-------|
| Display  | Playfair Display   | Masthead, story headlines |
| Body     | Source Serif 4     | Bullet points, body text |
| Label    | DM Mono            | Scores, domains, timestamps, category tags |

All three are Google Fonts, loaded via `next/font/google`.

### Rules
- **No card borders or box shadows.** Sections separated by 1px horizontal rules (`border-[var(--rule)]`).
- **Score is typographic** — DM Mono, red (`var(--accent)`) if ≥ 8, muted gray otherwise. No coloured badges.
- **Category labels** — ALL CAPS DM Mono.
- **Accent red** used sparingly: active filter underline, high scores, hover left-border on cards.

---

## Component Designs

### Masthead (`StatusHeader.tsx`)

Centred layout. Playfair Display title with em-dash ornaments. DM Mono date and status line below. Refresh button as a small inline typographic link top-right.

```
                  —— THE SIGNAL ——
            FRIDAY · 27 FEBRUARY 2026
       48 stories · Last fetch 2:30 PM       [↺ Refresh]
  ─────────────────────────────────────────────────────
```

- Title: `text-4xl font-bold tracking-tight` Playfair Display
- Date/status: `text-xs tracking-widest uppercase` DM Mono, muted color
- Refresh: `text-xs uppercase tracking-widest` DM Mono link button, no background

### Topic Filter (`TopicFilter.tsx`)

Horizontal row of uppercase DM Mono labels separated by `·` spacers. Active category gets a 2px editorial red underline, no fill/background change.

```
ALL  ·  MODEL RELEASES  ·  RESEARCH  ·  AGENTS  ·  INDUSTRY  ·  ...
‾‾‾  (red underline on active)
```

### Story Card (`StoryCard.tsx`)

Full-width, no border box. Score floated right in DM Mono. Headline in Playfair Display. Bullets in Source Serif 4. Footer metadata in DM Mono muted.

```
OpenAI Releases GPT-5 in Surprise Late-Night Drop       9.2
──────────────────────────────────────────────────────────
  · Benchmark results show 15% improvement over GPT-4o
  · Free API tier available immediately at launch
  · First model with native reasoning traces exposed

  openai.com  ·  @karpathy  ·  Model Releases  ·  14:32
```

Hover state: subtle red 2px left border accent animates in.

Score styling:
- `≥ 8.0` → `color: var(--accent)` (editorial red)
- `< 8.0` → `color: var(--muted)` (warm gray)

### Story Reader (`StoryReader.tsx`)

Keeps dark overlay but uses editorial palette inverted:
- Background: `#111009` (near-black warm)
- Text: `#F2EFE8` (warm cream)
- Progress bar fill: `var(--accent)` editorial red (instead of white)
- Source/author: DM Mono muted cream
- Headline: Playfair Display, large
- Bullets: Source Serif 4
- "Read full article →" link: DM Mono, small uppercase

### Page layout (`page.tsx`)

No changes to logic. `max-w-2xl` container stays. Minor padding/gap tweaks to match the editorial spacing rhythm.

---

## Files Changed

| File | Change |
|------|--------|
| `app/globals.css` | New CSS variables, body font, background |
| `app/layout.tsx` | Replace Geist with Playfair Display + Source Serif 4 + DM Mono; update metadata title |
| `app/components/StatusHeader.tsx` | Masthead layout |
| `app/components/TopicFilter.tsx` | Editorial tab style |
| `app/components/StoryCard.tsx` | Full editorial card redesign |
| `app/components/StoryReader.tsx` | Reader updated to editorial inverted palette |
| `app/page.tsx` | Minor spacing adjustments |

---

## Out of Scope

- No changes to API routes, data fetching, or business logic
- No dark/light mode toggle (light only)
- No layout changes to `/digests` or `/login` pages

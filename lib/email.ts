export interface DigestStory {
  title: string
  url: string
  summary: string
  score: number
  category: string
}

export function buildDigestEmail(stories: DigestStory[], date: Date): { subject: string; html: string; text: string } {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const bulletPoints = stories
    .map(s => `<li><strong>${s.title}</strong> — ${s.summary} <em>(${s.score}/10)</em> <a href="${s.url}">[link]</a></li>`)
    .join('\n')

  const textBullets = stories
    .map(s => `• ${s.title} — ${s.summary} (${s.score}/10)\n  ${s.url}`)
    .join('\n\n')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
  <h2 style="border-bottom: 2px solid #111; padding-bottom: 8px;">AI Daily Digest</h2>
  <p style="color: #666;">${dateStr}</p>
  <ul style="line-height: 1.8; padding-left: 20px;">
    ${bulletPoints}
  </ul>
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;">
  <p style="font-size: 12px; color: #999;">Your personal AI news digest</p>
</body>
</html>`

  const text = `AI Daily Digest — ${dateStr}\n\n${textBullets}`

  const subject = `AI Digest — ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return { subject, html, text }
}

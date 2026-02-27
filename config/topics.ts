export const searchQueries = [
  'major AI model release or launch announcement this week',
  'large language model research breakthrough paper 2026',
  'AI policy regulation government news 2026',
  'artificial intelligence startup funding industry news today',
  'AI agent autonomous systems news 2026',
  'AI safety alignment research findings 2026',
]

export const digestConfig = {
  fetchCron: '0 */3 * * *',   // every 3 hours
  digestCron: '0 8 * * *',    // 8am daily
  topStoriesPerDigest: 8,
  minScoreForDigest: 7,
  emailRecipient: process.env.DIGEST_EMAIL_RECIPIENT ?? '',
}

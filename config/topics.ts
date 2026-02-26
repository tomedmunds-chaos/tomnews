export const searchQueries = [
  'AI model release announcement site:openai.com OR site:anthropic.com OR site:deepmind.com OR site:mistral.ai',
  'large language model research paper 2026',
  'AI policy regulation news 2026',
  'artificial intelligence industry news today',
  'AI agent autonomous systems 2026',
  'AI safety alignment research',
]

export const digestConfig = {
  fetchCron: '0 */3 * * *',   // every 3 hours
  digestCron: '0 8 * * *',    // 8am daily
  topStoriesPerDigest: 8,
  minScoreForDigest: 7,
  emailRecipient: process.env.DIGEST_EMAIL_RECIPIENT ?? '',
}

import type { RawStory } from './perplexity'

export interface TweetStory extends RawStory {
  tweetAuthor: string
}

interface SocialDataTweet {
  id_str: string
  full_text: string
  tweet_created_at: string
  user: { screen_name: string }
  entities?: {
    urls?: Array<{ expanded_url: string; display_url: string }>
  }
  extended_entities?: {
    media?: Array<{ media_url_https: string; type: string }>
  }
}

async function fetchUserTweets(username: string): Promise<TweetStory[]> {
  const apiKey = process.env.SOCIALDATA_API_KEY
  if (!apiKey) throw new Error('[socialdata] SOCIALDATA_API_KEY is not set')

  const response = await fetch(
    `https://api.socialdata.tools/twitter/search?query=${encodeURIComponent(`from:${username} -filter:replies`)}&type=Latest`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`SocialData error for @${username} ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json() as { tweets: SocialDataTweet[] }
  const tweets = data.tweets ?? []

  return tweets.map((tweet): TweetStory => {
    const externalUrl = (tweet.entities?.urls ?? []).find(
      u => !u.expanded_url.includes('twitter.com') && !u.expanded_url.includes('x.com')
    )

    const url = externalUrl
      ? externalUrl.expanded_url
      : `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`

    let sourceDomain = 'x.com'
    if (externalUrl) {
      try {
        sourceDomain = new URL(externalUrl.expanded_url).hostname.replace(/^www\./, '')
      } catch {
        sourceDomain = externalUrl.display_url.split('/')[0] ?? 'unknown'
      }
    }

    // Use the first media item regardless of type — all types (photo, video, animated_gif) carry a usable thumbnail in media_url_https
    const mediaItem = (tweet.extended_entities?.media ?? []).find(
      m => m.type === 'photo' || m.type === 'video' || m.type === 'animated_gif'
    )

    return {
      title: tweet.full_text.slice(0, 100),
      url,
      sourceDomain,
      rawContent: tweet.full_text,
      publishedAt: tweet.tweet_created_at,
      tweetAuthor: tweet.user.screen_name,
      // Omit imageUrl entirely (rather than setting undefined) when no media is present
      ...(mediaItem ? { imageUrl: mediaItem.media_url_https } : {}),
    }
  })
}

export async function fetchTweetsFromAccounts(usernames: string[]): Promise<TweetStory[]> {
  const results = await Promise.allSettled(usernames.map(u => fetchUserTweets(u)))

  results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .forEach(r => console.error('[socialdata]', r.reason instanceof Error ? r.reason.message : r.reason))

  return results
    .filter((r): r is PromiseFulfilledResult<TweetStory[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
}

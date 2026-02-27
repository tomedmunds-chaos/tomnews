// Flat list of Twitter/X usernames to monitor.
// Categories map to the existing topic filter values.
export const twitterAccounts: { username: string; category: string }[] = [
  // AI Research / General
  { username: 'aiedge_', category: 'Other' },
  { username: 'levie', category: 'Industry' },
  { username: 'omooretweets', category: 'Other' },
  { username: 'mreflow', category: 'Other' },
  { username: 'carlvellotti', category: 'Other' },
  { username: 'slow_developer', category: 'Other' },
  { username: 'petergyang', category: 'Other' },
  { username: 'rubenhassid', category: 'Other' },
  { username: 'minchoi', category: 'Other' },
  { username: 'heyshrutimishra', category: 'Other' },

  // AI Agents
  { username: 'openclaw', category: 'AI Agents' },
  { username: 'steipete', category: 'AI Agents' },
  { username: 'AlexFinn', category: 'AI Agents' },
  { username: 'MatthewBerman', category: 'AI Agents' },
  { username: 'johann_sath', category: 'AI Agents' },
  { username: 'DeRonin_', category: 'AI Agents' },

  // Industry / Business
  { username: 'Codie_Sanchez', category: 'Industry' },
  { username: 'alliekmiller', category: 'Industry' },
  { username: 'ideabrowser', category: 'Industry' },
  { username: 'eptwts', category: 'Industry' },
  { username: 'gregisenberg', category: 'Industry' },
  { username: 'startupideaspod', category: 'Industry' },
  { username: 'Lukealexxander', category: 'Industry' },
  { username: 'vasuman', category: 'Industry' },
  { username: 'eyad_khrais', category: 'Industry' },
  { username: 'damianplayer', category: 'Industry' },
  { username: 'EXM7777', category: 'Industry' },
  { username: 'VibeMarketer_', category: 'Industry' },
  { username: 'boringmarketer', category: 'Industry' },
  { username: 'viktoroddy', category: 'Industry' },
  { username: 'Salmaaboukarr', category: 'Industry' },
  { username: 'AndrewBolis', category: 'Industry' },

  // Technical Expertise
  { username: 'frankdegods', category: 'Research' },
  { username: 'bcherny', category: 'Research' },
  { username: 'dani_avila7', category: 'Research' },
  { username: 'karpathy', category: 'Research' },
  { username: 'geoffreyhinton', category: 'AI Safety' },
  { username: 'MoonDevOnYT', category: 'Research' },
  { username: 'Hesamation', category: 'Research' },
  { username: 'kloss_xyz', category: 'Research' },
  { username: 'GithubProjects', category: 'Research' },
  { username: 'tom_doerr', category: 'Research' },
  { username: 'googleaidevs', category: 'Research' },
  { username: 'OpenAIDevs', category: 'Model Releases' },

  // Prompt Engineering
  { username: 'PromptLLM', category: 'Research' },
  { username: 'godofprompt', category: 'Research' },
  { username: 'alex_prompter', category: 'Research' },
  { username: 'promptcowboy', category: 'Research' },
  { username: 'Prompt_Perfect', category: 'Research' },
]

export const twitterUsernames = twitterAccounts.map(a => a.username)

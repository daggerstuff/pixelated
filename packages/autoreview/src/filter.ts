import { parse as parseYaml } from 'yaml'

/** Minimal comment shape the filter operates on (no body needed). */
export interface CommentLike {
  id: string
  authorLogin: string
  authorAssociation: string
}

export interface BotFilterConfig {
  /** Treat comments with `authorAssociation: "NONE"` as bots. Default true. */
  noneAssociationIsBot?: boolean
  /** Author logins ending with any of these suffixes are bots. */
  botSuffixes?: string[]
  /** Exact author logins considered bots. */
  botUsernames?: string[]
  /** Trusted AI reviewers that are never filtered (checked before bot rules). */
  whitelist?: string[]
}

export const DEFAULT_BOT_SUFFIXES = ['[bot]', '-ai', '-app', '-reviewer']
export const DEFAULT_BOT_USERNAMES = [
  'dependabot',
  'vercel',
  'github-actions',
  'sentry-io',
]

export const DEFAULT_BOT_FILTER_YAML = `none_association_is_bot: true
bot_suffixes:
  - "[bot]"
  - "-ai"
  - "-app"
  - "-reviewer"
bot_usernames:
  - dependabot
  - vercel
  - github-actions
  - sentry-io
whitelist: []
`

type NormalizedConfig = {
  noneAssociationIsBot: boolean
  botSuffixes: string[]
  botUsernames: string[]
  whitelist: string[]
}

function normalize(config?: BotFilterConfig): NormalizedConfig {
  return {
    noneAssociationIsBot: config?.noneAssociationIsBot ?? true,
    botSuffixes: config?.botSuffixes ?? [...DEFAULT_BOT_SUFFIXES],
    botUsernames: config?.botUsernames ?? [...DEFAULT_BOT_USERNAMES],
    whitelist: config?.whitelist ?? [],
  }
}

/**
 * Classifies PR comments as bot-authored using `authorAssociation` plus
 * configurable username patterns, instead of a hardcoded username list.
 */
export class BotCommentFilter {
  private readonly config: NormalizedConfig

  constructor(config?: BotFilterConfig) {
    this.config = normalize(config)
  }

  isBot(comment: CommentLike): boolean {
    const login = comment.authorLogin.trim()
    if (this.config.whitelist.includes(login)) {
      return false
    }
    if (this.config.botUsernames.includes(login)) {
      return true
    }
    if (this.config.botSuffixes.some((suffix) => login.endsWith(suffix))) {
      return true
    }
    if (
      this.config.noneAssociationIsBot &&
      comment.authorAssociation === 'NONE'
    ) {
      return true
    }
    return false
  }

  filter<T extends CommentLike>(comments: T[]): T[] {
    return comments.filter((comment) => !this.isBot(comment))
  }
}

interface RawBotFilterConfig {
  none_association_is_bot?: unknown
  bot_suffixes?: unknown
  bot_usernames?: unknown
  whitelist?: unknown
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const list = value.filter((item): item is string => typeof item === 'string')
  return list.length > 0 ? list : undefined
}

/** Parses a YAML string into a bot-filter config (unknown fields ignored). */
export function parseBotFilterConfigYaml(yamlText: string): BotFilterConfig {
  const parsed = parseYaml(yamlText) as RawBotFilterConfig | null
  const raw = parsed ?? {}
  return {
    noneAssociationIsBot:
      typeof raw.none_association_is_bot === 'boolean'
        ? raw.none_association_is_bot
        : undefined,
    botSuffixes: asStringList(raw.bot_suffixes),
    botUsernames: asStringList(raw.bot_usernames),
    whitelist: asStringList(raw.whitelist),
  }
}

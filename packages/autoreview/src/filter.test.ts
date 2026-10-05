import { describe, expect, it } from 'vitest'

import {
  BotCommentFilter,
  DEFAULT_BOT_FILTER_YAML,
  parseBotFilterConfigYaml,
  type CommentLike,
} from './filter'

function comment(overrides: Partial<CommentLike> = {}): CommentLike {
  return {
    id: '1',
    authorLogin: 'human',
    authorAssociation: 'MEMBER',
    ...overrides,
  }
}

describe('BotCommentFilter', () => {
  const filter = new BotCommentFilter()

  it('flags authorAssociation NONE', () => {
    expect(
      filter.isBot(
        comment({ authorLogin: 'rando', authorAssociation: 'NONE' }),
      ),
    ).toBe(true)
  })

  it.each(['[bot]', '-ai', '-app', '-reviewer'])(
    'flags username ending with %s',
    (suffix) => {
      expect(
        filter.isBot(
          comment({
            authorLogin: `tool${suffix}`,
            authorAssociation: 'CONTRIBUTOR',
          }),
        ),
      ).toBe(true)
    },
  )

  it.each(['dependabot', 'vercel', 'github-actions', 'sentry-io'])(
    'flags exact username %s',
    (name) => {
      expect(
        filter.isBot(
          comment({ authorLogin: name, authorAssociation: 'COLLABORATOR' }),
        ),
      ).toBe(true)
    },
  )

  it('does not flag a normal human comment', () => {
    expect(
      filter.isBot(
        comment({ authorLogin: 'alice', authorAssociation: 'MEMBER' }),
      ),
    ).toBe(false)
  })

  it('filters bot comments from a list', () => {
    const comments = [
      comment({ id: 'a', authorLogin: 'human', authorAssociation: 'MEMBER' }),
      comment({ id: 'b', authorLogin: 'ci[bot]', authorAssociation: 'NONE' }),
      comment({
        id: 'c',
        authorLogin: 'dependabot',
        authorAssociation: 'CONTRIBUTOR',
      }),
    ]
    expect(filter.filter(comments).map((c) => c.id)).toEqual(['a'])
  })

  it('whitelist overrides bot rules', () => {
    const whitelisted = new BotCommentFilter({
      whitelist: ['trusted-reviewer'],
    })
    expect(
      whitelisted.isBot(
        comment({ authorLogin: 'trusted-reviewer', authorAssociation: 'NONE' }),
      ),
    ).toBe(false)
  })

  it('can disable the NONE-association rule', () => {
    const strict = new BotCommentFilter({ noneAssociationIsBot: false })
    expect(
      strict.isBot(
        comment({ authorLogin: 'rando', authorAssociation: 'NONE' }),
      ),
    ).toBe(false)
  })
})

describe('parseBotFilterConfigYaml', () => {
  it('round-trips the default YAML into the default config', () => {
    const config = parseBotFilterConfigYaml(DEFAULT_BOT_FILTER_YAML)
    expect(config.botSuffixes).toEqual(['[bot]', '-ai', '-app', '-reviewer'])
    expect(config.botUsernames).toEqual([
      'dependabot',
      'vercel',
      'github-actions',
      'sentry-io',
    ])
    expect(config.noneAssociationIsBot).toBe(true)
  })

  it('ignores unknown fields and empty lists', () => {
    const config = parseBotFilterConfigYaml(
      'bot_suffixes: []\nunknown: 1\nwhitelist:\n  - keepme',
    )
    expect(config.botSuffixes).toBeUndefined()
    expect(config.whitelist).toEqual(['keepme'])
  })
})

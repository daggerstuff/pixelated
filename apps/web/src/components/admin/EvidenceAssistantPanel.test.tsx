import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EvidenceAssistantResponse } from '../../lib/api/evidence-assistant'
import { EvidenceAssistantPanel } from './EvidenceAssistantPanel'

const { mockedHookState, useEvidenceAssistantMock } = vi.hoisted(() => ({
  mockedHookState: {
    loading: false,
    error: null as Error | null,
    response: null as EvidenceAssistantResponse | null,
    groundedAnswerAvailable: true,
  },
  useEvidenceAssistantMock: vi.fn(),
}))

const mockSearch = vi.fn()
const mockReset = vi.fn()
const mockCancel = vi.fn()

vi.mock('../../hooks/useEvidenceAssistant', () => ({
  useEvidenceAssistant: useEvidenceAssistantMock,
}))

const mockResponse: EvidenceAssistantResponse = {
  query: 'How should crisis responses be escalated? ',
  answer:
    'Escalation should prioritize active-risk signals and follow internal playbooks.',
  providerUsed: 'local',
  results: [
    {
      id: 'docs/crisis-playbook',
      title: 'Crisis Playbook',
      content:
        'The crisis playbook defines escalation flow when active risk is detected in private settings.',
      url: '/docs/crisis-playbook',
      collection: 'docs',
      score: 11,
      excerpt:
        '...the crisis playbook defines escalation flow when active risk is detected in private settings...',
      matchedTerms: ['crisis'],
      tags: ['safety'],
      category: 'compliance',
    },
  ],
  citations: [
    {
      index: 1,
      title: 'Crisis Playbook',
      url: '/docs/crisis-playbook',
      collection: 'docs',
    },
  ],
  warnings: [
    'No configured provider available for live grounding in this environment.',
  ],
}

const renderPanel = async () => {
  cleanup()
  const result = render(<EvidenceAssistantPanel />)
  await screen.findByRole('combobox')
  return result
}

describe('EvidenceAssistantPanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    useEvidenceAssistantMock.mockImplementation(() => {
      return {
        ...mockedHookState,
        search: mockSearch,
        reset: mockReset,
        cancel: mockCancel,
      }
    })
    mockedHookState.loading = false
    mockedHookState.error = null
    mockedHookState.response = null
    mockedHookState.groundedAnswerAvailable = true
    mockSearch.mockReset()
    mockReset.mockReset()
    mockCancel.mockReset()
  })

  it('runs search with trimmed query and selected collection', async () => {
    await renderPanel()

    const queryInput = screen.getByPlaceholderText(
      /internal docs define crisis sensitivity requirements/i,
    )
    const collectionSelect = screen.getByRole('combobox')
    fireEvent.change(queryInput, {
      target: { value: '   how to escalate crisis   ' },
    })
    fireEvent.change(collectionSelect, { target: { value: 'docs' } })

    const submitButton = screen.getByRole('button', {
      name: /run evidence search/i,
    })
    fireEvent.click(submitButton)

    expect(mockSearch).toHaveBeenCalledTimes(1)
    expect(mockSearch).toHaveBeenCalledWith({
      query: 'how to escalate crisis',
      collection: 'docs',
      generateAnswer: true,
      limit: 6,
    })
  })

  it('renders answer, provider badge, results, and warnings from response', async () => {
    mockedHookState.response = mockResponse
    await renderPanel()

    expect(screen.getByText('Grounded answer')).toBeVisible()
    expect(screen.getByText('local', { exact: false })).toBeInTheDocument()
    expect(
      screen.getByText(/Escalation should prioritize active-risk signals/i),
    ).toBeInTheDocument()
    expect(screen.getByText('[1] Crisis Playbook')).toBeInTheDocument()
    expect(
      screen.getByText(
        'No configured provider available for live grounding in this environment.',
      ),
    ).toBeInTheDocument()
  })

  it('resets local state and hook state when reset clicked', async () => {
    mockedHookState.response = mockResponse
    await renderPanel()

    const queryInput = screen.getByPlaceholderText(
      /internal docs define crisis sensitivity requirements/i,
    )
    const collectionSelect = screen.getByRole('combobox')
    const generateAnswerCheckbox = screen.getByRole('checkbox', {
      name: /Generate grounded answer/i,
    })

    fireEvent.change(queryInput, {
      target: { value: 'How do we handle crisis escalation safely?' },
    })
    fireEvent.change(collectionSelect, { target: { value: 'pages' } })
    fireEvent.click(generateAnswerCheckbox)

    expect((queryInput as HTMLInputElement).value).toBe(
      'How do we handle crisis escalation safely?',
    )
    expect((collectionSelect as HTMLSelectElement).value).toBe('pages')
    expect((generateAnswerCheckbox as HTMLInputElement).checked).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Reset/i }))

    expect(mockReset).toHaveBeenCalledTimes(1)
    await waitFor(() => expect((queryInput as HTMLInputElement).value).toBe(''))
    expect((collectionSelect as HTMLSelectElement).value).toBe('')
    expect((generateAnswerCheckbox as HTMLInputElement).checked).toBe(true)
  })

  it('disables search while loading', async () => {
    mockedHookState.loading = true
    await renderPanel()

    const submitButton = screen.getByRole('button', {
      name: /searching\.\.\./i,
    })

    expect(submitButton).toBeDisabled()
    expect(submitButton).toHaveTextContent('Searching...')

    expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it('disables search for empty query', async () => {
    await renderPanel()

    const submitButton = screen.getByRole('button', {
      name: /run evidence search/i,
    })

    expect(submitButton).toBeDisabled()
    expect(submitButton).toHaveTextContent('Run evidence search')
  })

  it('disables grounded answer generation when no provider is available', async () => {
    mockedHookState.groundedAnswerAvailable = false
    await renderPanel()

    const generateAnswerCheckbox = screen.getByRole('checkbox', {
      name: /Generate grounded answer/i,
    })
    expect(generateAnswerCheckbox).toBeDisabled()
    expect(generateAnswerCheckbox).not.toBeChecked()
    expect(
      screen.getByText(
        'Grounded answers are unavailable: no AI provider is configured. Citations only mode is active.',
      ),
    ).toBeInTheDocument()
  })

  it('renders hook-reported errors', async () => {
    mockedHookState.error = new Error(
      'search endpoint is temporarily unavailable',
    )
    await renderPanel()

    expect(
      screen.getByText('search endpoint is temporarily unavailable'),
    ).toBeInTheDocument()
  })
})

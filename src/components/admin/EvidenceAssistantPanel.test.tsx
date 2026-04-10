import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EvidenceAssistantPanel } from './EvidenceAssistantPanel'
import type { EvidenceAssistantResponse } from '@/lib/api/evidence-assistant'

const mockSearch = vi.fn()
const mockReset = vi.fn()
const mockCancel = vi.fn()

const hookState: {
  loading: boolean
  error: Error | null
  response: EvidenceAssistantResponse | null
  groundedAnswerAvailable: boolean | null
} = {
  loading: false,
  error: null,
  response: null,
  groundedAnswerAvailable: true,
}

const useEvidenceAssistantMock = vi.fn(() => ({
  ...hookState,
  search: mockSearch,
  reset: mockReset,
  cancel: mockCancel,
}))

vi.mock('@/hooks/useEvidenceAssistant', () => ({
  useEvidenceAssistant: useEvidenceAssistantMock,
}))

const mockResponse: EvidenceAssistantResponse = {
  query: 'How should crisis responses be escalated? ',
  answer: 'Escalation should prioritize active-risk signals and follow internal playbooks.',
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
  warnings: ['No configured provider available for live grounding in this environment.'],
}

const renderPanel = () => {
  return render(<EvidenceAssistantPanel />)
}

describe('EvidenceAssistantPanel', () => {
  beforeEach(() => {
    hookState.loading = false
    hookState.error = null
    hookState.response = null
    hookState.groundedAnswerAvailable = true
    mockSearch.mockReset()
    mockReset.mockReset()
  })

  it('runs search with trimmed query and selected collection', () => {
    renderPanel()

    const queryInput = screen.getByPlaceholderText(
      /which internal docs define crisis sensitivity requirements/i,
    )
    fireEvent.change(queryInput, { target: { value: '   how to escalate crisis   ' } })

    const collectionSelect = screen.getByRole('combobox')
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

  it('renders answer, provider badge, results, and warnings from response', () => {
    hookState.response = mockResponse
    renderPanel()

    expect(screen.getByText('Grounded answer')).toBeVisible()
    expect(
      screen.getByText('local', { exact: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Escalation should prioritize active-risk signals'),
    ).toBeInTheDocument()
    expect(screen.getByText('[1] Crisis Playbook')).toBeInTheDocument()
    expect(screen.getByText('No configured provider available for live grounding in this environment.')).toBeInTheDocument()
  })

  it('resets local state and hook state when reset clicked', () => {
    hookState.response = mockResponse
    renderPanel()

    const queryInput = screen.getByPlaceholderText(
      /which internal docs define crisis sensitivity requirements/i,
    ) as HTMLTextAreaElement
    const collectionSelect = screen.getByRole('combobox') as HTMLSelectElement
    const generateAnswerCheckbox = screen.getByRole('checkbox', {
      name: /Generate grounded answer/i,
    }) as HTMLInputElement

    fireEvent.change(queryInput, {
      target: { value: 'How do we handle crisis escalation safely?' },
    })
    fireEvent.change(collectionSelect, { target: { value: 'pages' } })
    fireEvent.click(generateAnswerCheckbox)

    expect(queryInput.value).toBe('How do we handle crisis escalation safely?')
    expect(collectionSelect.value).toBe('pages')
    expect(generateAnswerCheckbox.checked).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Reset/i }))

    expect(mockReset).toHaveBeenCalledTimes(1)
    expect(queryInput.value).toBe('')
    expect(collectionSelect.value).toBe('')
    expect(generateAnswerCheckbox.checked).toBe(true)
  })

  it('disables search while loading', () => {
    hookState.loading = true
    renderPanel()

    const submitButton = screen.getByRole('button', {
      name: /searching\.\.\./i,
    })

    expect(submitButton).toBeDisabled()
    expect(submitButton).toHaveTextContent('Searching...')

    expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it('disables search for empty query', () => {
    renderPanel()

    const submitButton = screen.getByRole('button', {
      name: /run evidence search/i,
    })

    expect(submitButton).toBeDisabled()
    expect(submitButton).toHaveTextContent('Run evidence search')
  })

  it('disables grounded answer generation when no provider is available', () => {
    hookState.groundedAnswerAvailable = false
    renderPanel()

    const generateAnswerCheckbox = screen.getByRole('checkbox', {
      name: /Generate grounded answer/i,
    }) as HTMLInputElement
    expect(generateAnswerCheckbox).toBeDisabled()
    expect(generateAnswerCheckbox).not.toBeChecked()
    expect(
      screen.getByText(
        'Grounded answers are unavailable: no AI provider is configured. Citations only mode is active.',
      ),
    ).toBeInTheDocument()
  })

  it('renders hook-reported errors', () => {
    hookState.error = new Error('search endpoint is temporarily unavailable')
    renderPanel()

    expect(screen.getByText('search endpoint is temporarily unavailable')).toBeInTheDocument()
  })
})

import { dlpService } from '../../../lib/security/dlp'

type RecordLike = Record<string, unknown>

const isRecordLike = (value: unknown): value is RecordLike => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

type RuleUpdatedDetail = {
  id: string
  name: string
  isActive: boolean
}

type RuleDeletedDetail = {
  id: string
  name?: string
}

const isRuleUpdatedDetail = (
  detail: unknown,
): detail is RuleUpdatedDetail => {
  if (!isRecordLike(detail)) {
    return false
  }

  return (
    'id' in detail &&
    'name' in detail &&
    'isActive' in detail &&
    typeof detail.id === 'string' &&
    typeof detail.name === 'string' &&
    typeof detail.isActive === 'boolean'
  )
}

const isRuleDeletedDetail = (
  detail: unknown,
): detail is RuleDeletedDetail => {
  if (!isRecordLike(detail)) {
    return false
  }

  return (
    'id' in detail &&
    typeof detail.id === 'string'
  )
}

// Function to handle rule updates
function handleRuleUpdated(event: Event): void {
  if (!(event instanceof CustomEvent)) {
    return
  }
  const detail: unknown = event.detail
  if (!isRuleUpdatedDetail(detail)) {
    return
  }

  const { id, name, isActive } = detail
  console.log(
    `Rule updated: ${name} (${id}) is now ${isActive ? 'active' : 'inactive'}`,
  )
}

// Function to handle rule deletions
function handleRuleDeleted(event: Event): void {
  if (!(event instanceof CustomEvent)) {
    return
  }
  const detail: unknown = event.detail
  if (!isRuleDeletedDetail(detail)) {
    return
  }

  const { id, name } = detail
  console.log(`Rule deleted: ${name} (${id})`)

  // Find and remove the deleted rule element
  const ruleElement = document.querySelector(`[data-rule-id="${id}"]`)
  if (ruleElement instanceof HTMLElement) {
    ruleElement.parentElement?.remove()
  }

  // Check if there are no more rules after removal
  const rulesList = document.querySelector('.rules-list .space-y-4')
  if (rulesList instanceof HTMLElement && rulesList.children.length === 0) {
    // Show the "No rules" message
    const noRulesCard = document.createElement('div')
    noRulesCard.className = 'card'
    noRulesCard.innerHTML = `
      <div class="py-8">
        <p class="text-center text-muted-foreground">
          No DLP rules found. Add a rule to get started.
        </p>
      </div>
    `
    rulesList.parentNode?.replaceChild(noRulesCard, rulesList)
  }
}

// Function to handle delete button clicks
function handleDeleteClick(e: Event): void {
  e.preventDefault()
  e.stopPropagation()

  if (!(e.currentTarget instanceof HTMLButtonElement)) {
    return
  }
  const button = e.currentTarget
  const ruleId = button.getAttribute('data-rule-id')
  const ruleName = button.getAttribute('data-rule-name')

  if (!ruleId) {
    return
  }

  // Remove the rule from the service
  dlpService.removeRule(ruleId)

  // Dispatch custom event
  const event = new CustomEvent('dlp:rule-deleted', {
    detail: {
      id: ruleId,
      name: ruleName,
    },
    bubbles: true,
  })
  document.dispatchEvent(event)
}

// Set up event listeners when the script loads
function setupEventListeners() {
  const handleRuleUpdatedListener = (e: Event) => {
    if (e instanceof CustomEvent) {
      handleRuleUpdated(e)
    }
  }
  const handleRuleDeletedListener = (e: Event) => {
    if (e instanceof CustomEvent) {
      handleRuleDeleted(e)
    }
  }

  // Add click handlers to delete buttons
  document.querySelectorAll('.delete-rule-btn').forEach((button) => {
    button.addEventListener('click', handleDeleteClick)
  })

  document.addEventListener('dlp:rule-updated', handleRuleUpdatedListener)
  document.addEventListener('dlp:rule-deleted', handleRuleDeletedListener)

  // Clean up event listeners when the component unmounts
  return () => {
    document.removeEventListener('dlp:rule-updated', handleRuleUpdatedListener)
    document.removeEventListener('dlp:rule-deleted', handleRuleDeletedListener)
    document.querySelectorAll('.delete-rule-btn').forEach((button) => {
      button.removeEventListener('click', handleDeleteClick)
    })
  }
}

// Initialize the component
const cleanup = setupEventListeners()

// Clean up event listeners when the script is unloaded
window.addEventListener('unload', cleanup)

// [DEBUG] Removed custom ImportMeta augmentation to resolve conflict with Vite's built-in types.

// Export the cleanup function in case it's needed elsewhere
// Note: HMR support removed to avoid TypeScript module configuration issues

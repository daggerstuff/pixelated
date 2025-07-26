import type { CompatibilityIssue } from '../types/testing'

/**
 * Adds a new compatibility issue to localStorage
 */
export function addIssue(issue: CompatibilityIssue): void {
  const issues = getStoredIssues()
  issues.push({ ...issue, id: Date.now() })
  localStorage.setItem('compatibility-issues', JSON.stringify(issues))
  displayIssues()
}

/**
 * Removes a compatibility issue from localStorage by ID
 */
export function removeIssue(id: number): void {
  const issues = getStoredIssues()
  const filteredIssues = issues.filter((issue) => issue.id !== id)
  localStorage.setItem('compatibility-issues', JSON.stringify(filteredIssues))
  displayIssues()
}

/**
 * Displays all stored compatibility issues in the DOM
 */
export function displayIssues(): void {
  const issues = getStoredIssues()
  const container = document.getElementById('issues-container')

  if (!container) {
    return
  }

  if (issues.length === 0) {
    container.innerHTML = '<p>No issues reported yet.</p>'
    return
  }

  container.innerHTML = issues
    .map(
      (issue) => `
    <div class="issue-item">
      <div class="issue-header">
        <span class="issue-title">${issue.component} - ${issue.browser}</span>
        <span class="issue-severity ${issue.severity}">${issue.severity}</span>
      </div>
      <p class="issue-description">${issue.description}</p>
      <button
        class="btn btn-danger btn-sm"
        onclick="window.compatibilityTesting.removeIssue(${issue.id})"
        aria-label="Remove issue for ${issue.component} in ${issue.browser}"
      >
        Remove
      </button>
    </div>
  `,
    )
    .join('')
}

/**
 * Gets all stored compatibility issues from localStorage
 */
function getStoredIssues(): CompatibilityIssue[] {
  return JSON.parse(
    localStorage.getItem('compatibility-issues') || '[]',
  ) as CompatibilityIssue[]
}

// Add removeIssue to window object for onclick handlers
declare global {
  interface Window {
    compatibilityTesting: {
      removeIssue: (id: number) => void
    }
  }
}

window.compatibilityTesting = {
  removeIssue,
}

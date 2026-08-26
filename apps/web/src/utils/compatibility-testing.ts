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
export function displayIssues() {
  const issues = getStoredIssues()
  const container = document.getElementById('issues-container')!

  if (!container) {
    return
  }

  if (issues.length === 0) {
    container.innerHTML = '<p>No issues reported yet.</p>'
    return
  }

  // Build DOM nodes with textContent (never innerHTML) so stored issue data
  // cannot inject scripts.
  container.replaceChildren(
    ...issues.map((issue) => {
      const item = document.createElement('div')
      item.className = 'issue-item'

      const header = document.createElement('div')
      header.className = 'issue-header'

      const title = document.createElement('span')
      title.className = 'issue-title'
      title.textContent = `${issue.component} - ${issue.browser}`

      const severity = document.createElement('span')
      severity.className = `issue-severity ${issue.severity}`
      severity.textContent = issue.severity

      header.append(title, severity)

      const description = document.createElement('p')
      description.className = 'issue-description'
      description.textContent = issue.description

      const removeButton = document.createElement('button')
      removeButton.className = 'btn btn-danger btn-sm'
      removeButton.textContent = 'Remove'
      removeButton.setAttribute(
        'aria-label',
        `Remove issue for ${issue.component} in ${issue.browser}`,
      )
      removeButton.addEventListener('click', () => {
        if (typeof issue.id === 'number') {
          removeIssue(issue.id)
        }
      })

      item.append(header, description, removeButton)
      return item
    }),
  )
}

/**
 * Gets all stored compatibility issues from localStorage
 */
function getStoredIssues(): CompatibilityIssue[] {
  return JSON.parse(
    localStorage.getItem('compatibility-issues') ?? '[]',
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

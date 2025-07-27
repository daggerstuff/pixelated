import { dlpService } from '../../../lib/security/dlp';

// Function to handle rule updates
function handleRuleUpdated(event: CustomEvent) {
  const { id, name, isActive } = event.detail;
  console.log(
    `Rule updated: ${name} (${id}) is now ${isActive ? 'active' : 'inactive'}`,
  );
}

// Function to handle rule deletions
function handleRuleDeleted(event: CustomEvent) {
  const { id, name } = event.detail;
  console.log(`Rule deleted: ${name} (${id})`);

  // Find and remove the deleted rule element
  const ruleElement = document.querySelector(`[data-rule-id="${id}"]`);
  ruleElement?.parentElement?.remove();

  // Check if there are no more rules after removal
  const rulesList = document.querySelector('.rules-list .space-y-4');
  if (rulesList && rulesList.children.length === 0) {
    // Show the "No rules" message
    const noRulesCard = document.createElement('div');
    noRulesCard.className = 'card';
    noRulesCard.innerHTML = `
      <div class="py-8">
        <p class="text-center text-muted-foreground">
          No DLP rules found. Add a rule to get started.
        </p>
      </div>
    `;
    rulesList.parentNode?.replaceChild(noRulesCard, rulesList);
  }
}

// Function to handle delete button clicks
function handleDeleteClick(e: Event) {
  e.preventDefault();
  e.stopPropagation();

  const button = e.currentTarget as HTMLButtonElement;
  const ruleId = button.getAttribute('data-rule-id');
  const ruleName = button.getAttribute('data-rule-name');

  if (!ruleId) {
    return;
  }

  // Remove the rule from the service
  dlpService.removeRule(ruleId);

  // Dispatch custom event
  const event = new CustomEvent('dlp:rule-deleted', {
    detail: {
      id: ruleId,
      name: ruleName
    },
    bubbles: true
  });
  document.dispatchEvent(event);
}

// Set up event listeners when the script loads
function setupEventListeners() {
  const handleRuleUpdatedListener = (e: Event) =>
    handleRuleUpdated(e as CustomEvent);
  const handleRuleDeletedListener = (e: Event) =>
    handleRuleDeleted(e as CustomEvent);

  // Add click handlers to delete buttons
  document.querySelectorAll('.delete-rule-btn').forEach(button => {
    button.addEventListener('click', handleDeleteClick);
  });

  document.addEventListener('dlp:rule-updated', handleRuleUpdatedListener);
  document.addEventListener('dlp:rule-deleted', handleRuleDeletedListener);

  // Clean up event listeners when the component unmounts
  return () => {
    document.removeEventListener('dlp:rule-updated', handleRuleUpdatedListener);
    document.removeEventListener('dlp:rule-deleted', handleRuleDeletedListener);
    document.querySelectorAll('.delete-rule-btn').forEach(button => {
      button.removeEventListener('click', handleDeleteClick);
    });
  };
}

// Initialize the component
const cleanup = setupEventListeners();

// Clean up event listeners when the script is unloaded
window.addEventListener('unload', cleanup);

// [DEBUG] Removed custom ImportMeta augmentation to resolve conflict with Vite's built-in types.

// Export the cleanup function in case it's needed elsewhere
// Note: HMR support removed to avoid TypeScript module configuration issues

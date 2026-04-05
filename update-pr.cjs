const fs = require('fs');

let content = fs.readFileSync('src/components/therapy/TherapeuticGoalsTracker.tsx', 'utf8');

// Add useMemo to imports
content = content.replace(
  /import \{ useState, useEffect, useCallback \} from 'react'/,
  "import { useState, useEffect, useCallback, useMemo } from 'react'"
);

// Replace getRelatedInterventions
content = content.replace(
  /\/\/ Get interventions related to a specific goal[\s\S]*?\}, \[therapistInterventions, goals\]\)/m,
  `// Get interventions related to a specific goal
  // ⚡ Bolt: Precompute goal → relatedInterventions map to avoid repeated linear scans
  const goalInterventionsMap = useMemo(() => {
    const map = new Map<string, string[]>()

    goals.forEach((goal) => {
      if (goal.relatedInterventions && goal.relatedInterventions.length > 0) {
        map.set(goal.id, goal.relatedInterventions)
      }
    })

    return map
  }, [goals])

  // ⚡ Bolt: Memoize getRelatedInterventions to prevent unnecessary re-computations
  const getRelatedInterventions = useCallback(
    (goalId: string) => {
      const relatedInterventions = goalInterventionsMap.get(goalId)
      if (!relatedInterventions) return []

      return therapistInterventions
        .filter((intervention) => relatedInterventions.includes(intervention.type))
        .slice(0, 3) // Show only most recent 3
    },
    [therapistInterventions, goalInterventionsMap]
  )`
);

fs.writeFileSync('src/components/therapy/TherapeuticGoalsTracker.tsx', content);

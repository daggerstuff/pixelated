# Demo Chat UX Architecture—Modularization, Persona, Accessibility

## Context
Current logic fragments chat roles, fails to sustain client persona, has non-adaptive input styling, and randomly scrolls or disorients on reload/interaction. Messages do not fully integrate across session, input, and persona context. Accessibility is insufficient in dark mode, and UX is overwhelming.

---

## Architectural Approach

**Pattern:** Layered modular + stateless presentation, persona state injected via context/provider.  
**Boundaries:**  
- **Core Chat Engine:** Handles role logic, message history, context, and AI persona simulation.
- **Persona Injection Layer:** Enables consistent client personality; deterministic response pattern or LLM adapter slot.
- **ChatInput & View Components:** Isolated UI, with context-aware theming and synchronous data contract for roles.
- **Theme/Context Awareness:** All input/messages/components must bind to theme context and adapt styling for accessibility.
- **Analytics/API:** Session output and analysis is decoupled to side effect services (not blocking user flow).

---

## Component/Service Diagram (Mermaid C4)

```mermaid
flowchart TD
    subgraph UI Layer
        ChatShell["ChatShell (Page Mount/Reload Handler)"]
        ChatInput["ChatInput (Theme/Context-Aware Input)"]
        ChatMessages["ChatMessages (Role & Timestamp Renderer)"]
    end

    subgraph Logic Layer
        ChatEngine["ChatEngine (Role Routing, Message History, API Glue)"]
        PersonaService["PersonaService (Client Personality, Scenario Selection)"]
        ThemeContext["ThemeContext (Light/Dark/Contrast Binding)"]
        SessionAnalysis["SessionAnalysis (Async, Non-Blocking, Stats)"]
    end

    ChatShell --> ChatEngine
    ChatEngine <--> PersonaService
    ChatEngine <--> ChatMessages
    ChatEngine <--> ChatInput
    ChatInput <--> ThemeContext
    ChatMessages <--> ThemeContext
    ChatEngine --> SessionAnalysis

    NoteRight of PersonaService: Maintains persona consistency & determinism
    NoteRight of ThemeContext: Ensures colors and input accessibility

    classDef layer fill:#eef color:#222;
    class UI Layer,Logic Layer layer;
```

---

## Dataflow: Message Lifecycle

1. User submits input via `ChatInput`, with guaranteed high-contrast input styling from `ThemeContext`.
2. `ChatEngine` routes message with explicit role property (`role: 'user' | 'bot' | 'system'`), not `type`, preventing confusion.
3. `PersonaService` generates or selects deterministic persona-driven client response for 'bot', maintaining contextual consistency.
4. Validated message object (with persona context) is appended; `ChatMessages` renders with clear role styling (accessibility palette).
5. Session data, stats, and bias/content analysis dispatched asynchronously to `SessionAnalysis`.
6. All components subscribe to theme context for dark/light/adaptive rendering.

---

## Key API Contracts

```typescript
// Message contract for cross-component communication:
export interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  personaContext?: {
    scenario: string;
    tone: string;
    traits: string[];
  };
  metadata?: {
    biasDetected?: boolean;
    confidenceScore?: number;
    suggestions?: string[];
  };
}

// PersonaService API:
class PersonaService {
  getCurrentPersona(): PersonaContext;
  generateResponse(prevMessages: ChatMessage[], context: PersonaContext): string; // deterministic/LLM slot
}

// ThemeContext contract:
type Theme = 'light' | 'dark' | 'high-contrast'

interface ThemeContextValue {
  theme: Theme;
  palette: ThemePalette;
}
```

---

## Extensibility, Observability & Integration

- PersonaService can be extended to inject therapy models, scripted personas, or external LLMs, maintaining clear boundaries.
- ThemeContext enables site-wide accessibility settings.
- SessionAnalysis is pluggable, feeding stats/persistence/logs downstream.
- No hardcoded sensitive logic/credentials, separation of concerns maintained.

---

## Fixes for Identified Issues

- **Persona Blandness:** PersonaService manages client persona, responses follow scenario traits (not random/cliché), slot for LLM and scripts.
- **Role Confusion:** Only `role` is propagated, standardized contract cross-component, modular message flow.
- **Input Visibility:** ChatInput binds style/palette to ThemeContext, ensuring contrast and focus for light/dark/high-contrast.
- **Scroll Disorientation:** Controlled user/invisible scroll management via ChatShell, removing random jump logic.
- **Overwhelming UI:** UI Layer refactored for minimal cognitive load, theming palette designed for accessibility.

---

## Next Steps

- Refactor ChatEngine to use the unified ChatMessage contract with persona injection and context-aware theming.
- Migrate all chat UI components to subscribe/use ThemeContext for accessibility.
- Modularize persona logic into PersonaService.
- Decouple session analysis to async non-blocking logic.

---

## Implementation Tasklist (Actionable Progress Checklist)

- [ ] Refactor `ChatEngine` to use the unified `ChatMessage` contract with persona injection and context-aware theming
- [ ] Migrate all chat UI components (`ChatInput`, `ChatMessages`, etc) to subscribe/use `ThemeContext` for accessibility and adaptive styling
- [ ] Modularize persona logic into a separate `PersonaService` (inject client personality, deterministic/LLM option)
- [ ] Decouple session analysis and statistics handling to async non-blocking logic (`SessionAnalysis` service)
- [ ] Ensure all chat components propagate only the `role` property (`'user' | 'bot' | 'system'`), not `type`, to prevent role confusion
- [ ] Implement high-contrast, theme-aware input styling (with visual focus and color accessibility auditing)
- [ ] Eliminate random scrolling and disorienting page behavior; centralize scroll control in a unifying container (`ChatShell`)
- [ ] Reduce oversized, visually overwhelming elements to improve cognitive load and clarify interaction cues
- [ ] Integrate session metadata and analytics as pluggable, side-effect driven modules (never blocking main UI)
- [ ] Add test coverage for persona logic, theme adaptation, and contract propagation

---

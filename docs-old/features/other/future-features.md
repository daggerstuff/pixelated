# Future Features Roadmap

This document outlines potential features for the Pixelated Empathy platform, focusing on enhancing clinical training, data ethics, and simulation capabilities.

## 1. Collaborative "Fishbowl" Supervision Mode (In Progress)

**Concept:** Extend the "Empathy Gym" to allow supervisors to observe training sessions in real-time and provide annotations/feedback.

**Why:**
- Facilitates real-time clinical supervision.
- Allows for "live coaching" without interrupting the flow of the session (via hidden notes).
- Supports group learning where multiple trainees can observe a session.

**Technical Implementation:**
- **Backend:** Dedicated WebSocket server (`TrainingWebSocketServer`) managing session rooms.
- **Events:** `join_session`, `observer_msg`, `coaching_note`, `session_update`.
- **Frontend:** Observer UI in `TrainingSessionComponent` with distinct "Coaching Note" input.

## 2. Counterfactual "Branching" Scenarios ("The What-If Machine")

**Concept:** Allow trainees to "rewind" a conversation to a specific turn and try a different therapeutic approach, visualizing the conversation as a branching tree.

**Why:**
- Enables "deliberate practice" by exploring multiple paths for the same prompt.
- Helps trainees understand the consequences of different interventions (e.g., Validation vs. Confrontation).

**Technical Implementation:**
- **Data Structure:** Convert linear conversation history to a Tree/Graph structure.
- **UI:** Add "Rewind/Branch" button to message bubbles. Display a "Navigation Tree" side panel.
- **AI Adapter:** `MentalArenaAdapter` is already stateless enough to handle branching if the context history is managed correctly.

## 3. Dataset Bias Audit & Quarantine Tool

**Concept:** A dedicated UI within the Journal Research Pipeline to analyze imported datasets for bias *before* they are merged into the training pool.

**Why:**
- Prevents biased data from contaminating the training set ("Garbage In, Garbage Out").
- Provides transparency and human-in-the-loop verification for ethical AI.

**Technical Implementation:**
- **Backend:** Leverage `BiasDetectionEngine` to run batch analysis on imported files.
- **UI:** New view in `src/components/journal-research` showing histograms of bias scores.
- **Workflow:** "Quarantine" status for datasets until they pass the audit.

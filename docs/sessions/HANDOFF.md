# 🤝 AGENT HANDOFF: THE SYSTEMIC DEFENSE INTEGRATION

> **IMPORTANT FOR INCOMING AGENT:**
>
> Read this document first to instantly acquire the mental context of where
> the project currently stands. Do not reinvent the wheel. Read `AGENTS.md`
> before writing a single line of code.

## 🧭 The Current Mission

We are taking the baseline **PsyDefDetect** (Defense Mechanism Classifier via
DeBERTa) and weaving it deeply into the Pixelated Empathy platform
architecture. The goal is to move from a static inference model to a
real-time component of the Empathy Gym's feedback loop.

## 📍 Where We Are Right Now (State)

The **Systemic Defense Integration** epic is now **100% complete**.

- **PIX-149 ✅** Gestalt Fusion Engine — `ai/core/gestalt_engine.py`, 52 tests.
- **PIX-147 ✅** WebSocket Integration — `TrainingWebSocketServer.ts` broadcasts
  `gestalt_update` events in real time.
- **PIX-148 ✅** Adversarial Persona Injection — `pixel_inference_service.py`
  implements the Defense → Directive → Text closed loop.
- **PIX-150 ✅** Empathy PQ Scoring — `ai/core/empathy_pq.py` + REST API in
  `ai/api/pq_service.py`, 5 tests passing.
- **Architecture Spec:** Full specification in
  `docs/epics/systemic-defense-integration.md`.

## 🎯 Next Immediate Action

### **Frontend: Resistance Monitor UI Component**

The backend is fully wired. The next agent should build the frontend React
component that consumes `gestalt_update` WebSocket events.

- **Goal:** A live "Resistance Monitor" bar chart / gauge that shows:
  - `defense_maturity` as a shield intensity indicator.
  - `crisis_level` as a color-coded alert (NONE → green, MODERATE → orange,
    ACUTE → red).
  - `breakthrough_score` as a positive flash/animation on breakthroughs.
- **Where to build:** New component at `src/simulator/components/ResistanceMonitor/`.
- **Events to consume:** The WebSocket `gestalt_update` message from
  `TrainingWebSocketServer.ts`.

## 🛑 Strict Rules for Incoming Agent

1. **NO STUBS:** Write real, production-ready code.
2. **USE CSS MODULES:** Follow the project's styling conventions.
3. **TYPE SAFETY:** Derive TypeScript types from the `GestaltAnalysisResponse`
   interface in `GestaltClient.ts`.

_GLHF. Keep the empathy pixelated, but the code surgical._

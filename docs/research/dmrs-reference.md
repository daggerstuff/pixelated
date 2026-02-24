# DMRS Reference: Defense Mechanism Rating Scales

> **Framework Source**: J. Christopher Perry's Defense Mechanism Rating
> Scales (DMRS), operationalized for NLP annotation in the
> [PsyDefDetect Annotation Handbook](./Psychological%20Defense%20Mechanism%20Coding%20Handbook.pdf).

---

## Overview

Psychological defense mechanisms are unconscious processes that
reduce anxiety and maintain psychological equilibrium when facing
internal conflicts or external stressors. They profoundly influence
emotions, cognitions, and behaviors.

The DMRS organizes defenses into a **maturity hierarchy** — from
immature (reality-distorting) through neurotic (moderate) to mature
(adaptive). This hierarchy directly correlates with therapeutic
outcomes and mental health functioning.

---

## Label Taxonomy (9 Classes)

### Level 0 — Neutral / No Defense

- **Function**: Maintain conversational flow, social niceties,
  non-emotional information exchange
- **Examples**: Greetings, "thank you," simple "yes"/"no"/"okay"
- **NOT defenses**: Direct emotion expression ("I am very sad"),
  factual descriptions, clarification questions

### Level 1 — Action Defenses (Immature)

- **Function**: Discharge emotions through concrete actions
  without reflection
- **Mechanisms**:
  - **Passive Aggression**: Indirect hostility masked by
    compliance. Facade of agreement with covert resistance.
  - **Help-Rejecting Complaining**: Repetitious complaints while
    rejecting all offered help. "I've tried that, it didn't work."
  - **Acting Out**: Expressing internal states through behavior
    rather than words

### Level 2 — Major Image-Distorting (Immature)

- **Function**: Extreme, all-or-nothing distortion of self/other
  images
- **Mechanisms**:
  - **Splitting**: Contradictory absolute views of the same person
    ("all-good" then "all-bad"). Hard to detect in short
    dialogues — requires observing the _shift_.
  - **Projective Identification**: Attributing one's own feelings
    to another AND inducing those feelings in them

### Level 3 — Disavowal (Immature)

- **Function**: Evade unpleasant facts or internal pain
- **Mechanisms**:
  - **Denial**: Refusing to acknowledge external reality
  - **Rationalization**: Constructing logical-sounding but false
    explanations to justify unacceptable feelings
  - **Projection**: Attributing one's own unacceptable impulses
    to others

### Level 4 — Minor Image-Distorting (Intermediate)

- **Function**: Less severe distortion of self/other images
- **Mechanisms**:
  - **Devaluation**: Diminishing the importance of self or others
  - **Idealization**: Attributing exaggerated positive qualities
  - **Omnipotence**: Experiencing self as superior to cope with
    helplessness

### Level 5 — Neurotic (Intermediate)

- **Function**: Manage anxiety at an unconscious level
- **Mechanisms**:
  - **Repression**: Unconscious exclusion of painful memories
    (traces: sudden forgetfulness, vague memories — hard to
    confirm in short texts)
  - **Displacement**: Redirecting emotion from true source to
    safer target
  - **Dissociation**: Detachment from experience ("I felt like
    I was outside my body")
  - **Reaction Formation**: Expressing the opposite of an
    unacceptable impulse

### Level 6 — Obsessional (Mature-adjacent)

- **Function**: Excessive control over thoughts/feelings to
  manage anxiety
- **Mechanisms**:
  - **Intellectualization**: Using abstract thinking to distance
    from emotional reality
  - **Isolation of Affect**: Separating the idea from its
    associated emotion
  - **Undoing**: Symbolic acts of reparation to neutralize
    guilt-inducing behavior

### Level 7 — High-Adaptive (Mature)

- **Function**: Modulate emotions in a constructive way
- **Mechanisms**:
  - **Humor**: Using wit to defuse tension while acknowledging
    the underlying issue
  - **Sublimation**: Channeling unacceptable impulses into
    socially valued activities (art, sports, creativity)
  - **Altruism**: Addressing one's own emotional needs through
    constructive service to others
  - **Self-Observation**: Reflective awareness of one's own
    feelings and motivations
  - **Self-Assertion**: Directly expressing feelings and thoughts
    to navigate conflict
  - **Anticipation**: Realistic planning for future challenges
  - **Affiliation**: Turning to others for support while
    maintaining connection
  - **Suppression**: _Voluntarily_ postponing attention to a
    problem (distinct from denial — the person acknowledges
    the problem)

### Level 8 — Unclear / Needs More Information

- **Function**: Catch-all for insufficient context
- **When to use**: Ambiguous utterances, multiple equally
  prominent defenses, or genuinely unclassifiable statements

---

## Core Annotation Principles

1. **Primacy of Context**: The preceding dialogue determines
   the true psychological function of an utterance
2. **Function-Oriented**: Ask "What psychological goal is the
   speaker trying to achieve?"
3. **Emotion ≠ Defense**: Expressing an emotion directly
   ("I am very sad") is NOT a defense. A defense is present
   only when emotion is distorted, avoided, or transformed.
4. **Multiple Defenses**: If multiple are present, label the
   most immature (lower maturity level) as primary

---

## Clinical Significance for Pixelated Empathy

### Defense Maturity as Therapeutic Progress

The DMRS hierarchy maps directly to therapeutic growth:

```text
Immature (1-3) → Intermediate (4-5) → Mature (6-7)
     ↑                                        ↑
  Therapy begins                    Therapeutic progress
```

Tracking a client's defense maturity over sessions provides
an objective measure of therapeutic effectiveness — directly
enhancing the Empathy PQ scoring system.

### OCEAN → Defense Profile Mapping

| Personality Profile | Expected Defense Pattern               |
| :------------------ | :------------------------------------- |
| High N + Low A      | Action, Projection (immature)          |
| Low O + High C      | Intellectualization (obsessional)      |
| High O + Low N      | Humor, Sublimation (high-adaptive)     |
| High A + High N     | Repression, Displacement (neurotic)    |
| High E + Low N      | Self-Assertion, Affiliation (adaptive) |

### Difficult-to-Detect Defenses in Short Dialogues

Some defenses require longitudinal observation and are
inherently hard to classify in short exchanges:

- **Splitting** — needs both sides of the shift
- **Reaction Formation** — needs long-term pattern knowledge
- **Repression** — unconscious, detectable only by traces
- **Undoing** — requires the full Act A → Act B sequence

---

## References

- Perry, J.C. (1990). _Defense Mechanism Rating Scales_
- Perry, J.C. & Henry, M. (2004). Studying defense mechanisms
  in psychotherapy using the Defense Mechanism Rating Scales.
  In _Advances in Psychology_, 136, 165-192.
- [PsyDefDetect Annotation Handbook](./Psychological%20Defense%20Mechanism%20Coding%20Handbook.pdf)
- [PsyDefDetect@BioNLP 2026](https://psydefdetect-shared-task.github.io/)

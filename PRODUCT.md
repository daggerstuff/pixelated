# Product

## Register

product

## Platform

web

## Users

Clinical therapists in training, their supervisors, and the institutions running training
programs. All three have equal weight — the platform serves the full training ecosystem
equally.

## Product Purpose

Pixelated Empathy bridges clinical mental health with advanced AI to create safe training
environments where therapists can practice, analyze, and evolve their emotional
intelligence. It provides a structured baseline for training and supervision that the field
currently lacks.

## Positioning

The first platform to establish a rigorous, data-informed baseline for therapist training
and supervision — bringing the rigor of evidence-based practice to how clinicians themselves
are developed.

## Brand Personality

**Precise, grounded, humane.** Precise earns the clinician's trust — the interface reads
as an instrument, not a product. Grounded because the technology is advanced, but the
experience stays familiar where it counts — no novelty for its own sake. Humane because
this is about the people training to help people; warmth lives in interaction and copy,
never in decorative treatments. Together they evoke calm competence, not edge or spectacle.

## Anti-references

Three failure modes, in order:

1. **Dark Metal** — the earlier identity (aggressive near-black, electric orange,
   developer-tool energy). This is a clinical training platform, not a dev tool or game.
   Anything that reads as edgy, aggressive, or adversarial.
2. **Cream-AI defaults** — the saturated warm-neutral band: sand, cream, paper, parchment
   body backgrounds with gradient hero text. The generic AI-aesthetic of the moment; reads
   as machine-generated, not clinical.
3. **SaaS-clone dark dashboards** — dark-mode Linear/Notion pastiches with the SaaS
   metric-stack hero, identical icon-card grids, glassmorphism, and button gradients.
   Familiarity is fine; undifferentiated pastiche is not.

## Design Principles

- **Trust is the default state.** Every visual decision earns or erodes it. No decorative
  flourishes that feel clever at the expense of clarity.
- **Show, don't tell.** Let the evidence of good training practice be visible in the
  interface itself — clarity of information, structure that mirrors clinical reasoning.
- **Precise instruments, humane touch.** Forward-looking but rooted — the technology is
  advanced, but the experience is grounded and familiar where it counts. Precision in
  structure, humanity in interaction.
- **Serve the clinical triad equally.** The therapist trainee, the supervisor, and the
  institution each see a surface that respects their context.
- **Verify contrast, don't assume it.** The zero-chroma grayscale system leans entirely on
  value contrast for hierarchy. Every text/surface pair must be checked against WCAG AA,
  not assumed safe because the palette is neutral.

## Accessibility & Inclusion

WCAG AA baseline, with particular attention to neurodivergent-friendly design: clear
information architecture, predictable navigation, reduced cognitive load, and explicit
affordances over hidden gestures.

**Contrast-verify mandate:** because the system carries emphasis through value contrast
alone (no hue, no accent), contrast is not a guaranteed property of the neutral ramp — it
must be measured for each text/background pair. Body text needs ≥4.5:1 against its surface;
large text (≥18px or bold ≥14px) needs ≥3:1; placeholder text needs the same 4.5:1. The
muted-gray default (`oklch(0.55)`) on a tinted near-white fails this silently — never ship a
pair without checking.

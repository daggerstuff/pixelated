# Pixelated Empathy Documentation

[![Documentation](https://img.shields.io/badge/docs-mintlify-purple)](https://pixelatedempathy.com/docs)
[![License](https://img.shields.io/badge/license-proprietary-blue)](../LICENSE)
[![Status](https://img.shields.io/badge/status-active-brightgreen)](https://pixelatedempathy.com)

> 💜 *Where Technology Meets the Heart of Human Connection*

---

## What Is This?

This is the **Mintlify documentation source** for Pixelated Empathy — an
enterprise-grade emotional intelligence platform that trains mental health
professionals through AI-powered therapeutic simulations.

**The Empathy Gym™** lets therapists practice difficult conversations with AI
clients before meeting real patients. No risk. Real growth.

---

## Documentation Structure

```
docs2/
├── 📄 index.mdx          # Landing page — start here
├── 📄 quickstart.mdx     # Get up and running in 5 minutes
├── 📄 docs.json          # Mintlify configuration
├── 📁 product/           # Product documentation
│   ├── emotional-intelligence.mdx
│   ├── bias-detection.mdx
│   ├── crisis-detection.mdx
│   ├── training-scenarios.mdx
│   └── empathy-gym.mdx
├── 📁 platform/          # Technical architecture
│   ├── overview.mdx
│   ├── architecture.mdx
│   ├── api-reference.mdx
│   └── security.mdx
├── 📁 guides/            # User guides
│   ├── therapists/
│   ├── supervisors/
│   └── developers/
├── 📁 knowledge/         # Psychology & EI concepts
│   ├── plutchik-wheel.mdx
│   ├── big-five-ocean.mdx
│   └── therapeutic-modalities.mdx
├── 📁 research/          # Methods & ethics
│   ├── our-approach.mdx
│   ├── ethics-framework.mdx
│   └── bias-reports.mdx
└── 📁 compliance/        # HIPAA, security
    ├── overview.mdx
    ├── hipaa.mdx
    └── security.mdx
```

---

## Quick Navigation

| For Therapists | For Supervisors | For Developers |
| -------------- | --------------- | -------------- |
| [Quickstart](/quickstart) | [Quickstart](/quickstart) | [Quickstart](/quickstart) |
| [Empathy Gym Guide](/guides/therapists/empathy-gym-guide) | [Supervisor Dashboard](/guides/supervisors/dashboard) | [API Reference](/platform/api-reference) |
| [Understanding Feedback](/guides/therapists/understanding-feedback) | [Cohort Management](/guides/supervisors/cohorts) | [Developer Setup](/guides/developers/setup) |
| [Training Scenarios](/product/training-scenarios) | [Competency Tracking](/guides/supervisors/competencies) | [Architecture](/platform/architecture) |

---

## Key Concepts

### Emotional Intelligence Framework

We use two scientifically-validated frameworks:

1. **Plutchik's Wheel of Emotions** — 8 primary emotions with intensity
   variations
2. **Big Five (OCEAN)** — Openness, Conscientiousness, Extraversion,
   Agreeableness, Neuroticism

All emotion scores are normalized to `0.0–1.0` floats for consistent processing.

### The EARS Framework

Every AI response is evaluated against:

- **E**mpathy — Emotional attunement score
- **A**uthenticity — Genuine vs. scripted response ratio
- **R**elevance — Contextual appropriateness
- **S**afety — Crisis detection & psychological safety

### Bias Detection

Real-time monitoring for 40+ bias categories:

- Demographic (age, gender, ethnicity)
- Linguistic (dialect, accent, vocabulary)
- Cultural (norms, values, communication styles)
- Socioeconomic (education, income, occupation)

---

## Local Development

### Prerequisites

- Node.js 19+
- pnpm 8+
- Mintlify CLI (optional)

### Run Locally

```bash
# Install Mintlify CLI
npm i -g mintlify

# Run docs locally
cd docs2
mintlify dev
```

Documentation will be available at `http://localhost:3333`

### Build for Production

```bash
mintlify build
```

Output in `docs2/build/` — deploy to any static host.

---

## Contributing

1. **Fork the repo** and create a feature branch
2. **Make changes** following our style guide
3. **Test locally** with `mintlify dev`
4. **Submit a PR** with clear description

### Style Guidelines

- Use **MDX** for interactive pages (components, tabs, steps)
- Use **Markdown** for static content
- Keep lines under **120 characters**
- Add **frontmatter** to all pages:

```yaml
---
title: 'Page Title'
description: 'Brief description for SEO and previews'
---
```

---

## Resources

| Resource | Link |
| -------- | ---- |
| Main Documentation | <https://pixelatedempathy.com/docs> |
| API Reference | <https://pixelatedempathy.com/api> |
| Community Forum | <https://pixelatedempathy.com/community> |
| Support Email | <support@pixelatedempathy.com> |
| GitHub | <https://github.com/pixelatedempathy> |

---

## License

This documentation is proprietary and confidential. Unauthorized reproduction or
distribution is prohibited.

---

<div align="center">

*Built with 💜 for the mental health community*

*Last Updated: February 2026*

</div>

---
title: 'Known Accessibility Issues'
description: 'Documentation of known accessibility issues and their resolution status'
pubDate: '2025-01-01'
author: 'Accessibility Team'
draft: false
toc: true
share: true
date: '2025-04-12'
---

# Known Accessibility Issues

This document tracks known accessibility issues in the Pixelated platform identified through automated testing, manual testing, and user feedback.

## WCAG 2.1 AA Compliance Status

The Pixelated platform is partially conformant with WCAG 2.1 level AA. We are actively working to resolve known issues and achieve full compliance.

## Current Critical Issues

| Issue ID | Description                                                     | WCAG Criteria | Impact   | Status      | Resolution Date |
| -------- | --------------------------------------------------------------- | ------------- | -------- | ----------- | --------------- |
| A001     | Missing alt text on dashboard charts                            | 1.1.1         | Critical | In Progress | -               |
| A002     | Insufficient color contrast in button hover states              | 1.4.3         | Critical | In Progress | -               |
| A003     | Keyboard focus not visible on some interactive elements         | 2.4.7         | Critical | Fixed       | 2025-04-10      |
| A004     | Form error messages not programmatically associated with inputs | 3.3.1         | Critical | In Progress | -               |
| A005     | Heading levels skip in documentation pages                      | 1.3.1, 2.4.6  | Serious  | In Progress | -               |

## Issues by Component

### Navigation

| Issue ID | Description                                    | WCAG Criteria | Impact   | Status      |
| -------- | ---------------------------------------------- | ------------- | -------- | ----------- |
| A006     | Mobile navigation menu not keyboard accessible | 2.1.1         | Serious  | In Progress |
| A007     | Active page not announced to screen readers    | 4.1.2         | Moderate | Fixed       |

### Forms

| Issue ID | Description                                                     | WCAG Criteria | Impact   | Status      |
| -------- | --------------------------------------------------------------- | ------------- | -------- | ----------- |
| A004     | Form error messages not programmatically associated with inputs | 3.3.1         | Critical | In Progress |
| A008     | Registration form lacks autocomplete attributes                 | 1.3.5         | Minor    | To Do       |
| A009     | Date fields lack proper labeling for screen readers             | 1.3.1, 4.1.2  | Serious  | Fixed       |

### Dashboard

| Issue ID | Description                                      | WCAG Criteria | Impact   | Status      |
| -------- | ------------------------------------------------ | ------------- | -------- | ----------- |
| A001     | Missing alt text on dashboard charts             | 1.1.1         | Critical | In Progress |
| A010     | Interactive graph elements need keyboard support | 2.1.1         | Serious  | In Progress |
| A011     | Data tables missing proper headers               | 1.3.1         | Serious  | Fixed       |

### Content

| Issue ID | Description                                        | WCAG Criteria | Impact   | Status      |
| -------- | -------------------------------------------------- | ------------- | -------- | ----------- |
| A002     | Insufficient color contrast in button hover states | 1.4.3         | Critical | In Progress |
| A005     | Heading levels skip in documentation pages         | 1.3.1, 2.4.6  | Serious  | In Progress |
| A012     | Documents available only as PDFs                   | 1.1.1         | Moderate | To Do       |

## Resolution Work Plan

### Critical Fixes (Priority 1)

- **A001: Missing alt text on charts**
  - Add proper alt text to all chart images
  - Implement descriptive text summaries for complex visualizations
  - Ensure data tables are available as alternatives for all charts

- **A002: Color contrast issues**
  - Adjust color palette for button hover states
  - Implement contrast testing in CI pipeline
  - Update design system documentation with accessibility requirements

- **A004: Form error messages**
  - Connect error messages to form fields using aria-describedby
  - Implement focus management to move to first error
  - Add an error summary at the top of forms with links to each error

### Serious Issues (Priority 2)

- **A005: Heading structure**
  - Audit and correct heading hierarchy across all documentation pages
  - Implement automated tests for heading structure
  - Create documentation guidelines for content authors

- **A006: Mobile navigation**
  - Implement keyboard trap for mobile menu
  - Add proper ARIA attributes to menu toggle
  - Ensure all navigation items can be accessed via keyboard

- **A010: Graph interactions**
  - Add keyboard controls for all interactive charts
  - Implement focus management for chart elements
  - Add screen reader announcements for data point selection

## Testing Process

All accessibility fixes undergo the following testing process:

1. **Automated Testing**: Using axe-core for automated compliance checks
2. **Component Testing**: Dedicated accessibility tests for components
3. **Screen Reader Testing**: Manual testing with NVDA, JAWS, and VoiceOver
4. **Keyboard Testing**: Verification of keyboard-only navigation
5. **User Testing**: Validation with users who rely on assistive technologies

## Reporting New Issues

If you encounter an accessibility issue that is not listed in this document, please report it by:

1. Opening an issue on GitHub with the "accessibility" label
2. Emailing [accessibility@gradiant.com](mailto:accessibility@gradiant.com)
3. Using the feedback form on the accessibility statement page

Please include:

- A description of the issue
- The page or feature where you encountered it
- Steps to reproduce
- The assistive technology you were using (if applicable)

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [Accessibility Statement](/accessibility)
- [Automated Accessibility Tests](/tests/accessibility.test.ts)

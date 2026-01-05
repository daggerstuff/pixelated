---
title: 'Accessibility Developer Guide'
description: 'Best practices and standards for implementing accessible components'
pubDate: '2025-01-01'
author: 'Accessibility Team'
draft: false
toc: true
share: true
date: '2025-04-12'
---

# Accessibility Developer Guide

This guide provides practical instructions for implementing accessible components in our Astro application. Following these guidelines will help ensure that our application is usable by people with disabilities and meets WCAG 2.1 AA standards.

## Core Principles

### 1. Perceivable

Information and user interface components must be presentable to users in ways they can perceive.

### 2. Operable

User interface components and navigation must be operable by all users.

### 3. Understandable

Information and the operation of the user interface must be understandable.

### 4. Robust

Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies.

## Testing Your Components

Always test your components for accessibility during development:

```ts
// In your component test file
;

expect.extend(toHaveNoViolations);

describe('YourComponent accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<YourComponent />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## Implementation Guidelines by Component Type

### Forms

1. **Labels and Instructions**
   - Always provide visible labels for form controls
   - Use `<label>` elements properly associated with their inputs

   ```astro
   ---
   // In your Astro component
   ---

     <input
       type="email"
       id="email"
       name="email"
       aria-describedby="email-hint"
       required
     />
       We'll never share your email with anyone else.
   ```

2. **Error Handling**
   - Provide clear error messages
   - Associate error messages with their inputs
   - Ensure errors are announced to screen readers

   ```astro
   ---
   const { errors = {} } = Astro.props
   ---

     <input
       type="email"
       id="email"
       name="email"
       aria-describedby={errors.email ? 'email-error' : 'email-hint'}
       aria-invalid={errors.email ? 'true' : 'false'}
       required
     />
     {
       errors.email ? (
           {errors.email}
       ) : (
           We'll never share your email with anyone else.
       )
     }
   ```

3. **Form Field Grouping**
   - Use `<fieldset>` and `<legend>` for related form fields

   ```astro
   ```

### Navigation

1. **Skip Links**
   - Provide a skip link at the top of each page

   ```astro
   ```

2. **ARIA Landmarks**
   - Use proper landmarks to structure your page

   ```astro
   ```

3. **Navigation State**
   - Indicate current page in navigation
   - Use `aria-current="page"` for current navigation items

   ```astro
   ---
   const currentPath = Astro.url.pathname
   const navItems = [
     { href: '/', label: 'Home' },
     { href: '/about', label: 'About' },
     { href: '/contact', label: 'Contact' },
   ]
   ---

       {
         navItems.map((item) => (
             <a
               href={item.href}
               aria-current={currentPath === item.href ? 'page' : undefined}
             >
               {item.label}
         ))
       }
   ```

### Interactive Elements

1. **Buttons vs. Links**
   - Use `<button>` for actions, `<a>` for navigation
   - Ensure all interactive elements are keyboard accessible

   ```astro
   <!-- For actions within the page -->

   <!-- For navigation -->
   ```

2. **Custom Components**
   - Use appropriate ARIA roles and states
   - Implement keyboard interactions

   ```astro
   ---
   // Tab component
   const { tabId, selected } = Astro.props
   ---

   <button
     id={`tab-${tabId}`}
     role="tab"
     aria-selected={selected ? 'true' : 'false'}
     aria-controls={`panel-${tabId}`}
     tabindex={selected ? '0' : '-1'}
   >
   ```

3. **Focus Management**
   - Ensure interactive elements show a visible focus indicator
   - Maintain logical tab order
   - Use `tabindex="0"` only when necessary

   ```css
   /* In your CSS */
   :focus-visible {
     outline: 2px solid blue;
     outline-offset: 2px;
   }
   ```

### Images and Media

1. **Alternative Text**
   - Provide descriptive alt text for informative images
   - Use empty alt text for decorative images

   ```astro
   <!-- Informative image -->
   <img
     src="/chart.png"
     alt="Sales increased by 25% in Q4 2024, surpassing our target goal"
   />

   <!-- Decorative image -->
   ```

2. **Complex Visuals**
   - Provide text alternatives for charts and graphs
   - Include data tables where appropriate

   ```astro
     <img
       src="/complex-chart.png"
       alt="Summary: Market share distribution across 5 regions"
     />
       <!-- Data table markup here -->
   ```

3. **Video and Audio**
   - Include captions and transcripts
   - Provide audio descriptions where necessary
   - Ensure media controls are keyboard accessible

   ```astro
     <track
       kind="captions"
       src="/captions.vtt"
       srclang="en"
       label="English"
       default
     />
     <track
       kind="descriptions"
       src="/descriptions.vtt"
       srclang="en"
       label="English descriptions"
     />
       Your browser doesn't support HTML5 video. <a href="/video.mp4"
         >Download the video</a
       > instead.
   ```

### Content Structure

1. **Headings**
   - Use proper heading hierarchy
   - Don't skip heading levels

   ```astro
       <!-- Content -->
   ```

2. **Lists**
   - Use appropriate list markup

   ```astro


   ```

3. **Tables**
   - Use proper table markup with headers
   - Include captions and summaries

   ```astro
       <!-- More rows -->
   ```

## Client-Side Rendering Considerations in Astro

Astro's `client:load` directive can impact accessibility. Consider these tips:

1. **Loading States**
   - Provide accessible loading indicators
   - Prevent focus from being lost during updates

   ```astro
   ---
   ---

     {isLoading ? <LoadingSpinner label="Loading content..." /> : <slot />}
   ```

2. **Live Regions**
   - Use ARIA live regions for dynamic content
   - Notify users of important updates

   ```astro
     <!-- Dynamic content will be announced -->

     // Update the notification from client-side JavaScript
     document.getElementById('notification').textContent =
       'Your changes have been saved.'
   ```

3. **React Islands in Astro**
   - When using React components with `client:load`, ensure they handle accessibility correctly

   ```astro
   ---
   ---

   ```

## Color and Contrast

1. **Minimum Contrast**
   - Ensure text has a contrast ratio of at least 4.5:1 (AA)
   - Large text (18pt or 14pt bold) should have a ratio of at least 3:1

2. **Color Independence**
   - Don't rely solely on color to convey information
   - Always include a secondary indicator (icon, text, pattern)

   ```astro
   ```

3. **Focus Indicators**
   - Ensure focus indicators have sufficient contrast
   - Don't remove focus outlines without providing alternatives

## Responsive Accessibility

1. **Zoom Support**
   - Ensure the site works at up to 200% zoom
   - Avoid fixed sizes that might cause content overflow

2. **Touch Targets**
   - Make touch targets at least 44x44px
   - Provide adequate spacing between interactive elements

3. **Orientation**
   - Support both portrait and landscape orientations
   - Don't restrict functionality to a single orientation

## Testing Your Work

### Automated Testing

1. **Component-Level Tests**
   - Use axe-core in your component tests

2. **End-to-End Tests**
   - Implement dedicated accessibility tests for key user flows

3. **CI Integration**
   - Include accessibility checks in your CI pipeline

### Manual Testing

1. **Keyboard Navigation**
   - Test with keyboard only
   - Verify tab order and focus management

2. **Screen Reader Testing**
   - Test with at least one screen reader
   - Verify announcements and interactions

3. **Browser Tools**
   - Use the Accessibility tab in browser dev tools
   - Check for common issues and color contrast

## Resources

- [Astro Accessibility Guide](https://docs.astro.build/en/guides/accessibility/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)

## Appendix: Common ARIA Attributes

| Attribute          | Purpose                                                               | Example                                                                     |
| ------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `aria-label`       | Provides a label for objects that can be read by assistive technology | `<button aria-label="Close">×</button>`                                     |
| `aria-labelledby`  | Identifies the element(s) that labels the current element             | `<div id="txt1">Name</div><input aria-labelledby="txt1">`                   |
| `aria-describedby` | Identifies the element(s) that describes the object                   | `<input aria-describedby="hint1"><div id="hint1">Enter your username</div>` |
| `aria-required`    | Indicates that user input is required on the element                  | `<input aria-required="true">`                                              |
| `aria-expanded`    | Indicates whether a control is expanded or collapsed                  | `<button aria-expanded="false">Show more</button>`                          |
| `aria-hidden`      | Removes element from the accessibility tree                           | `<div aria-hidden="true">Decorative content</div>`                          |
| `aria-live`        | Indicates an element will be updated                                  | `<div aria-live="polite">Status updates appear here</div>`                  |
| `aria-current`     | Indicates the current item in a set                                   | `<a aria-current="page">Current page</a>`                                   |
| `role`             | Defines the purpose of an element                                     | `<div role="alert">Error message</div>`                                     |

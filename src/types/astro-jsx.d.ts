/**
 * Global TypeScript declarations for Astro JSX elements
 * Prevents "JSX element implicitly has type 'any'" errors
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
    }

    interface HTMLAttributes extends React.HTMLAttributes<HTMLElement> {
      class?: string
    }

    // Keep declaration-only and avoid redeclaring DOM Element/ElementClass.
  }
}

// Minimal Astro JSX shims used only for build-time JSX parsing.
export {}

// types module (standardized)

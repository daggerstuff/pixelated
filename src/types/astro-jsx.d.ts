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

    // Add Element type for components that return JSX.Element
    type Element = React.ReactElement

    // Add ElementClass for class components
    interface ElementClass extends React.Component<unknown> {
      render(): React.ReactNode
    }

    // Add ElementAttributesProperty for props type inference
    interface ElementAttributesProperty {
      props: Record<string, unknown>
    }
  }
}

export {}

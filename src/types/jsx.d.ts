declare namespace JSX {
  // Define a common type for JSX element properties
  type JSXElementProps = {
    id?: string;
    class?: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }

  interface IntrinsicElements {
    button: JSXElementProps
    div: JSXElementProps
    p: JSXElementProps
    header: JSXElementProps
    // Add more elements as needed
  }
}

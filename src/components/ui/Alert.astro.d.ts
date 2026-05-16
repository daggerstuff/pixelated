declare const Alert: {
  render: (
    props: Record<string, unknown>,
    options?: { default?: { render: () => string } },
  ) => Promise<{ html: string }>
}
export default Alert

declare const SearchDemo: {
  render: (
    props: Record<string, unknown>,
    options?: { default?: { render: () => string } },
  ) => Promise<{ html: string }>
}
export default SearchDemo

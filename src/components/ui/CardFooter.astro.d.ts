declare const CardFooter: {
  name: string
  render: (
    props: Record<string, unknown>,
    options?: { default?: { render: () => string } },
  ) => Promise<{ html: string }>
}
export default CardFooter

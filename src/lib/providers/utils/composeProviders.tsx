import React from 'react'
import type { ComponentType, ReactNode } from 'react'

// Define more specific provider props type to avoid explicit unknown/any
type ProviderProps = Record<string, unknown>
type ProviderType = ComponentType<{ children: ReactNode } & ProviderProps>
type ProviderComponentProps = { children: ReactNode } & ProviderProps

/**
 * Composes multiple providers into a single provider component
 * Providers are applied from right to left (last provider wraps all others)
 *
 * @example
 * ```tsx
 * const ComposedProviders = composeProviders(
 *   AuthProvider,
 *   ThemeProvider,
 *   ConvexProvider
 * )
 *
 * // Use in your app:
 * <ComposedProviders>
 *   <App />
 * </ComposedProviders>
 * ```
 */
export function composeProviders(
  ...providers: ProviderType[]
): ComponentType<ProviderComponentProps> {
  const BaseProvider = ({ children }: ProviderComponentProps) => <>{children}</>

  const ComposedProvider = providers.reduce(
    (
      Accumulated: ComponentType<ProviderComponentProps>,
      Current: ProviderType,
    ) => {
      const NextProvider = ({ children, ...props }: ProviderComponentProps) => (
        <Accumulated {...props}>
          <Current {...props}>{children}</Current>
        </Accumulated>
      )

      NextProvider.displayName = `ComposedProvider(${Current.displayName || 'Component'})`
      return NextProvider
    },
    BaseProvider,
  )

  ComposedProvider.displayName = 'ComposedProvider'
  return ComposedProvider
}

/**
 * Creates a provider composition with initial props for each provider
 *
 * @example
 * ```tsx
 * const Providers = createProviderComposition({
 *   auth: { initialUser: null },
 *   theme: { defaultTheme: 'dark' }
 * })(AuthProvider, ThemeProvider)
 *
 * // Use in your app:
 * <Providers>
 *   <App />
 * </Providers>
 * ```
 */
export function createProviderComposition(
  initialProps: Record<string, unknown> = {},
) {
  return (
    ...providers: ProviderType[]
  ): ComponentType<ProviderComponentProps> => {
    const ProviderComposition = ({
      children,
      ...props
    }: ProviderComponentProps) =>
      providers.reduceRight(
        (acc: ReactNode, Provider: ProviderType) => (
          <Provider {...initialProps} {...props}>
            {acc}
          </Provider>
        ),

        children,
      )

    ProviderComposition.displayName = 'ProviderComposition'
    return ProviderComposition
  }
}

/**
 * Type-safe provider props extractor
 * Extracts props type from a provider component
 */
export type ExtractProviderProps<T> =
  T extends ComponentType<infer P> ? P : never

/**
 * Creates a strongly typed provider composition
 *
 * @example
 * ```tsx
 * const TypedProviders = createTypedProviderComposition(
 *   AuthProvider,
 *   ThemeProvider
 * )<{
 *   auth: { user: User },
 *   theme: { mode: 'light' | 'dark' }
 * }>()
 *
 * // Use with type checking:
 * <TypedProviders
 *   auth={{ user }}
 *   theme={{ mode: 'dark' }}
 * >
 *   <App />
 * </TypedProviders>
 * ```
 */
export function createTypedProviderComposition<
  T extends ComponentType<{ children: ReactNode } & Record<string, unknown>>,
  Props extends Record<string, unknown> = Record<string, unknown>,
>(...providers: T[]) {
  return <P extends Props>() => {
    type TypedProviderProps = { children: ReactNode } & P
    // Create a wrapper function that uses createElement instead of JSX
    const TypedProviderComposition = ({
      children,
      ...props
    }: TypedProviderProps) => {
      // Use createElement pattern to avoid type casting issues
      return providers.reduceRight((accumulated: ReactNode, Provider) => {
        // Using createElement to avoid JSX type checking issues
        return React.createElement(
          Provider,
          // Props are handled here in a way that TypeScript can understand
          Object.assign({}, props, { children: accumulated }),
        )
      }, children)
    }

    TypedProviderComposition.displayName = 'TypedProviderComposition'
    return TypedProviderComposition
  }
}

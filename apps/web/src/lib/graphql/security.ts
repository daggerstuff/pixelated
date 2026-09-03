/**
 * GraphQL Security Middleware — PIX-4064
 *
 * Enforces:
 * - Query depth limit (max depth: 10)
 * - Query complexity limit (max complexity: 1000)
 * - Introspection disabled in production
 *
 * Per acceptance criteria:
 *   "depth limit (10) + complexity limit (1000)"
 *
 * Custom complexity calculator replaces graphql-query-complexity
 * (incompatible with graphql v17 ESM resolution).
 *
 * Type detection uses Symbol.toStringTag instead of graphql's
 * isListType/getNullableType to avoid the ESM/CJS dual-package
 * instanceof hazard where instanceOf() fails across module realms.
 */

import { GraphQLSchema, ValidationContext, GraphQLError, Kind } from 'graphql'
import depthLimit from 'graphql-depth-limit'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('graphql-security')

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export const MAX_DEPTH = 10
export const MAX_COMPLEXITY = 1000
const LIST_BASE_COST = 10

// ──────────────────────────────────────────────
// Depth limit validation rule
// ──────────────────────────────────────────────

export function depthLimitRule(): ReturnType<typeof depthLimit> {
  return depthLimit(MAX_DEPTH, (depth: number) =>
    logger.warn('GraphQL depth limit exceeded', { depth }),
  )
}

// ──────────────────────────────────────────────
// Complexity limit validation rule (custom implementation)
// ──────────────────────────────────────────────

/**
 * Custom query complexity validator.
 *
 * Cost model:
 * - Scalar/object field: 1
 * - List field without limit arg: LIST_BASE_COST (10)
 * - List field with limit arg N: LIST_BASE_COST * N
 *
 * Rejects queries whose total cost exceeds MAX_COMPLEXITY.
 *
 * Uses Symbol.toStringTag for type detection because graphql's
 * isListType/getNullableType rely on instanceOf which fails in
 * the ESM/CJS dual-package environment (vitest loads two separate
 * graphql module realms).
 */
export function complexityLimitRule(
  _schema: GraphQLSchema,
): (context: ValidationContext) => Record<string, unknown> {
  return (context: ValidationContext) => {
    let complexity = 0

    return {
      Field: {
        enter: (node) => {
          const fieldDef = context.getFieldDef()
          let cost = 1

          if (fieldDef) {
            let fieldType = fieldDef.type

            // Strip NonNull wrapper (equivalent to getNullableType)
            if (fieldType?.[Symbol.toStringTag] === 'GraphQLNonNull') {
              fieldType = (fieldType as { ofType?: unknown }).ofType
            }

            // Check if it's a list type (equivalent to isListType)
            if (fieldType?.[Symbol.toStringTag] === 'GraphQLList') {
              cost = LIST_BASE_COST

              const limitArg = node.arguments?.find(
                (a) => a.name.value === 'limit' && a.value.kind === Kind.INT,
              )
              if (limitArg && limitArg.value.kind === Kind.INT) {
                const limitValue = parseInt(limitArg.value.value, 10)
                cost = LIST_BASE_COST * limitValue
              }
            }
          }

          complexity += cost
        },
      },
      OperationDefinition: {
        leave: () => {
          if (complexity > MAX_COMPLEXITY) {
            context.reportError(
              new GraphQLError(
                `Query complexity ${complexity} exceeds maximum of ${MAX_COMPLEXITY}`,
              ),
            )
          } else if (complexity > MAX_COMPLEXITY * 0.8) {
            logger.warn('GraphQL complexity approaching limit', {
              complexity,
              limit: MAX_COMPLEXITY,
            })
          }
        },
      },
    }
  }
}

// ──────────────────────────────────────────────
// Introspection control
// ──────────────────────────────────────────────

/**
 * Disables introspection in production.
 * In development, introspection is allowed for tools like GraphiQL.
 */
export function isIntrospectionEnabled(): boolean {
  const env =
    (import.meta as unknown as Record<string, unknown>)['env'] ?? process.env
  const nodeEnv = (env?.['NODE_ENV'] as string) ?? 'development'
  return nodeEnv !== 'production'
}

// ──────────────────────────────────────────────
// Combined validation rules
// ──────────────────────────────────────────────

export function getValidationRules(schema: GraphQLSchema) {
  return [depthLimitRule(), complexityLimitRule(schema)]
}

// ──────────────────────────────────────────────
// Error formatter
// ──────────────────────────────────────────────

export function formatGraphQLError(error: GraphQLError) {
  const isProduction =
    ((import.meta as unknown as Record<string, unknown>)['env'] ??
      process.env)?.['NODE_ENV'] === 'production'

  return {
    message: error.message,
    path: error.path,
    locations: error.locations,
    extensions: {
      code: (error.extensions?.['code'] as string) ?? 'INTERNAL_SERVER_ERROR',
      ...(isProduction ? {} : { stack: error.stack }),
    },
  }
}

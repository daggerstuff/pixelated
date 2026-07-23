/**
 * Auth Directive Transformer — PIX-4065
 *
 * Implements field-level security via `@auth(scope)` and `@requireRole(role)`
 * directives.  After `makeExecutableSchema` parses the SDL, this transformer
 * walks every object field, finds directives, and wraps the resolver with
 * authentication / authorization checks.
 *
 * Directive semantics:
 *
 *  @auth                     → any authenticated user
 *  @auth(scope: "admin")     → admin role (or admin scope for API-key users)
 *  @auth(scope: "read")      → user must have "read" scope (API-key scopes)
 *  @auth(scope: "memory:read") → user must have "memory:read" scope
 *  @requireRole(role: "admin") → user.role must equal "admin"
 *
 * Role mapping:
 *  - JWT users:  role from token validation (admin, clinician, developer, guest, …)
 *  - API-key users: role derived from scopes ("admin" if admin scope, else "developer")
 *  - Scopes:    API-key users carry scopes[] from the key record; JWT users have none
 *
 * The admin role bypasses all scope checks.
 */

import { defaultFieldResolver, GraphQLSchema } from "graphql";
import { mapSchema, MapperKind, getDirectiveExtensions } from "@graphql-tools/utils";
import type { GraphqlContext } from "./resolvers";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";

const logger = createBuildSafeLogger("graphql-auth-directive");

/**
 * Check whether the user satisfies the required scope.
 *
 * @param scope  Required scope string (e.g. "admin", "read", "memory:read")
 * @param role   User role
 * @param scopes User scopes (API-key users only; JWT users have none)
 * @returns `true` if access is allowed, `false` otherwise
 */
function hasScopeAccess(scope: string, role: string, scopes: string[]): boolean {
  // Admin role bypasses all scope checks
  if (role === "admin") return true;

  // The literal scope "admin" maps to role check only
  if (scope === "admin") return role === "admin";

  // API-key users: check explicit scopes array
  if (scopes.length > 0) return scopes.includes(scope);

  // JWT users without scopes: non-admin scope is satisfied by any authenticated user.
  // Scope enforcement is primarily for API-key callers; JWT callers are trusted at
  // the route level via the existing dual-mode auth middleware.
  return true;
}

/**
 * Apply `@auth` and `@requireRole` directives to a GraphQL schema.
 *
 * Returns a new schema with resolver wrappers enforcing the directives.
 * Fields without directives keep their original resolvers untouched.
 */
export function applyAuthDirectives(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
      const directives = getDirectiveExtensions(fieldConfig, schema);

      const authEntries = directives?.auth; // [{ scope?: string }] | undefined
      const roleEntries = directives?.requireRole; // [{ role: string }] | undefined

      if (!authEntries?.length && !roleEntries?.length) return fieldConfig;

      const requiredScope = authEntries?.[0]?.scope as string | undefined;
      const requiredRole = roleEntries?.[0]?.role as string | undefined;

      const originalResolve = fieldConfig.resolve ?? defaultFieldResolver;

      fieldConfig.resolve = async (
        parent: unknown,
        args: unknown,
        context: GraphqlContext,
        info: unknown,
      ) => {
        // ── Authentication ──────────────────────────────────────
        if (authEntries?.length && !context.user) {
          logger.warn("Auth directive blocked unauthenticated request", {
            field: fieldName,
            scope: requiredScope,
          });
          throw new Error("Authentication required");
        }

        // ── Scope check ─────────────────────────────────────────
        if (authEntries?.length && requiredScope && context.user) {
          const userScopes = context.user.scopes ?? [];
          if (!hasScopeAccess(requiredScope, context.user.role, userScopes)) {
            logger.warn("Auth directive blocked insufficient scope", {
              field: fieldName,
              requiredScope,
              userRole: context.user.role,
              userScopes,
            });
            throw new Error(`Scope '${requiredScope}' required`);
          }
        }

        // ── Role check ─────────────────────────────────────────
        if (roleEntries?.length && requiredRole && context.user) {
          if (context.user.role !== requiredRole) {
            logger.warn("Role directive blocked insufficient role", {
              field: fieldName,
              requiredRole,
              userRole: context.user.role,
            });
            throw new Error(`Role '${requiredRole}' required`);
          }
        }

        return originalResolve(parent, args, context, info);
      };

      return fieldConfig;
    },
  });
}

#!/usr/bin/env node
/**
 * Audit the Auth0 management client's granted scopes against the ones the
 * application actually calls for.
 *
 * A management client can authenticate successfully and still be missing a
 * scope. Every call that needs one then fails with 403 insufficient_scope,
 * and the application catches that and degrades to an empty result: an empty
 * role list, an empty factor list, an empty audit log. That is
 * indistinguishable from "the tenant genuinely has no data", which is why a
 * scope gap in production can sit unnoticed for months.
 *
 * This script asks the tenant directly. It requests a management token and
 * compares the granted scope set with the calls in the codebase, then names
 * what is missing.
 *
 * Usage:
 *   node scripts/devops/check-auth0-scopes.mjs
 *   node scripts/devops/check-auth0-scopes.mjs --json
 *
 * Exit codes: 0 all required scopes granted, 1 something missing, 2 cannot
 * authenticate (bad credentials or unreachable tenant).
 *
 * Credentials come from the environment, falling back to .env:
 *   AUTH0_DOMAIN, AUTH0_MANAGEMENT_CLIENT_ID, AUTH0_MANAGEMENT_CLIENT_SECRET
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_SCOPES = [
  { scope: "read:roles", usedBy: "auth0-rbac-service roles.list / getUserRoles" },
  {
    scope: "read:users",
    usedBy:
      "auth0-rbac-service users.roles.list; auth0.service users.get / list / listUsersByEmail / update; auth0-mfa-service users.enrollments.get",
  },
  {
    scope: "update:users",
    usedBy: "auth0-rbac-service users.roles.assign / delete; auth0.service users.update (profile and password)",
  },
  { scope: "read:sessions", usedBy: "auth0-activity-tracking-service getUserSessions (users.sessions)" },
  { scope: "delete:sessions", usedBy: "auth0-activity-tracking-service terminateUserSessions (users.sessions)" },
  { scope: "create:users", usedBy: "auth0.service users.create (signup)" },
  { scope: "create:roles", usedBy: "auth0-rbac-service roles.create (role bootstrap)" },
  {
    scope: "create:user_tickets",
    usedBy: "auth0.service tickets.changePassword (password reset)",
  },
  {
    scope: "read:logs",
    usedBy:
      "auth0-adaptive-mfa-service / auth0-activity-tracking-service logs.list (IP and behaviour lookups)",
  },
  { scope: "read:guardian_factors", usedBy: "auth0-mfa-service guardian.factors.list" },
  {
    scope: "create:guardian_enrollment_tickets",
    usedBy: "auth0-mfa-service guardian.enrollments.createTicket",
  },
  {
    scope: "delete:guardian_enrollments",
    usedBy: "auth0-mfa-service guardian.enrollments.delete",
  },
];

export function findMissingScopes(grantedList, requiredList = REQUIRED_SCOPES) {
  const grantedSet = new Set(grantedList);
  return requiredList.filter((entry) => !grantedSet.has(entry.scope));
}

function loadEnvFile() {
  try {
    process.loadEnvFile(resolve(".env"));
  } catch {
    return;
  }
}

async function fetchGrantedScopes({ domain, clientId, clientSecret }) {
  const response = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.error_description ?? body.error ?? `HTTP ${response.status}`;
    throw new Error(String(detail));
  }
  if (typeof body.scope !== "string") {
    if (typeof body.access_token === "string") return null;
    throw new Error("token response carried no scope claim");
  }
  return body.scope.split(/\s+/).filter(Boolean);
}

async function main() {
  const asJson = process.argv.includes("--json");
  loadEnvFile();

  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;

  const absent = [
    ["AUTH0_DOMAIN", domain],
    ["AUTH0_MANAGEMENT_CLIENT_ID", clientId],
    ["AUTH0_MANAGEMENT_CLIENT_SECRET", clientSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (absent.length > 0) {
    console.error("Missing credentials: " + absent.join(", "));
    console.error("Set them in the environment or in .env, then re-run.");
    process.exit(2);
  }

  let granted;
  try {
    granted = await fetchGrantedScopes({ domain, clientId, clientSecret });
  } catch (error) {
    console.error("Could not obtain a management token: " + error.message);
    console.error("That is a credentials or connectivity problem, not a scope problem.");
    process.exit(2);
  }

  if (granted === null) {
    console.error("The token response carried no scope claim, so the granted set is unknown.");
    console.error("Check the client's grants in the Auth0 dashboard, or use a client that returns scopes.");
    process.exit(2);
  }

  const missing = findMissingScopes(granted);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          domain: domain.replace(/^[^.]+/, "***"),
          grantedCount: granted.length,
          granted,
          missing: missing.map((entry) => entry.scope),
        },
        null,
        2,
      ),
    );
  } else {
    console.log("Tenant: " + domain.replace(/^[^.]+/, "***"));
    console.log("Granted management scopes: " + granted.length);
    if (missing.length === 0) {
      console.log("All " + REQUIRED_SCOPES.length + " required scopes are granted.");
    } else {
      console.error("\nMissing " + missing.length + " required scope(s):");
      for (const entry of missing) {
        console.error("  " + entry.scope + "  (needed by " + entry.usedBy + ")");
      }
      console.error(
        "\nWithout these, the calls fail with 403 insufficient_scope and the\n" +
          "services degrade to empty results that look like an empty tenant.",
      );
    }
  }

  process.exit(missing.length === 0 ? 0 : 1);
}

function isDirectInvocation() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  main().catch((error) => {
    console.error("check-auth0-scopes: internal error");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}

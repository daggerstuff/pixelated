#!/usr/bin/env tsx
/**
 * Consent expiry check script for CI.
 * Runs the expiry check and outputs results.
 */
import { getConsentExpiryService, resetConsentExpiryService } from "../../src/lib/consent";
import { initializeDatabase } from "../../src/lib/db";

/**
 * Parse a postgres:// or postgresql:// connection string into the
 * DatabaseConfig shape accepted by initializeDatabase().
 */
function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | object;
} {
  const parsed = new URL(url);
  const sslMode = parsed.searchParams.get("sslmode");
  // Match the app's server.ts behavior: enable TLS (without cert validation,
  // intentionally mirroring server.ts) for production and for remote hosts,
  // unless sslmode explicitly disables it.
  const isRemoteHost =
    parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
  const enableSsl =
    sslMode === "require" ||
    sslMode === "verify-ca" ||
    sslMode === "verify-full" ||
    sslMode === "no-verify" ||
    (sslMode !== "disable" &&
      sslMode !== "prefer" &&
      (process.env["NODE_ENV"] === "production" || isRemoteHost));
  const ssl: boolean | object = enableSsl
    ? { rejectUnauthorized: false }
    : false;
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    database: parsed.pathname.replace(/^\//, ""),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl,
  };
}

async function main() {
  // Initialize the connection pool so the consent queries run against a real
  // database. Prefers DATABASE_URL when present (CI sets it from secrets);
  // otherwise falls back to the DB_* environment variables used by the app.
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl) {
    initializeDatabase(parseDatabaseUrl(databaseUrl));
  } else {
    initializeDatabase();
  }

  const service = getConsentExpiryService();
  const result = await service.checkExpiries();

  console.log("=== Consent Expiry Check Results ===");
  console.log(`Checked at: ${result.checkedAt}`);
  console.log(`Total checked: ${result.totalChecked}`);
  console.log(`Expiring soon (≤30 days): ${result.summary.expiringSoon}`);
  console.log(`Expiring critical (≤7 days): ${result.summary.expiringCritical}`);
  console.log(`Expired: ${result.summary.expired}`);

  if (result.reminders.length > 0) {
    console.log("\nReminders:");
    for (const reminder of result.reminders) {
      console.log(`  [${reminder.reminderType}] ${reminder.clientId}: ${reminder.message}`);
    }
  }

  // GitHub Actions outputs
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import("fs");
    const output = [
      `expired-count=${result.summary.expired}`,
      `expiring-critical=${result.summary.expiringCritical}`,
      `expiring-soon=${result.summary.expiringSoon}`,
    ].join("\n");
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output + "\n");
  }

  resetConsentExpiryService();
}

main().catch((error) => {
  console.error("Expiry check failed:", error);
  process.exit(1);
});

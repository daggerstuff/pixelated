#!/usr/bin/env tsx
/**
 * Consent expiry check script for CI.
 * Runs the expiry check and outputs results.
 */
import { getConsentExpiryService, resetConsentExpiryService } from "../../src/lib/consent";
import { initializeDatabase } from "../../src/lib/db";
import { parseDatabaseUrl } from "../../src/lib/db/parse-database-url";

async function main() {
  // Initialize the connection pool so the consent queries run against a real
  // database. CI sets DATABASE_URL from secrets; a blank/missing secret must
  // fail with a clear message instead of silently falling back to localhost.
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Configure the DATABASE_URL secret for the Consent Expiry Check workflow.",
    );
  }
  initializeDatabase(parseDatabaseUrl(databaseUrl));

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

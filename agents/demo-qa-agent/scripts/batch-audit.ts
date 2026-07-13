/**
 * Headless batch run for the demo-qa-agent.
 *
 * Exercises the real tool chain against the hackathon corpus without
 * starting the Eve server:
 *   1. audit_corpus  — fragility audit over the real email dump
 *   2. curate_showcase — pick the 15 demo-ready threads
 *   3. gate_injection — compute the injection verdict from the audit result
 *   4. persist the audit summary to Foresight (no-op if Foresight is down)
 *
 * Run:  pnpm exec tsx scripts/batch-audit.ts
 */

import { fileURLToPath } from "node:url";

import auditCorpus from "../agent/tools/audit_corpus.js";
import curateShowcase from "../agent/tools/curate_showcase.js";
import gateInjection from "../agent/tools/gate_injection.js";
import { storeMemory } from "../agent/foresight-client.js";
import { noopToolContext } from "./tool-context.js";

const CORPUS = fileURLToPath(
  new URL("../../../hackathon/monthly_work/2025-08/generated_emails.json", import.meta.url),
);

const CHAT_CORPUS = fileURLToPath(
  new URL("../../../hackathon/monthly_work/2025-08/generated_chat_bursts.json", import.meta.url),
);

async function main() {
  console.log(`\n=== demo-qa-agent headless batch run ===`);
  console.log(`corpus: ${CORPUS}\n`);
  console.log(`chat:   ${CHAT_CORPUS}\n`);

  const audit = await auditCorpus.execute(
    { corpus_path: CORPUS, chat_path: CHAT_CORPUS },
    noopToolContext,
  );
  console.log(
    `AUDIT  pass=${audit.pass} records=${audit.total_records} ` +
      `threads=${audit.thread_count} blocking=${audit.blocking_count} ` +
      `findings=${audit.findings.length}`,
  );
  const byClass: Record<string, number> = {};
  for (const f of audit.findings) {
    byClass[f.class] = (byClass[f.class] ?? 0) + 1;
  }
  console.log(`  by-class: ${JSON.stringify(byClass)}`);

  const curate = await curateShowcase.execute(
    {
      corpus_path: CORPUS,
      target_count: 15,
    },
    noopToolContext,
  );
  console.log(
    `\nCURATE picked=${curate.picked_count}/${curate.target_count} ` +
      `rejected=${curate.rejected_threads.length}`,
  );
  for (const p of curate.picks) {
    console.log(`  - [${p.thread_id}] ${p.subject} (${p.message_count} msgs)`);
  }

  const gate = await gateInjection.execute(
    {
      last_audit_pass: audit.pass,
      last_audit_blocking_count: audit.blocking_count,
      target: "both",
      dry_run: true,
    },
    noopToolContext,
  );
  console.log(
    `\nGATE   state=${gate.state} authorized=${gate.authorized} reason="${gate.reason}"`,
  );

  const summary = `demo-qa-agent batch run ${new Date().toISOString()}: audit pass=${audit.pass}, blocking=${audit.blocking_count}, threads picked=${curate.picked_count}. injection gate=${gate.state}.`;

  try {
    const stored = await storeMemory({
      content: summary,
      category: "demo_qa_run",
      scope: "session",
      tags: ["hackathon", "demo-qa-agent"],
    });
    console.log(`\nFORESIGHT stored memory: ${stored?.memory_id ?? "null"}`);
  } catch {
    console.log(`\nFORESIGHT not reachable — skipped persistence (non-fatal).`);
  }

  console.log(`\n=== done ===`);
}

main().catch((err) => {
  console.error("batch run failed:", err);
  process.exit(1);
});

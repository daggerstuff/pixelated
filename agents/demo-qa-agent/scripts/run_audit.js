import { readdirSync } from "fs";
import { join } from "path";
import auditTool from "../agent/tools/audit_clinical_corpus.ts";

async function main() {
  const dir = "../../ai/training/output/books";
  const files = readdirSync(dir).filter(f => f.endsWith(".jsonl") && !f.includes("_clean"));
  
  let totalPairs = 0;
  let totalSlop = 0;
  let totalDupes = 0;
  let totalClean = 0;

  for (const f of files) {
    const p = join(dir, f);
    const cleanP = join(dir, f.replace(".jsonl", "_clean.jsonl"));
    console.log(`Auditing ${f}...`);
    // Need to extract the execute function since it's an eve tool
    const res = await auditTool.execute({ corpus_path: p, clean_output_path: cleanP });
    
    totalPairs += res.total_pairs;
    totalSlop += res.slop_count;
    totalDupes += res.duplicate_count;
    totalClean += res.clean_pairs_count;
    console.log(`  -> pairs: ${res.total_pairs}, slop: ${res.slop_count}, dupes: ${res.duplicate_count}, clean: ${res.clean_pairs_count}`);
  }
  
  console.log("\n=== AUDIT COMPLETE ===");
  console.log(`Total Pairs Scanned: ${totalPairs}`);
  console.log(`Total Slop Removed:  ${totalSlop}`);
  console.log(`Total Dupes Removed: ${totalDupes}`);
  console.log(`Total Clean Pairs:   ${totalClean}`);
}

main().catch(console.error);

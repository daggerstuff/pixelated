#!/usr/bin/env ts-node
/**
 * Evidence System Comprehensive Test
 *
 * This script demonstrates and tests the comprehensive evidence extraction
 * system we implemented for the MentalLLaMA adapter.
 */

import { runAllTests } from "../lib/ai/mental-llama/evidence/EvidenceExtractor.test";

async function main() {
  console.log("🧪 Starting Evidence System Comprehensive Test");
  console.log("=".repeat(60));

  try {
    await runAllTests();
    console.log("🎉 All evidence system tests completed successfully!");
    console.log("📝 Summary:");
    console.log("✅ Evidence extraction patterns working correctly");
    console.log("✅ Crisis evidence detection functioning");
    console.log("✅ Quality assessment system operational");
    console.log("✅ Caching and metrics tracking active");
    console.log("✅ LLM-enhanced evidence extraction ready");
  } catch (error: unknown) {
    console.error("\n❌ Evidence system test failed:", error);
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);

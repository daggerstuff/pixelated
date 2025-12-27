import logging
import json
import os
from dotenv import load_dotenv

# Load env vars from ai/.env
load_dotenv("ai/.env")

# Verify keys are present
if not os.getenv("LLM_API_KEY") and not os.getenv("OPENAI_API_KEY"):
    print("WARNING: No API Key found in env. Grading will fail.")

from ai.evals.therapy_bench.therapy_bench import TherapyBench

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TherapyBenchVerifier")

class MockModel:
    """Simulates a therapist AI"""
    def generate(self, prompt):
        # Return a generally good empathetic response to pass the rubric
        return "I hear how painful this is for you. It sounds like you're carrying a heavy burden, and I want to support you through it. You are safe here."

def run():
    print("--- Starting TherapyBench Verification ---")
    bench = TherapyBench()
    
    # Run benchmark
    results = bench.run_benchmark(MockModel())
    
    print("\n--- Benchmark Results ---")
    print(json.dumps(results["metrics"], indent=2))
    
    # Check if we got real scores (not just 0.0 or the mock 8.5/9.0/8.0 hardcoded values)
    # The new rubric likely gives variable scores, but if it works, they should be high for the good response above.
    
    print("\nDetailed First Result:")
    print(json.dumps(results["details"][0], indent=2))

    if results.get("persisted_path"):
        print(f"\nPersisted results: {results['persisted_path']}")

if __name__ == "__main__":
    run()

#!/usr/bin/env python3
"""
Edge Case Generator (PIX-8).
Focuses on 'Nightmare Fuel': Severe dissociation, DID, treatment-resistant trauma.
"""

import json
import logging
import random
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("edge_case_gen")


class EdgeCaseGenerator:
    def __init__(
        self,
        output_path: str = "ai/training/ready_packages/datasets/synthetic/nightmare_fuel.jsonl",
    ):
        self.output_path = Path(output_path)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)

    def generate_nightmare_fuel(self, count: int = 50):
        logger.info(f"Generating {count} 'Nightmare Fuel' edge cases (Extreme/Unwinnable)...")

        # Hard/Extreme Therapeutic Scenarios
        hard_scenarios = [
            "Severe dissociative episode with multiple hostile alters (DID)",
            "Complex PTSD with comorbid treatment-resistant depression and self-sabotage",
            "Ethical boundary testing involving therapist coercion and stalking",
            "Psychotic break during a therapy session with violent hallucinations",
        ]

        # Nightmare Fuel - "Make Stephen King throw up" levels of shock value
        nightmare_scenarios = [
            "Active ritualistic abuse trauma with fresh physical evidence",
            "Meticulously planned mass-casualty ideation with total absence of remorse",
            "Chronic child sexual abuse involving active family cover-up and coercion",
            "Graphic recounts of horrendous tragedies involving infant loss and neglect",
        ]

        # Unwinnable Scenarios - 5% of cases where the patient CANNOT be saved
        unwinnable_scenarios = [
            "Terminal hopelessness: Patient executes plan immediately after session despite perfect intervention",
            "Total therapeutic deadlock: Patient is a high-functioning sociopath manipulating therapist for harm",
            "Imminent tragedy: The 'clock runs out' logic where external forces kill the patient mid-session",
        ]

        records_generated = 0
        with open(self.output_path, "w", encoding="utf-8") as f:
            for _i in range(count):
                # 5% Unwinnable, 45% Nightmare, 50% Hard/Extreme
                rand_val = random.random()
                if rand_val < 0.05:
                    scenario_pool = unwinnable_scenarios
                    subtype = "unwinnable"
                elif rand_val < 0.50:
                    scenario_pool = nightmare_scenarios
                    subtype = "nightmare_fuel"
                else:
                    scenario_pool = hard_scenarios
                    subtype = "extreme_therapeutic"

                scenario = random.choice(scenario_pool)
                # In production, this would call LLMClient with 'unfiltered/training' pulse
                record = {
                    "type": "edge_case",
                    "subtype": subtype,
                    "scenario": scenario,
                    "conversation": [
                        {
                            "role": "user",
                            "content": f"Simulated EXTREME UNGUARDED content for {scenario}",
                        },
                        {
                            "role": "assistant",
                            "content": "Validated therapeutic response for training validation.",
                        },
                    ],
                    "ears_score": 0.95,
                    "is_unwinnable": subtype == "unwinnable",
                    "guardrails_bypassed": True,
                }
                f.write(json.dumps(record) + "\n")
                records_generated += 1

        logger.info(f"Generation complete. Saved to {self.output_path}")


if __name__ == "__main__":
    generator = EdgeCaseGenerator()
    generator.generate_nightmare_fuel(100)

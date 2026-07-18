import json
import random

INPUT_FILE = "/home/vivi/dataset/ULTIMATE_FINAL_DATASET.jsonl"
OUTPUT_FILE = "/home/vivi/dataset/RL_training_dataset.jsonl"
MAX_CONVERSATIONS = 10000


def get_system_prompt(role_to_play):
    if role_to_play == "client":
        return "You are the client in a therapy session. Respond to the therapist in character."
    return "You are a highly empathetic and clinically precise AI therapist. Formulate a clinical response."


examples = []

print(f"Extracting up to {MAX_CONVERSATIONS} conversations from {INPUT_FILE}...")

with open(INPUT_FILE) as f:
    for line in f:
        if not line.strip():
            continue
        try:
            data = json.loads(line)
        except Exception:
            continue

        # We only care about rows with conversational arrays
        if "conversation" not in data:
            continue

        convo = data["conversation"]
        if not isinstance(convo, list) or len(convo) < 2:
            continue

        # Extract turns and format them to standard user/assistant
        history = []
        for turn in convo:
            role = turn.get("role", "")
            content = turn.get("content", "")

            # Map client/therapist to roles
            if role not in ["client", "therapist"] or not content:
                continue

            history.append({"role_type": role, "content": content})

        # Generate training examples from the history
        for i in range(1, len(history)):
            target_turn = history[i]
            context = history[:i]

            target_role = target_turn["role_type"]

            # Decide if we want to train on this turn (80% client, 20% therapist)
            if target_role == "client":
                if random.random() > 0.8:
                    continue  # We already have plenty of client turns, but let's take 80%
            elif random.random() > 0.2:
                continue  # Keep therapist examples sparse

            # Build the messages array
            messages = [{"role": "system", "content": get_system_prompt(target_role)}]

            # Add context
            for c_turn in context:
                # The perspective is relative to the target role
                mapped_role = "assistant" if c_turn["role_type"] == target_role else "user"
                messages.append({"role": mapped_role, "content": c_turn["content"]})

            # Add expected output
            messages.append({"role": "assistant", "content": target_turn["content"]})

            examples.append({"messages": messages})

        if len(examples) >= MAX_CONVERSATIONS * 2:
            break

print(f"Extracted {len(examples)} examples. Shuffling...")
random.shuffle(examples)

print(f"Writing to {OUTPUT_FILE}...")
with open(OUTPUT_FILE, "w") as out:
    for ex in examples:
        out.write(json.dumps(ex) + "\n")

print("Dataset normalization complete!")

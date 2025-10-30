import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import torch
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TextIteratorStreamer,
    GenerationConfig,
    BitsAndBytesConfig,
)
from peft import PeftModel


@dataclass
class DifficultClientAgentConfig:
    base_model: str = "LatitudeGames/Harbinger-24B"
    adapter_dir: str = "ai/training/checkpoints/harbinger24b-difficult-client-qlora"
    device_map: str | dict = "auto"
    max_new_tokens: int = 256
    temperature: float = 0.9
    top_p: float = 0.9
    repetition_penalty: float = 1.05
    use_4bit: bool = True


SYSTEM_PROMPT = (
    "You are role‑playing as a DIFFICULT therapy client. "
    "You can be resistant, avoidant, defensive, or hostile while remaining coherent and realistic. "
    "Avoid slurs and personal identifiers."
)


class DifficultClientAgent:
    def __init__(self, config: Optional[DifficultClientAgentConfig] = None):
        self.config = config or DifficultClientAgentConfig()

        bnb_config = None
        if self.config.use_4bit:
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=(
                    torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float16
                ),
            )

        self.tokenizer = AutoTokenizer.from_pretrained(self.config.base_model, use_fast=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        base = AutoModelForCausalLM.from_pretrained(
            self.config.base_model,
            device_map=self.config.device_map,
            trust_remote_code=True,
            quantization_config=bnb_config,
        )

        adapter_path = Path(self.config.adapter_dir)
        if not adapter_path.exists():
            raise FileNotFoundError(f"Adapter directory not found: {adapter_path}")

        self.model = PeftModel.from_pretrained(base, str(adapter_path))
        self.model.eval()
        self.model.config.use_cache = True

    def build_prompt(self, messages: List[dict]) -> str:
        # messages: [{role: 'system'|'user'|'assistant', content: str}]
        parts = [f"<system>\n{SYSTEM_PROMPT}\n</system>"]
        for m in messages:
            role = m.get("role", "").lower()
            content = m.get("content", "").strip()
            if not content:
                continue
            if role == "user":
                parts.append(f"<user>\n{content}\n</user>")
            elif role == "assistant":
                parts.append(f"<assistant>\n{content}\n</assistant>")
            elif role == "system":
                parts.append(f"<system>\n{content}\n</system>")
        parts.append("<assistant>\n")
        return "\n".join(parts)

    @torch.inference_mode()
    def simulate_client_response(self, therapist_message: str, history: Optional[List[dict]] = None) -> str:
        history = history or []
        messages = history + [{"role": "user", "content": therapist_message}]
        prompt = self.build_prompt(messages)

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        gen_cfg = GenerationConfig(
            max_new_tokens=self.config.max_new_tokens,
            temperature=self.config.temperature,
            top_p=self.config.top_p,
            repetition_penalty=self.config.repetition_penalty,
            do_sample=True,
            eos_token_id=self.tokenizer.eos_token_id,
            pad_token_id=self.tokenizer.pad_token_id,
        )

        output_ids = self.model.generate(**inputs, generation_config=gen_cfg)
        text = self.tokenizer.decode(output_ids[0], skip_special_tokens=True)
        # Return only the last assistant block if present
        if "<assistant>" in text:
            return text.split("<assistant>")[-1].strip()
        return text


if __name__ == "__main__":
    agent = DifficultClientAgent()
    reply = agent.simulate_client_response("Can you tell me what brought you in today?")
    print("Client:", reply)

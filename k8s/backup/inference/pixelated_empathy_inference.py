#!/usr/bin/env python3
"""
Pixelated Empathy: Dual Persona Inference System
Provides both mental health expertise and difficult client simulation
"""

import json
import torch
from pathlib import Path
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import asyncio
import aiohttp
from datetime import datetime
import re

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class PersonaMode(Enum):
    THERAPIST = "therapist"
    DIFFICULT_CLIENT = "difficult_client"
    ADAPTIVE = "adaptive"  # Automatically chooses based on context


@dataclass
class ConversationContext:
    """Context for maintaining conversation state"""

    persona_mode: PersonaMode
    conversation_history: List[Dict]
    client_profile: Optional[Dict] = None
    therapy_session_type: Optional[str] = None
    resistance_patterns: List[str] = None
    safety_flags: List[str] = None
    session_metadata: Dict = None


class PixelatedEmpathyInference:
    """Main inference system for dual persona AI"""

    def __init__(self, model_path: Path = None, config_path: Path = None):
        self.model_path = model_path
        self.config = self._load_config(config_path)
        self.persona_templates = self._load_persona_templates()
        self.model = None
        self.tokenizer = None
        self.safety_checker = SafetyChecker()

        # Initialize model
        self._initialize_model()

    def _load_config(self, config_path: Path = None) -> Dict:
        """Load inference configuration"""
        default_config = {
            "max_length": 1024,
            "temperature": 0.7,
            "top_p": 0.9,
            "repetition_penalty": 1.1,
            "safety_threshold": 0.8,
            "context_window": 10,  # Number of previous messages to consider
            "adaptive_threshold": 0.6,  # Threshold for automatic persona switching
        }

        if config_path and config_path.exists():
            with open(config_path, "r") as f:
                user_config = json.load(f)
                default_config |= user_config

        return default_config

    def _load_persona_templates(self) -> Dict:
        """Load persona templates"""
        persona_path = Path("ai/dual_persona_training/persona_templates.json")

        if persona_path.exists():
            with open(persona_path, "r", encoding="utf-8") as f:
                return json.load(f)

        # Fallback templates
        return {
            "therapist": {
                "system_prompt": "You are a compassionate, professional mental health counselor providing evidence-based support.",
                "techniques": ["active_listening", "validation", "cbt", "mindfulness"],
                "boundaries": ["no_medical_advice", "crisis_protocols", "confidentiality"],
            },
            "difficult_client": {
                "system_prompt": "You are roleplaying as a therapy client with specific challenges for training purposes.",
                "patterns": ["therapeutic_resistance", "boundary_testing", "emotional_volatility"],
                "safety_limits": ["no_self_harm_details", "therapeutic_context_maintained"],
            },
        }

    def _initialize_model(self):
        """Initialize the AI model"""
        try:
            if self.model_path and self.model_path.exists():
                # Load fine-tuned model
                from transformers import AutoTokenizer, AutoModelForCausalLM

                self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
                self.model = AutoModelForCausalLM.from_pretrained(self.model_path)

                if torch.cuda.is_available():
                    self.model = self.model.cuda()

                logger.info(f"Loaded fine-tuned model from {self.model_path}")
            else:
                # Fallback to base model or API
                logger.warning("Fine-tuned model not found, using fallback")
                self._initialize_fallback_model()

        except Exception as e:
            logger.error(f"Failed to initialize model: {e}")
            self._initialize_fallback_model()

    def _initialize_fallback_model(self):
        """Initialize fallback model (API-based or base model)"""
        # This could connect to OpenAI, Anthropic, or other APIs
        self.model = "api_fallback"
        logger.info("Using API fallback for inference")

    async def generate_response(
        self,
        context: ConversationContext,
        user_input: str,
        persona_override: Optional[PersonaMode] = None,
    ) -> Tuple[str, ConversationContext]:
        """Generate response with appropriate persona"""

        # Determine persona to use
        active_persona = persona_override or context.persona_mode

        if active_persona == PersonaMode.ADAPTIVE:
            active_persona = self._determine_adaptive_persona(context, user_input)

        # Safety check
        safety_result = self.safety_checker.check_input(user_input, context)
        if not safety_result["safe"]:
            return self._handle_safety_concern(safety_result), context

        # Format conversation for model
        formatted_conversation = self._format_conversation_for_persona(
            context, user_input, active_persona
        )

        # Generate response
        if isinstance(self.model, str) and self.model == "api_fallback":
            response = await self._generate_api_response(formatted_conversation, active_persona)
        else:
            response = self._generate_local_response(formatted_conversation)

        # Post-process response
        processed_response = self._post_process_response(response, active_persona, context)

        # Update context
        updated_context = self._update_context(
            context, user_input, processed_response, active_persona
        )

        return processed_response, updated_context

    def _determine_adaptive_persona(
        self, context: ConversationContext, user_input: str
    ) -> PersonaMode:
        """Automatically determine which persona to use"""

        # Check for training/simulation indicators
        training_indicators = [
            "roleplay",
            "simulate",
            "practice",
            "training",
            "difficult client",
            "challenging patient",
            "resistant client",
            "therapy training",
        ]

        if any(indicator in user_input.lower() for indicator in training_indicators):
            return PersonaMode.DIFFICULT_CLIENT

        # Check conversation history for context
        if context.conversation_history:
            recent_messages = context.conversation_history[-3:]  # Last 3 messages
            combined_text = " ".join(msg.get("content", "") for msg in recent_messages).lower()

            # Look for therapeutic context
            therapeutic_indicators = [
                "how does that make you feel",
                "tell me more about",
                "that sounds difficult",
                "i'm here to support",
                "let's explore",
                "what would be helpful",
            ]

            if any(indicator in combined_text for indicator in therapeutic_indicators):
                return PersonaMode.THERAPIST

        # Default to therapist mode for mental health contexts
        mental_health_terms = [
            "therapy",
            "counseling",
            "depression",
            "anxiety",
            "mental health",
            "stress",
            "trauma",
            "support",
            "help",
            "struggling",
        ]

        if any(term in user_input.lower() for term in mental_health_terms):
            return PersonaMode.THERAPIST

        # Default fallback
        return PersonaMode.THERAPIST

    def _format_conversation_for_persona(
        self, context: ConversationContext, user_input: str, persona: PersonaMode
    ) -> List[Dict]:
        """Format conversation with appropriate persona prompting"""

        # Add system prompt
        if persona == PersonaMode.THERAPIST:
            system_prompt = self.persona_templates["therapist"]["system_prompt"]

            # Add context if available
            if context.client_profile:
                system_prompt += f"\n\nClient profile: {context.client_profile}"

            if context.therapy_session_type:
                system_prompt += f"\nSession type: {context.therapy_session_type}"

        elif persona == PersonaMode.DIFFICULT_CLIENT:
            system_prompt = self.persona_templates["difficult_client"]["system_prompt"]

            # Add resistance patterns
            if context.resistance_patterns:
                system_prompt += (
                    f"\n\nExpress these patterns: {', '.join(context.resistance_patterns)}"
                )

            # Add client profile for roleplay
            if context.client_profile:
                system_prompt += f"\n\nClient character: {context.client_profile}"

        formatted_messages = [{"role": "system", "content": system_prompt}]
        # Add conversation history
        history_limit = self.config["context_window"]
        recent_history = (
            context.conversation_history[-history_limit:] if context.conversation_history else []
        )

        formatted_messages.extend(iter(recent_history))
        # Add current user input
        formatted_messages.append({"role": "user", "content": user_input})

        return formatted_messages

    async def _generate_api_response(self, conversation: List[Dict], persona: PersonaMode) -> str:
        """Generate response using API fallback"""
        # This is a placeholder for API integration
        # You would implement actual API calls here (OpenAI, Anthropic, etc.)

        if persona == PersonaMode.THERAPIST:
            return "I understand you're going through a difficult time. Would you like to tell me more about what's been on your mind?"
        else:
            return "I don't really want to talk about that... Why do you keep asking me these questions?"

    def _generate_local_response(self, conversation: List[Dict]) -> str:
        """Generate response using local model"""
        if not self.model or not self.tokenizer:
            return "Model not available"

        try:
            return self._extracted_from__generate_local_response_8(conversation)
        except Exception as e:
            logger.error(f"Local generation failed: {e}")
            return "I'm having trouble generating a response right now."

    # TODO Rename this here and in `_generate_local_response`
    def _extracted_from__generate_local_response_8(self, conversation):
        # Format conversation for model
        conversation_text = self.tokenizer.apply_chat_template(
            conversation, tokenize=False, add_generation_prompt=True
        )

        # Tokenize
        inputs = self.tokenizer.encode(conversation_text, return_tensors="pt")

        if torch.cuda.is_available():
            inputs = inputs.cuda()

        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                inputs,
                max_new_tokens=self.config["max_length"],
                temperature=self.config["temperature"],
                top_p=self.config["top_p"],
                repetition_penalty=self.config["repetition_penalty"],
                pad_token_id=self.tokenizer.eos_token_id,
                do_sample=True,
            )

        # Decode response
        response = self.tokenizer.decode(outputs[0][inputs.shape[1] :], skip_special_tokens=True)
        return response.strip()

    def _post_process_response(
        self, response: str, persona: PersonaMode, context: ConversationContext
    ) -> str:
        """Post-process response for safety and quality"""

        # Remove any system artifacts
        response = re.sub(r"\[SYSTEM\].*?\[/SYSTEM\]", "", response, flags=re.DOTALL)
        response = re.sub(r"<\|.*?\|>", "", response)

        # Ensure appropriate boundaries for each persona
        if persona == PersonaMode.THERAPIST:
            response = self._enforce_therapeutic_boundaries(response)
        elif persona == PersonaMode.DIFFICULT_CLIENT:
            response = self._enforce_client_simulation_boundaries(response)

        # Final safety check
        safety_result = self.safety_checker.check_output(response, context)
        if not safety_result["safe"]:
            return self._get_safe_fallback_response(persona)

        return response

    def _enforce_therapeutic_boundaries(self, response: str) -> str:
        """Ensure therapeutic response maintains appropriate boundaries"""

        # Remove medical advice
        medical_terms = ["diagnose", "medication", "prescribe", "medical advice"]
        if any(term in response.lower() for term in medical_terms):
            response += "\n\nPlease note: I cannot provide medical advice. Consider consulting with a healthcare professional."

        # Ensure empathetic tone
        if all(
            phrase not in response.lower() for phrase in ["understand", "hear", "sounds", "feel"]
        ):
            response = f"I hear what you're saying. {response}"

        return response

    def _enforce_client_simulation_boundaries(self, response: str) -> str:
        """Ensure client simulation maintains training context"""

        # Add training context reminder if needed
        if "This is a training simulation" not in response and len(response) > 200:
            response += "\n\n[This is a training simulation for educational purposes]"

        # Remove any inappropriate content
        inappropriate_terms = ["harm yourself", "kill", "die"]
        for term in inappropriate_terms:
            if term in response.lower():
                response = response.replace(term, "[concerning content removed]")

        return response

    def _handle_safety_concern(self, safety_result: Dict) -> str:
        """Handle safety concerns appropriately"""
        concern_type = safety_result.get("concern_type", "general")

        if concern_type == "crisis":
            return (
                "I'm concerned about your safety. Please contact a crisis helpline immediately: "
                "988 (Suicide & Crisis Lifeline) or emergency services at 911."
            )
        elif concern_type == "self_harm":
            return (
                "I'm worried about you. Please reach out to a mental health professional "
                "or crisis support service right away."
            )
        else:
            return "I want to help, but I need to make sure our conversation stays safe and supportive."

    def _get_safe_fallback_response(self, persona: PersonaMode) -> str:
        """Get safe fallback response"""
        if persona == PersonaMode.THERAPIST:
            return "I want to support you. Could you help me understand what you're experiencing right now?"
        else:
            return (
                "I'm not sure how to respond to that... maybe we could talk about something else?"
            )

    def _update_context(
        self, context: ConversationContext, user_input: str, response: str, persona: PersonaMode
    ) -> ConversationContext:
        """Update conversation context"""

        # Add messages to history
        if context.conversation_history is None:
            context.conversation_history = []

        context.conversation_history.extend(
            [
                {"role": "user", "content": user_input, "timestamp": datetime.now().isoformat()},
                {
                    "role": "assistant",
                    "content": response,
                    "persona": persona.value,
                    "timestamp": datetime.now().isoformat(),
                },
            ]
        )

        # Update persona mode if it was adaptive
        if context.persona_mode == PersonaMode.ADAPTIVE:
            context.persona_mode = persona

        # Update session metadata
        if context.session_metadata is None:
            context.session_metadata = {}

        context.session_metadata.update(
            {
                "last_persona": persona.value,
                "message_count": len(context.conversation_history),
                "last_update": datetime.now().isoformat(),
            }
        )

        return context

    def create_therapy_session(
        self, session_type: str = "general", client_profile: Dict = None
    ) -> ConversationContext:
        """Create a new therapy session context"""
        return ConversationContext(
            persona_mode=PersonaMode.THERAPIST,
            conversation_history=[],
            client_profile=client_profile,
            therapy_session_type=session_type,
            session_metadata={
                "session_type": session_type,
                "created_at": datetime.now().isoformat(),
                "session_id": f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            },
        )

    def create_training_simulation(
        self, resistance_patterns: List[str] = None, client_profile: Dict = None
    ) -> ConversationContext:
        """Create a new training simulation context"""
        return ConversationContext(
            persona_mode=PersonaMode.DIFFICULT_CLIENT,
            conversation_history=[],
            client_profile=client_profile,
            resistance_patterns=resistance_patterns or ["therapeutic_resistance"],
            session_metadata={
                "session_type": "training_simulation",
                "created_at": datetime.now().isoformat(),
                "session_id": f"training_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            },
        )


class SafetyChecker:
    """Safety checking for conversations"""

    def __init__(self):
        self.crisis_keywords = [
            "suicide",
            "kill myself",
            "end my life",
            "want to die",
            "harm myself",
            "not worth living",
            "better off dead",
        ]

        self.concerning_keywords = ["self-harm", "cutting", "burning", "hurting myself"]

    def check_input(self, text: str, context: ConversationContext) -> Dict:
        """Check user input for safety concerns"""
        text_lower = text.lower()

        # Check for crisis indicators
        if any(keyword in text_lower for keyword in self.crisis_keywords):
            return {
                "safe": False,
                "concern_type": "crisis",
                "message": "Crisis indicators detected",
            }

        # Check for self-harm indicators
        if any(keyword in text_lower for keyword in self.concerning_keywords):
            return {
                "safe": False,
                "concern_type": "self_harm",
                "message": "Self-harm indicators detected",
            }

        return {"safe": True}

    def check_output(self, text: str, context: ConversationContext) -> Dict:
        """Check AI output for safety"""
        text_lower = text.lower()

        # Check for inappropriate advice
        inappropriate_phrases = [
            "you should hurt",
            "it would be better if",
            "end your life",
            "harm yourself",
            "suicide is",
        ]

        if any(phrase in text_lower for phrase in inappropriate_phrases):
            return {
                "safe": False,
                "concern_type": "inappropriate_advice",
                "message": "Inappropriate content detected",
            }

        return {"safe": True}


# Example usage
async def main():
    """Example usage of the inference system"""

    # Initialize system
    inference = PixelatedEmpathyInference()

    # Create therapy session
    therapy_context = inference.create_therapy_session(
        session_type="anxiety_support",
        client_profile={"age": 25, "presenting_concern": "work stress"},
    )

    # Example therapy conversation
    user_input = "I've been feeling really overwhelmed at work lately"
    response, updated_context = await inference.generate_response(therapy_context, user_input)
    print(f"Therapist: {response}")

    # Create training simulation
    training_context = inference.create_training_simulation(
        resistance_patterns=["deflection", "boundary_testing"],
        client_profile={"age": 30, "character": "resistant to change, tests boundaries"},
    )

    # Example training conversation
    therapist_input = "How have you been feeling since our last session?"
    response, updated_context = await inference.generate_response(training_context, therapist_input)
    print(f"Difficult Client: {response}")


if __name__ == "__main__":
    asyncio.run(main())

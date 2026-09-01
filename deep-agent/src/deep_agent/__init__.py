"""
Deep Agent Quickstart — Cloudflare Workers AI & NVIDIA NIM

Built from the langchain-skills deepagents-python-quickstart.
Uses Tavily for web search (Cloudflare/NVIDIA don't have built-in search
like Anthropic/OpenAI/Google).

Usage:
  1. Fill in .env with your API keys (Cloudflare, NVIDIA, Tavily)
  2. Run: uv run python agent.py
  3. (Optional) Switch provider: PROVIDER=nvidia uv run python agent.py
"""

import os
from typing import Literal

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from tavily import TavilyClient

from deepagents import create_deep_agent

load_dotenv(override=True)


class CloudflareChatOpenAI(ChatOpenAI):
    """ChatOpenAI subclass that flattens messages for Cloudflare Workers AI.

    Cloudflare's OpenAI-compatible endpoint rejects:
    - content as array of content blocks (expects plain string)
    - non-null content on assistant messages that have tool_calls
    """

    def _get_request_payload(self, input_, *, stop=None, **kwargs):
        payload = super()._get_request_payload(input_, stop=stop, **kwargs)
        for msg in payload.get("messages", []):
            content = msg.get("content")
            if isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block["text"])
                    elif isinstance(block, str):
                        parts.append(block)
                msg["content"] = "\n".join(parts) if parts else ""
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                msg["content"] = ""
            if msg.get("role") == "tool" and msg.get("content") and not isinstance(msg.get("content"), str):
                msg["content"] = str(msg["content"])
        return payload


# --- Provider Configuration --------------------------------------------------

PROVIDER = os.environ.get("PROVIDER", "cloudflare")  # "cloudflare" or "nvidia"


def get_model(provider: str):
    """Return an initialized ChatModel for the given provider."""
    if provider == "cloudflare":
        account_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
        api_key = os.environ["CLOUDFLARE_API_KEY"]
        return CloudflareChatOpenAI(
            base_url=f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
            api_key=api_key,
            model="@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            temperature=0,
        )
    elif provider == "nvidia":
        api_key = os.environ["NVIDIA_API_KEY"]
        return ChatOpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key,
            model="minimaxai/minimax-m3",
            temperature=0,
        )
    else:
        raise ValueError(f"Unknown provider: {provider}. Use 'cloudflare' or 'nvidia'.")


# --- Tavily Search Tool ------------------------------------------------------

tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])


def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
) -> list[dict]:
    """Run a web search via Tavily.

    Args:
        query: The search query.
        max_results: Maximum number of results to return.
        topic: Search topic (general, news, or finance).
        include_raw_content: Whether to include raw page content.
    """
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )


# --- Research System Prompt --------------------------------------------------

research_instructions = """You are an expert researcher. Your job is to conduct thorough research and then write a polished report.
You have access to an internet search tool as your primary means of gathering information.
## `internet_search`
Use this to run an internet search for a given query. You can specify the max number of results to return, the topic, and whether raw content should be included."""


# --- Build & Run Agent -------------------------------------------------------

def main():
    model = get_model(PROVIDER)
    print(f"Using provider: {PROVIDER}")
    print(f"Model: {model.model_name}")
    print()

    agent = create_deep_agent(
        model=model,
        tools=[internet_search],
        system_prompt=research_instructions,
    )

    query = "What is LangGraph and how does it differ from LangChain?"
    print(f"Research query: {query}")
    print("-" * 60)
    print()

    result = agent.invoke({
        "messages": [{"role": "user", "content": query}]
    })

    print("=" * 60)
    print("RESULT")
    print("=" * 60)
    print(result["messages"][-1].content)


if __name__ == "__main__":
    main()

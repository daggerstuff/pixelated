#!/usr/bin/env python3
"""
Byterover MCP Server Implementation

This server provides knowledge storage and retrieval functionality for the
Pixelated Empathy project, implementing the Model Context Protocol (MCP).
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path


class ByteroverMCPServer:
    """MCP server for byterover knowledge management."""

    def __init__(self, knowledge_dir: Path | None = None):
        """Initialize the MCP server."""
        self.knowledge_dir = knowledge_dir or Path.home() / ".byterover" / "knowledge"
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)

    def _setup_tools(self) -> None:
        """Setup MCP tools."""

    async def _store_knowledge(self, content: str) -> str:
        """Store knowledge in the knowledge base."""
        try:
            # Create a knowledge entry with timestamp
            import datetime
            timestamp = datetime.datetime.now().isoformat()

            # Generate a unique filename
            filename = f"knowledge_{timestamp.replace(':', '-')}.json"
            filepath = self.knowledge_dir / filename

            # Store the knowledge
            knowledge_data = {
                "timestamp": timestamp,
                "content": content,
                "type": "general_knowledge"
            }

            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(knowledge_data, f, indent=2)

            return f"✅ Knowledge stored successfully in {filename}"

        except Exception as e:
            return f"❌ Error storing knowledge: {e!s}"

    async def _retrieve_knowledge(self, query: str) -> str:
        """Retrieve relevant knowledge from the knowledge base."""
        try:
            relevant_knowledge = []

            # Search through all knowledge files
            for knowledge_file in self.knowledge_dir.glob("knowledge_*.json"):
                try:
                    with open(knowledge_file, encoding="utf-8") as f:
                        knowledge_data = json.load(f)

                    # Simple relevance check - look for query terms in content
                    content = knowledge_data.get("content", "").lower()
                    query_terms = query.lower().split()

                    # Check if any query term is in the content
                    if any(term in content for term in query_terms):
                        relevant_knowledge.append({
                            "timestamp": knowledge_data.get("timestamp", "unknown"),
                            "content": knowledge_data.get("content", ""),
                            "file": knowledge_file.name
                        })

                except (json.JSONDecodeError, KeyError):
                    # Skip invalid knowledge files
                    continue

            if relevant_knowledge:
                # Format the results
                results = []
                for knowledge in relevant_knowledge[:5]:  # Limit to top 5 results
                    results.append(f"📚 {knowledge['timestamp']}")
                    results.append(f"File: {knowledge['file']}")
                    results.append(f"Content: {knowledge['content'][:200]}...")
                    results.append("-" * 50)

                return "\n".join(results)
            return "🔍 No relevant knowledge found for your query."

        except Exception as e:
            return f"❌ Error retrieving knowledge: {e!s}"


async def main(once: bool = False) -> None:
    """Main entry point for the MCP server."""
    # Get knowledge directory from environment or use default
    knowledge_dir = os.getenv("BYTEROVER_KNOWLEDGE_DIR")
    if knowledge_dir:
        knowledge_dir = Path(knowledge_dir)

    server = ByteroverMCPServer(knowledge_dir)

    # If running interactively (stdin is a TTY) we likely were started manually
    # by a developer. In that case, avoid entering the blocking stdin loop
    # which will appear to 'hang' — print a helpful message and exit.
    # When the MCP host runs this server it will pipe stdin, making isatty() false,
    # so normal behavior is preserved.
    try:
        if sys.stdin.isatty():
            print("No MCP host detected on stdin (tty). Exiting to avoid blocking.\n" \
                  "To run the server use a MCP host or pipe a single request for testing.")
            return
    except Exception:
        # If any unexpected error checking TTY, proceed normally.
        pass

    # Simple MCP-like interface for stdin/stdout
    processed_one = False
    while True:
        try:
            line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
            if not line:
                break

            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
                method = request.get("method")
                params = request.get("params", {})
                request_id = request.get("id")

                # Handle notifications (no ID) vs requests (with ID)
                if request_id is not None:
                    response = {"id": request_id}

                    if method == "initialize":
                        # Handle MCP initialize request
                        response["result"] = {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {
                                "tools": {},
                                "resources": {},
                                "prompts": {}
                            },
                            "serverInfo": {
                                "name": "byterover-mcp-server",
                                "version": "1.0.0"
                            }
                        }
                    elif method == "tools/list":
                        response["result"] = {
                            "tools": [
                                {
                                    "name": "byterover-store-knowledge",
                                    "description": "Store knowledge about patterns, APIs, architectural decisions, error solutions, debugging techniques, reusable code patterns, or utility functions",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "content": {
                                                "type": "string",
                                                "description": "The knowledge content to store"
                                            }
                                        },
                                        "required": ["content"]
                                    }
                                },
                                {
                                    "name": "byterover-retrieve-knowledge",
                                    "description": "Retrieve relevant knowledge for context, patterns, solutions, or architectural decisions",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "query": {
                                                "type": "string",
                                                "description": "The query to search for relevant knowledge"
                                            }
                                        },
                                        "required": ["query"]
                                    }
                                }
                            ]
                        }
                    elif method == "tools/call":
                        tool_name = params.get("name")
                        tool_args = params.get("arguments", {})

                        if tool_name == "byterover-store-knowledge":
                            result = await server._store_knowledge(tool_args.get("content", ""))
                        elif tool_name == "byterover-retrieve-knowledge":
                            result = await server._retrieve_knowledge(tool_args.get("query", ""))
                        else:
                            result = f"Unknown tool: {tool_name}"

                        response["result"] = result
                    else:
                        response["error"] = {"code": -32601, "message": "Method not found"}

                    # Ensure immediate delivery to the MCP host
                    print(json.dumps(response), flush=True)
                # Handle notifications (no ID)
                elif method == "initialized":
                    # MCP initialized notification - acknowledge silently
                    pass
                else:
                    # Unknown notification - log for debugging
                    print(json.dumps({"notification": method, "params": params}), file=sys.stderr, flush=True)

            except json.JSONDecodeError:
                error_response = {"error": {"code": -32700, "message": "Parse error"}}
                print(json.dumps(error_response), flush=True)

            # If --once was requested, stop after processing one request
            if once:
                processed_one = True
                break

        except KeyboardInterrupt:
            break
        except Exception as e:
            error_response = {"error": {"code": -32603, "message": f"Internal error: {e!s}"}}
            print(json.dumps(error_response), flush=True)


def _cli() -> int:
    parser = argparse.ArgumentParser(description="Byterover MCP server")
    parser.add_argument("--health", action="store_true", help="Print tool metadata and exit (health check)")
    parser.add_argument("--once", action="store_true", help="Process a single request then exit (testing)")

    args = parser.parse_args()

    # Health check: print tools metadata and exit
    if args.health:
        tools_meta = {
            "tools": [
                {
                    "name": "byterover-store-knowledge",
                    "description": "Store knowledge about patterns, APIs, architectural decisions, error solutions, debugging techniques, reusable code patterns, or utility functions",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"content": {"type": "string"}},
                        "required": ["content"]
                    }
                },
                {
                    "name": "byterover-retrieve-knowledge",
                    "description": "Retrieve relevant knowledge for context, patterns, solutions, or architectural decisions",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"query": {"type": "string"}},
                        "required": ["query"]
                    }
                }
            ]
        }
        print(json.dumps({"status": "ok", "tools": tools_meta}))
        return 0

    # If running interactively, avoid blocking
    try:
        if sys.stdin.isatty():
            print("No MCP host detected on stdin (tty). Exiting to avoid blocking.\n" \
                  "To run the server use a MCP host or pipe a single request for testing.")
            return 0
    except Exception:
        pass

    asyncio.run(main(once=args.once))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())

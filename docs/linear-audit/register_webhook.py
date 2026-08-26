#!/usr/bin/env python3
"""
register_webhook.py — Register/unregister Linear webhook for dashboard refresh.

Creates a webhook subscription in Linear that sends Issue and Project events
to the dashboard-refresh endpoint. The webhook secret is auto-generated and
printed so you can set it as LINEAR_DASHBOARD_WEBHOOK_SECRET on the server.

Usage:
    # Register (creates a new webhook)
    export LINEAR_API_KEY=lin_api_...
    python3 register_webhook.py register \\
        --url https://your-server.com/api/webhooks/linear/dashboard

    # List existing webhooks
    python3 register_webhook.py list

    # Unregister by label
    python3 register_webhook.py unregister --label "Enterprise Readiness Dashboard Refresh"

    # Unregister by id
    python3 register_webhook.py unregister --id <webhook-id>
"""

import argparse
import json
import os
import secrets
import sys
import urllib.error
import urllib.request

API_KEY = os.environ.get("LINEAR_API_KEY", "")
if not API_KEY:
    print("ERROR: LINEAR_API_KEY environment variable must be set.", file=sys.stderr)
    sys.exit(1)

API_URL = "https://api.linear.app/graphql"


def gql(query: str, variables: dict | None = None) -> dict | None:
    """Execute a GraphQL query against the Linear API. Returns None on failure."""
    payload: dict[str, object] = {"query": query}
    if variables:
        payload["variables"] = variables

    try:
        req = urllib.request.Request(
            API_URL,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": API_KEY},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            if "errors" in result:
                print(f"  API Error: {result['errors']}", file=sys.stderr)
                return None
            return result
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        print(f"  HTTP {e.code} error from Linear API: {body}", file=sys.stderr)
        return None
    except urllib.error.URLError as e:
        print(f"  Connection error: {e.reason}", file=sys.stderr)
        return None


def list_webhooks():
    """List all webhooks in the workspace."""
    # NOTE: The Webhook type uses `label` (not `name`) and `id` for identification
    result = gql("{ webhooks { nodes { id label url enabled resourceTypes } } }")
    if not result:
        print("Failed to fetch webhooks.", file=sys.stderr)
        sys.exit(1)

    webhooks = result.get("data", {}).get("webhooks", {}).get("nodes", [])

    if not webhooks:
        print("No webhooks found.")
        return

    print(f"Found {len(webhooks)} webhook(s):\n")
    for w in webhooks:
        print(f"  ID:     {w['id']}")
        print(f"  Label:  {w.get('label', '(no label)')}")
        print(f"  URL:    {w['url']}")
        print(f"  Active: {w['enabled']}")
        print(f"  Events: {', '.join(w.get('resourceTypes', []))}")
        print()


def register_webhook(url: str, label: str | None = None):
    """Register a new webhook. Auto-generates secret. Returns the webhook data + secret."""
    webhook_label = label or "Enterprise Readiness Dashboard Refresh"
    secret = "whsec_" + secrets.token_hex(32)

    mutation = """
    mutation($input: WebhookCreateInput!) {
      webhookCreate(input: $input) {
        success
        webhook {
          id
          label
          url
          enabled
          resourceTypes
        }
      }
    }
    """
    variables = {
        "input": {
            "label": webhook_label,
            "url": url,
            "secret": secret,
            "enabled": True,
            "resourceTypes": ["Issue", "Project"],
            "allPublicTeams": True,
        }
    }

    result = gql(mutation, variables)
    if not result:
        print("Failed to create webhook (API call failed).", file=sys.stderr)
        sys.exit(1)

    data = result.get("data", {}).get("webhookCreate", {})
    webhook = data.get("webhook", {})

    if data.get("success") and webhook:
        print(f"✅ Webhook registered successfully!\n")
        print(f"  ID:       {webhook['id']}")
        print(f"  Label:    {webhook.get('label', webhook_label)}")
        print(f"  URL:      {webhook['url']}")
        print(f"  Events:   {', '.join(webhook.get('resourceTypes', []))}")
        print(f"\n⚠️  IMPORTANT: Set this environment variable on your server:\n")
        print(f"  LINEAR_DASHBOARD_WEBHOOK_SECRET={secret}\n")
        print(f"  (Keep this secret — it's used to verify webhook signatures.)")
        return webhook["id"], secret
    else:
        print(f"❌ Failed to create webhook: {data}", file=sys.stderr)
        sys.exit(1)


def unregister_webhook(webhook_id: str | None = None, label: str | None = None):
    """Delete a webhook by ID or by label."""
    if webhook_id and label:
        print("ERROR: Provide --id OR --label, not both.", file=sys.stderr)
        sys.exit(1)

    target_id = webhook_id

    if label:
        # Find webhook by label
        result = gql("{ webhooks { nodes { id label } } }")
        if not result:
            print("Failed to fetch webhooks.", file=sys.stderr)
            sys.exit(1)
        webhooks = result.get("data", {}).get("webhooks", {}).get("nodes", [])
        matches = [w for w in webhooks if w.get("label") == label]
        if not matches:
            print(f"No webhook found with label '{label}'", file=sys.stderr)
            sys.exit(1)
        target_id = matches[0]["id"]
        print(f"Found webhook '{label}' with ID: {target_id}")

    if not target_id:
        print("ERROR: Provide --id or --label to identify the webhook.", file=sys.stderr)
        sys.exit(1)

    mutation = f'mutation {{ webhookDelete(id: "{target_id}") {{ success }} }}'
    result = gql(mutation)
    if not result:
        print("Failed to delete webhook (API call failed).", file=sys.stderr)
        sys.exit(1)

    if result.get("data", {}).get("webhookDelete", {}).get("success"):
        print(f"✅ Webhook {target_id} deleted successfully.")
    else:
        print(f"❌ Failed to delete webhook.", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Register or unregister a Linear webhook for dashboard refresh.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # register
    reg = sub.add_parser("register", help="Create a new webhook")
    reg.add_argument("--url", required=True, help="Public URL of the webhook endpoint")
    reg.add_argument("--label", help="Human-readable label for the webhook")

    # unregister
    unreg = sub.add_parser("unregister", help="Delete a webhook")
    unreg.add_argument("--id", help="Webhook ID to delete")
    unreg.add_argument("--label", help="Delete webhook by label name")

    # list
    sub.add_parser("list", help="List all webhooks")

    args = parser.parse_args()

    if args.command == "list":
        list_webhooks()
    elif args.command == "register":
        register_webhook(args.url, args.label)
    elif args.command == "unregister":
        unregister_webhook(args.id, args.label)


if __name__ == "__main__":
    main()

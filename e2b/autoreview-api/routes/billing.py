"""
AutoReview AI — Stripe Billing Routes.

Handles:
  - POST /billing/checkout — Create Stripe Checkout session
  - POST /billing/portal — Create Customer Portal session
  - POST /billing/webhook — Stripe webhook handler
"""

import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from config import get_settings
from db import (
    delete_subscription,
    get_supabase,
    get_user_by_id,
    update_user_stripe_customer,
    update_user_tier,
    upsert_subscription,
)

logger = logging.getLogger("autoreview.billing")
router = APIRouter()

TIER_PRICE_MAP: dict[str, str] = {}


def _init_stripe() -> None:
    """Initialize Stripe client and tier-price mapping."""
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    TIER_PRICE_MAP.update(
        {
            "indie": settings.stripe_price_indie,
            "team": settings.stripe_price_team,
            "pro": settings.stripe_price_pro,
        }
    )


def _price_to_tier(price_id: str) -> str:
    """Reverse-lookup tier name from Stripe price ID."""
    for tier, pid in TIER_PRICE_MAP.items():
        if pid == price_id:
            return tier
    return "free"


# ── Checkout ─────────────────────────────────────────


class CheckoutRequest(BaseModel):
    tier: str


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest, request: Request):
    """Create a Stripe Checkout session for tier upgrade."""
    _init_stripe()
    settings = get_settings()
    user_id = request.state.user_id

    if body.tier not in TIER_PRICE_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(f"Invalid tier: {body.tier}. Choose from: {list(TIER_PRICE_MAP)}"),
        )

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Create or reuse Stripe Customer
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.get("email"),
            metadata={
                "user_id": user_id,
                "github_login": user["github_login"],
            },
        )
        customer_id = customer.id
        update_user_stripe_customer(user_id, customer_id)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[
            {
                "price": TIER_PRICE_MAP[body.tier],
                "quantity": 1,
            }
        ],
        success_url=(f"{settings.frontend_url}/dashboard?checkout=success"),
        cancel_url=(f"{settings.frontend_url}/pricing?checkout=canceled"),
        metadata={
            "user_id": user_id,
            "tier": body.tier,
        },
    )

    logger.info(
        "Checkout session created for %s → %s",
        user["github_login"],
        body.tier,
    )
    return {"checkout_url": session.url}


# ── Customer Portal ──────────────────────────────────


@router.post("/portal")
async def create_portal(request: Request):
    """Create a Stripe Customer Portal session."""
    _init_stripe()
    settings = get_settings()
    user_id = request.state.user_id

    user = get_user_by_id(user_id)
    if not user or not user.get("stripe_customer_id"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No billing account found",
        )

    portal = stripe.billing_portal.Session.create(
        customer=user["stripe_customer_id"],
        return_url=(f"{settings.frontend_url}/dashboard"),
    )

    return {"portal_url": portal.url}


# ── Webhook ──────────────────────────────────────────


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events.

    Processes:
      - checkout.session.completed
      - customer.subscription.updated
      - customer.subscription.deleted
    """
    _init_stripe()
    settings = get_settings()

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.stripe_webhook_secret,
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        ) from None

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(
        "Stripe webhook: %s (%s)",
        event_type,
        data.get("id", ""),
    )

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(data)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(data)

    return {"received": True}


async def _handle_checkout_completed(
    session: dict,
) -> None:
    """Activate subscription after successful checkout."""
    user_id = session.get("metadata", {}).get("user_id")
    tier = session.get("metadata", {}).get("tier", "indie")
    sub_id = session.get("subscription")

    if not user_id or not sub_id:
        logger.warning("Checkout completed without user_id or sub_id")
        return

    # Fetch full subscription details
    sub = stripe.Subscription.retrieve(sub_id)

    upsert_subscription(
        user_id=user_id,
        stripe_sub_id=sub_id,
        tier=tier,
        status="active",
        current_period_end=datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc),
    )

    update_user_tier(user_id, tier)

    logger.info(
        "Subscription activated: user=%s tier=%s",
        user_id,
        tier,
    )


async def _handle_subscription_updated(
    sub: dict,
) -> None:
    """Handle plan changes and cancellations."""
    sub_id = sub["id"]

    # Determine tier from price
    items = sub.get("items", {}).get("data", [])
    price_id = items[0]["price"]["id"] if items else None
    tier = _price_to_tier(price_id) if price_id else "free"

    # Find user by customer
    customer_id = sub["customer"]

    client = get_supabase()
    user_result = (
        client.table("users")
        .select("id")
        .eq("stripe_customer_id", customer_id)
        .maybe_single()
        .execute()
    )

    if not user_result.data:
        logger.warning(
            "Sub updated for unknown customer: %s",
            customer_id,
        )
        return

    user_id = user_result.data["id"]

    upsert_subscription(
        user_id=user_id,
        stripe_sub_id=sub_id,
        tier=tier,
        status=sub["status"],
        current_period_end=datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc),
        cancel_at_period_end=sub.get("cancel_at_period_end", False),
    )

    # Update tier if subscription is active
    if sub["status"] == "active":
        update_user_tier(user_id, tier)
    elif sub["status"] in ("past_due", "unpaid"):
        update_user_tier(user_id, "free")

    logger.info(
        "Subscription updated: sub=%s status=%s tier=%s",
        sub_id,
        sub["status"],
        tier,
    )


async def _handle_subscription_deleted(
    sub: dict,
) -> None:
    """Downgrade user when subscription is canceled."""
    sub_id = sub["id"]
    customer_id = sub["customer"]

    client = get_supabase()
    user_result = (
        client.table("users")
        .select("id")
        .eq("stripe_customer_id", customer_id)
        .maybe_single()
        .execute()
    )

    if user_result.data:
        user_id = user_result.data["id"]
        update_user_tier(user_id, "free")
        delete_subscription(sub_id)
        logger.info(
            "Subscription deleted, user %s → free",
            user_id,
        )

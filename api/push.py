"""Web Push notification sender using pywebpush + VAPID."""

from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)


def _get_vapid_config() -> tuple[str, str, str] | None:
    """Return (private_key, public_key, email) or None if not configured."""
    priv = os.environ.get("VAPID_PRIVATE_KEY", "")
    pub = os.environ.get("VAPID_PUBLIC_KEY", "")
    email = os.environ.get("VAPID_EMAIL", "")
    if not (priv and pub and email):
        return None
    return priv, pub, email


def send_push(subscriptions: list[dict], title: str, body: str, url: str = "/") -> int:
    """
    Send a push notification to a list of subscription dicts.
    Each dict must have: endpoint, p256dh, auth.
    Returns count of successfully sent pushes.
    """
    config = _get_vapid_config()
    if not config:
        logger.warning("VAPID keys not configured — skipping push")
        return 0

    try:
        from pywebpush import WebPusher, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping push")
        return 0

    priv_key, pub_key, email = config
    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0

    for sub in subscriptions:
        try:
            response = WebPusher(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                }
            ).send(
                data=payload,
                vapid_private_key=priv_key,
                vapid_claims={"sub": f"mailto:{email}"},
            )
            if response and response.status_code in (200, 201, 204):
                sent += 1
            elif response and response.status_code == 410:
                logger.info("Push subscription gone (410): %s", sub["endpoint"][:40])
        except WebPushException as exc:
            logger.warning("Push failed for %s: %s", sub["endpoint"][:40], exc)
        except Exception as exc:
            logger.warning("Unexpected push error: %s", exc)

    return sent

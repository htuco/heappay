"""
FEP Nexus integration — drop this single file into your project's server/ folder.

Add three lines to your .env:
    NEXUS_URL=https://fep-funds.railway.app
    NEXUS_SECRET_KEY=<shared-secret>
    NEXUS_PROJECT=atom          # atom | meta | heap | 5-stack

Add httpx to your dependencies:
    uv add httpx

Lifecycle:
    request_funds()  -> creates a request (status "requested", awaiting operator)
    operator approves it in the dashboard       (status -> "approved")
    fetch_approved() -> lists approved items (claimable), each with external_ref
    confirm(id)      -> marks one received      (status -> "completed")

Use external_ref to tie a disbursement back to your own record (e.g. a user id),
so a multi-user app credits the right account.
"""

import os
from decimal import Decimal
from typing import Optional
import httpx


def _config():
    # Read at call time so it works no matter when dotenv loads
    return (
        os.getenv("NEXUS_URL", "").rstrip("/"),
        os.getenv("NEXUS_SECRET_KEY", ""),
        os.getenv("NEXUS_PROJECT", ""),
    )


def _headers(key):
    return {"x-nexus-key": key}


async def request_funds(amount: float, note: str = "", external_ref: Optional[str] = None) -> dict:
    """
    Ask the operator for funds. Creates a request in status "requested" (NOT yet
    claimable — the operator must approve it first).

    Returns the full request object: {id, project, amount, currency, status,
    note, external_ref, created_at, ...}. Returns {} on failure (never raises).

        req = await nexus.request_funds(500.0, note="topup", external_ref=str(user.id))
        req_id = req.get("id")
    """
    url, key, project = _config()
    if not (url and key and project):
        return {}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{url}/requests",
                json={"project": project, "amount": amount, "note": note or None, "external_ref": external_ref},
                headers=_headers(key),
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        return {}


async def list_requests(status: Optional[str] = None) -> list[dict]:
    """
    List this project's requests, optionally filtered by status
    (requested | approved | completed | rejected). [] on failure.
    """
    url, key, project = _config()
    if not (url and key and project):
        return []
    params = {"project": project}
    if status:
        params["status"] = status
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{url}/requests", params=params, headers=_headers(key))
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        return []


async def get_request(request_id: str) -> Optional[dict]:
    """Fetch a single request for status polling. None if missing or on failure."""
    url, key, _ = _config()
    if not (url and key):
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{url}/requests/{request_id}", headers=_headers(key))
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        return None


async def fetch_approved() -> list[dict]:
    """
    List approved (claimable) disbursements for this project. Each item includes
    external_ref and the id, so you can credit the right user:

        for item in await nexus.fetch_approved():
            if await nexus.confirm(item["id"]):
                credit(item["external_ref"], item["amount"])

    [] if nothing approved or on failure (never raises).
    """
    url, key, project = _config()
    if not (url and key and project):
        return []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{url}/dispense/pending", params={"project": project}, headers=_headers(key))
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        return []


async def confirm(dispense_id: str) -> bool:
    """
    Confirm receipt of one disbursement. True on success (200), False otherwise
    (409 already-completed, network error, or misconfig). Never raises. Safe to
    gate crediting on: only credit when this returns True.
    """
    url, key, _ = _config()
    if not (url and key):
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{url}/dispense/confirm/{dispense_id}", headers=_headers(key))
            return resp.status_code == 200
    except httpx.HTTPError:
        return False


async def claim() -> Decimal:
    """
    DEPRECATED — returns a lump sum and cannot correlate per request/user.
    Prefer fetch_approved() + confirm() so you can credit by external_ref.

    Confirms every approved disbursement and returns the total amount. Each item
    is confirmed BEFORE it is counted, so the total only reflects funds actually
    marked delivered. Never raises.
    """
    total = Decimal("0")
    for item in await fetch_approved():
        ident = item.get("id") or item.get("request_id")
        if ident and await confirm(ident):
            total += Decimal(str(item["amount"]))
    return total

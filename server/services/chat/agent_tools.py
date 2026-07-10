import json
import logging
import time
from decimal import Decimal, InvalidOperation

from repositories.card.card import CardRepository
from repositories.transaction.transaction import TransactionRepository
from repositories.user.user import UserRepository
from schemas.transaction import TransactionCreate
from services.fx.fx import FxError, FxService
from services.request.request import (
    CardAlreadyFrozenError,
    CardNotFoundError as RequestCardNotFoundError,
    CardNotFrozenError,
    ForbiddenError as RequestForbiddenError,
    FreezeRequestAlreadyPendingError,
    NotRefundableError,
    RefundAlreadyExistsError,
    RequestService,
    TransactionNotFoundError as RequestTransactionNotFoundError,
)
from services.transaction.transaction import (
    CardFrozenError,
    CardNotFoundError,
    ForbiddenError,
    InsufficientBalanceError,
    TransactionService,
)

logger = logging.getLogger(__name__)

_PAYMENT_TYPE_NAME = "payment"

WRITE_TOOLS = {"send_money", "request_card_freeze", "create_refund_request"}

_CONFIRMATION_TTL_SECONDS = 300
_IDEMPOTENCY_WINDOW_SECONDS = 120

CONFIRM_NEEDED = "needs_confirmation"
CONFIRMED = "confirmed"
ALREADY_DONE = "already_done"


class _ConfirmationGate:
    def __init__(self) -> None:
        self._turn: dict[int, int] = {}
        self._pending: dict[int, dict] = {}
        self._executed: dict[int, dict[str, float]] = {}

    def begin_turn(self, user_id: int) -> None:
        self._turn[user_id] = self._turn.get(user_id, 0) + 1

    def decide(self, user_id: int, signature: str) -> str:
        now = time.time()

        executed = self._executed.get(user_id, {})
        last_done = executed.get(signature)
        if last_done is not None and (now - last_done) < _IDEMPOTENCY_WINDOW_SECONDS:
            return ALREADY_DONE

        current = self._turn.get(user_id, 0)
        pending = self._pending.get(user_id)
        if (
            pending is not None
            and pending["signature"] == signature
            and pending["turn"] == current - 1
            and (now - pending["ts"]) < _CONFIRMATION_TTL_SECONDS
        ):
            del self._pending[user_id]
            return CONFIRMED

        self._pending[user_id] = {"signature": signature, "turn": current, "ts": now}
        return CONFIRM_NEEDED

    def mark_executed(self, user_id: int, signature: str) -> None:
        self._executed.setdefault(user_id, {})[signature] = time.time()
        pending = self._pending.get(user_id)
        if pending is not None and pending["signature"] == signature:
            del self._pending[user_id]


_GATE = _ConfirmationGate()


def _action_signature(name: str, args: dict) -> str | None:
    try:
        if name == "send_money":
            amount = Decimal(str(args["amount"]))
            return (
                f"send_money|{int(args['sender_card_id'])}"
                f"|{int(args['recipient_card_id'])}|{amount:.2f}"
            )
        if name == "request_card_freeze":
            return f"request_card_freeze|{int(args['card_id'])}|{args.get('action', 'freeze')}"
        if name == "create_refund_request":
            return f"create_refund_request|{int(args['transaction_id'])}"
    except (KeyError, TypeError, ValueError, InvalidOperation):
        return None
    return None

TOOL_DEFS = [
    {
        "type": "function",
        "function": {
            "name": "list_cards",
            "description": "List the user's own cards with their IDs, balances, and statuses. Use this to look up a card_id before sending money or freezing a card — never guess an ID.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_transactions",
            "description": "List the user's recent transactions with IDs, amounts, dates, and statuses. Use this to find a transaction_id before requesting a refund.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "How many recent transactions to return (1-50).",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_spending_summary",
            "description": "Monthly income/expense breakdown for the user over the last N months.",
            "parameters": {
                "type": "object",
                "properties": {
                    "months": {
                        "type": "integer",
                        "description": "How many months back to summarise (1-12).",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_recipient",
            "description": "Find another user to send money to, by name or email. Returns matching users with their active card IDs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Name or email to search for.",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_refund_status",
            "description": "Check whether a refund request already exists for a transaction, and its status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "integer"},
                },
                "required": ["transaction_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_money",
            "description": "Send money from one of the user's cards to a recipient card. Irreversible — only call after the user has confirmed the exact amount and recipient.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sender_card_id": {"type": "integer", "description": "One of the user's own card IDs."},
                    "recipient_card_id": {"type": "integer"},
                    "amount": {"type": "number", "description": "Amount in USD, up to 2 decimals."},
                    "note": {"type": "string"},
                },
                "required": ["sender_card_id", "recipient_card_id", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_card_freeze",
            "description": "File a request to freeze or unfreeze one of the user's cards. Only call after the user confirms.",
            "parameters": {
                "type": "object",
                "properties": {
                    "card_id": {"type": "integer"},
                    "action": {"type": "string", "enum": ["freeze", "unfreeze"]},
                    "note": {"type": "string"},
                },
                "required": ["card_id", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_refund_request",
            "description": "File a refund request for one of the user's completed transactions. Only call after the user confirms.",
            "parameters": {
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "integer"},
                    "note": {"type": "string"},
                },
                "required": ["transaction_id"],
            },
        },
    },
]

# Read-only, informational tools offered in "Chat" (ask) mode. They never change
# the user's account, so they are kept separate from the action TOOL_DEFS above.
CONVERT_CURRENCY_TOOL = {
    "type": "function",
    "function": {
        "name": "convert_currency",
        "description": (
            "Convert an amount from one currency to another at an INDICATIVE exchange "
            "rate (e.g. 'convert 50 EUR to USD', 'how much is £20 in dollars?'). This is "
            "an informational estimate only — it does NOT move or convert any real money. "
            "Use it whenever the user asks what an amount is worth in another currency. "
            "Currency codes are ISO 4217 (USD, EUR, GBP, ...)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "amount": {
                    "type": "number",
                    "description": "The amount to convert. Must be greater than zero.",
                },
                "from_currency": {
                    "type": "string",
                    "description": "ISO 4217 code of the source currency, e.g. EUR.",
                },
                "to_currency": {
                    "type": "string",
                    "description": "ISO 4217 code of the target currency, e.g. USD.",
                },
            },
            "required": ["amount", "from_currency", "to_currency"],
        },
    },
}

INFO_TOOLS = [CONVERT_CURRENCY_TOOL]


def gemini_tool_declarations():
    from google.genai import types

    type_map = {
        "object": types.Type.OBJECT,
        "integer": types.Type.INTEGER,
        "number": types.Type.NUMBER,
        "string": types.Type.STRING,
        "boolean": types.Type.BOOLEAN,
    }

    def to_schema(node: dict):
        kwargs = {"type": type_map[node["type"]]}
        if "description" in node:
            kwargs["description"] = node["description"]
        if "enum" in node:
            kwargs["enum"] = [str(e) for e in node["enum"]]
        if node["type"] == "object":
            props = {k: to_schema(v) for k, v in node.get("properties", {}).items()}
            if props:
                kwargs["properties"] = props
            if node.get("required"):
                kwargs["required"] = node["required"]
        return types.Schema(**kwargs)

    declarations = []
    for td in TOOL_DEFS:
        fn = td["function"]
        decl_kwargs = {"name": fn["name"], "description": fn["description"]}
        params = fn.get("parameters", {})
        if params.get("properties"):
            decl_kwargs["parameters"] = to_schema(params)
        declarations.append(types.FunctionDeclaration(**decl_kwargs))

    return [types.Tool(function_declarations=declarations)]


class AgentTools:
    def __init__(
        self,
        *,
        card_repo: CardRepository,
        transaction_repo: TransactionRepository,
        user_repo: UserRepository,
        transaction_service: TransactionService,
        request_service: RequestService,
        fx_service: FxService | None = None,
    ) -> None:
        self._card_repo = card_repo
        self._transaction_repo = transaction_repo
        self._user_repo = user_repo
        self._transaction_service = transaction_service
        self._request_service = request_service
        self._fx = fx_service or FxService()

    def begin_turn(self, user_id: int) -> None:
        _GATE.begin_turn(user_id)

    def execute(self, name: str, arguments: str, *, user_id: int) -> str:
        try:
            args = json.loads(arguments) if arguments else {}
        except json.JSONDecodeError:
            return json.dumps({"error": "Invalid tool arguments."})

        handler = getattr(self, f"_tool_{name}", None)
        if handler is None:
            return json.dumps({"error": f"Unknown tool: {name}"})

        signature = _action_signature(name, args) if name in WRITE_TOOLS else None
        if signature is not None:
            decision = _GATE.decide(user_id, signature)
            if decision == ALREADY_DONE:
                return json.dumps({
                    "status": "already_completed",
                    "action": name,
                    "message": (
                        "This exact action was just completed moments ago and was NOT "
                        "repeated. Do not perform it again — tell the user it is already done."
                    ),
                })
            if decision == CONFIRM_NEEDED:
                return json.dumps({
                    "status": "confirmation_required",
                    "action": name,
                    "proposed": {k: v for k, v in args.items() if k != "note"},
                    "message": (
                        "This irreversible action was NOT performed. It requires the "
                        "user's explicit confirmation in a new message. State exactly "
                        "what will happen — including the integer IDs and the amount in "
                        "USD — and ask the user to reply to confirm. Do NOT claim it "
                        "is done; nothing has happened yet."
                    ),
                })

        try:
            result = handler(args, user_id)
        except Exception:
            logger.exception("Agent tool %s failed for user_id=%s", name, user_id)
            return json.dumps({"error": "Tool execution failed."})

        if signature is not None:
            try:
                if json.loads(result).get("ok"):
                    _GATE.mark_executed(user_id, signature)
            except (json.JSONDecodeError, AttributeError):
                pass
        return result

    def _tool_list_cards(self, args: dict, user_id: int) -> str:
        cards = self._card_repo.list_all(user_id=user_id)
        result = []
        for card in cards:
            card_type = (
                f"{card.card_type.vendor} {card.card_type.type_name}"
                if card.card_type
                else "Card"
            )
            result.append({
                "card_id": card.card_id,
                "type": card_type,
                "last_four": card.last_four,
                "balance": str(card.balance),
                "status": card.status.status_name if card.status else "unknown",
                "expires_at": str(card.expires_at),
            })
        return json.dumps(result)

    def _tool_search_transactions(self, args: dict, user_id: int) -> str:
        limit = max(1, min(int(args.get("limit", 20)), 50))
        txns, _total = self._transaction_service.list_for_user(user_id=user_id, limit=limit)
        result = []
        for tx in txns:
            recipient_name = None
            if tx.recipient_card and tx.recipient_card.user:
                u = tx.recipient_card.user
                recipient_name = f"{u.first_name} {u.last_name}"
            result.append({
                "transaction_id": tx.transaction_id,
                "date": tx.created_at.strftime("%Y-%m-%d"),
                "amount": str(tx.amount),
                "type": tx.transaction_type.name if tx.transaction_type else "transfer",
                "status": tx.status.name if tx.status else "unknown",
                "recipient": recipient_name,
                "note": tx.note,
            })
        return json.dumps(result)

    def _tool_get_spending_summary(self, args: dict, user_id: int) -> str:
        months = max(1, min(int(args.get("months", 6)), 12))
        points = self._transaction_service.get_summary_for_user(user_id=user_id, months=months)
        serializable = [
            {k: str(v) if isinstance(v, Decimal) else v for k, v in p.items()}
            for p in points
        ]
        return json.dumps(serializable)

    def _tool_find_recipient(self, args: dict, user_id: int) -> str:
        query = str(args.get("query", "")).strip()
        if not query:
            return json.dumps({"error": "query is required."})
        matches = self._user_repo.search(query, exclude_user_id=user_id, limit=5)
        if not matches and " " in query:
            seen: set[int] = set()
            merged = []
            for token in query.split():
                for row in self._user_repo.search(token, exclude_user_id=user_id, limit=5):
                    uid = row[0].user_id
                    if uid not in seen:
                        seen.add(uid)
                        merged.append(row)
            matches = merged[:5]
        result = []
        for user, card, _ in matches:
            result.append({
                "user_id": user.user_id,
                "name": f"{user.first_name} {user.last_name}",
                "email": user.email,
                "card_id": card.card_id if card else None,
            })
        return json.dumps(result)

    def _tool_get_refund_status(self, args: dict, user_id: int) -> str:
        transaction_id = int(args["transaction_id"])
        return json.dumps(self._request_service.get_refund_status(transaction_id))

    def _tool_convert_currency(self, args: dict, user_id: int) -> str:
        try:
            amount = Decimal(str(args["amount"]))
        except (KeyError, TypeError, InvalidOperation):
            return json.dumps({"error": "A numeric amount is required."})
        from_currency = str(args.get("from_currency", "")).strip()
        to_currency = str(args.get("to_currency", "")).strip()
        if not from_currency or not to_currency:
            return json.dumps({"error": "from_currency and to_currency are required."})
        try:
            result = self._fx.convert(
                amount=amount, from_currency=from_currency, to_currency=to_currency
            )
        except FxError as exc:
            return json.dumps({"error": str(exc)})
        return json.dumps(result)

    def _tool_send_money(self, args: dict, user_id: int) -> str:
        type_id = self._transaction_repo.get_type_id_by_name(_PAYMENT_TYPE_NAME)
        if type_id is None:
            return json.dumps({"error": "Payment type not configured."})
        try:
            amount = Decimal(str(args["amount"]))
        except (InvalidOperation, KeyError, TypeError):
            return json.dumps({"error": "Invalid amount."})
        try:
            payload = TransactionCreate(
                sender_card_id=int(args["sender_card_id"]),
                recipient_card_id=int(args["recipient_card_id"]),
                transaction_type_id=type_id,
                amount=amount,
                note=args.get("note"),
            )
        except Exception as exc:
            return json.dumps({"error": f"Invalid transfer: {exc}"})
        try:
            tx, _created = self._transaction_service.create(payload, user_id=user_id)
        except InsufficientBalanceError:
            return json.dumps({"error": "Insufficient balance on the sender card."})
        except CardFrozenError as exc:
            return json.dumps({"error": f"Card is frozen ({exc.side})."})
        except CardNotFoundError:
            return json.dumps({"error": "Card not found."})
        except ForbiddenError:
            return json.dumps({"error": "You can only send money from your own cards."})
        return json.dumps({
            "ok": True,
            "transaction_id": tx.transaction_id,
            "amount": str(tx.amount),
            "status": tx.status.name if tx.status else "pending",
        })

    def _tool_request_card_freeze(self, args: dict, user_id: int) -> str:
        card_id = int(args["card_id"])
        action = str(args.get("action", "freeze"))
        note = args.get("note")
        try:
            if action == "unfreeze":
                req = self._request_service.request_card_unfreeze(
                    card_id=card_id, note=note, user_id=user_id
                )
            else:
                req = self._request_service.request_card_freeze(
                    card_id=card_id, note=note, user_id=user_id
                )
        except RequestCardNotFoundError:
            return json.dumps({"error": "Card not found."})
        except RequestForbiddenError:
            return json.dumps({"error": "You can only manage your own cards."})
        except CardAlreadyFrozenError:
            return json.dumps({"error": "Card is already frozen."})
        except CardNotFrozenError:
            return json.dumps({"error": "Card is not frozen."})
        except FreezeRequestAlreadyPendingError:
            return json.dumps({"error": "A freeze request is already pending for this card."})
        return json.dumps({
            "ok": True,
            "request_id": req.request_id,
            "action": action,
            "status": "pending_admin_approval",
            "message": (
                f"{action.capitalize()} request submitted. The card status does NOT "
                "change until an admin approves the request."
            ),
        })

    def _tool_create_refund_request(self, args: dict, user_id: int) -> str:
        transaction_id = int(args["transaction_id"])
        note = args.get("note")
        try:
            req = self._request_service.request_refund(
                transaction_id=transaction_id, note=note, user_id=user_id
            )
        except RequestTransactionNotFoundError:
            return json.dumps({"error": "Transaction not found."})
        except RequestForbiddenError:
            return json.dumps({"error": "You can only refund your own transactions."})
        except NotRefundableError as exc:
            return json.dumps({"error": str(exc) or "Transaction is not refundable."})
        except RefundAlreadyExistsError as exc:
            return json.dumps({"error": f"A refund already exists ({exc.status})."})
        return json.dumps({
            "ok": True,
            "request_id": req.request_id,
            "status": "pending_admin_approval",
            "message": "Refund request submitted. It will be reviewed by an admin; the money is not returned until approved.",
        })

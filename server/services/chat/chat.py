import json
import logging
import time
from datetime import date

from google import genai
from google.genai import errors as gemini_errors
from groq import BadRequestError, Groq

from models.chat_message import ChatMessage
from repositories.card.card import CardRepository
from repositories.chat.chat import ChatRepository
from repositories.transaction.transaction import TransactionRepository
from repositories.user.user import UserRepository
from repositories.vector.knowledge import VectorRepository
from services.chat.agent_tools import (
    INFO_TOOLS,
    TOOL_DEFS,
    AgentTools,
    gemini_tool_declarations,
)
from services.embedding.embedding import EmbeddingService
from services.request.request import RequestService
from services.transaction.transaction import TransactionService

logger = logging.getLogger(__name__)

_ROLE_MAP = {"model": "assistant"}

_MAX_AGENT_STEPS = 5

_GEMINI_MODEL = "gemini-2.5-flash"

_GEMINI_RETRY_ATTEMPTS = 3
_GEMINI_RETRY_CODES = {429, 503}

_AGENT_FALLBACK_REPLY = "Sorry, I couldn't complete that. Could you rephrase or be more specific?"

_NO_IBAN_RULE = (
    "This app never uses or displays IBANs. Never state, generate, or imply an IBAN for any "
    "user, account, or card — including in card-related answers — even if explicitly asked."
)

_ASK_MODE_REDIRECT = """\
You are in "Chat" mode, which only ANSWERS questions. You CANNOT perform actions and you have NO tools available to perform them with — anything you say is just text, nothing you say changes the user's account.
If the user asks you to DO something that changes their account (send or transfer money, top up a card, freeze or unfreeze a card, request a refund) — even if they only hint at it, or reply to your own earlier question about it (e.g. naming which card) — do NOT ask follow-up questions to prepare the action and do NOT proceed with it in any way. NEVER simulate, describe, or claim an outcome (e.g. never say a card was frozen/unfrozen, money was sent, or a refund was filed) — you have no way to make that true or even know if it happened. In your very next reply, tell them, in their own language, to switch to "Actions" mode using the Chat / Actions toggle at the top of the assistant, and to make the request there. Do nothing else.
"""

_ACTION_MODE_REDIRECT = """
You are in "Actions" mode, which exists ONLY to perform actions on the user's account (send money, freeze/unfreeze a card, request a refund). It is NOT for answering questions.
If the user's request does not itself require performing one of those actions — any general or how-to question, OR any informational question about their own data (balance, transactions, spending summary, "what is my X") — do NOT answer it, do NOT call list_cards / search_transactions / get_spending_summary / find_recipient to gather the answer, and do NOT ask a follow-up question about it. The ONLY tool calls allowed here are ones that directly prepare an action the user has already asked to perform (e.g. looking up a card_id right before freezing it). In your very next reply, tell them, in their own language, to switch to "Chat" mode using the Chat / Actions toggle at the top of the assistant, where questions are answered. Do nothing else.
"""

_AGENT_SYSTEM_SUFFIX = """
You can take actions on the user's behalf using the available tools.

Rules:
- For irreversible actions (send_money, request_card_freeze, create_refund_request): once you have looked up the required IDs, CALL the tool. The system does NOT execute it right away — it returns a "confirmation_required" response. When you get that, relay it to the user: state the exact integer IDs and the USD amount and ask them to confirm. When the user confirms in their next message, CALL THE SAME TOOL AGAIN with identical arguments to actually perform it. Only tell the user an action happened when the tool returns a success result (e.g. ok=true or a request_id) — never on a "confirmation_required" response.
- Never guess IDs and never pass a placeholder. Use list_cards / search_transactions / find_recipient to look up card and transaction IDs first.
- Tool results from EARLIER messages are NOT remembered. In the current turn, before calling an action tool, look up every ID again (e.g. call find_recipient again before send_money). Do not rely on an ID you found in a previous message.
- When you ask the user to confirm an action, state the exact integer IDs in your confirmation message (e.g. "send $20 from card_id=18 to card_id=22"). That way the IDs are still visible when they reply "yes".
- Freezing/unfreezing a card and refunds are REQUESTS that an admin must approve. After calling those tools, tell the user the request was submitted and is pending approval — do NOT claim the card is already frozen/unfrozen or that the money was refunded.
- A "top up" between the user's own cards is just a send_money from one of their cards to another (sender and recipient must be different cards). The sender card must not be frozen.
- Account balances, card balances and transaction amounts are all in US dollars (USD); when the user gives a bare number for an action, treat it as USD. Indicative currency-conversion questions are answered in "Chat" mode, not here.
- Sending money to a person, step by step. "Send Talha $20" gives you everything you need — do not ask the user to rephrase it:
  1. Call find_recipient with just the name they used ("Talha" is enough). Read the next_step in the result and follow it.
  2. If it found exactly one payable person, immediately — in this SAME turn — call send_money with that person's card_id as recipient_card_id, the MAIN card from the ID REFERENCE above as sender_card_id (unless the user named a different card), and the amount they gave. Only ask the user which card to send from if they have no main card or the main card is frozen.
  3. That send_money call comes back as "confirmation_required" and moves no money. Relay it: name the person, the amount in USD and both integer card IDs, and ask them to confirm.
  4. When they confirm, call find_recipient again and then send_money again with identical arguments. That second call is the one that actually sends.
- Only ask a follow-up question when something is genuinely missing or ambiguous (several people match the name, no amount given). Otherwise act.
- After each action, explain briefly what you did.
"""

_FX_CURRENCY_GUIDANCE = """
Currency conversion:
- You have exactly ONE tool available here: convert_currency. It returns an INDICATIVE exchange-rate estimate and moves no money.
- When the user asks what an amount is worth in another currency (e.g. "convert €50 to dollars", "how much is 20 GBP in USD?"), CALL convert_currency with the amount and the ISO 4217 currency codes, then give them the result.
- Always make clear the figure is an indicative rate for information only and that no money was actually converted — converting real money only happens as part of a transaction, which you cannot perform here.
- Do NOT invent exchange rates from memory — always use the tool. If it returns an error (e.g. an unsupported currency), tell the user you can't convert that currency rather than guessing.
"""


class ChatService:
    def __init__(
        self,
        repo: ChatRepository,
        card_repo: CardRepository,
        transaction_repo: TransactionRepository,
        user_repo: UserRepository,
        api_key: str,
        vector_repo: VectorRepository | None = None,
        embedding_service: EmbeddingService | None = None,
        transaction_service: TransactionService | None = None,
        request_service: RequestService | None = None,
        gemini_api_key: str | None = None,
    ) -> None:
        self._repo = repo
        self._card_repo = card_repo
        self._transaction_repo = transaction_repo
        self._user_repo = user_repo
        self._client = Groq(api_key=api_key)
        self._vector_repo = vector_repo
        self._embedding_service = embedding_service

        self._gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

        self._agent_tools: AgentTools | None = None
        if transaction_service is not None and request_service is not None:
            self._agent_tools = AgentTools(
                card_repo=card_repo,
                transaction_repo=transaction_repo,
                user_repo=user_repo,
                transaction_service=transaction_service,
                request_service=request_service,
            )

    def _format_cards(self, cards: list) -> list[str]:
        if not cards:
            return ["   Cards: No cards found."]
        lines = ["   Cards:"]
        for card in cards:
            card_type = f"{card.card_type.vendor} {card.card_type.type_name}" if card.card_type else "Card"
            status = card.status.status_name if card.status else "unknown"
            lines.append(
                f"   - {card_type} (*{card.last_four}) | Balance: ${card.balance}"
                f" | Status: {status} | Expires: {card.expires_at}"
            )
        return lines

    def _format_transactions(
        self, transactions: list, limit_label: int, *, mask_amounts: bool = False
    ) -> list[str]:
        if not transactions:
            return [f"   Recent transactions (last {limit_label}): No transactions found."]
        lines = [f"   Recent transactions (last {limit_label}):"]
        for txn in transactions:
            txn_type = txn.transaction_type.name if txn.transaction_type else "transfer"
            status = txn.status.name if txn.status else "unknown"
            note = f" [{txn.note}]" if txn.note else ""
            created = txn.created_at.strftime("%Y-%m-%d")
            amount_part = "[amount hidden]" if mask_amounts else f"${txn.amount}"
            lines.append(f"   - {created}: {txn_type} {amount_part}{note} — {status}")
        return lines

    def _user_context_from_vector(self, user_id: int, message: str) -> str | None:
        if not self._vector_repo or not self._embedding_service:
            return None
        try:
            query_emb = self._embedding_service.embed_query(message)
            chunks = self._vector_repo.search(query_emb, user_id, limit=5)
            if chunks:
                return "\n".join(chunks)
        except Exception:
            logger.exception("Vector search failed for user_id=%s, falling back to live data", user_id)
        return None

    def _user_context_from_repo(self, user_id: int) -> str:
        user = self._user_repo.get_by_id(user_id)
        cards = self._card_repo.list_all(user_id=user_id)
        transactions = self._transaction_repo.list_for_user(user_id=user_id, limit=5)

        lines = []
        if user:
            lines.append(f"User: {user.first_name} {user.last_name}")
            lines.append("")

        lines.append("Cards:")
        if cards:
            for card in cards:
                card_type = f"{card.card_type.vendor} {card.card_type.type_name}" if card.card_type else "Card"
                status = card.status.status_name if card.status else "unknown"
                lines.append(
                    f"- {card_type} (*{card.last_four}) | Balance: ${card.balance}"
                    f" | Status: {status} | Expires: {card.expires_at}"
                )
        else:
            lines.append("- No cards found.")
        lines.append("")

        lines.append("Recent transactions (last 5):")
        if transactions:
            for txn in transactions:
                txn_type = txn.transaction_type.name if txn.transaction_type else "transfer"
                status = txn.status.name if txn.status else "unknown"
                note = f" [{txn.note}]" if txn.note else ""
                created = txn.created_at.strftime("%Y-%m-%d")
                lines.append(f"- {created}: {txn_type} ${txn.amount}{note} — {status}")
        else:
            lines.append("- No transactions found.")

        return "\n".join(lines)

    def _agent_id_reference(self, user_id: int) -> str:
        cards = self._card_repo.list_all(user_id=user_id)
        txns = self._transaction_repo.list_for_user(user_id=user_id, limit=10)

        lines = [
            "ID REFERENCE — use these exact integer IDs in tool calls. "
            "Never invent an ID or pass a placeholder string.",
            "Your cards:",
        ]
        if cards:
            for c in cards:
                status = c.status.status_name if c.status else "unknown"
                # The main card is flagged so the agent can pick a sender itself
                # instead of stalling on "which card should I send from?".
                main = " (MAIN — default sender card)" if c.is_main else ""
                lines.append(
                    f"- card_id={c.card_id}: *{c.last_four}, balance ${c.balance}, status {status}{main}"
                )
        else:
            lines.append("- (none)")
        lines.append("Your recent transactions:")
        if txns:
            for t in txns:
                ttype = t.transaction_type.name if t.transaction_type else "transfer"
                created = t.created_at.strftime("%Y-%m-%d")
                lines.append(
                    f"- transaction_id={t.transaction_id}: {created} {ttype} ${t.amount}"
                )
        else:
            lines.append("- (none)")
        return "\n".join(lines)

    def _build_system_message(
        self, user_id: int, message: str, is_admin: bool, agent_mode: bool = False
    ) -> str:
        today = date.today().isoformat()

        if is_admin:
            lines = [
                'You are an admin assistant for "heap", a digital wallet app.',
                "Always respond in the same language the admin writes in. Always use Latin script (never Cyrillic).",
                "Be concise and precise. Today's date is " + today + ".",
                _NO_IBAN_RULE,
                "",
            ]
        else:
            lines = [
                'You are a helpful assistant for "heap", a digital wallet app.',
                "Help the user with anything they ask — prioritise questions about their finances, cards, and transactions, but you may answer general questions too.",
                "Always respond in the same language the user writes in. Always use Latin script (never Cyrillic).",
                "Be concise and friendly. Today's date is " + today + ".",
                _NO_IBAN_RULE,
                "",
            ]

        if agent_mode:
            # Shared for admins and regular users: an admin's own cards/transactions
            # and their ability to act on their own account work the same way.
            lines.append(self._agent_id_reference(user_id))
            lines.append(_AGENT_SYSTEM_SUFFIX)
            lines.append(_ACTION_MODE_REDIRECT)
        elif is_admin:
            lines.append(_ASK_MODE_REDIRECT)
            lines.append("You have access to user, card, and transaction metadata across the platform.")
            lines.append(
                "Transaction monetary amounts are hidden from admins for privacy — you can see ids, users, status, dates, and types, but not USD amounts."
            )
            lines.append("Help the admin with anything they ask about users and the platform within those limits.")
            lines.append("")
            all_users = self._user_repo.list_users(
                email=None, status_id=None, user_role_id=None,
                include_deleted=False, limit=200, offset=0,
            )
            lines.append(f"All users ({len(all_users)} total):")
            lines.append("")
            for i, u in enumerate(all_users, 1):
                lines.append(f"{i}. {u.first_name} {u.last_name} ({u.email}) | ID: {u.user_id}")
                cards = self._card_repo.list_all(user_id=u.user_id)
                lines.extend(self._format_cards(cards))
                txns = self._transaction_repo.list_for_user(user_id=u.user_id, limit=3)
                lines.extend(self._format_transactions(txns, 3, mask_amounts=True))
                lines.append("")
        else:
            lines.append(_ASK_MODE_REDIRECT)
            context = self._user_context_from_vector(user_id, message) or self._user_context_from_repo(user_id)
            lines.append(context)

        if not agent_mode:
            lines.append(_FX_CURRENCY_GUIDANCE)

        return "\n".join(lines)

    def send_message(
        self,
        user_id: int,
        message: str,
        is_admin: bool = False,
        agent_mode: bool = False,
    ) -> tuple[str, list[ChatMessage]]:
        use_agent = agent_mode and self._agent_tools is not None
        use_gemini_agent = use_agent and self._gemini_client is not None

        if use_agent:
            self._agent_tools.begin_turn(user_id)

        history = self._repo.get_history(
            user_id, agent_mode=agent_mode, limit=8 if use_agent else 20
        )

        system_content = self._build_system_message(user_id, message, is_admin, agent_mode=agent_mode)

        def _groq_messages() -> list[dict]:
            msgs = [{"role": "system", "content": system_content}]
            msgs += [
                {"role": _ROLE_MAP.get(msg.role, msg.role), "content": msg.content}
                for msg in history
            ]
            msgs.append({"role": "user", "content": message})
            return msgs

        try:
            if use_gemini_agent:
                try:
                    reply = self._run_agent_loop_gemini(system_content, history, message, user_id)
                except gemini_errors.APIError as exc:
                    logger.warning(
                        "Gemini agent unavailable (code=%s) for user_id=%s; falling back to Groq agent",
                        getattr(exc, "code", None), user_id,
                    )
                    reply = self._run_agent_loop(_groq_messages(), user_id)
            elif use_agent:
                reply = self._run_agent_loop(_groq_messages(), user_id)
            elif self._agent_tools is not None:
                # "Chat" mode: offer only the read-only informational tools
                # (currency conversion) — no account-changing actions.
                reply = self._run_agent_loop(
                    _groq_messages(), user_id, tools=INFO_TOOLS
                )
            else:
                response = self._client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=_groq_messages(),
                )
                reply = response.choices[0].message.content
        except Exception:
            logger.exception("AI call failed for user_id=%s", user_id)
            raise

        self._repo.save_message(user_id, "user", message, agent_mode=agent_mode)
        self._repo.save_message(user_id, "assistant", reply, agent_mode=agent_mode)

        updated_history = self._repo.get_history(user_id, agent_mode=agent_mode)
        return reply, updated_history

    def _run_agent_loop(
        self, messages: list[dict], user_id: int, tools: list | None = None
    ) -> str:
        tools = tools if tools is not None else TOOL_DEFS
        reply = ""
        for _ in range(_MAX_AGENT_STEPS):
            try:
                response = self._client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                )
            except BadRequestError as exc:
                body = getattr(exc, "body", None)
                code = body.get("error", {}).get("code") if isinstance(body, dict) else None
                if code == "tool_use_failed":
                    messages.append({
                        "role": "user",
                        "content": (
                            "Your last tool call was not in the correct function-calling "
                            "format, so it was ignored. Do NOT write the call as text "
                            "(no <function=...> tags). Either reply to the user in plain "
                            "text, or emit a single properly-formatted tool call. When "
                            "you need an ID, call find_recipient / list_cards / "
                            "search_transactions first and use the exact integer it returns."
                        ),
                    })
                    continue
                raise

            msg = response.choices[0].message
            reply = msg.content or ""

            if not msg.tool_calls:
                break

            messages.append({
                "role": "assistant",
                "content": msg.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ],
            })
            for tc in msg.tool_calls:
                result = self._agent_tools.execute(
                    tc.function.name, tc.function.arguments, user_id=user_id
                )
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

        return reply or _AGENT_FALLBACK_REPLY

    def _gemini_generate_with_retry(self, *, contents, config):
        last_exc = None
        for attempt in range(_GEMINI_RETRY_ATTEMPTS):
            try:
                return self._gemini_client.models.generate_content(
                    model=_GEMINI_MODEL, contents=contents, config=config
                )
            except gemini_errors.APIError as exc:
                if getattr(exc, "code", None) in _GEMINI_RETRY_CODES and attempt < _GEMINI_RETRY_ATTEMPTS - 1:
                    last_exc = exc
                    time.sleep(1.0 * (attempt + 1))
                    continue
                raise
        raise last_exc

    def _run_agent_loop_gemini(
        self, system_content: str, history: list[ChatMessage], message: str, user_id: int
    ) -> str:
        from google.genai import types

        contents = [
            types.Content(
                role="model" if msg.role in ("assistant", "model") else "user",
                parts=[types.Part.from_text(text=msg.content)],
            )
            for msg in history
        ]
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

        config = types.GenerateContentConfig(
            system_instruction=system_content,
            tools=gemini_tool_declarations(),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        reply = ""
        for _ in range(_MAX_AGENT_STEPS):
            response = self._gemini_generate_with_retry(contents=contents, config=config)
            candidate = response.candidates[0]
            parts = (candidate.content.parts or []) if candidate.content else []
            function_calls = [p.function_call for p in parts if p.function_call]
            text = "".join(p.text for p in parts if p.text)
            if text:
                reply = text

            if function_calls:
                contents.append(candidate.content)
                response_parts = []
                for fc in function_calls:
                    result = self._agent_tools.execute(
                        fc.name, json.dumps(dict(fc.args or {})), user_id=user_id
                    )
                    response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"result": json.loads(result)},
                        )
                    )
                contents.append(types.Content(role="user", parts=response_parts))
                continue

            if not reply:
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(
                            text="Reply to the user now in plain text, summarising the result of the tools you called."
                        )],
                    )
                )
                continue

            break

        return reply or _AGENT_FALLBACK_REPLY

    def get_history(self, user_id: int, agent_mode: bool = False) -> list[ChatMessage]:
        return self._repo.get_history(user_id, agent_mode=agent_mode)

    def clear_history(self, user_id: int, agent_mode: bool = False) -> None:
        self._repo.clear_history(user_id, agent_mode=agent_mode)

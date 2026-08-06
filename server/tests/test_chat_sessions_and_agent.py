"""Chat session windowing and agent transfer reliability.

Two behaviours are pinned here:

* history is scoped to the current session, so a conversation from days ago never
  reappears -- neither on screen nor in the model's context;
* a plain "send Talha $20" resolves the recipient by name and completes the
  transfer after confirmation, without the user having to phrase it precisely.

The agent tests drive the real service loop against a scripted LLM client, since
the thing worth testing is the wiring between the tool results, the confirmation
gate and the transaction service -- not the model.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
import json
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from repositories.chat.chat import SESSION_IDLE_MINUTES, _current_session  # noqa: E402
from services.chat.agent_tools import INFO_TOOLS, AgentTools  # noqa: E402
from services.chat.chat import ChatService  # noqa: E402

_NOW = datetime(2026, 8, 3, 12, 0, tzinfo=timezone.utc)


# --------------------------------------------------------------------------- #
# Session windowing
# --------------------------------------------------------------------------- #
def _msg(minutes_ago: float, role: str = "user", content: str = "x"):
    return SimpleNamespace(
        role=role, content=content, created_at=_NOW - timedelta(minutes=minutes_ago)
    )


def test_a_continuous_conversation_is_returned_whole() -> None:
    rows = [_msg(40), _msg(35), _msg(10), _msg(2)]
    assert _current_session(rows) == rows


def test_messages_before_a_long_pause_are_dropped() -> None:
    yesterday = [_msg(60 * 24), _msg(60 * 24 - 1)]
    today = [_msg(5), _msg(4)]

    kept = _current_session(yesterday + today)

    assert kept == today


def test_only_the_most_recent_session_survives_several_gaps() -> None:
    rows = [_msg(300), _msg(299), _msg(120), _msg(119), _msg(3), _msg(2)]

    kept = _current_session(rows)

    assert kept == rows[-2:]


def test_a_pause_just_under_the_threshold_keeps_the_conversation() -> None:
    # 29 minutes apart with a 30-minute threshold: still one conversation.
    rows = [_msg(SESSION_IDLE_MINUTES), _msg(1)]

    assert _current_session(rows) == rows


def test_a_pause_past_the_threshold_starts_a_new_conversation() -> None:
    rows = [_msg(SESSION_IDLE_MINUTES + 2), _msg(1)]

    assert _current_session(rows) == rows[-1:]


def test_empty_history_stays_empty() -> None:
    assert _current_session([]) == []


# --------------------------------------------------------------------------- #
# Fakes
# --------------------------------------------------------------------------- #
class _FakeCard:
    def __init__(self, card_id: int, *, is_main: bool = False) -> None:
        self.card_id = card_id
        self.last_four = f"{card_id:04d}"
        self.balance = Decimal("500.00")
        self.is_main = is_main
        self.card_type = SimpleNamespace(vendor="visa", type_name="debit")
        self.status = SimpleNamespace(status_name="active")
        self.expires_at = "2030-01-01"


class _FakeUser:
    def __init__(self, user_id: int, first: str, last: str) -> None:
        self.user_id = user_id
        self.first_name = first
        self.last_name = last
        self.email = f"{first}.{last}@heappay.ba".lower()


class FakeUserRepo:
    """Substring match over first/last/full name, mirroring the real query."""

    def __init__(self, people=None) -> None:
        self.people = people if people is not None else [
            (_FakeUser(2, "Talha", "Zlatar"), _FakeCard(22)),
        ]

    def get_by_id(self, user_id: int):
        return _FakeUser(user_id, "Izel", "Repuh")

    def search(self, q: str, exclude_user_id: int, limit: int):
        needle = q.strip().lower()
        rows = []
        for user, card in self.people:
            haystacks = [
                user.first_name.lower(),
                user.last_name.lower(),
                f"{user.first_name} {user.last_name}".lower(),
                user.email,
            ]
            if any(needle in h for h in haystacks):
                rows.append((user, card, "visa"))
        return rows[:limit]


class FakeCardRepo:
    def list_all(self, user_id: int):
        return [_FakeCard(18, is_main=True), _FakeCard(19)]


class FakeTransactionRepo:
    def list_for_user(self, user_id: int, limit: int = 5):
        return []

    def get_type_id_by_name(self, name: str):
        return 1


class FakeTransactionService:
    def __init__(self) -> None:
        self.created = []

    def create(self, payload, *, user_id: int):
        self.created.append(payload)
        tx = SimpleNamespace(
            transaction_id=99,
            amount=payload.amount,
            status=SimpleNamespace(name="pending"),
        )
        return tx, True


class FakeChatRepo:
    def __init__(self) -> None:
        self.saved = []

    def get_history(self, user_id: int, agent_mode: bool = False, limit: int = 20):
        return []

    def save_message(self, user_id: int, role: str, content: str, agent_mode: bool = False):
        self.saved.append((role, content, agent_mode))
        return SimpleNamespace(role=role, content=content, agent_mode=agent_mode)

    def clear_history(self, user_id: int, agent_mode: bool = False) -> None:
        self.saved = [s for s in self.saved if s[2] != agent_mode]


class ScriptedLLM:
    """Stands in for the Groq client: replays a scripted list of turns.

    Each scripted turn is either a plain string (a final reply) or a list of
    (tool_name, arguments dict) pairs.
    """

    def __init__(self, script: list) -> None:
        self._script = list(script)
        self.tools_seen = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, *, model, messages, tools=None, tool_choice=None, **kwargs):
        self.tools_seen.append(tools)
        step = self._script.pop(0) if self._script else "Done."
        if isinstance(step, str):
            message = SimpleNamespace(content=step, tool_calls=None)
        else:
            message = SimpleNamespace(
                content=None,
                tool_calls=[
                    SimpleNamespace(
                        id=f"call_{i}",
                        function=SimpleNamespace(name=name, arguments=json.dumps(args)),
                    )
                    for i, (name, args) in enumerate(step)
                ],
            )
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _tools(user_repo=None, transaction_service=None) -> AgentTools:
    return AgentTools(
        card_repo=FakeCardRepo(),
        transaction_repo=FakeTransactionRepo(),
        user_repo=user_repo or FakeUserRepo(),
        transaction_service=transaction_service or FakeTransactionService(),
        request_service=SimpleNamespace(),
    )


def _service(script: list, *, user_repo=None, transaction_service=None):
    chat_repo = FakeChatRepo()
    tx_service = transaction_service or FakeTransactionService()
    service = ChatService(
        chat_repo,
        FakeCardRepo(),
        FakeTransactionRepo(),
        user_repo or FakeUserRepo(),
        "test-key",
        transaction_service=tx_service,
        request_service=SimpleNamespace(),
    )
    llm = ScriptedLLM(script)
    service._client = llm
    return service, llm, tx_service


# --------------------------------------------------------------------------- #
# find_recipient
# --------------------------------------------------------------------------- #
def _find(query: str, *, user_repo=None) -> dict:
    result = _tools(user_repo=user_repo).execute(
        "find_recipient", json.dumps({"query": query}), user_id=1
    )
    return json.loads(result)


def test_a_first_name_alone_resolves_the_recipient() -> None:
    payload = _find("Talha")

    assert payload["count"] == 1
    assert payload["matches"][0]["card_id"] == 22
    # The model is told to go straight to send_money rather than ask again.
    assert "send_money" in payload["next_step"]


def test_the_match_is_case_insensitive_and_partial() -> None:
    assert _find("talh")["count"] == 1


def test_a_full_name_resolves_the_recipient() -> None:
    assert _find("Talha Zlatar")["count"] == 1


def test_several_matches_ask_the_user_to_choose() -> None:
    repo = FakeUserRepo([
        (_FakeUser(2, "Talha", "Zlatar"), _FakeCard(22)),
        (_FakeUser(3, "Talha", "Hodzic"), _FakeCard(33)),
    ])

    payload = _find("Talha", user_repo=repo)

    assert payload["count"] == 2
    assert "which one" in payload["next_step"]
    assert {m["card_id"] for m in payload["matches"]} == {22, 33}


def test_no_match_asks_for_an_email_instead_of_failing_silently() -> None:
    payload = _find("Nobody")

    assert payload["count"] == 0
    assert "email" in payload["next_step"]


def test_a_recipient_without_an_active_card_is_reported_as_unpayable() -> None:
    repo = FakeUserRepo([(_FakeUser(2, "Talha", "Zlatar"), None)])

    payload = _find("Talha", user_repo=repo)

    assert payload["matches"][0]["payable"] is False
    assert "no active card" in payload["next_step"]


def test_list_cards_marks_the_main_card() -> None:
    cards = json.loads(_tools().execute("list_cards", "{}", user_id=1))

    assert [c["card_id"] for c in cards if c["is_main"]] == [18]


# --------------------------------------------------------------------------- #
# A full "send Talha $20" agent turn
# --------------------------------------------------------------------------- #
_SEND_TURN = [
    [("find_recipient", {"query": "Talha"})],
    [("send_money", {"sender_card_id": 18, "recipient_card_id": 22, "amount": 20})],
    "Send $20 from card_id=18 to card_id=22 (Talha Zlatar)? Reply to confirm.",
]


def test_a_send_turn_asks_for_confirmation_and_moves_no_money() -> None:
    service, _llm, tx_service = _service(_SEND_TURN)

    reply, _history = service.send_message(4001, "send Talha $20", agent_mode=True)

    assert tx_service.created == []
    assert "confirm" in reply.lower()


def test_confirming_completes_the_transfer() -> None:
    user_id = 4002
    tx_service = FakeTransactionService()

    service, _llm, _ = _service(_SEND_TURN, transaction_service=tx_service)
    service.send_message(user_id, "send Talha $20", agent_mode=True)
    assert tx_service.created == []

    confirm_turn = [
        [("find_recipient", {"query": "Talha"})],
        [("send_money", {"sender_card_id": 18, "recipient_card_id": 22, "amount": 20})],
        "Sent $20 to Talha Zlatar.",
    ]
    service2, _llm2, _ = _service(confirm_turn, transaction_service=tx_service)
    reply = service2.send_message(user_id, "yes", agent_mode=True)[0]

    assert len(tx_service.created) == 1
    assert tx_service.created[0].amount == Decimal("20")
    assert tx_service.created[0].recipient_card_id == 22
    assert "sent" in reply.lower()


def test_chat_mode_gets_only_the_read_only_tools() -> None:
    service, llm, tx_service = _service(["Your balance is $500."])

    service.send_message(4003, "what is my balance?", agent_mode=False)

    assert llm.tools_seen == [INFO_TOOLS]
    assert tx_service.created == []

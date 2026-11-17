from datetime import datetime, timezone
import uuid
from fastapi import HTTPException
import pytest

from app.api.v1.endpoints.sessions import delete_session, get_session, list_sessions
from app.core.security import UserContext
from app.services import session_service


class _Mappings:
    def __init__(self, rows):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


class _Result:
    def __init__(self, rows=None):
        self._rows = rows or []

    def mappings(self):
        return _Mappings(self._rows)


class InMemorySessionDb:
    def __init__(self) -> None:
        self.sessions: dict[str, dict] = {}
        self.messages: list[dict] = []
        self._next_msg_id = 1

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        params = params or {}

        if "SELECT id, user_id, session_token" in sql and "WHERE id =" in sql:
            row = self.sessions.get(params["id"])
            return _Result([row] if row else [])

        if "INSERT INTO chat_sessions" in sql:
            self.sessions[params["id"]] = {
                "id": uuid.UUID(params["id"]),
                "user_id": params["user_id"],
                "keycloak_id": params["keycloak_id"],
                "session_token": params["session_token"],
                "title": params["title"],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
            return _Result()

        if "INSERT INTO chat_messages" in sql:
            self.messages.append(
                {
                    "id": self._next_msg_id,
                    "session_id": params["session_id"],
                    "role": params["role"],
                    "content": params["content"],
                    "cached": params["cached"],
                    "created_at": datetime.now(timezone.utc),
                }
            )
            self._next_msg_id += 1
            return _Result()

        if "UPDATE chat_sessions SET updated_at" in sql:
            if params["session_id"] in self.sessions:
                self.sessions[params["session_id"]]["updated_at"] = datetime.now(timezone.utc)
            return _Result()

        if "FROM chat_sessions" in sql and "WHERE user_id =" in sql:
            rows = [s for s in self.sessions.values() if s["user_id"] == params["user_id"]]
            return _Result(rows)

        if "FROM chat_sessions" in sql and "WHERE user_id IS NULL" in sql:
            rows = [
                s
                for s in self.sessions.values()
                if s["user_id"] is None and s["session_token"] == params["session_token"]
            ]
            return _Result(rows)

        if "FROM chat_messages" in sql and "ORDER BY created_at DESC" in sql:
            rows = [m for m in self.messages if m["session_id"] == params["session_id"]]
            rows = list(reversed(rows))[: params["limit"]]
            return _Result(rows)

        if "FROM chat_messages" in sql and "ORDER BY created_at ASC" in sql:
            rows = [m for m in self.messages if m["session_id"] == params["id"]]
            return _Result(rows)

        if "DELETE FROM chat_sessions" in sql:
            sid = params["id"]
            self.sessions.pop(sid, None)
            self.messages = [m for m in self.messages if m["session_id"] != sid]
            return _Result()

        return _Result()

    async def commit(self) -> None:
        return None


@pytest.mark.asyncio
async def test_sessions_crud_history_and_ownership():
    db = InMemorySessionDb()
    owner = UserContext(user_id=101, session_token="owner-tok")
    other = UserContext(user_id=202, session_token="other-tok")
    guest = UserContext(user_id=None, session_token="guest-tok")

    sid = await session_service.ensure_session(db, owner, title_hint="Refund question")
    await session_service.append_exchange(db, sid, "Refund policy?", "60 minutes prior.", cached=False)
    await session_service.append_exchange(db, sid, "VIP seats?", "Non-refundable.", cached=True)

    guest_sid = await session_service.ensure_session(db, guest, title_hint="Guest chat")
    await session_service.append_exchange(db, guest_sid, "Hi", "Hello!", cached=False)

    owner_sessions = await list_sessions(user=owner, db=db)
    assert len(owner_sessions) == 1
    assert owner_sessions[0]["id"] == sid

    guest_sessions = await list_sessions(user=guest, db=db)
    assert len(guest_sessions) == 1
    assert guest_sessions[0]["id"] == guest_sid

    detail = await get_session(sid, user=owner, db=db)
    assert len(detail["messages"]) == 4
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]

    history = await session_service.get_recent_history(db, sid, max_turns=1)
    assert len(history) == 2
    assert history[0]["content"] == "VIP seats?"

    with pytest.raises(HTTPException) as forbidden_get:
        await get_session(sid, user=other, db=db)
    assert forbidden_get.value.status_code == 403

    with pytest.raises(HTTPException) as forbidden_del:
        await delete_session(sid, user=other, db=db)
    assert forbidden_del.value.status_code == 403

    await delete_session(sid, user=owner, db=db)
    assert await list_sessions(user=owner, db=db) == []

    with pytest.raises(HTTPException) as missing:
        await get_session(sid, user=owner, db=db)
    assert missing.value.status_code == 404

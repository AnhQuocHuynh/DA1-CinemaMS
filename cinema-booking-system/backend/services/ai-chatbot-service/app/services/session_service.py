from datetime import datetime, timezone
import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import UserContext

logger = logging.getLogger("cinebot.sessions")


def _safe_uuid_str(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError):
        return None


def _owns_session(row: Any, user: UserContext) -> bool:
    row_user_id = row.get("user_id")
    if row_user_id is not None:
        return user.user_id is not None and int(row_user_id) == int(user.user_id)
    row_keycloak_id = row.get("keycloak_id")
    if row_keycloak_id is not None:
        return bool(user.keycloak_id and str(row_keycloak_id) == str(user.keycloak_id))
    row_token = row.get("session_token")
    if row_token:
        return bool(user.session_token and row_token == user.session_token)
    return False


def normalize_title(title: str | None, allow_blank: bool = False) -> str:
    """Validate and normalize a conversation session title."""
    if title is None or not title.strip():
        if allow_blank:
            return "New Conversation"
        raise HTTPException(status_code=400, detail="Session title cannot be blank")
    trimmed = title.strip()
    if len(trimmed) > 255:
        raise HTTPException(status_code=400, detail="Session title exceeds 255 characters")
    return trimmed


async def ensure_session(
    db: AsyncSession | None,
    user: UserContext,
    session_id: UUID | None = None,
    title_hint: str | None = None,
) -> UUID:
    """Resolve an existing owned session or create a new chat_sessions row."""
    resolved_id = session_id or uuid4()
    if db is None:
        return resolved_id

    if session_id is not None:
        lookup_stmt = sql_text(
            "SELECT id, user_id, session_token, keycloak_id FROM chat_sessions WHERE id = CAST(:id AS uuid)"
        )
        result = await db.execute(lookup_stmt, {"id": str(session_id)})
        existing = result.mappings().first()
        if existing is not None:
            if not _owns_session(existing, user):
                raise HTTPException(status_code=403, detail="Forbidden")
            return resolved_id

    title = (title_hint or "New Conversation").strip()[:120] or "New Conversation"
    insert_stmt = sql_text(
        """
        INSERT INTO chat_sessions (id, user_id, keycloak_id, session_token, title)
        VALUES (
            CAST(:id AS uuid),
            :user_id,
            CAST(:keycloak_id AS uuid),
            :session_token,
            :title
        )
        """
    )
    try:
        await db.execute(
            insert_stmt,
            {
                "id": str(resolved_id),
                "user_id": user.user_id,
                "keycloak_id": _safe_uuid_str(user.keycloak_id),
                "session_token": user.session_token,
                "title": title,
            },
        )
        await db.commit()
    except Exception:
        logger.warning("Failed to persist chat session %s", resolved_id, exc_info=True)
    return resolved_id


async def create_user_session(
    db: AsyncSession | None,
    user: UserContext,
    title: str | None = None,
) -> dict:
    """Explicitly create a new chat session owned by the caller."""
    resolved_id = uuid4()
    normalized = normalize_title(title, allow_blank=True)
    now = datetime.now(timezone.utc)
    if db is not None:
        insert_stmt = sql_text(
            """
            INSERT INTO chat_sessions (id, user_id, keycloak_id, session_token, title)
            VALUES (
                CAST(:id AS uuid),
                :user_id,
                CAST(:keycloak_id AS uuid),
                :session_token,
                :title
            )
            """
        )
        await db.execute(
            insert_stmt,
            {
                "id": str(resolved_id),
                "user_id": user.user_id,
                "keycloak_id": _safe_uuid_str(user.keycloak_id),
                "session_token": user.session_token,
                "title": normalized,
            },
        )
        await db.commit()
    return {
        "id": resolved_id,
        "title": normalized,
        "createdAt": now,
        "updatedAt": now,
    }


async def get_recent_history(
    db: AsyncSession | None,
    session_id: UUID,
    max_turns: int | None = None,
) -> list[dict]:
    """Fetch the most recent N turns (2*N messages) in chronological order."""
    if db is None:
        return []
    turns = settings.HISTORY_WINDOW_TURNS if max_turns is None else max_turns
    limit = max(1, turns) * 2
    stmt = sql_text(
        """
        SELECT role, content
        FROM chat_messages
        WHERE session_id = CAST(:session_id AS uuid)
        ORDER BY created_at DESC, id DESC
        LIMIT :limit
        """
    )
    try:
        result = await db.execute(stmt, {"session_id": str(session_id), "limit": limit})
        rows = [dict(r) for r in result.mappings().all()]
        rows.reverse()
        return rows
    except Exception:
        logger.warning("Failed to load conversation history for %s", session_id, exc_info=True)
        return []


async def append_exchange(
    db: AsyncSession | None,
    session_id: UUID,
    user_message: str,
    assistant_reply: str,
    cached: bool = False,
) -> None:
    """Persist a user/assistant exchange to chat_messages and refresh updated_at."""
    if db is None:
        return
    insert_msg = sql_text(
        """
        INSERT INTO chat_messages (session_id, role, content, cached)
        VALUES (CAST(:session_id AS uuid), :role, :content, :cached)
        """
    )
    touch_session = sql_text(
        "UPDATE chat_sessions SET updated_at = NOW() WHERE id = CAST(:session_id AS uuid)"
    )
    try:
        await db.execute(
            insert_msg,
            {
                "session_id": str(session_id),
                "role": "user",
                "content": user_message,
                "cached": False,
            },
        )
        await db.execute(
            insert_msg,
            {
                "session_id": str(session_id),
                "role": "assistant",
                "content": assistant_reply,
                "cached": cached,
            },
        )
        await db.execute(touch_session, {"session_id": str(session_id)})
        await db.commit()
    except Exception:
        logger.warning("Failed to append exchange for session %s", session_id, exc_info=True)


async def list_user_sessions(db: AsyncSession | None, user: UserContext) -> list[dict]:
    """List sessions owned by the caller ordered by most recently updated."""
    if db is None:
        return []
    if user.user_id is not None:
        stmt = sql_text(
            """
            SELECT id, title, created_at, updated_at
            FROM chat_sessions
            WHERE user_id = :user_id
            ORDER BY updated_at DESC
            LIMIT 50
            """
        )
        params: dict[str, Any] = {"user_id": user.user_id}
    elif _safe_uuid_str(user.keycloak_id):
        stmt = sql_text(
            """
            SELECT id, title, created_at, updated_at
            FROM chat_sessions
            WHERE user_id IS NULL AND keycloak_id = CAST(:keycloak_id AS uuid)
            ORDER BY updated_at DESC
            LIMIT 50
            """
        )
        params = {"keycloak_id": _safe_uuid_str(user.keycloak_id)}
    elif user.session_token:
        stmt = sql_text(
            """
            SELECT id, title, created_at, updated_at
            FROM chat_sessions
            WHERE user_id IS NULL AND session_token = :session_token
            ORDER BY updated_at DESC
            LIMIT 50
            """
        )
        params = {"session_token": user.session_token}
    else:
        return []

    result = await db.execute(stmt, params)
    return [
        {
            "id": row["id"],
            "title": row.get("title"),
            "createdAt": row.get("created_at"),
            "updatedAt": row.get("updated_at"),
        }
        for row in result.mappings().all()
    ]


async def get_session_detail(
    db: AsyncSession | None,
    session_id: UUID,
    user: UserContext,
) -> dict | None:
    """Retrieve an owned session and its chronological message history."""
    if db is None:
        return None
    sess_stmt = sql_text(
        """
        SELECT id, user_id, session_token, keycloak_id, title, created_at, updated_at
        FROM chat_sessions
        WHERE id = CAST(:id AS uuid)
        """
    )
    sess_res = await db.execute(sess_stmt, {"id": str(session_id)})
    sess = sess_res.mappings().first()
    if sess is None:
        return None
    if not _owns_session(sess, user):
        raise HTTPException(status_code=403, detail="Forbidden")

    msg_stmt = sql_text(
        """
        SELECT id, role, content, cached, created_at
        FROM chat_messages
        WHERE session_id = CAST(:id AS uuid)
        ORDER BY created_at ASC, id ASC
        """
    )
    msg_res = await db.execute(msg_stmt, {"id": str(session_id)})
    messages = [
        {
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "cached": bool(row.get("cached", False)),
            "createdAt": row.get("created_at"),
        }
        for row in msg_res.mappings().all()
    ]
    return {
        "id": sess["id"],
        "title": sess.get("title"),
        "createdAt": sess.get("created_at"),
        "updatedAt": sess.get("updated_at"),
        "messages": messages,
    }


async def rename_user_session(
    db: AsyncSession | None,
    session_id: UUID,
    user: UserContext,
    title: str,
) -> dict | None:
    """Rename an owned session; returns None if missing, raises 400 on invalid title or 403 if unowned."""
    normalized = normalize_title(title, allow_blank=False)
    if db is None:
        return None
    sess_stmt = sql_text(
        """
        SELECT id, user_id, session_token, keycloak_id, title, created_at, updated_at
        FROM chat_sessions
        WHERE id = CAST(:id AS uuid)
        """
    )
    sess_res = await db.execute(sess_stmt, {"id": str(session_id)})
    sess = sess_res.mappings().first()
    if sess is None:
        return None
    if not _owns_session(sess, user):
        raise HTTPException(status_code=403, detail="Forbidden")

    upd_stmt = sql_text(
        "UPDATE chat_sessions SET title = :title, updated_at = NOW() WHERE id = CAST(:id AS uuid)"
    )
    await db.execute(upd_stmt, {"id": str(session_id), "title": normalized})
    await db.commit()
    return {
        "id": sess["id"],
        "title": normalized,
        "createdAt": sess.get("created_at"),
        "updatedAt": datetime.now(timezone.utc),
    }


async def delete_user_session(
    db: AsyncSession | None,
    session_id: UUID,
    user: UserContext,
) -> bool:
    """Delete an owned session; returns False if not found, raises 403 if unowned."""
    if db is None:
        return False
    sess_stmt = sql_text(
        "SELECT id, user_id, session_token, keycloak_id FROM chat_sessions WHERE id = CAST(:id AS uuid)"
    )
    sess_res = await db.execute(sess_stmt, {"id": str(session_id)})
    sess = sess_res.mappings().first()
    if sess is None:
        return False
    if not _owns_session(sess, user):
        raise HTTPException(status_code=403, detail="Forbidden")

    del_stmt = sql_text("DELETE FROM chat_sessions WHERE id = CAST(:id AS uuid)")
    await db.execute(del_stmt, {"id": str(session_id)})
    await db.commit()
    return True

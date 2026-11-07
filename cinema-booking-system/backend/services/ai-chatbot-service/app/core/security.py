import uuid
from dataclasses import dataclass, field

from fastapi import Header


@dataclass
class UserContext:
    user_id: int | None = None
    keycloak_id: str | None = None
    roles: list[str] = field(default_factory=list)
    session_token: str | None = None

    @property
    def is_authenticated(self) -> bool:
        return self.user_id is not None


async def get_user_context(
    x_user_id: str | None = Header(default=None),
    x_keycloak_id: str | None = Header(default=None),
    x_user_roles: str | None = Header(default=None),
    x_session_token: str | None = Header(default=None),
) -> UserContext:
    """Build the caller context from headers injected by the API gateway."""
    user_id = int(x_user_id) if x_user_id and x_user_id.isdigit() else None
    roles = [r.strip() for r in x_user_roles.split(",")] if x_user_roles else []
    token = x_session_token or (None if user_id else uuid.uuid4().hex)
    return UserContext(user_id, x_keycloak_id, roles, token)


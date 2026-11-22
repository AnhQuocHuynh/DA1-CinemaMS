import hmac

from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.services import catalog_indexer

router = APIRouter()


@router.post("/reindex")
async def reindex(x_internal_token: str | None = Header(default=None)) -> dict[str, int]:
    """Trigger a full catalog embedding reindex for internal callers."""
    if (
        not isinstance(x_internal_token, str)
        or not x_internal_token
        or not settings.INTERNAL_API_TOKEN
        or not hmac.compare_digest(x_internal_token, settings.INTERNAL_API_TOKEN)
    ):
        raise HTTPException(status_code=403, detail="Forbidden")
    return await catalog_indexer.reindex_catalog()

from datetime import date

import pytest
from fastapi import HTTPException

from app import main
from app.api.v1.endpoints import internal
from app.core.config import settings
from app.services import catalog_indexer, downstream_client, llm_client


class FakeResponse:
    def __init__(self, payload, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


class FakeHttpClient:
    def __init__(self, response: FakeResponse | None = None, exc: Exception | None = None) -> None:
        self._response = response
        self._exc = exc
        self.urls: list[str] = []

    async def get(self, url: str, params=None, headers=None):
        self.urls.append(url)
        if self._exc is not None:
            raise self._exc
        assert self._response is not None
        return self._response


class _FakeScalars:
    def __init__(self, values: list[int]) -> None:
        self._values = values

    def all(self) -> list[int]:
        return list(self._values)


class _FakeResult:
    def __init__(self, values: list[int]) -> None:
        self._values = values

    def scalars(self) -> _FakeScalars:
        return _FakeScalars(self._values)


class FakeIndexerSession:
    def __init__(self, existing_ids: list[int] | None = None) -> None:
        self.existing_ids = list(existing_ids or [])
        self.executed: list[tuple[str, dict]] = []
        self.commits = 0

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        self.executed.append((sql, params or {}))
        if "SELECT movie_id FROM movie_embeddings" in sql:
            return _FakeResult(self.existing_ids)
        return None

    async def commit(self) -> None:
        self.commits += 1


@pytest.mark.asyncio
async def test_downstream_list_all_movies_unwraps_limits_and_handles_errors(monkeypatch):
    payload = {
        "success": True,
        "data": [
            {"id": 1, "title": "Movie 1"},
            {"id": 2, "title": "Movie 2"},
            {"id": 3, "title": "Movie 3"},
        ],
    }
    client = FakeHttpClient(response=FakeResponse(payload))
    monkeypatch.setattr(downstream_client, "_client", client)

    movies = await downstream_client.list_all_movies(limit=2)
    assert movies == [{"id": 1, "title": "Movie 1"}, {"id": 2, "title": "Movie 2"}]
    assert client.urls[0].endswith("/api/movies")

    monkeypatch.setattr(
        downstream_client,
        "_client",
        FakeHttpClient(response=FakeResponse({}, status_code=503)),
    )
    assert await downstream_client.list_all_movies() == []

    monkeypatch.setattr(
        downstream_client,
        "_client",
        FakeHttpClient(exc=RuntimeError("network down")),
    )
    assert await downstream_client.list_all_movies() == []


@pytest.mark.asyncio
async def test_reindex_catalog_normal_upserts_and_prunes_removed(monkeypatch):
    movies = [
        {
            "id": 1,
            "title": "Inception",
            "genres": ["Sci-Fi", "Thriller"],
            "description": "Dream heist.",
            "ageRating": "T13",
        },
        {
            "id": 2,
            "title": "Interstellar",
            "genres": ["Sci-Fi", "Drama"],
            "description": "Wormhole journey.",
            "ageRating": "T13",
        },
    ]

    async def fake_list_all(limit: int = 500):
        return movies[:limit]

    async def fake_embed(text: str):
        return [0.1] * 768

    monkeypatch.setattr(downstream_client, "list_all_movies", fake_list_all)
    monkeypatch.setattr(llm_client, "embed", fake_embed)

    db = FakeIndexerSession(existing_ids=[1, 2, 99])
    summary = await catalog_indexer.reindex_catalog(db=db)

    assert summary == {"indexed": 2, "removed": 1, "skipped": 0}
    assert db.commits == 1

    upserts = [entry for entry in db.executed if "INSERT INTO movie_embeddings" in entry[0]]
    assert len(upserts) == 2
    assert [u[1]["movie_id"] for u in upserts] == [1, 2]

    deletes = [entry for entry in db.executed if "DELETE FROM movie_embeddings" in entry[0]]
    assert len(deletes) == 1
    assert "movie_id <> ALL(:ids)" in deletes[0][0]
    assert deletes[0][1]["ids"] == [1, 2]


@pytest.mark.asyncio
async def test_reindex_catalog_empty_catalog_never_deletes(monkeypatch):
    async def fake_list_all(limit: int = 500):
        return []

    monkeypatch.setattr(downstream_client, "list_all_movies", fake_list_all)

    db = FakeIndexerSession(existing_ids=[1, 2])
    summary = await catalog_indexer.reindex_catalog(db=db)

    assert summary == {"indexed": 0, "removed": 0, "skipped": 0}
    assert db.executed == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_reindex_catalog_skips_movies_without_id(monkeypatch):
    movies = [
        {"title": "Missing ID"},
        {"id": 10, "title": "Dune", "genres": ["Sci-Fi"], "description": "Arrakis", "ageRating": "T13"},
    ]

    async def fake_list_all(limit: int = 500):
        return movies

    async def fake_embed(text: str):
        return [0.2] * 768

    monkeypatch.setattr(downstream_client, "list_all_movies", fake_list_all)
    monkeypatch.setattr(llm_client, "embed", fake_embed)

    db = FakeIndexerSession(existing_ids=[10, 20])
    summary = await catalog_indexer.reindex_catalog(db=db)

    assert summary == {"indexed": 1, "removed": 1, "skipped": 1}
    assert db.commits == 1
    deletes = [entry for entry in db.executed if "DELETE FROM movie_embeddings" in entry[0]]
    assert len(deletes) == 1
    assert deletes[0][1]["ids"] == [10]

    # When all returned items lack an id, never wipe existing rows
    async def fake_list_only_invalid(limit: int = 500):
        return [{"title": "Still missing ID"}]

    monkeypatch.setattr(downstream_client, "list_all_movies", fake_list_only_invalid)
    db_invalid = FakeIndexerSession(existing_ids=[10, 20])
    summary_invalid = await catalog_indexer.reindex_catalog(db=db_invalid)
    assert summary_invalid == {"indexed": 0, "removed": 0, "skipped": 1}
    assert db_invalid.executed == []
    assert db_invalid.commits == 0


@pytest.mark.asyncio
async def test_reindex_catalog_list_error_never_deletes(monkeypatch):
    async def failing_list_all(limit: int = 500):
        raise RuntimeError("catalog service unavailable")

    monkeypatch.setattr(downstream_client, "list_all_movies", failing_list_all)

    db = FakeIndexerSession(existing_ids=[1, 2, 3])
    summary = await catalog_indexer.reindex_catalog(db=db)

    assert summary == {"indexed": 0, "removed": 0, "skipped": 0}
    assert db.executed == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_reindex_catalog_single_embed_failure_does_not_abort_others(monkeypatch):
    movies = [
        {"id": 1, "title": "First", "genres": ["Action"], "description": "One"},
        {"id": 2, "title": "Broken", "genres": ["Drama"], "description": "Two"},
        {"id": 3, "title": "Third", "genres": ["Comedy"], "description": "Three"},
    ]

    async def fake_list_all(limit: int = 500):
        return movies

    async def flaky_embed(text: str):
        if text.startswith("Broken"):
            raise RuntimeError("embedding timeout")
        return [0.3] * 768

    monkeypatch.setattr(downstream_client, "list_all_movies", fake_list_all)
    monkeypatch.setattr(llm_client, "embed", flaky_embed)

    db = FakeIndexerSession(existing_ids=[1, 2, 3, 99])
    summary = await catalog_indexer.reindex_catalog(db=db)

    assert summary == {"indexed": 2, "removed": 1, "skipped": 1}
    assert db.commits == 1
    upserts = [entry for entry in db.executed if "INSERT INTO movie_embeddings" in entry[0]]
    assert [u[1]["movie_id"] for u in upserts] == [1, 3]
    deletes = [entry for entry in db.executed if "DELETE FROM movie_embeddings" in entry[0]]
    assert deletes[0][1]["ids"] == [1, 2, 3]


@pytest.mark.asyncio
async def test_internal_reindex_endpoint_auth_and_safe_reindex(monkeypatch):
    with pytest.raises(HTTPException) as exc_default:
        await internal.reindex()
    assert exc_default.value.status_code == 403
    assert exc_default.value.detail == "Forbidden"

    with pytest.raises(HTTPException) as exc_missing:
        await internal.reindex(x_internal_token=None)
    assert exc_missing.value.status_code == 403

    with pytest.raises(HTTPException) as exc_wrong:
        await internal.reindex(x_internal_token="wrong-token")
    assert exc_wrong.value.status_code == 403

    async def fake_reindex_catalog(db=None):
        return {"indexed": 4, "removed": 1, "skipped": 0}

    monkeypatch.setattr(catalog_indexer, "reindex_catalog", fake_reindex_catalog)
    result = await internal.reindex(x_internal_token=settings.INTERNAL_API_TOKEN)
    assert result == {"indexed": 4, "removed": 1, "skipped": 0}

    async def failing_reindex():
        raise RuntimeError("boom")

    monkeypatch.setattr(main, "reindex_catalog", failing_reindex)
    await main._safe_reindex()

    if hasattr(main.app, "routes"):
        paths = {getattr(route, "path", None) for route in main.app.routes}
        assert "/internal/chat/reindex" in paths


def test_opt_date_parses_supported_formats_and_rejects_invalid():
    assert catalog_indexer._opt_date("2010-07-16") == date(2010, 7, 16)
    assert catalog_indexer._opt_date([2010, 7, 16]) == date(2010, 7, 16)
    assert catalog_indexer._opt_date(date(2010, 7, 16)) == date(2010, 7, 16)
    assert catalog_indexer._opt_date("not-a-date") is None
    assert catalog_indexer._opt_date(None) is None

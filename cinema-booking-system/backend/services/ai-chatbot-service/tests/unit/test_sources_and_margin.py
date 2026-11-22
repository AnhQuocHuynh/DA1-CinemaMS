import pytest

from app.schemas.chat import ChatResponse, SourceSchema
from app.services import downstream_client, intent_router, rag_service


class _FakeMappings:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return _FakeMappings(self._rows)


class _FakeDb:
    def __init__(self, rows=None, exc: Exception | None = None):
        self.rows = rows or []
        self.exc = exc
        self.last_stmt = ""
        self.last_params = {}

    async def execute(self, stmt, params=None):
        if self.exc is not None:
            raise self.exc
        self.last_stmt = str(stmt)
        self.last_params = params or {}
        return _FakeResult(self.rows)


def test_apply_relative_margin_normal_and_edge_cases():
    rows = [
        {"id": 1, "similarity": 0.92},
        {"id": 2, "similarity": 0.86},
        {"id": 3, "similarity": 0.80},
    ]
    kept = rag_service.apply_relative_margin(rows, 0.08)
    assert [r["id"] for r in kept] == [1, 2]

    # Edge cases: empty, single row, margin 0, negative margin
    assert rag_service.apply_relative_margin([], 0.08) == []
    assert rag_service.apply_relative_margin([rows[0]], 0.0) == [rows[0]]

    tied = [
        {"id": 1, "similarity": 0.90},
        {"id": 2, "similarity": 0.90},
        {"id": 3, "similarity": 0.89},
    ]
    assert [r["id"] for r in rag_service.apply_relative_margin(tied, 0.0)] == [1, 2]
    assert [r["id"] for r in rag_service.apply_relative_margin(tied, -0.5)] == [1, 2]


@pytest.mark.asyncio
async def test_search_applies_relative_margin():
    faq_db = _FakeDb(
        [
            {
                "id": 1,
                "category": "POLICY",
                "question": "Q1",
                "answer": "A1",
                "metadata": None,
                "similarity": 0.91,
            },
            {
                "id": 2,
                "category": "POLICY",
                "question": "Q2",
                "answer": "A2",
                "metadata": None,
                "similarity": 0.81,
            },
        ]
    )
    faqs = await rag_service.search_faqs([0.1, 0.2], limit=5, db=faq_db)
    assert [f["id"] for f in faqs] == [1]

    faqs_wider = await rag_service.search_faqs(
        [0.1, 0.2], limit=5, db=faq_db, relative_margin=0.15
    )
    assert [f["id"] for f in faqs_wider] == [1, 2]

    movie_db = _FakeDb(
        [
            {
                "movie_id": 10,
                "title": "Dune",
                "genres": "Sci-Fi",
                "synopsis": "Desert planet.",
                "age_rating": "T13",
                "similarity": 0.88,
            },
            {
                "movie_id": 11,
                "title": "Far Hit",
                "genres": "Drama",
                "synopsis": "Unrelated.",
                "age_rating": "P",
                "similarity": 0.70,
            },
        ]
    )
    movies = await rag_service.search_movies_vector([0.3, 0.4], limit=3, db=movie_db)
    assert [m["movie_id"] for m in movies] == [10]


@pytest.mark.asyncio
async def test_list_movie_titles_normal_and_error():
    db = _FakeDb([{"title": "Dune"}, {"title": "Inception"}, {"title": ""}])
    titles = await rag_service.list_movie_titles(db=db)
    assert titles == ["Dune", "Inception"]
    assert "SELECT title FROM movie_embeddings" in db.last_stmt
    assert db.last_params == {}

    failing_db = _FakeDb(exc=RuntimeError("db down"))
    assert await rag_service.list_movie_titles(db=failing_db) == []


def test_source_builders_and_snippet_clipping():
    long_answer = ("word " * 80).strip()  # 399 chars
    faqs = rag_service.faq_sources(
        [
            {
                "id": 42,
                "question": "What is the refund window?",
                "answer": long_answer,
                "similarity": 0.93,
            }
        ]
    )
    assert len(faqs) == 1
    assert faqs[0]["type"] == "faq"
    assert faqs[0]["id"] == 42
    assert faqs[0]["title"] == "What is the refund window?"
    assert faqs[0]["similarity"] == 0.93
    assert len(faqs[0]["snippet"]) <= 300
    assert faqs[0]["snippet"].endswith("word")

    movies = rag_service.movie_sources(
        [
            {
                "movie_id": 7,
                "title": "Avatar",
                "synopsis": "Short synopsis.",
                "similarity": 0.85,
            }
        ]
    )
    assert movies == [
        {
            "type": "movie",
            "id": 7,
            "title": "Avatar",
            "snippet": "Short synopsis.",
            "similarity": 0.85,
        }
    ]

    # Schema backward compatibility
    resp_default = ChatResponse(reply="Hello")
    assert resp_default.sources == []
    resp_with_sources = ChatResponse(
        reply="Hello",
        sources=[SourceSchema(**movies[0])],
    )
    assert resp_with_sources.sources[0].id == 7


@pytest.mark.asyncio
async def test_build_context_and_sources_faq_and_movie_paths(monkeypatch):
    async def fake_search_faqs(emb, limit=2, db=None):
        return [
            {
                "id": 3,
                "category": "REFUND",
                "question": "Refund policy?",
                "answer": "Cancel 60 minutes prior.",
                "similarity": 0.94,
            }
        ]

    monkeypatch.setattr(intent_router.rag_service, "search_faqs", fake_search_faqs)
    ctx, sources = await intent_router.build_context_and_sources(
        "CINEMA_FAQ", "refund", query_embedding=[0.1] * 4
    )
    assert ctx is not None and "Cancel 60 minutes prior." in ctx
    assert sources == [
        {
            "type": "faq",
            "id": 3,
            "title": "Refund policy?",
            "snippet": "Cancel 60 minutes prior.",
            "similarity": 0.94,
        }
    ]

    # Vector movie hit path
    async def fake_movies_vec_hit(emb, limit=3, db=None):
        return [
            {
                "movie_id": 9,
                "title": "Interstellar",
                "genres": "Sci-Fi",
                "synopsis": "Wormhole expedition.",
                "age_rating": "T13",
                "similarity": 0.89,
            }
        ]

    monkeypatch.setattr(intent_router.rag_service, "search_movies_vector", fake_movies_vec_hit)
    ctx, sources = await intent_router.build_context_and_sources(
        "MOVIE_QUERY", "Tell me about space movies", query_embedding=[0.1] * 4
    )
    assert ctx is not None and "Interstellar" in ctx
    assert sources == [
        {
            "type": "movie",
            "id": 9,
            "title": "Interstellar",
            "snippet": "Wormhole expedition.",
            "similarity": 0.89,
        }
    ]

    # Catalog fallback path when vector search returns empty
    async def fake_movies_vec_empty(emb, limit=3, db=None):
        return []

    async def fake_search_movies(keyword: str):
        return [
            {
                "id": 15,
                "title": "Avatar",
                "description": ("Pandora adventure " * 25).strip(),
            }
        ]

    monkeypatch.setattr(intent_router.rag_service, "search_movies_vector", fake_movies_vec_empty)
    monkeypatch.setattr(downstream_client, "search_movies", fake_search_movies)
    ctx, sources = await intent_router.build_context_and_sources(
        "MOVIE_QUERY", "Avatar", query_embedding=[0.1] * 4
    )
    assert ctx is not None and "Avatar" in ctx
    assert len(sources) == 1
    assert sources[0]["type"] == "movie"
    assert sources[0]["id"] == 15
    assert sources[0]["title"] == "Avatar"
    assert sources[0]["similarity"] is None
    assert len(sources[0]["snippet"]) <= 300
    assert sources[0]["snippet"].endswith("Pandora")

    # Showtime and other non-citation intents return empty sources
    async def fake_showtimes(movie_id=None, cinema_id=None):
        return [{"id": 501, "displayTitle": "Avatar", "startTime": "2026-11-17T18:00:00"}]

    monkeypatch.setattr(downstream_client, "get_today_showtimes", fake_showtimes)
    st_ctx, st_sources = await intent_router.build_context_and_sources(
        "SHOWTIME_QUERY", "Avatar", query_embedding=[0.1] * 4
    )
    assert st_ctx is not None
    assert st_sources == []

    other_ctx, other_sources = await intent_router.build_context_and_sources(
        "OFF_TOPIC", "Hello", query_embedding=[0.1] * 4
    )
    assert other_ctx is None
    assert other_sources == []

from datetime import date

import pytest

from app.services import rag_service
from scripts import seed_faqs as seed_script


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


class FakeRagSession:
    def __init__(self, rows):
        self.rows = rows
        self.last_stmt = ""
        self.last_params = {}

    async def execute(self, stmt, params=None):
        self.last_stmt = str(stmt)
        self.last_params = params or {}
        return _FakeResult(self.rows)


class FakeAsyncpgConn:
    def __init__(self, existing_questions: set[str] | None = None) -> None:
        self.existing = existing_questions or set()
        self.executed: list[tuple[str, tuple]] = []

    async def fetchval(self, query: str, question: str):
        if question in self.existing:
            return 1
        return None

    async def execute(self, query: str, *args):
        self.executed.append((query, args))


@pytest.mark.asyncio
async def test_search_faqs_returns_rows_and_handles_empty():
    assert await rag_service.search_faqs([]) == []

    db = FakeRagSession(
        [
            {
                "id": 1,
                "category": "REFUND",
                "question": "What is the refund policy?",
                "answer": "Cancel up to 60 minutes prior.",
                "metadata": {"cutoff_minutes": 60},
                "similarity": 0.91,
            }
        ]
    )
    results = await rag_service.search_faqs([0.1, 0.2], limit=2, db=db, threshold=0.8)
    assert len(results) == 1
    assert results[0]["category"] == "REFUND"
    assert results[0]["similarity"] == 0.91
    assert db.last_params["threshold"] == 0.8
    assert db.last_params["limit"] == 2


@pytest.mark.asyncio
async def test_search_movies_vector_and_format_context():
    db = FakeRagSession(
        [
            {
                "movie_id": 10,
                "title": "Inception",
                "genres": "Sci-Fi",
                "synopsis": "Dream heist",
                "age_rating": "T13",
                "director": "Christopher Nolan",
                "actors": "Leonardo DiCaprio",
                "imdb_rating": 8.8,
                "region": "USA",
                "release_date": date(2010, 7, 16),
                "language": "English",
                "duration_minutes": 148,
                "similarity": 0.88,
            }
        ]
    )
    movies = await rag_service.search_movies_vector([0.3, 0.4], limit=3, db=db)
    assert movies[0]["movie_id"] == 10
    assert movies[0]["title"] == "Inception"
    assert movies[0]["director"] == "Christopher Nolan"
    assert movies[0]["actors"] == "Leonardo DiCaprio"
    assert movies[0]["imdb_rating"] == 8.8
    assert movies[0]["region"] == "USA"
    assert movies[0]["release_date"] == "2010-07-16"
    assert movies[0]["language"] == "English"
    assert movies[0]["duration_minutes"] == 148

    formatted = rag_service.format_faq_context(
        [{"category": "REFUND", "question": "Refund?", "answer": "60 min cutoff."}]
    )
    assert "[REFUND] Q: Refund?\nA: 60 min cutoff." == formatted


@pytest.mark.asyncio
async def test_seed_faqs_inserts_and_updates_idempotently(monkeypatch):
    async def fake_embed(text: str) -> list[float]:
        return [0.01] * 768

    monkeypatch.setattr(seed_script.llm_client, "embed", fake_embed)

    first_question = seed_script.FAQS[0]["question"]
    conn = FakeAsyncpgConn(existing_questions={first_question})
    seeded = await seed_script.seed_faqs(conn=conn)

    assert seeded == len(seed_script.FAQS)
    assert seeded >= 8
    assert len(conn.executed) == len(seed_script.FAQS)
    assert "UPDATE faq_embeddings" in conn.executed[0][0]
    assert all("INSERT INTO faq_embeddings" in sql for sql, _ in conn.executed[1:])

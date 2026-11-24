CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chat_sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       BIGINT,
    keycloak_id   UUID,
    session_token VARCHAR(128),
    title         VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id                BIGSERIAL PRIMARY KEY,
    session_id        UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role              VARCHAR(16) NOT NULL,
    content           TEXT NOT NULL,
    tokens_prompt     INT,
    tokens_completion INT,
    cached            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS faq_embeddings (
    id         SERIAL PRIMARY KEY,
    category   VARCHAR(64),
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    embedding  vector(768),
    metadata   JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movie_embeddings (
    movie_id   BIGINT PRIMARY KEY,
    title      VARCHAR(255),
    genres     VARCHAR(255),
    synopsis   TEXT,
    age_rating VARCHAR(16),
    embedding  vector(768),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE movie_embeddings ADD COLUMN IF NOT EXISTS director         VARCHAR(200);
ALTER TABLE movie_embeddings ADD COLUMN IF NOT EXISTS actors           TEXT;
ALTER TABLE movie_embeddings ADD COLUMN IF NOT EXISTS imdb_rating      DOUBLE PRECISION;
ALTER TABLE movie_embeddings ADD COLUMN IF NOT EXISTS region           VARCHAR(255);
ALTER TABLE movie_embeddings ADD COLUMN IF NOT EXISTS release_date     DATE;
ALTER TABLE movie_embeddings ADD COLUMN IF NOT EXISTS language         VARCHAR(50);
ALTER TABLE movie_embeddings ADD COLUMN IF NOT EXISTS duration_minutes INT;

CREATE TABLE IF NOT EXISTS semantic_cache (
    id            BIGSERIAL PRIMARY KEY,
    query_hash    VARCHAR(64),
    query_text    TEXT,
    response_text TEXT NOT NULL,
    embedding     vector(768),
    hit_count     INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_faq_embeddings_hnsw ON faq_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_movie_embeddings_hnsw ON movie_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_hnsw ON semantic_cache USING hnsw (embedding vector_cosine_ops);


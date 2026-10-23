CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    email_normalized VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(512) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    disabled_at TIMESTAMPTZ
);

CREATE TABLE refresh_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id VARCHAR(36) NOT NULL,
    csrf_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX ix_refresh_sessions_user_expiry ON refresh_sessions(user_id, expires_at);

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES refresh_sessions(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE TABLE auth_attempts (
    id SERIAL PRIMARY KEY,
    fingerprint VARCHAR(64) NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_auth_attempts_fingerprint_time ON auth_attempts(fingerprint, attempted_at);

CREATE TABLE learner_profiles (
    user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    target_role VARCHAR(160),
    profile_data JSON NOT NULL DEFAULT '{}'::json,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE lesson_completions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(240) NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    title VARCHAR(500) NOT NULL,
    canonical_skills JSON NOT NULL DEFAULT '[]'::json,
    unmapped_skills JSON NOT NULL DEFAULT '[]'::json,
    evidence_sources JSON NOT NULL DEFAULT '[]'::json,
    learning_status VARCHAR(20) NOT NULL DEFAULT 'not_started',
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL,
    evidence_type VARCHAR(40) NOT NULL DEFAULT 'progress_status',
    CONSTRAINT ck_lesson_completion_status CHECK (
        learning_status IN ('not_started', 'in_progress', 'completed')
    ),
    CONSTRAINT ck_lesson_completion_item_type CHECK (
        item_type IN ('pathway_step', 'course')
    ),
    CONSTRAINT uq_lesson_completion_user_item UNIQUE(user_id, item_id)
);
CREATE INDEX ix_lesson_completions_user_status ON lesson_completions(user_id, completed_at);

CREATE TABLE roadmap_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    target_role VARCHAR(160) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    change_reason TEXT NOT NULL,
    payload JSON NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_roadmap_user_version UNIQUE(user_id, version)
);
CREATE INDEX ix_roadmap_user_active ON roadmap_snapshots(user_id, active);
CREATE UNIQUE INDEX uq_roadmap_one_active_per_user
    ON roadmap_snapshots(user_id) WHERE active;

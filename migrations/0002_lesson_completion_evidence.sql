ALTER TABLE lesson_completions
    ADD COLUMN IF NOT EXISTS evidence_sources JSON NOT NULL DEFAULT '[]'::json;

UPDATE lesson_completions
SET canonical_skills = '[]'::json,
    unmapped_skills = '[]'::json,
    evidence_sources = '[]'::json,
evidence_type = CASE
    WHEN learning_status = 'completed' THEN 'lesson_completed'
    ELSE 'progress_status'
END;

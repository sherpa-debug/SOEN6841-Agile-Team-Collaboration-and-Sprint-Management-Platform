-- Sync bookkeeping for SP-9 (GitHub commit and pull request sync). Run once after schema.sql:
--   psql -d sprintproof -f server/db/sync_state.sql
BEGIN;

CREATE TABLE IF NOT EXISTS sync_state (
    team_id BIGINT PRIMARY KEY REFERENCES team(id) ON DELETE CASCADE,
    last_sync_at TIMESTAMPTZ,
    pulls_etag TEXT,
    status TEXT NOT NULL DEFAULT 'never' CHECK (status IN ('never', 'ok', 'error')),
    last_error TEXT
);

COMMIT;

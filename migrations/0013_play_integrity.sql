CREATE TABLE IF NOT EXISTS play_integrity_seen (
  token_hash TEXT PRIMARY KEY,
  seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_play_integrity_seen_at
  ON play_integrity_seen (seen_at);

CREATE TABLE recovery_notices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  read_at TEXT
);

CREATE INDEX idx_recovery_notices_unread
  ON recovery_notices(user_id) WHERE read_at IS NULL;
